import crypto from 'crypto';
import { walletRepository } from '../repositories/walletRepository.js';
import { WalletAccount, WalletTransaction, TransactionType } from '../../src/types/index.js';

function makeTx(userId:string,type:TransactionType,amount:number,referenceId:string,idempotency:string,description:string,createdBy='system'):WalletTransaction{return {transaction_id:`tx_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,user_id:userId,type,amount_cents:amount,status:'COMPLETED',description,reference_type:type.startsWith('GENERATION_')||type==='REFUND'?'GENERATION':'SYSTEM',reference_id:referenceId,idempotency_key:idempotency,created_at:new Date().toISOString(),created_by:createdBy};}
function legacyWriteDisabled():never{throw Object.assign(new Error('A carteira BRL é somente histórica. Use o Credit Ledger para novas operações.'),{code:'LEGACY_WALLET_WRITE_DISABLED'});}
export const walletService={
  async getSummary(userId:string):Promise<WalletAccount>{return walletRepository.getAccount(userId);},
  async listTransactions(userId:string,options:any={}){return walletRepository.listTransactions(userId,options);},
  async adjustBalance(_params:{adminId:string;adminEmail:string;targetUserId:string;type:'ADMIN_CREDIT'|'ADMIN_DEBIT';amount_cents:number;reason:string;idempotency_key:string}){return legacyWriteDisabled();},
  async reserveForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;description?:string}){if(!Number.isInteger(p.amount_cents)||p.amount_cents<=0)throw new Error('Reserva inválida.');const tx=makeTx(p.userId,'GENERATION_RESERVE',p.amount_cents,p.generation_id,p.idempotency_key,p.description||`Reserva para geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:-p.amount_cents,reserved:p.amount_cents,total:0});},
  async captureForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;description?:string}){const tx=makeTx(p.userId,'GENERATION_CAPTURE',p.amount_cents,p.generation_id,p.idempotency_key,p.description||`Cobrança geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:0,reserved:-p.amount_cents,total:-p.amount_cents,used:p.amount_cents});},
  async releaseForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;reason?:string}){const tx=makeTx(p.userId,'GENERATION_RELEASE',p.amount_cents,p.generation_id,p.idempotency_key,p.reason||`Liberação geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:p.amount_cents,reserved:-p.amount_cents,total:0});},
  async refundForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;reason?:string}){const tx=makeTx(p.userId,'REFUND',p.amount_cents,p.generation_id,p.idempotency_key,p.reason||`Reembolso geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:p.amount_cents,reserved:0,total:p.amount_cents});},
  async depositFunds(_p:{userId:string;amount_cents:number;reference_id:string;idempotency_key:string;description?:string}){return legacyWriteDisabled();}
};
