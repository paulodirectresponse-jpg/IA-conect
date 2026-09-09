import crypto from 'crypto';
import { PaymentRecord, PaymentMethod, WalletAccount, WalletTransaction } from '../../src/types/index.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

function cfg(){
 const token=process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
 if(!token){const e:any=new Error('Mercado Pago ainda não configurado.');e.code='PAYMENTS_NOT_CONFIGURED';throw e;}
 return{
  token,
  base:(process.env.MERCADOPAGO_BASE_URL||'https://api.mercadopago.com').replace(/\/$/,''),
  mode:String(process.env.MERCADOPAGO_MODE||'test').toLowerCase()==='production'?'production':'test'
 } as const;
}
function amountString(c:number){return (c/100).toFixed(2);}
function mapOrderStatus(status:string,statusDetail?:string){
 const s=String(status||'').toLowerCase();const d=String(statusDetail||'').toLowerCase();
 if(s==='processed'&&d==='accredited')return'CONFIRMED' as const;
 if(['failed','canceled','cancelled','refunded','charged_back'].includes(s))return'FAILED' as const;
 if(s==='expired')return'EXPIRED' as const;
 return'PENDING' as const;
}
function parseSig(v:string){const out:Record<string,string>={};v.split(',').forEach(part=>{const[k,val]=part.trim().split('=');if(k&&val)out[k]=val;});return out;}
function emptyWallet(userId:string):WalletAccount{return{account_id:userId,user_id:userId,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:new Date().toISOString()};}
function idemId(key:string){return crypto.createHash('sha256').update(key).digest('hex');}

async function getUserEmail(userId:string){const u=await firestoreAdminRest.get(`users/${encodeURIComponent(userId)}`);const email=String(u.data?.email||'').trim();if(!email)throw new Error('E-mail do usuário não encontrado.');return email;}

async function depositWalletOnce(userId:string,amount_cents:number,paymentInternalId:string,gatewayReference:string){
 const idempotencyKey=`mp-deposit:${gatewayReference}`;const idemPath=`wallet_idempotency/${idemId(idempotencyKey)}`;const existing=await firestoreAdminRest.get(idemPath);if(existing.exists)return{already:true};
 for(let attempt=0;attempt<3;attempt++){
  const accountPath=`wallet_accounts/${encodeURIComponent(userId)}`;const accountDoc=await firestoreAdminRest.get(accountPath);const current=(accountDoc.exists?accountDoc.data:emptyWallet(userId)) as WalletAccount;const now=new Date().toISOString();
  const next:WalletAccount={...current,available_balance_cents:Number(current.available_balance_cents||0)+amount_cents,total_balance_cents:Number(current.total_balance_cents||0)+amount_cents,total_deposited_cents:Number(current.total_deposited_cents||0)+amount_cents,reserved_balance_cents:Number(current.reserved_balance_cents||0),total_used_cents:Number(current.total_used_cents||0),updated_at:now};
  const txId=`tx_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;const tx:WalletTransaction={transaction_id:txId,user_id:userId,type:'DEPOSIT',amount_cents,status:'COMPLETED',description:`Recarga Pix Mercado Pago #${String(gatewayReference).slice(-6)}`,reference_type:'SYSTEM',reference_id:paymentInternalId,idempotency_key:idempotencyKey,created_at:now,created_by:'system'};
  const writes:any[]=[
   {update:{name:firestoreAdminRest.docName(accountPath),fields:firestoreAdminRest.fields(next)},currentDocument:accountDoc.exists?{updateTime:accountDoc.updateTime}:{exists:false}},
   {update:{name:firestoreAdminRest.docName(`wallet_transactions/${txId}`),fields:firestoreAdminRest.fields(tx)},currentDocument:{exists:false}},
   {update:{name:firestoreAdminRest.docName(idemPath),fields:firestoreAdminRest.fields({transaction_id:txId,user_id:userId,created_at:now})},currentDocument:{exists:false}},
  ];
  try{await firestoreAdminRest.commit(writes);return{already:false};}catch(e:any){const idem=await firestoreAdminRest.get(idemPath);if(idem.exists)return{already:true};if(attempt===2)throw e;}
 }
 return{already:false};
}

async function fetchOrder(orderId:string){
 const {token,base}=cfg();const r=await fetch(`${base}/v1/orders/${encodeURIComponent(orderId)}`,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});const text=await r.text();let body:any={};try{body=JSON.parse(text);}catch{}
 if(!r.ok)throw Object.assign(new Error(body?.message||body?.error||`Mercado Pago Orders HTTP ${r.status}`),{code:`MERCADOPAGO_ORDERS_HTTP_${r.status}`});
 return body;
}

async function applyOrderToPayment(order:any,payment:any){
 const internalId=String(order?.external_reference||payment.payment_id||'');if(!internalId)return payment;
 if(payment.gateway_order_id&&String(payment.gateway_order_id)!==String(order?.id||''))return payment;
 const tx=order?.transactions?.payments?.[0]||{};const nextStatus=mapOrderStatus(String(order?.status||tx?.status||''),String(order?.status_detail||tx?.status_detail||''));
 if(nextStatus==='CONFIRMED'&&payment.status!=='CONFIRMED'){
  await depositWalletOnce(payment.user_id,payment.amount_cents,internalId,String(tx?.id||order?.id||internalId));
  payment.confirmed_at=new Date().toISOString();
 }
 if(nextStatus==='FAILED')payment.failed_at=payment.failed_at||new Date().toISOString();
 payment.status=nextStatus;payment.gateway_status=String(order?.status||tx?.status||'');payment.gateway_status_detail=String(order?.status_detail||tx?.status_detail||'');payment.gateway_order_id=String(order?.id||payment.gateway_order_id||'');payment.gateway_payment_id=String(tx?.id||payment.gateway_payment_id||'');
 await firestoreAdminRest.set(`payments/${encodeURIComponent(internalId)}`,payment);return payment;
}

export const paymentService={
 isConfigured(){return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());},
 async createPayment(params:{userId:string;amount_cents:number;method:PaymentMethod}):Promise<PaymentRecord>{
  if(params.method!=='PIX')throw Object.assign(new Error('Neste MVP, recargas online estão habilitadas apenas via Pix.'),{code:'PAYMENT_METHOD_UNSUPPORTED'});
  if(!Number.isInteger(params.amount_cents)||params.amount_cents<500)throw new Error('Recarga mínima: R$ 5,00.');if(params.amount_cents>1000000)throw new Error('Recarga máxima por transação: R$ 10.000,00.');
  const {token,base,mode}=cfg();const realEmail=await getUserEmail(params.userId);const paymentId=`pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,idem=`mp-order:${paymentId}`;const amount=amountString(params.amount_cents);
  // Mercado Pago Orders test environment requires a test payer. APRO makes the
  // sandbox Pix transition automatically to approved, per the official test flow.
  const payer=mode==='test'?{email:'test_user_br@testuser.com',first_name:'APRO'}:{email:realEmail};
  const payload:any={type:'online',total_amount:amount,external_reference:paymentId,processing_mode:'automatic',transactions:{payments:[{amount,payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'PT30M'}]},payer};
  const response=await fetch(`${base}/v1/orders`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Idempotency-Key':idem},body:JSON.stringify(payload)});const text=await response.text();let body:any={};try{body=JSON.parse(text);}catch{}
  if(!response.ok)throw Object.assign(new Error(body?.message||body?.error||body?.cause?.[0]?.description||`Mercado Pago Orders HTTP ${response.status}`),{code:`MERCADOPAGO_ORDERS_HTTP_${response.status}`});
  const tx=body?.transactions?.payments?.[0]||{};const method=tx?.payment_method||{};const now=new Date().toISOString();const status=mapOrderStatus(String(body?.status||tx?.status||''),String(body?.status_detail||tx?.status_detail||''));
  const payment:any={payment_id:paymentId,user_id:params.userId,amount_cents:params.amount_cents,method:'PIX',status,pix_code:method.qr_code,pix_qr_code_base64:method.qr_code_base64,checkout_url:method.ticket_url,description:'Recarga de saldo via Pix',idempotency_key:`deposit:${paymentId}`,created_at:body?.created_date||now,expires_at:new Date(Date.now()+30*60000).toISOString(),confirmed_at:null,failed_at:null,gateway:'MERCADOPAGO',gateway_order_id:String(body?.id||''),gateway_payment_id:String(tx?.id||''),gateway_status:String(body?.status||tx?.status||'pending'),gateway_status_detail:String(body?.status_detail||tx?.status_detail||''),gateway_mode:mode};
  await firestoreAdminRest.set(`payments/${paymentId}`,payment);
  if(status==='CONFIRMED')return await applyOrderToPayment(body,payment) as PaymentRecord;
  return payment as PaymentRecord;
 },
 async getPayment(paymentId:string,userId:string):Promise<PaymentRecord|null>{
  const d=await firestoreAdminRest.get(`payments/${encodeURIComponent(paymentId)}`);if(!d.exists)return null;let p:any=d.data;if(p.user_id!==userId)return null;
  // Polling is a secondary reconciliation path: even if a webhook is delayed,
  // the wallet UI can confirm an Orders payment safely and idempotently.
  if(p.status==='PENDING'&&p.gateway_order_id){try{const order=await fetchOrder(String(p.gateway_order_id));p=await applyOrderToPayment(order,p);}catch(e:any){console.warn('[MercadoPagoOrdersPoll]',e?.message||e);}}
  return p as PaymentRecord;
 },
 async listUserPayments(userId:string):Promise<PaymentRecord[]>{const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'payments'}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],limit:50});return rows.map((r:any)=>r.data as PaymentRecord);},
 async confirmPayment(_paymentId?:string,_userId?:string){const e:any=new Error('Confirmação manual proibida. Aguarde o webhook verificado do Mercado Pago.');e.code='PAYMENT_CONFIRM_FORBIDDEN';throw e;},
 verifyWebhookSignature(headers:Record<string,any>,dataId:string){const secret=process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();if(!secret)return false;const sig=String(headers['x-signature']||''),requestId=String(headers['x-request-id']||'');const parsed=parseSig(sig),ts=parsed.ts,v1=parsed.v1;if(!ts||!v1)return false;const manifest=`id:${dataId};request-id:${requestId};ts:${ts};`;const expected=crypto.createHmac('sha256',secret).update(manifest).digest('hex');try{return crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(v1,'hex'));}catch{return false;}},
 async processWebhook(params:{headers:Record<string,any>;dataId:string;eventType?:string;action?:string}){
  if(!this.verifyWebhookSignature(params.headers,params.dataId))throw Object.assign(new Error('Assinatura de webhook inválida.'),{code:'INVALID_WEBHOOK_SIGNATURE'});
  const eventType=String(params.eventType||'').toLowerCase();
  // Orders is the source of truth for the new Checkout Transparente integration.
  if(eventType&&eventType!=='order')return{ignored:true,reason:`unsupported_event:${eventType}`};
  const order=await fetchOrder(params.dataId);const internalId=String(order?.external_reference||'');if(!internalId)return{ignored:true};const doc=await firestoreAdminRest.get(`payments/${encodeURIComponent(internalId)}`);if(!doc.exists)return{ignored:true};const payment:any=doc.data;if(payment.gateway_order_id&&String(payment.gateway_order_id)!==String(order.id))return{ignored:true};const updated=await applyOrderToPayment(order,payment);return{ignored:false,status:updated.status};
 }
};
