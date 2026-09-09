import crypto from 'crypto';
import { PaymentRecord, PaymentMethod, WalletAccount, WalletTransaction } from '../../src/types/index.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

function cfg(){const token=process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();if(!token){const e:any=new Error('Mercado Pago ainda não configurado.');e.code='PAYMENTS_NOT_CONFIGURED';throw e;}return{token,base:(process.env.MERCADOPAGO_BASE_URL||'https://api.mercadopago.com').replace(/\/$/,'')}}
function centsToAmount(c:number){return Number((c/100).toFixed(2));}
function mapStatus(status:string){if(status==='approved')return'CONFIRMED' as const;if(['cancelled','rejected'].includes(status))return'FAILED' as const;if(status==='expired')return'EXPIRED' as const;return'PENDING' as const;}
function parseSig(v:string){const out:Record<string,string>={};v.split(',').forEach(part=>{const[k,val]=part.trim().split('=');if(k&&val)out[k]=val;});return out;}
function emptyWallet(userId:string):WalletAccount{return{account_id:userId,user_id:userId,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:new Date().toISOString()};}
function idemId(key:string){return crypto.createHash('sha256').update(key).digest('hex');}

async function getUserEmail(userId:string){const u=await firestoreAdminRest.get(`users/${encodeURIComponent(userId)}`);const email=String(u.data?.email||'').trim();if(!email)throw new Error('E-mail do usuário não encontrado.');return email;}

async function depositWalletOnce(userId:string,amount_cents:number,paymentInternalId:string,gatewayPaymentId:string){
 const idempotencyKey=`mp-deposit:${gatewayPaymentId}`;const idemPath=`wallet_idempotency/${idemId(idempotencyKey)}`;const existing=await firestoreAdminRest.get(idemPath);if(existing.exists)return{already:true};
 for(let attempt=0;attempt<3;attempt++){
  const accountPath=`wallet_accounts/${encodeURIComponent(userId)}`;const accountDoc=await firestoreAdminRest.get(accountPath);const current=(accountDoc.exists?accountDoc.data:emptyWallet(userId)) as WalletAccount;const now=new Date().toISOString();
  const next:WalletAccount={...current,available_balance_cents:Number(current.available_balance_cents||0)+amount_cents,total_balance_cents:Number(current.total_balance_cents||0)+amount_cents,total_deposited_cents:Number(current.total_deposited_cents||0)+amount_cents,reserved_balance_cents:Number(current.reserved_balance_cents||0),total_used_cents:Number(current.total_used_cents||0),updated_at:now};
  const txId=`tx_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;const tx:WalletTransaction={transaction_id:txId,user_id:userId,type:'DEPOSIT',amount_cents,status:'COMPLETED',description:`Recarga Pix Mercado Pago #${String(gatewayPaymentId).slice(-6)}`,reference_type:'SYSTEM',reference_id:paymentInternalId,idempotency_key:idempotencyKey,created_at:now,created_by:'system'};
  const writes:any[]=[
   {update:{name:firestoreAdminRest.docName(accountPath),fields:firestoreAdminRest.fields(next)},currentDocument:accountDoc.exists?{updateTime:accountDoc.updateTime}:{exists:false}},
   {update:{name:firestoreAdminRest.docName(`wallet_transactions/${txId}`),fields:firestoreAdminRest.fields(tx)},currentDocument:{exists:false}},
   {update:{name:firestoreAdminRest.docName(idemPath),fields:firestoreAdminRest.fields({transaction_id:txId,user_id:userId,created_at:now})},currentDocument:{exists:false}},
  ];
  try{await firestoreAdminRest.commit(writes);return{already:false};}catch(e:any){const idem=await firestoreAdminRest.get(idemPath);if(idem.exists)return{already:true};if(attempt===2)throw e;}
 }
 return{already:false};
}

export const paymentService={
 isConfigured(){return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());},
 async createPayment(params:{userId:string;amount_cents:number;method:PaymentMethod}):Promise<PaymentRecord>{
  if(params.method!=='PIX')throw Object.assign(new Error('Neste MVP, recargas online estão habilitadas apenas via Pix.'),{code:'PAYMENT_METHOD_UNSUPPORTED'});if(!Number.isInteger(params.amount_cents)||params.amount_cents<500)throw new Error('Recarga mínima: R$ 5,00.');if(params.amount_cents>1000000)throw new Error('Recarga máxima por transação: R$ 10.000,00.');const {token,base}=cfg();const email=await getUserEmail(params.userId);
  const paymentId=`pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,idem=`mp-create:${paymentId}`,appUrl=process.env.APP_URL?.replace(/\/$/,'');const payload:any={transaction_amount:centsToAmount(params.amount_cents),description:'Recarga de saldo - IA Connect',payment_method_id:'pix',payer:{email},external_reference:paymentId};if(appUrl)payload.notification_url=`${appUrl}/api/payments/webhook`;
  const response=await fetch(`${base}/v1/payments`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-Idempotency-Key':idem},body:JSON.stringify(payload)});const text=await response.text();let body:any={};try{body=JSON.parse(text);}catch{}if(!response.ok)throw Object.assign(new Error(body?.message||`Mercado Pago HTTP ${response.status}`),{code:`MERCADOPAGO_HTTP_${response.status}`});
  const tx=body?.point_of_interaction?.transaction_data||{};const now=new Date().toISOString();const payment:any={payment_id:paymentId,user_id:params.userId,amount_cents:params.amount_cents,method:'PIX',status:mapStatus(String(body?.status||'pending')),pix_code:tx.qr_code,pix_qr_code_base64:tx.qr_code_base64,checkout_url:tx.ticket_url,description:'Recarga de saldo via Pix',idempotency_key:`deposit:${paymentId}`,created_at:body?.date_created||now,expires_at:body?.date_of_expiration||new Date(Date.now()+30*60000).toISOString(),confirmed_at:null,failed_at:null,gateway:'MERCADOPAGO',gateway_payment_id:String(body?.id||''),gateway_status:String(body?.status||'pending')};await firestoreAdminRest.set(`payments/${paymentId}`,payment);return payment as PaymentRecord;
 },
 async getPayment(paymentId:string,userId:string):Promise<PaymentRecord|null>{const d=await firestoreAdminRest.get(`payments/${encodeURIComponent(paymentId)}`);if(!d.exists)return null;const p=d.data as PaymentRecord;return p.user_id===userId?p:null;},
 async listUserPayments(userId:string):Promise<PaymentRecord[]>{const rows=await firestoreAdminRest.runQuery({from:[{collectionId:'payments'}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],limit:50});return rows.map((r:any)=>r.data as PaymentRecord);},
 async confirmPayment(_paymentId?:string,_userId?:string){const e:any=new Error('Confirmação manual proibida. Aguarde o webhook verificado do Mercado Pago.');e.code='PAYMENT_CONFIRM_FORBIDDEN';throw e;},
 verifyWebhookSignature(headers:Record<string,any>,dataId:string){const secret=process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();if(!secret)return false;const sig=String(headers['x-signature']||''),requestId=String(headers['x-request-id']||'');const parsed=parseSig(sig),ts=parsed.ts,v1=parsed.v1;if(!ts||!v1)return false;const manifest=`id:${dataId};request-id:${requestId};ts:${ts};`;const expected=crypto.createHmac('sha256',secret).update(manifest).digest('hex');try{return crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(v1,'hex'));}catch{return false;}},
 async processWebhook(params:{headers:Record<string,any>;dataId:string;eventType?:string;action?:string}){
  if(!this.verifyWebhookSignature(params.headers,params.dataId))throw Object.assign(new Error('Assinatura de webhook inválida.'),{code:'INVALID_WEBHOOK_SIGNATURE'});
  const eventType=String(params.eventType||'').toLowerCase();if(eventType&&eventType!=='payment')return{ignored:true,reason:`unsupported_event:${eventType}`};
  const {token,base}=cfg();const r=await fetch(`${base}/v1/payments/${encodeURIComponent(params.dataId)}`,{headers:{Authorization:`Bearer ${token}`}});const text=await r.text();let body:any={};try{body=JSON.parse(text);}catch{}if(!r.ok)throw new Error(`Falha ao consultar pagamento Mercado Pago (${r.status}).`);const internalId=String(body?.external_reference||'');if(!internalId)return{ignored:true};const doc=await firestoreAdminRest.get(`payments/${encodeURIComponent(internalId)}`);if(!doc.exists)return{ignored:true};const payment:any=doc.data;if(String(payment.gateway_payment_id)!==String(body.id))return{ignored:true};const status=mapStatus(String(body.status||''));
  if(status==='CONFIRMED'&&payment.status!=='CONFIRMED'){await depositWalletOnce(payment.user_id,payment.amount_cents,internalId,String(body.id));payment.confirmed_at=new Date().toISOString();}
  if(status==='FAILED')payment.failed_at=new Date().toISOString();payment.status=status;payment.gateway_status=String(body.status||'');await firestoreAdminRest.set(`payments/${internalId}`,payment);return{ignored:false,status};
 }
};
