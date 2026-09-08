import crypto from 'crypto';
import { walletRepository } from '../repositories/walletRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { WalletAccount, WalletTransaction, TransactionType } from '../../src/types/index.js';

function makeTx(userId:string,type:TransactionType,amount:number,referenceId:string,idempotency:string,description:string,createdBy='system'):WalletTransaction{return {transaction_id:`tx_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,user_id:userId,type,amount_cents:amount,status:'COMPLETED',description,reference_type:type.startsWith('GENERATION_')||type==='REFUND'?'GENERATION':'SYSTEM',reference_id:referenceId,idempotency_key:idempotency,created_at:new Date().toISOString(),created_by:createdBy};}

export const walletService={
  async getSummary(userId:string):Promise<WalletAccount>{return walletRepository.getAccount(userId);},
  async listTransactions(userId:string,options:any={}){return walletRepository.listTransactions(userId,options);},
  async adjustBalance(params:{adminId:string;adminEmail:string;targetUserId:string;type:'ADMIN_CREDIT'|'ADMIN_DEBIT';amount_cents:number;reason:string;idempotency_key:string}){
    if(!Number.isInteger(params.amount_cents)||params.amount_cents<=0)throw new Error('Valor inválido.');if(params.reason.trim().length<3)throw new Error('Motivo obrigatório.');if(!await userRepository.getById(params.targetUserId))throw Object.assign(new Error('Usuário não encontrado.'),{code:'RESOURCE_NOT_FOUND'});
    const before=await this.getSummary(params.targetUserId);const delta=params.type==='ADMIN_CREDIT'?params.amount_cents:-params.amount_cents;
    const tx=makeTx(params.targetUserId,params.type,params.amount_cents,params.adminId,params.idempotency_key,`Ajuste administrativo: ${params.reason}`,params.adminId);
    const result=await walletRepository.applyTransaction(tx,{available:delta,reserved:0,total:delta});
    await auditRepository.record({log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,admin_id:params.adminId,admin_email:params.adminEmail,action:'BALANCE_ADJUSTMENT',entity_type:'WALLET',entity_id:params.targetUserId,before,after:result.account,reason:params.reason,created_at:new Date().toISOString()});return result;
  },
  async reserveForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;description?:string}){if(!Number.isInteger(p.amount_cents)||p.amount_cents<=0)throw new Error('Reserva inválida.');const tx=makeTx(p.userId,'GENERATION_RESERVE',p.amount_cents,p.generation_id,p.idempotency_key,p.description||`Reserva para geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:-p.amount_cents,reserved:p.amount_cents,total:0});},
  async captureForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;description?:string}){const tx=makeTx(p.userId,'GENERATION_CAPTURE',p.amount_cents,p.generation_id,p.idempotency_key,p.description||`Cobrança geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:0,reserved:-p.amount_cents,total:-p.amount_cents,used:p.amount_cents});},
  async releaseForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;reason?:string}){const tx=makeTx(p.userId,'GENERATION_RELEASE',p.amount_cents,p.generation_id,p.idempotency_key,p.reason||`Liberação geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:p.amount_cents,reserved:-p.amount_cents,total:0});},
  async refundForGeneration(p:{userId:string;amount_cents:number;generation_id:string;idempotency_key:string;reason?:string}){const tx=makeTx(p.userId,'REFUND',p.amount_cents,p.generation_id,p.idempotency_key,p.reason||`Reembolso geração #${p.generation_id.slice(-6)}`);return walletRepository.applyTransaction(tx,{available:p.amount_cents,reserved:0,total:p.amount_cents});},
  async depositFunds(p:{userId:string;amount_cents:number;reference_id:string;idempotency_key:string;description?:string}){const tx=makeTx(p.userId,'DEPOSIT',p.amount_cents,p.reference_id,p.idempotency_key,p.description||'Depósito confirmado');return walletRepository.applyTransaction(tx,{available:p.amount_cents,reserved:0,total:p.amount_cents,deposited:p.amount_cents});}
};
