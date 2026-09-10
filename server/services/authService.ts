import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository.js';
import { creditWalletService } from './creditWalletService.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { UserProfile, UserRole, UserStatus } from '../../src/types/index.js';

const INITIAL_ADMIN_EMAIL = (process.env.INITIAL_ADMIN_EMAIL || '').toLowerCase().trim();

export const authService = {
  async registerOrSyncProfile(params: {
    userId: string;
    email: string;
    displayName?: string;
    avatarUrl?: string;
  }): Promise<{ user: UserProfile; isNew: boolean }> {
    const { userId, email, displayName, avatarUrl } = params;
    const normalizedEmail = (email || '').toLowerCase().trim();

    let user = await userRepository.getById(userId);
    if (user) {
      const now = new Date().toISOString();
      user.email = normalizedEmail || user.email || '';
      user.display_name = displayName || user.display_name || normalizedEmail.split('@')[0] || 'Usuário';
      user.avatar_url = avatarUrl || user.avatar_url || '';
      user.role = user.role === 'ADMIN' ? 'ADMIN' : 'USER';
      user.status = user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
      user.created_at = user.created_at || user.last_login_at || user.updated_at || now;
      user.last_login_at = now;
      user.updated_at = now;
      const saved = await userRepository.save(user);
      await creditWalletService.getAccount(userId);
      return { user:saved, isNew:false };
    }

    // Determine initial role securely
    const counts = await userRepository.count();
    let initialRole: UserRole = 'USER';

    // Auto-promote if matching configured INITIAL_ADMIN_EMAIL or if first user bootstrap
    if (normalizedEmail && normalizedEmail === INITIAL_ADMIN_EMAIL) {
      initialRole = 'ADMIN';
    } else if (counts.total === 0) {
      initialRole = 'ADMIN';
    }

    const newUser: UserProfile = {
      user_id: userId,
      email: normalizedEmail,
      display_name: displayName || normalizedEmail.split('@')[0] || 'Usuário',
      avatar_url: avatarUrl || '',
      role: initialRole,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };

    const savedUser = await userRepository.save(newUser);

    // Credits V2 is the only operational wallet.
    await creditWalletService.getAccount(userId);

    // If assigned ADMIN on creation, record audit log
    if (initialRole === 'ADMIN') {
      await auditRepository.record({
        log_id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        admin_id: 'SYSTEM',
        admin_email: 'system@platform.internal',
        action: 'INITIAL_ADMIN_DESIGNATED',
        entity_type: 'USER',
        entity_id: userId,
        before: null,
        after: { role: 'ADMIN', email: normalizedEmail },
        reason: 'Bootstrap do primeiro administrador do sistema',
        created_at: new Date().toISOString(),
      });
    }

    return { user: savedUser, isNew: true };
  },

  async bootstrapFirstAdmin(userId: string, bootstrapSecret?: string): Promise<UserProfile> {
    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const envSecret = (process.env.ADMIN_BOOTSTRAP_SECRET || '').trim();
    if (envSecret) {
      if (!bootstrapSecret || bootstrapSecret.trim() !== envSecret) {
        const err: any = new Error('Segredo técnico de bootstrap administrativo inválido ou ausente.');
        err.code = 'INVALID_BOOTSTRAP_SECRET';
        throw err;
      }
    }

    const counts = await userRepository.count();
    if (counts.admins > 0 && user.role !== 'ADMIN') {
      const err: any = new Error('O bootstrap inicial já foi concluído e já existe um administrador registrado no sistema.');
      err.code = 'OPERATION_REJECTED';
      throw err;
    }

    user.role = 'ADMIN';
    user.updated_at = new Date().toISOString();
    const updated = await userRepository.save(user);

    await auditRepository.record({
      log_id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      admin_id: userId,
      admin_email: user.email,
      action: 'BOOTSTRAP_ADMIN_CLAIMED',
      entity_type: 'USER',
      entity_id: userId,
      before: { role: 'USER' },
      after: { role: 'ADMIN' },
      reason: 'Reivindicação de primeiro administrador durante o bootstrap inicial',
      created_at: new Date().toISOString(),
    });

    return updated;
  },
};
