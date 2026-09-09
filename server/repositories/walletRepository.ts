import crypto from 'crypto';
import { WalletAccount, WalletTransaction } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

function empty(userId:string):WalletAccount{return {account_id:userId,user_id:userId,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:new Date().toISOString()};}
function idemId(key:string){return crypto.createHash('sha256').update(key).digest('hex');}
type Deltas={available:number;reserved:number;total:number;deposited?:number;used?:number};
const ACCOUNT_COLLECTION='wallet_accounts';
const TX_COLLECTION='wallet_transactions';
const LEGACY_ACCOUNT_COLLECTION='wallets';
const LEGACY_TX_COLLECTION='ledger';

export const walletRepository={
 async getAccount(userId:string):Promise<WalletAccount>{
  const current=await firestoreAdminRest.get(`${ACCOUNT_COLLECTION}/${encodeURIComponent(userId)}`);
  if(current.exists)return current.data as WalletAccount;
  const legacy=await firestoreAdminRest.get(`${LEGACY_ACCOUNT_COLLECTION}/${encodeURIComponent(userId)}`);
  if(legacy.exists){await firestoreAdminRest.set(`${ACCOUNT_COLLECTION}/${encodeURIComponent(userId)}`,legacy.data);return legacy.data as WalletAccount;}
  return empty(userId);
 },
 async saveAccount(account:WalletAccount){await firestoreAdminRest.set(`${ACCOUNT_COLLECTION}/${encodeURIComponent(account.user_id)}`,account);return account;},
 async getTransactionByIdempotencyKey(key:string):Promise<WalletTransaction|null>{
  const idem=await firestoreAdminRest.get(`wallet_idempotency/${idemId(key)}`);if(!idem.exists)return null;
  const txId=String(idem.data?.transaction_id||'');if(!txId)return null;
  return this.getTransactionById(txId);
 },
 async getTransactionById(id:string):Promise<WalletTransaction|null>{
  const doc=await firestoreAdminRest.get(`${TX_COLLECTION}/${encodeURIComponent(id)}`);if(doc.exists)return doc.data as WalletTransaction;
  const legacy=await firestoreAdminRest.get(`${LEGACY_TX_COLLECTION}/${encodeURIComponent(id)}`);return legacy.exists?legacy.data as WalletTransaction:null;
 },
 async applyTransaction(tx:WalletTransaction,deltas:Deltas):Promise<{transaction:WalletTransaction;account:WalletAccount}>{
  const idemPath=`wallet_idempotency/${idemId(tx.idempotency_key)}`;
  for(let attempt=0;attempt<3;attempt++){
   const existing=await firestoreAdminRest.get(idemPath);
   if(existing.exists){const ex=await this.getTransactionById(String(existing.data?.transaction_id||''));const account=await this.getAccount(tx.user_id);if(ex)return{transaction:ex,account};}
   const accountPath=`${ACCOUNT_COLLECTION}/${encodeURIComponent(tx.user_id)}`;
   let accountDoc=await firestoreAdminRest.get(accountPath);
   let current:WalletAccount;
   if(accountDoc.exists)current=accountDoc.data as WalletAccount;
   else{const legacy=await firestoreAdminRest.get(`${LEGACY_ACCOUNT_COLLECTION}/${encodeURIComponent(tx.user_id)}`);current=legacy.exists?legacy.data as WalletAccount:empty(tx.user_id);}
   const next:WalletAccount={...current,available_balance_cents:Number(current.available_balance_cents||0)+deltas.available,reserved_balance_cents:Number(current.reserved_balance_cents||0)+deltas.reserved,total_balance_cents:Number(current.total_balance_cents||0)+deltas.total,total_deposited_cents:Number(current.total_deposited_cents||0)+(deltas.deposited||0),total_used_cents:Number(current.total_used_cents||0)+(deltas.used||0),updated_at:new Date().toISOString()};
   if(next.available_balance_cents<0)throw Object.assign(new Error('Saldo disponível insuficiente.'),{code:'WALLET_INSUFFICIENT_FUNDS'});
   if(next.reserved_balance_cents<0)throw Object.assign(new Error('Reserva financeira inconsistente.'),{code:'WALLET_RESERVE_INVALID'});
   if(next.total_balance_cents<0)throw Object.assign(new Error('Saldo total não pode ficar negativo.'),{code:'WALLET_NEGATIVE_BALANCE'});
   const writes:any[]=[
    {update:{name:firestoreAdminRest.docName(accountPath),fields:firestoreAdminRest.fields(next)},currentDocument:accountDoc.exists?{updateTime:accountDoc.updateTime}:{exists:false}},
    {update:{name:firestoreAdminRest.docName(`${TX_COLLECTION}/${tx.transaction_id}`),fields:firestoreAdminRest.fields(tx)},currentDocument:{exists:false}},
    {update:{name:firestoreAdminRest.docName(idemPath),fields:firestoreAdminRest.fields({transaction_id:tx.transaction_id,user_id:tx.user_id,created_at:tx.created_at})},currentDocument:{exists:false}}
   ];
   try{await firestoreAdminRest.commit(writes);return{transaction:tx,account:next};}catch(e:any){const idem=await firestoreAdminRest.get(idemPath);if(idem.exists){const ex=await this.getTransactionById(String(idem.data?.transaction_id||''));const account=await this.getAccount(tx.user_id);if(ex)return{transaction:ex,account};}if(attempt===2)throw e;}
  }
  throw new Error('Falha ao aplicar transação da carteira.');
 },
 async recordTransaction(tx:WalletTransaction){const existing=await this.getTransactionByIdempotencyKey(tx.idempotency_key);if(existing)return existing;await firestoreAdminRest.commit([{update:{name:firestoreAdminRest.docName(`${TX_COLLECTION}/${tx.transaction_id}`),fields:firestoreAdminRest.fields(tx)},currentDocument:{exists:false}},{update:{name:firestoreAdminRest.docName(`wallet_idempotency/${idemId(tx.idempotency_key)}`),fields:firestoreAdminRest.fields({transaction_id:tx.transaction_id,user_id:tx.user_id})},currentDocument:{exists:false}}]);return tx;},
 async listTransactions(userId:string,options:{limit?:number;offset?:number}={}){const lim=Math.min(100,options.limit||20);let rows=await firestoreAdminRest.runQuery({from:[{collectionId:TX_COLLECTION}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],limit:lim});if(!rows.length)rows=await firestoreAdminRest.runQuery({from:[{collectionId:LEGACY_TX_COLLECTION}],where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},orderBy:[{field:{fieldPath:'created_at'},direction:'DESCENDING'}],limit:lim});const transactions=rows.map((r:any)=>r.data as WalletTransaction);return{transactions,total:transactions.length};},
 async computeBalanceFromLedger(userId:string){const account=await this.getAccount(userId);return{available_balance_cents:account.available_balance_cents,reserved_balance_cents:account.reserved_balance_cents,total_balance_cents:account.total_balance_cents,total_deposited_cents:account.total_deposited_cents,total_used_cents:account.total_used_cents};},
 async getTotalPlatformBalance(){const rows=await firestoreAdminRest.runQuery({from:[{collectionId:ACCOUNT_COLLECTION}]});return rows.reduce((s:number,r:any)=>s+Number(r.data?.total_balance_cents||0),0);},
 clearForTesting(){}
};
