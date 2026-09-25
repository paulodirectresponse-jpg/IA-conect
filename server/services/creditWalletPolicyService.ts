import crypto from 'crypto';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';

type Lot={credit_lot_id:string;user_id:string;source:string;available_credits:number;reserved_credits:number;expired_credits:number;expires_at:string|null;created_at:string;metadata?:Record<string,any>;[key:string]:any};
type VersionedLot=Lot&{__updateTime:string};
const ACCOUNT='credit_accounts',LOTS='credit_lots',TX='credit_transactions',IDEM='credit_idempotency';
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
const idemPath=(key:string)=>IDEM+'/'+hash(key);
const makeId=(prefix:string)=>prefix+'_'+Date.now()+'_'+crypto.randomBytes(5).toString('hex');

async function getAccountRaw(userId:string){return firestoreAdminRest.get(ACCOUNT+'/'+encodeURIComponent(userId));}
async function listLots(userId:string):Promise<VersionedLot[]>{
  const rows=await firestoreAdminRest.runQuery({from:[{collectionId:LOTS}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}}});
  return rows.map((row:any)=>({...row.data,__updateTime:String(row.updateTime)}) as VersionedLot);
}
async function already(key:string){return (await firestoreAdminRest.get(idemPath(key))).exists;}

async function expireLots(params:{userId:string;lots:Array<{lot:VersionedLot;credits:number}>;idempotencyKey:string;referenceType:string;referenceId:string;metadata?:Record<string,any>}){
  const amount=params.lots.reduce((sum,row)=>sum+row.credits,0);
  if(amount<=0)return{expired:0};
  if(await already(params.idempotencyKey))return{expired:0,duplicate:true};
  const accountDoc=await getAccountRaw(params.userId);
  if(!accountDoc.exists)return{expired:0};
  const current:any=accountDoc.data||{};
  const now=new Date().toISOString();
  const nextAccount={...current,available_credits:Math.max(0,Number(current.available_credits||0)-amount),total_credits:Math.max(0,Number(current.total_credits||0)-amount),total_expired_credits:Math.max(0,Number(current.total_expired_credits||0)+amount),updated_at:now};
  const allocations=params.lots.map(({lot,credits})=>({credit_lot_id:lot.credit_lot_id,credits,net_cash_value_per_credit_micros:Number(lot.net_cash_value_per_credit_micros||0),source:String(lot.source||''),expires_at:lot.expires_at||null}));
  const txId=makeId('ctx');
  const tx={transaction_id:txId,user_id:params.userId,type:'EXPIRE',amount_credits:amount,status:'COMPLETED',reference_type:params.referenceType,reference_id:params.referenceId,idempotency_key:params.idempotencyKey,lot_allocations:allocations,balance_after_credits:nextAccount.available_credits,created_at:now,metadata:params.metadata};
  await firestoreAdminRest.commit([
    {update:{name:firestoreAdminRest.docName(ACCOUNT+'/'+encodeURIComponent(params.userId)),fields:firestoreAdminRest.fields(nextAccount)},currentDocument:{updateTime:accountDoc.updateTime}},
    ...params.lots.map(({lot,credits})=>{const {__updateTime,...clean}=lot;const next={...clean,available_credits:Math.max(0,Number(lot.available_credits||0)-credits),expired_credits:Math.max(0,Number(lot.expired_credits||0)+credits)};return{update:{name:firestoreAdminRest.docName(LOTS+'/'+lot.credit_lot_id),fields:firestoreAdminRest.fields(next)},currentDocument:{updateTime:__updateTime}};}),
    {update:{name:firestoreAdminRest.docName(TX+'/'+txId),fields:firestoreAdminRest.fields(tx)},currentDocument:{exists:false}},
    {update:{name:firestoreAdminRest.docName(idemPath(params.idempotencyKey)),fields:firestoreAdminRest.fields({transaction_id:txId,user_id:params.userId,created_at:now})},currentDocument:{exists:false}},
  ]);
  return{expired:amount};
}

export const creditWalletPolicyService={
  rollover_multiplier:2,

  async sweepExpired(userId:string,nowMs=Date.now()){
    const lots=(await listLots(userId)).filter(lot=>Number(lot.available_credits||0)>0&&lot.expires_at&&Date.parse(String(lot.expires_at))<=nowMs);
    if(!lots.length)return{expired:0};
    const signature=lots.map(lot=>lot.credit_lot_id+':'+lot.available_credits).sort().join('|');
    return expireLots({userId,lots:lots.map(lot=>({lot,credits:Number(lot.available_credits||0)})),idempotencyKey:'credit-expiry-sweep:'+userId+':'+hash(signature),referenceType:'EXPIRATION',referenceId:new Date(nowMs).toISOString(),metadata:{reason:'LOT_EXPIRED'}});
  },

  async enforceSubscriptionRolloverCap(params:{userId:string;incomingCredits:number;monthlyCredits:number;invoiceId:string;planId:string}){
    const cap=Math.max(0,Math.floor(params.monthlyCredits*this.rollover_multiplier));
    const allowedBefore=Math.max(0,cap-Math.max(0,Math.floor(params.incomingCredits)));
    const recurring=(await listLots(params.userId)).filter(lot=>Number(lot.available_credits||0)>0&&lot.source==='PURCHASE'&&lot.metadata?.recurring===true).sort((a,b)=>Date.parse(String(a.created_at||0))-Date.parse(String(b.created_at||0)));
    const availableBefore=recurring.reduce((sum,lot)=>sum+Number(lot.available_credits||0),0);
    let excess=Math.max(0,availableBefore-allowedBefore);
    const selected:Array<{lot:VersionedLot;credits:number}>=[];
    for(const lot of recurring){if(excess<=0)break;const credits=Math.min(excess,Number(lot.available_credits||0));if(credits>0){selected.push({lot,credits});excess-=credits;}}
    const result=await expireLots({userId:params.userId,lots:selected,idempotencyKey:'subscription-rollover:'+params.invoiceId,referenceType:'SUBSCRIPTION_ROLLOVER',referenceId:params.invoiceId,metadata:{reason:'ROLLOVER_CAP',plan_id:params.planId,rollover_multiplier:this.rollover_multiplier,cap_credits:cap,incoming_credits:params.incomingCredits}});
    return{...result,cap_credits:cap,available_before:availableBefore,allowed_before:allowedBefore};
  },

  async summary(userId:string){
    await this.sweepExpired(userId);
    const [accountDoc,lots]=await Promise.all([getAccountRaw(userId),listLots(userId)]);
    const account:any=accountDoc.exists?accountDoc.data:{};
    const usable=lots.filter(lot=>Number(lot.available_credits||0)>0&&(!lot.expires_at||Date.parse(String(lot.expires_at))>Date.now()));
    const subscription_credits=usable.filter(lot=>lot.source==='PURCHASE'&&lot.metadata?.recurring===true).reduce((s,l)=>s+Number(l.available_credits||0),0);
    const promotional_credits=usable.filter(lot=>lot.source==='PROMOTION').reduce((s,l)=>s+Number(l.available_credits||0),0);
    const other_credits=Math.max(0,Number(account.available_credits||0)-subscription_credits-promotional_credits);
    const expirations=usable.map(l=>l.expires_at).filter(Boolean).map(String).sort();
    return{available_credits:Math.max(0,Number(account.available_credits||0)),reserved_credits:Math.max(0,Number(account.reserved_credits||0)),subscription_credits,promotional_credits,other_credits,nearest_expiration_at:expirations[0]||null,rollover_multiplier:this.rollover_multiplier};
  },
};
