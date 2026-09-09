import { collection, doc, getDoc, getDocs, limit as limitQuery, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { WalletAccount, WalletTransaction } from '../types/index.js';

function emptyWallet(userId:string):WalletAccount{
  return {
    account_id:userId,user_id:userId,currency:'BRL',available_balance_cents:0,reserved_balance_cents:0,
    total_balance_cents:0,total_deposited_cents:0,total_used_cents:0,updated_at:new Date().toISOString()
  } as WalletAccount;
}

export const walletService = {
  async getSummary(): Promise<WalletAccount> {
    const user=auth.currentUser; if(!user) throw new Error('Usuário não autenticado.');
    try{
      const snap=await getDoc(doc(db,'wallet_accounts',user.uid));
      return snap.exists() ? (snap.data() as WalletAccount) : emptyWallet(user.uid);
    }catch(err){
      console.warn('[WalletService] Unable to read wallet account; showing zero balance.',err);
      return emptyWallet(user.uid);
    }
  },

  async listTransactions(max = 20, offset = 0): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const user=auth.currentUser; if(!user) return {transactions:[],total:0};
    try{
      const q=query(collection(db,'wallet_transactions'),where('user_id','==',user.uid),orderBy('created_at','desc'),limitQuery(Math.min(100,max+offset)));
      const snap=await getDocs(q);
      const all=snap.docs.map(d=>d.data() as WalletTransaction);
      return {transactions:all.slice(offset,offset+max),total:all.length};
    }catch(err){
      console.warn('[WalletService] Unable to read ledger.',err);
      return {transactions:[],total:0};
    }
  },
};
