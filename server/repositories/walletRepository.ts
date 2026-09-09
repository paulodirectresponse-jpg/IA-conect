import crypto from 'crypto';
import { WalletAccount, WalletTransaction } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';

function db(){const d=getAdminDb();if(!d)throw new Error('Firestore Admin indisponível.');return d;}
function empty(userId:string):WalletAccount{return {account_id:userId,user_id:userId,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:new Date().toISOString()};}
function idemId(key:string){return crypto.createHash('sha256').update(key).digest('hex');}

type Deltas={available:number;reserved:number;total:number;deposited?:number;used?:number};

const ACCOUNT_COLLECTION='wallet_accounts';
const TX_COLLECTION='wallet_transactions';
const LEGACY_ACCOUNT_COLLECTION='wallets';
const LEGACY_TX_COLLECTION='ledger';

export const walletRepository={
  async getAccount(userId:string):Promise<WalletAccount>{
    const database=db();
    const current=await database.collection(ACCOUNT_COLLECTION).doc(userId).get();
    if(current.exists)return current.data() as WalletAccount;
    const legacy=await database.collection(LEGACY_ACCOUNT_COLLECTION).doc(userId).get();
    if(legacy.exists){
      const account=legacy.data() as WalletAccount;
      await database.collection(ACCOUNT_COLLECTION).doc(userId).set(account,{merge:true});
      return account;
    }
    return empty(userId);
  },
  async saveAccount(account:WalletAccount){await db().collection(ACCOUNT_COLLECTION).doc(account.user_id).set(account,{merge:true});return account;},
  async getTransactionByIdempotencyKey(key:string):Promise<WalletTransaction|null>{
    const database=db(); const idoc=await database.collection('wallet_idempotency').doc(idemId(key)).get();
    if(!idoc.exists)return null; const txId=String(idoc.data()?.transaction_id||''); if(!txId)return null;
    const tx=await database.collection(TX_COLLECTION).doc(txId).get();
    if(tx.exists)return tx.data() as WalletTransaction;
    const legacy=await database.collection(LEGACY_TX_COLLECTION).doc(txId).get();
    return legacy.exists?legacy.data() as WalletTransaction:null;
  },
  async getTransactionById(id:string):Promise<WalletTransaction|null>{const database=db();const doc=await database.collection(TX_COLLECTION).doc(id).get();if(doc.exists)return doc.data() as WalletTransaction;const legacy=await database.collection(LEGACY_TX_COLLECTION).doc(id).get();return legacy.exists?legacy.data() as WalletTransaction:null;},

  async applyTransaction(tx:WalletTransaction,deltas:Deltas):Promise<{transaction:WalletTransaction;account:WalletAccount}>{
    const database=db();const accountRef=database.collection(ACCOUNT_COLLECTION).doc(tx.user_id);const ledgerRef=database.collection(TX_COLLECTION).doc(tx.transaction_id);const idemRef=database.collection('wallet_idempotency').doc(idemId(tx.idempotency_key));
    return database.runTransaction(async t=>{
      const [idemSnap,accountSnap]=await Promise.all([t.get(idemRef),t.get(accountRef)]);
      if(idemSnap.exists){const existingId=String(idemSnap.data()?.transaction_id||'');const ex=await t.get(database.collection(TX_COLLECTION).doc(existingId));return {transaction:ex.data() as WalletTransaction,account:(accountSnap.exists?accountSnap.data():empty(tx.user_id)) as WalletAccount};}
      let current=(accountSnap.exists?accountSnap.data():null) as WalletAccount|null;
      if(!current){const legacySnap=await t.get(database.collection(LEGACY_ACCOUNT_COLLECTION).doc(tx.user_id));current=(legacySnap.exists?legacySnap.data():empty(tx.user_id)) as WalletAccount;}
      const next:WalletAccount={...current,available_balance_cents:current.available_balance_cents+deltas.available,reserved_balance_cents:current.reserved_balance_cents+deltas.reserved,total_balance_cents:current.total_balance_cents+deltas.total,total_deposited_cents:current.total_deposited_cents+(deltas.deposited||0),total_used_cents:current.total_used_cents+(deltas.used||0),updated_at:new Date().toISOString()};
      if(next.available_balance_cents<0)throw Object.assign(new Error('Saldo disponível insuficiente.'),{code:'WALLET_INSUFFICIENT_FUNDS'});
      if(next.reserved_balance_cents<0)throw Object.assign(new Error('Reserva financeira inconsistente.'),{code:'WALLET_RESERVE_INVALID'});
      if(next.total_balance_cents<0)throw Object.assign(new Error('Saldo total não pode ficar negativo.'),{code:'WALLET_NEGATIVE_BALANCE'});
      t.create(ledgerRef,tx);t.create(idemRef,{transaction_id:tx.transaction_id,user_id:tx.user_id,created_at:tx.created_at});t.set(accountRef,next,{merge:true});return {transaction:tx,account:next};
    });
  },

  async recordTransaction(tx:WalletTransaction){const existing=await this.getTransactionByIdempotencyKey(tx.idempotency_key);if(existing)return existing;await db().collection(TX_COLLECTION).doc(tx.transaction_id).create(tx);await db().collection('wallet_idempotency').doc(idemId(tx.idempotency_key)).create({transaction_id:tx.transaction_id,user_id:tx.user_id});return tx;},
  async listTransactions(userId:string,options:{limit?:number;offset?:number}={}){const lim=Math.min(100,options.limit||20);const database=db();const snap=await database.collection(TX_COLLECTION).where('user_id','==',userId).orderBy('created_at','desc').limit(lim).get();if(!snap.empty){const transactions=snap.docs.map(d=>d.data() as WalletTransaction);return {transactions,total:transactions.length};}const legacy=await database.collection(LEGACY_TX_COLLECTION).where('user_id','==',userId).orderBy('created_at','desc').limit(lim).get();const transactions=legacy.docs.map(d=>d.data() as WalletTransaction);return {transactions,total:transactions.length};},
  async computeBalanceFromLedger(userId:string){const account=await this.getAccount(userId);return {available_balance_cents:account.available_balance_cents,reserved_balance_cents:account.reserved_balance_cents,total_balance_cents:account.total_balance_cents,total_deposited_cents:account.total_deposited_cents,total_used_cents:account.total_used_cents};},
  async getTotalPlatformBalance(){const snap=await db().collection(ACCOUNT_COLLECTION).get();return snap.docs.reduce((s,d)=>s+Number(d.data().total_balance_cents||0),0);},
  clearForTesting(){}
};
