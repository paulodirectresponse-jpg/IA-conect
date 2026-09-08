import crypto from 'crypto';
import { walletRepository } from '../repositories/walletRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { auditRepository } from '../repositories/auditRepository.js';
import { WalletAccount, WalletTransaction } from '../../src/types/index.js';

export interface AdjustBalanceParams {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT';
  amount_cents: number;
  reason: string;
  idempotency_key: string;
}

export const walletService = {
  async getSummary(userId: string): Promise<WalletAccount> {
    const computed = await walletRepository.computeBalanceFromLedger(userId);
    const account = await walletRepository.getAccount(userId);

    // Synchronize snapshot with computed ledger truth
    account.available_balance_cents = computed.available_balance_cents;
    account.reserved_balance_cents = computed.reserved_balance_cents;
    account.total_balance_cents = computed.total_balance_cents;
    account.total_deposited_cents = computed.total_deposited_cents;
    account.total_used_cents = computed.total_used_cents;
    account.updated_at = new Date().toISOString();

    await walletRepository.saveAccount(account);
    return account;
  },

  async listTransactions(userId: string, options: { limit?: number; offset?: number } = {}) {
    return walletRepository.listTransactions(userId, options);
  },

  /**
   * Performs an atomic, idempotent administrative balance adjustment.
   * Never mutates balance directly without an immutable ledger entry.
   * Never allows negative available balance on debits.
   */
  async adjustBalance(params: AdjustBalanceParams): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
    const { adminId, adminEmail, targetUserId, type, amount_cents, reason, idempotency_key } = params;

    // 1. Validate inputs
    if (!targetUserId) {
      throw new Error('Usuário de destino é obrigatório.');
    }
    if (type !== 'ADMIN_CREDIT' && type !== 'ADMIN_DEBIT') {
      throw new Error('Tipo de ajuste inválido. Deve ser ADMIN_CREDIT ou ADMIN_DEBIT.');
    }
    if (!Number.isInteger(amount_cents) || amount_cents <= 0) {
      throw new Error('Valor inválido. O valor deve ser um número inteiro de centavos maior que zero.');
    }
    if (!reason || reason.trim().length < 3) {
      throw new Error('Motivo é obrigatório para registrar a auditoria do ajuste.');
    }
    if (!idempotency_key || idempotency_key.trim().length < 4) {
      throw new Error('Chave de idempotência é obrigatória para operações financeiras.');
    }

    // 2. Check target user existence
    const user = await userRepository.getById(targetUserId);
    if (!user) {
      const err: any = new Error('Usuário não encontrado.');
      err.code = 'RESOURCE_NOT_FOUND';
      throw err;
    }

    // 3. Check idempotency: if transaction already processed with this key, return without duplicate credit/debit
    const existingTx = await walletRepository.getTransactionByIdempotencyKey(idempotency_key);
    if (existingTx) {
      const currentAccount = await this.getSummary(targetUserId);
      return { transaction: existingTx, account: currentAccount };
    }

    // 4. Retrieve current balance snapshot from ledger
    const balanceBefore = await walletRepository.computeBalanceFromLedger(targetUserId);

    // 5. Enforce non-negative available balance invariant on debits
    if (type === 'ADMIN_DEBIT') {
      if (balanceBefore.available_balance_cents < amount_cents) {
        const err: any = new Error(
          `Saldo insuficiente. O saldo disponível atual é de R$ ${(balanceBefore.available_balance_cents / 100).toFixed(2)}, inferior ao débito solicitado de R$ ${(amount_cents / 100).toFixed(2)}.`
        );
        err.code = 'WALLET_INSUFFICIENT_FUNDS';
        throw err;
      }
    }

    // 6. Create immutable ledger transaction
    const transactionId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const tx: WalletTransaction = {
      transaction_id: transactionId,
      user_id: targetUserId,
      type,
      amount_cents,
      status: 'COMPLETED',
      description: `Ajuste Administrativo: ${reason}`,
      reference_type: 'MANUAL_ADMIN',
      reference_id: adminId,
      idempotency_key,
      created_at: new Date().toISOString(),
      created_by: adminId,
    };

    const recordedTx = await walletRepository.recordTransaction(tx);

    // 7. Recompute balance from updated ledger
    const balanceAfter = await walletRepository.computeBalanceFromLedger(targetUserId);
    const updatedAccount: WalletAccount = {
      account_id: targetUserId,
      user_id: targetUserId,
      currency: 'BRL',
      available_balance_cents: balanceAfter.available_balance_cents,
      reserved_balance_cents: balanceAfter.reserved_balance_cents,
      total_balance_cents: balanceAfter.total_balance_cents,
      total_deposited_cents: balanceAfter.total_deposited_cents,
      total_used_cents: balanceAfter.total_used_cents,
      updated_at: new Date().toISOString(),
    };
    await walletRepository.saveAccount(updatedAccount);

    // 8. Record audit log
    await auditRepository.record({
      log_id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      admin_id: adminId,
      admin_email: adminEmail,
      action: 'BALANCE_ADJUSTMENT',
      entity_type: 'WALLET',
      entity_id: targetUserId,
      before: {
        available_balance_cents: balanceBefore.available_balance_cents,
        total_balance_cents: balanceBefore.total_balance_cents,
      },
      after: {
        available_balance_cents: balanceAfter.available_balance_cents,
        total_balance_cents: balanceAfter.total_balance_cents,
        transaction_id: transactionId,
        type,
        amount_cents,
      },
      reason,
      created_at: new Date().toISOString(),
    });

    return { transaction: recordedTx, account: updatedAccount };
  },
};
