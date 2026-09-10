import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { creditWalletService } from './creditWalletService.js';
import { firestoreAdminRest } from '../repositories/firestoreAdminRest.js';
import { UserProfile, UserStatus } from '../../src/types/index.js';

export const adminService = {
  async getDashboardStats() {
    const userCounts = await userRepository.count();
    const models = await catalogRepository.listModels();
    const providers = await catalogRepository.listProviders();
    const flags = await catalogRepository.listFeatureFlags();
    const creditRows=await firestoreAdminRest.runQuery({from:[{collectionId:'credit_accounts'}]}).catch(()=>[]);
    const totalPlatformCredits=creditRows.reduce((sum:number,r:any)=>sum+Math.max(0,Number(r?.data?.available_credits||0))+Math.max(0,Number(r?.data?.reserved_credits||0)),0);
    return {
      total_users: userCounts.total,active_users: userCounts.active,suspended_users: userCounts.suspended,admin_users: userCounts.admins,
      total_platform_credits:totalPlatformCredits,generations_count:0,generations_by_status:{QUEUED:0,PROCESSING:0,SUCCEEDED:0,FAILED:0},
      models_count:models.length,providers_count:providers.length,feature_flags_count:flags.length,alerts:[],
    };
  },

  async listUsers(options: { search?: string; limit?: number; offset?: number }) { return userRepository.list(options); },

  async getUserDetails(userId: string) {
    const user = await userRepository.getById(userId);if (!user) throw new Error('Usuário não encontrado');
    const wallet=await creditWalletService.getAccount(userId);const recent=await creditWalletService.listTransactions(userId,10);
    return {user,wallet,recent_transactions:recent};
  },

  async adjustCredits(params:{adminId:string;adminEmail:string;targetUserId:string;type:'ADMIN_CREDIT'|'ADMIN_DEBIT';amount_credits:number;reason:string;idempotency_key:string}){
    const {adminId,adminEmail,targetUserId,type,amount_credits,reason,idempotency_key}=params;
    if(!Number.isInteger(amount_credits)||amount_credits<=0)throw new Error('Quantidade de créditos inválida.');if(reason.trim().length<3)throw new Error('Justificativa obrigatória.');
    if(!await userRepository.getById(targetUserId))throw new Error('Usuário não encontrado');
    const before=await creditWalletService.getAccount(targetUserId);
    let after;
    if(type==='ADMIN_CREDIT')after=await creditWalletService.issue({userId:targetUserId,credits:amount_credits,source:'COMPENSATION',idempotencyKey:idempotency_key,referenceId:`admin:${adminId}`,netCashBackingMicros:0,metadata:{admin_id:adminId,reason,transaction_type:'ADMIN_CREDIT'}});
    else after=await creditWalletService.adminDebit({userId:targetUserId,credits:amount_credits,idempotencyKey:idempotency_key,referenceId:`admin:${adminId}`,metadata:{admin_id:adminId,reason}});
    await auditRepository.record({log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,admin_id:adminId,admin_email:adminEmail,action:'CREDIT_ADJUSTMENT',entity_type:'CREDIT_ACCOUNT',entity_id:targetUserId,before,after,reason,created_at:new Date().toISOString()});
    return after;
  },

  async updateUserStatus(params: {adminId:string;adminEmail:string;targetUserId:string;status:UserStatus;reason:string;}): Promise<UserProfile> {
    const { adminId, adminEmail, targetUserId, status, reason } = params;const userBefore=await userRepository.getById(targetUserId);if(!userBefore)throw new Error('Usuário não encontrado');if(!['ACTIVE','SUSPENDED'].includes(status))throw new Error('Status inválido');const updatedUser=await userRepository.updateStatus(targetUserId,status);if(!updatedUser)throw new Error('Falha ao atualizar status do usuário');
    await auditRepository.record({log_id:`aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,admin_id:adminId,admin_email:adminEmail,action:status==='SUSPENDED'?'USER_SUSPENDED':'USER_REACTIVATED',entity_type:'USER',entity_id:targetUserId,before:{status:userBefore.status},after:{status:updatedUser.status},reason,created_at:new Date().toISOString()});return updatedUser;
  },
};
