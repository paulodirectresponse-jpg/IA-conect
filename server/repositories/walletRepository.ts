import crypto from 'crypto';
import { WalletAccount, WalletTransaction } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';

function db(){const d=getAdminDb();if(!d)throw new Error('Firestore Admin indisponível.');return d;}
function empty(userId:string):WalletAccount{return {account_id:userId,user_id:userId,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:new Date().toISOString()};}
function idemId(key:string){return crypto.createHash('sha256').update(key).digest('hex');}

type Deltas={available:number;reserved:number;total:number;deposited?:number;used?:number};
export const walletRepository={
  async getAccount(userId:string):Promise<WalletAccount>{const doc=await db().collection('wallets').doc(userId).get();return doc.exists?doc.data() as WalletAccount:empty(userId);},
  async saveAccount(account:WalletAccount){await db().collection('wallets').doc(account.user_id).set(account,{merge:true});return account;},
  async getTransactionByIdempotencyKey(key:string):Promise<WalletTransaction|null>{const idoc=await db().collection('wallet_idempotency').doc(idemId(key)).get();if(!idoc.exists)return null;const txId=String(idoc.data()?.transaction_id||'');if(!txId)return null;const tx=await db().collection('ledger').doc(txId).get();return tx.exists?tx.data() as WalletTransaction:null;},
  async getTransactionById(id:string):Promise<WalletTransaction|null>{const doc=await db().collection('ledger').doc(id).get();return doc.exists?doc.data() as WalletTransaction:null;},

  async applyTransaction(tx:WalletTransaction,deltas:Deltas):Promise<{transaction:WalletTransaction;account:WalletAccount}>{
    const database=db();const accountRef=database.collection('wallets').doc(tx.user_id);const ledgerRef=database.collection('ledger').doc(tx.transaction_id);const idemRef=database.collection('wallet_idempotency').doc(idemId(tx.idempotency_key));
    return database.runTransaction(async t=>{
      const [idemSnap,accountSnap]=await Promise.all([t.get(idemRef),t.get(accountRef)]);
      if(idemSnap.exists){const existingId=String(idemSnap.data()?.transaction_id||'');const ex=await t.get(database.collection('ledger').doc(existingId));return {transaction:ex.data() as WalletTransaction,account:(accountSnap.exists?accountSnap.data():empty(tx.user_id)) as WalletAccount};}
      const current=(accountSnap.exists?accountSnap.data():empty(tx.user_id)) as WalletAccount;
      const next:WalletAccount={...current,available_balance_cents:current.available_balance_cents+deltas.available,reserved_balance_cents:current.reserved_balance_cents+deltas.reserved,total_balance_cents:current.total_balance_cents+deltas.total,total_deposited_cents:current.total_deposited_cents+(deltas.deposited||0),total_used_cents:current.total_used_cents+(deltas.used||0),updated_at:new Date().toISOString()};
      if(next.available_balance_cents<0)throw Object.assign(new Error('Saldo disponível insuficiente.'),{code:'WALLET_INSUFFICIENT_FUNDS'});
      if(next.reserved_balance_cents<0)throw Object.assign(new Error('Reserva financeira inconsistente.'),{code:'WALLET_RESERVE_INVALID'});
      if(next.total_balance_cents<0)throw Object.assign(new Error('Saldo total não pode ficar negativo.'),{code:'WALLET_NEGATIVE_BALANCE'});
      t.create(ledgerRef,tx);t.create(idemRef,{transaction_id:tx.transaction_id,user_id:tx.user_id,created_at:tx.created_at});t.set(accountRef,next,{merge:true});return {transaction:tx,account:next};
    });
  },

  async recordTransaction(tx:WalletTransaction){const existing=await this.getTransactionByIdempotencyKey(tx.idempotency_key);if(existing)return existing;await db().collection('ledger').doc(tx.transaction_id).create(tx);await db().collection('wallet_idempotency').doc(idemId(tx.idempotency_key)).create({transaction_id:tx.transaction_id,user_id:tx.user_id});return tx;},
  async listTransactions(userId:string,options:{limit?:number;offset?:number}={}){const lim=Math.min(100,options.limit||20);const snap=await db().collection('ledger').where('user_id','==',userId).orderBy('created_at','desc').limit(lim).get();const transactions=snap.docs.map(d=>d.data() as WalletTransaction);return {transactions,total:transactions.length};},
  async computeBalanceFromLedger(userId:string){const account=await this.getAccount(userId);return {available_balance_cents:account.available_balance_cents,reserved_balance_cents:account.reserved_balance_cents,total_balance_cents:account.total_balance_cents,total_deposited_cents:account.total_deposited_cents,total_used_cents:account.total_used_cents};},
  async getTotalPlatformBalance(){const snap=await db().collection('wallets').get();return snap.docs.reduce((s,d)=>s+Number(d.data().total_balance_cents||0),0);},
  clearForTesting(){}
};
