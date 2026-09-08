import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository.js';
import { walletRepository } from '../repositories/walletRepository.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { UserProfile, UserStatus } from '../../src/types/index.js';

export const adminService = {
  async getDashboardStats() {
    const userCounts = await userRepository.count();
    const totalPlatformBalanceCents = await walletRepository.getTotalPlatformBalance();
    const models = await catalogRepository.listModels();
    const providers = await catalogRepository.listProviders();
    const flags = await catalogRepository.listFeatureFlags();

    return {
      total_users: userCounts.total,
      active_users: userCounts.active,
      suspended_users: userCounts.suspended,
      admin_users: userCounts.admins,
      total_platform_balance_cents: totalPlatformBalanceCents,
      generations_count: 0, // No fake generations created
      generations_by_status: {
        QUEUED: 0,
        PROCESSING: 0,
        SUCCEEDED: 0,
        FAILED: 0,
      },
      models_count: models.length,
      providers_count: providers.length,
      feature_flags_count: flags.length,
      alerts: [
        {
          type: 'INFO',
          message: 'Fundação da Etapa 1 ativa: Módulos de provedores e pagamentos preparados e isolados para Etapas 2 e 3.',
        },
      ],
    };
  },

  async listUsers(options: { search?: string; limit?: number; offset?: number }) {
    return userRepository.list(options);
  },

  async getUserDetails(userId: string) {
    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    const wallet = await walletRepository.getAccount(userId);
    const ledger = await walletRepository.listTransactions(userId, { limit: 10 });
    return {
      user,
      wallet,
      recent_transactions: ledger.transactions,
    };
  },

  async updateUserStatus(params: {
    adminId: string;
    adminEmail: string;
    targetUserId: string;
    status: UserStatus;
    reason: string;
  }): Promise<UserProfile> {
    const { adminId, adminEmail, targetUserId, status, reason } = params;

    const userBefore = await userRepository.getById(targetUserId);
    if (!userBefore) {
      throw new Error('Usuário não encontrado');
    }

    if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
      throw new Error('Status inválido');
    }

    const updatedUser = await userRepository.updateStatus(targetUserId, status);
    if (!updatedUser) {
      throw new Error('Falha ao atualizar status do usuário');
    }

    await auditRepository.record({
      log_id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      admin_id: adminId,
      admin_email: adminEmail,
      action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      entity_type: 'USER',
      entity_id: targetUserId,
      before: { status: userBefore.status },
      after: { status: updatedUser.status },
      reason,
      created_at: new Date().toISOString(),
    });

    return updatedUser;
  },
};
