import crypto from 'crypto';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { packCatalogService, PackVersion } from './packCatalogService.js';
import { creditWalletService } from './creditWalletService.js';
import { creditWalletPolicyService } from './creditWalletPolicyService.js';

export type SubscriptionStatus='PENDING'|'ACTIVE'|'PAUSED'|'CANCELED'|'FAILED';

export interface UserSubscription {
  subscription_id:string;
  user_id:string;
  email:string;
  pack_id:string;
  pack_version:number;
  plan_name:string;
  price_brl_cents:number;
  monthly_credits:number;
  status:SubscriptionStatus;
  gateway:'MERCADOPAGO';
  gateway_subscription_id:string;
  checkout_url?:string;
  next_payment_date?:string|null;
  pending_plan_change?:{pack_id:string;pack_version:number;plan_name:string;price_brl_cents:number;monthly_credits:number}|null;
  created_at:string;
  updated_at:string;
  canceled_at?:string|null;
  checkout_expires_at?:string|null;
}

const COLLECTION='subscriptions',POINTERS='user_subscriptions';
export const SUBSCRIPTION_CHECKOUT_TTL_MS=30*60*1000;
const checkoutExpiresAt=(createdAt:string)=>new Date(Date.parse(createdAt)+SUBSCRIPTION_CHECKOUT_TTL_MS).toISOString();
const isPendingCheckoutExpired=(subscription:UserSubscription,nowMs=Date.now())=>subscription.status==='PENDING'&&Date.parse(subscription.checkout_expires_at||checkoutExpiresAt(subscription.created_at))<=nowMs;
const cfg=()=>{
  const token=process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if(!token)throw Object.assign(new Error('Mercado Pago ainda não configurado.'),{code:'PAYMENTS_NOT_CONFIGURED'});
  return{token,base:(process.env.MERCADOPAGO_BASE_URL||'https://api.mercadopago.com').replace(/\/$/,'')};
};
const appUrl=()=>String(process.env.PUBLIC_APP_URL||process.env.APP_URL||'https://iaconnect.ia.br').replace(/\/$/,'');
const headers=()=>({Authorization:`Bearer ${cfg().token}`,Accept:'application/json','Content-Type':'application/json'});
const statusMap=(status:string):SubscriptionStatus=>{
  const s=String(status||'').toLowerCase();
  if(s==='authorized')return'ACTIVE';
  if(s==='paused')return'PAUSED';
  if(s==='cancelled'||s==='canceled')return'CANCELED';
  if(s==='pending')return'PENDING';
  return'FAILED';
};
async function mp(path:string,init:RequestInit={}){
  const {base}=cfg();
  const response=await fetch(`${base}${path}`,{...init,headers:{...headers(),...(init.headers||{})}});
  const text=await response.text();let body:any={};try{body=text?JSON.parse(text):{};}catch{}
  if(!response.ok)throw Object.assign(new Error(body?.message||body?.error||`Mercado Pago HTTP ${response.status}`),{code:`MERCADOPAGO_HTTP_${response.status}`,status:response.status});
  return body;
}
async function getPointer(userId:string){
  const row=await firestoreAdminRest.get(`${POINTERS}/${encodeURIComponent(userId)}`);
  return row.exists?row.data as {subscription_id:string}:null;
}
async function getLocal(id:string){
  const row=await firestoreAdminRest.get(`${COLLECTION}/${encodeURIComponent(id)}`);
  return row.exists?row.data as UserSubscription:null;
}
async function saveLocal(record:UserSubscription){
  await firestoreAdminRest.set(`${COLLECTION}/${encodeURIComponent(record.subscription_id)}`,record);
  await firestoreAdminRest.set(`${POINTERS}/${encodeURIComponent(record.user_id)}`,{subscription_id:record.subscription_id,updated_at:new Date().toISOString()});
  return record;
}
function verifySignature(headersIn:Record<string,any>,dataId:string){
  const secret=process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();if(!secret)return false;
  const sig=String(headersIn['x-signature']||''),requestId=String(headersIn['x-request-id']||'');
  const parsed:Record<string,string>={};sig.split(',').forEach(part=>{const[k,v]=part.trim().split('=');if(k&&v)parsed[k]=v;});
  const ts=parsed.ts,v1=parsed.v1;if(!ts||!v1)return false;
  const expected=crypto.createHmac('sha256',secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest('hex');
  try{return crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(v1,'hex'));}catch{return false;}
}
async function syncFromGateway(local:UserSubscription){
  const remote=await mp(`/preapproval/${encodeURIComponent(local.gateway_subscription_id)}`);
  const now=new Date().toISOString();
  const next:UserSubscription={...local,status:statusMap(remote.status),checkout_url:String(remote.init_point||local.checkout_url||''),next_payment_date:remote.next_payment_date||null,updated_at:now};
  await saveLocal(next);return next;
}
async function cancelGateway(id:string){return mp(`/preapproval/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({status:'canceled'})});}
function packSnapshot(pack:PackVersion){return{pack_id:pack.pack_id,pack_version:pack.version,plan_name:pack.name,price_brl_cents:pack.price_brl_cents,monthly_credits:pack.total_credits};}

export const subscriptionService={
  async getCurrent(userId:string,{sync=true}={}){
    const pointer=await getPointer(userId);if(!pointer)return null;
    const local=await getLocal(pointer.subscription_id);if(!local)return null;
    if(local.status==='CANCELED')return local;
    let current=local;
    if(sync){
      try{current=await syncFromGateway(local);}catch{current=local;}
    }
    if(isPendingCheckoutExpired(current)){
      await cancelGateway(current.gateway_subscription_id).catch(()=>{});
      const now=new Date().toISOString();
      return saveLocal({...current,status:'CANCELED',checkout_url:'',canceled_at:now,updated_at:now,checkout_expires_at:current.checkout_expires_at||checkoutExpiresAt(current.created_at)});
    }
    return current;
  },

  async createCheckout(params:{userId:string;email:string;packId:string;packVersion:number}){
    const pack=packCatalogService.get(params.packId,params.packVersion);
    if(!pack)throw Object.assign(new Error('Plano comercial inválido ou desatualizado.'),{code:'PLAN_VERSION_STALE'});
    const current=await this.getCurrent(params.userId,{sync:true});
    if(current?.status==='ACTIVE')throw Object.assign(new Error('Você já possui uma assinatura ativa. Use a troca de plano.'),{code:'SUBSCRIPTION_ALREADY_ACTIVE'});
    if(current?.status==='PENDING'&&current.pack_id===pack.pack_id&&current.checkout_url)return current;
    if(current?.status==='PENDING')await cancelGateway(current.gateway_subscription_id).catch(()=>{});

    const externalReference=`iac-sub:${params.userId}:${pack.pack_id}:${pack.version}:${Date.now()}`;
    const remote=await mp('/preapproval',{method:'POST',body:JSON.stringify({
      reason:`IA Connect ${pack.name}`,
      external_reference:externalReference,
      payer_email:params.email,
      auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:Number((pack.price_brl_cents/100).toFixed(2)),currency_id:'BRL'},
      back_url:`${appUrl()}/?subscription=return`,
      status:'pending',
    })});
    const now=new Date().toISOString();
    const local:UserSubscription={
      subscription_id:String(remote.id),user_id:params.userId,email:params.email,...packSnapshot(pack),
      status:statusMap(remote.status),gateway:'MERCADOPAGO',gateway_subscription_id:String(remote.id),
      checkout_url:String(remote.init_point||''),next_payment_date:remote.next_payment_date||null,pending_plan_change:null,
      created_at:now,updated_at:now,canceled_at:null,checkout_expires_at:new Date(Date.now()+SUBSCRIPTION_CHECKOUT_TTL_MS).toISOString(),
    };
    await saveLocal(local);return local;
  },

  async requestPlanChange(userId:string,packId:string,packVersion:number){
    const pack=packCatalogService.get(packId,packVersion);if(!pack)throw Object.assign(new Error('Plano inválido.'),{code:'PLAN_VERSION_STALE'});
    const current=await this.getCurrent(userId,{sync:true});
    if(!current||current.status!=='ACTIVE')throw Object.assign(new Error('Assinatura ativa não encontrada.'),{code:'SUBSCRIPTION_NOT_ACTIVE'});
    if(current.pack_id===pack.pack_id&&current.pack_version===pack.version)return current;
    await mp(`/preapproval/${encodeURIComponent(current.gateway_subscription_id)}`,{method:'PUT',body:JSON.stringify({
      reason:`IA Connect ${pack.name}`,
      auto_recurring:{transaction_amount:Number((pack.price_brl_cents/100).toFixed(2)),currency_id:'BRL'},
    })});
    const next={...current,pending_plan_change:packSnapshot(pack),updated_at:new Date().toISOString()};
    return saveLocal(next);
  },

  async cancel(userId:string){
    const current=await this.getCurrent(userId,{sync:true});
    if(!current||current.status==='CANCELED')return current;
    await cancelGateway(current.gateway_subscription_id);
    const now=new Date().toISOString();
    return saveLocal({...current,status:'CANCELED',canceled_at:now,updated_at:now,pending_plan_change:null});
  },

  async processWebhook(params:{headers:Record<string,any>;dataId:string;eventType:string}){
    if(!verifySignature(params.headers,params.dataId))throw Object.assign(new Error('Assinatura do webhook inválida.'),{code:'INVALID_WEBHOOK_SIGNATURE'});
    if(params.eventType==='subscription_preapproval'){
      const local=await getLocal(params.dataId);if(!local)return{ignored:true};
      return{subscription:await syncFromGateway(local)};
    }
    if(params.eventType==='subscription_authorized_payment'){
      const invoice=await mp(`/authorized_payments/${encodeURIComponent(params.dataId)}`);
      const subscriptionId=String(invoice.preapproval_id||'');if(!subscriptionId)return{ignored:true};
      const local=await getLocal(subscriptionId);if(!local)return{ignored:true};
      const approved=String(invoice?.payment?.status||'').toLowerCase()==='approved'&&String(invoice?.payment?.status_detail||'').toLowerCase()==='accredited';
      if(!approved)return{ignored:true,status:invoice?.payment?.status||invoice?.status};
      const target=local.pending_plan_change||packSnapshot(packCatalogService.get(local.pack_id,local.pack_version)||({pack_id:local.pack_id,version:local.pack_version,name:local.plan_name,price_brl_cents:local.price_brl_cents,total_credits:local.monthly_credits} as any));
      const invoiceId=String(invoice.id);
      const reservePct=Math.min(.5,Math.max(0,Number(process.env.CREDIT_CASH_RESERVE_PERCENT||8)/100));
      const netBackingMicros=Math.floor(Number(target.price_brl_cents||0)*10000*(1-reservePct));
      await creditWalletService.issue({
        userId:local.user_id,credits:Number(target.monthly_credits),source:'PURCHASE',
        idempotencyKey:`subscription-invoice:${invoiceId}`,referenceId:invoiceId,paymentId:`subscription:${invoiceId}`,
        packId:String(target.pack_id),packVersion:Number(target.pack_version),netCashBackingMicros:netBackingMicros,
        metadata:{subscription_id:subscriptionId,invoice_id:invoiceId,plan_name:target.plan_name,recurring:true,gateway:'MERCADOPAGO',rollover_multiplier:creditWalletPolicyService.rollover_multiplier},
      });
      const rollover=await creditWalletPolicyService.enforceSubscriptionRolloverCap({userId:local.user_id,incomingCredits:0,monthlyCredits:Number(target.monthly_credits),invoiceId,planId:String(target.pack_id)});
      const remote=await mp(`/preapproval/${encodeURIComponent(subscriptionId)}`);
      const next:UserSubscription={...local,pack_id:String(target.pack_id),pack_version:Number(target.pack_version),plan_name:String(target.plan_name),price_brl_cents:Number(target.price_brl_cents),monthly_credits:Number(target.monthly_credits),status:statusMap(remote.status),next_payment_date:remote.next_payment_date||null,pending_plan_change:null,updated_at:new Date().toISOString()};
      await saveLocal(next);
      return{subscription:next,credits_issued:Number(target.monthly_credits),rollover_expired:Number(rollover.expired||0),rollover_cap_credits:Number(rollover.cap_credits||0),invoice_id:invoiceId};
    }
    return{ignored:true};
  },
};
