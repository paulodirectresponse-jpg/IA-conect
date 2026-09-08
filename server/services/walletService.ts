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

  /**
   * Reserves funds for an upcoming generation.
   * Decreases available balance, increases reserved balance.
   * Throws WALLET_INSUFFICIENT_FUNDS if available balance < amount_cents.
   */
  async reserveForGeneration(params: {
    userId: string;
    amount_cents: number;
    generation_id: string;
    idempotency_key: string;
    description?: string;
  }): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
    const { userId, amount_cents, generation_id, idempotency_key, description } = params;

    // Idempotency check
    const existing = await walletRepository.getTransactionByIdempotencyKey(idempotency_key);
    if (existing) {
      const acc = await this.getSummary(userId);
      return { transaction: existing, account: acc };
    }

    const currentBalance = await walletRepository.computeBalanceFromLedger(userId);
    if (currentBalance.available_balance_cents < amount_cents) {
      const err: any = new Error(
        `Saldo insuficiente para autorizar a geração. Saldo disponível: R$ ${(currentBalance.available_balance_cents / 100).toFixed(2)}, Necessário: R$ ${(amount_cents / 100).toFixed(2)}.`
      );
      err.code = 'WALLET_INSUFFICIENT_FUNDS';
      throw err;
    }

    const txId = `tx_res_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const tx: WalletTransaction = {
      transaction_id: txId,
      user_id: userId,
      type: 'GENERATION_RESERVE',
      amount_cents,
      status: 'COMPLETED',
      description: description || `Reserva de saldo para geração #${generation_id.slice(-6)}`,
      reference_id: generation_id,
      idempotency_key,
      created_at: new Date().toISOString(),
    };

    const recorded = await walletRepository.recordTransaction(tx);
    const updatedAccount = await this.getSummary(userId);
    return { transaction: recorded, account: updatedAccount };
  },

  /**
   * Captures previously reserved funds when a generation completes successfully.
   * Transfers reserved funds into permanent debits (used funds).
   */
  async captureForGeneration(params: {
    userId: string;
    amount_cents: number;
    generation_id: string;
    idempotency_key: string;
    description?: string;
  }): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
    const { userId, amount_cents, generation_id, idempotency_key, description } = params;

    const existing = await walletRepository.getTransactionByIdempotencyKey(idempotency_key);
    if (existing) {
      const acc = await this.getSummary(userId);
      return { transaction: existing, account: acc };
    }

    const txId = `tx_cap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const tx: WalletTransaction = {
      transaction_id: txId,
      user_id: userId,
      type: 'GENERATION_CAPTURE',
      amount_cents,
      status: 'COMPLETED',
      description: description || `Cobrança de geração concluída #${generation_id.slice(-6)}`,
      reference_id: generation_id,
      idempotency_key,
      created_at: new Date().toISOString(),
    };

    const recorded = await walletRepository.recordTransaction(tx);
    const updatedAccount = await this.getSummary(userId);
    return { transaction: recorded, account: updatedAccount };
  },

  /**
   * Releases previously reserved funds when a generation fails or is cancelled before completion.
   * Restores available balance immediately.
   */
  async releaseForGeneration(params: {
    userId: string;
    amount_cents: number;
    generation_id: string;
    idempotency_key: string;
    reason?: string;
  }): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
    const { userId, amount_cents, generation_id, idempotency_key, reason } = params;

    const existing = await walletRepository.getTransactionByIdempotencyKey(idempotency_key);
    if (existing) {
      const acc = await this.getSummary(userId);
      return { transaction: existing, account: acc };
    }

    const txId = `tx_rel_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const tx: WalletTransaction = {
      transaction_id: txId,
      user_id: userId,
      type: 'GENERATION_RELEASE',
      amount_cents,
      status: 'COMPLETED',
      description: reason ? `Liberação de saldo (${reason})` : `Liberação de reserva #${generation_id.slice(-6)}`,
      reference_id: generation_id,
      idempotency_key,
      created_at: new Date().toISOString(),
    };

    const recorded = await walletRepository.recordTransaction(tx);
    const updatedAccount = await this.getSummary(userId);
    return { transaction: recorded, account: updatedAccount };
  },

  /**
   * Issues a refund for a previously captured generation.
   */
  async refundForGeneration(params: {
    userId: string;
    amount_cents: number;
    generation_id: string;
    idempotency_key: string;
    reason?: string;
  }): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
    const { userId, amount_cents, generation_id, idempotency_key, reason } = params;

    const existing = await walletRepository.getTransactionByIdempotencyKey(idempotency_key);
    if (existing) {
      const acc = await this.getSummary(userId);
      return { transaction: existing, account: acc };
    }

    const txId = `tx_ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const tx: WalletTransaction = {
      transaction_id: txId,
      user_id: userId,
      type: 'REFUND',
      amount_cents,
      status: 'COMPLETED',
      description: reason ? `Reembolso de geração: ${reason}` : `Reembolso de geração #${generation_id.slice(-6)}`,
      reference_id: generation_id,
      idempotency_key,
      created_at: new Date().toISOString(),
    };

    const recorded = await walletRepository.recordTransaction(tx);
    const updatedAccount = await this.getSummary(userId);
    return { transaction: recorded, account: updatedAccount };
  },

  /**
   * Adds deposit funds from real payment (PIX or Card).
   */
  async depositFunds(params: {
    userId: string;
    amount_cents: number;
    reference_id: string;
    idempotency_key: string;
    description?: string;
  }): Promise<{ transaction: WalletTransaction; account: WalletAccount }> {
    const { userId, amount_cents, reference_id, idempotency_key, description } = params;

    const existing = await walletRepository.getTransactionByIdempotencyKey(idempotency_key);
    if (existing) {
      const acc = await this.getSummary(userId);
      return { transaction: existing, account: acc };
    }

    const txId = `tx_dep_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const tx: WalletTransaction = {
      transaction_id: txId,
      user_id: userId,
      type: 'DEPOSIT',
      amount_cents,
      status: 'COMPLETED',
      description: description || `Adição de saldo via PIX/Cartão #${reference_id.slice(-6)}`,
      reference_id,
      idempotency_key,
      created_at: new Date().toISOString(),
    };

    const recorded = await walletRepository.recordTransaction(tx);
    const updatedAccount = await this.getSummary(userId);
    return { transaction: recorded, account: updatedAccount };
  },
};
