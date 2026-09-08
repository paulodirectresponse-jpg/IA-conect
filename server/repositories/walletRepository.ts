import { WalletAccount, WalletTransaction } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';

const accountsMap = new Map<string, WalletAccount>();
const transactionsList: WalletTransaction[] = [];
const idempotencyMap = new Map<string, WalletTransaction>();

export const walletRepository = {
  async getAccount(userId: string): Promise<WalletAccount> {
    let account = accountsMap.get(userId);
    if (!account) {
      try {
        const db = getAdminDb();
        if (db) {
          const doc = await db.collection('wallets').doc(userId).get();
          if (doc.exists) {
            account = doc.data() as WalletAccount;
            accountsMap.set(userId, account);
          }
        }
      } catch {
        // Fallback to default
      }
    }

    if (!account) {
      account = {
        account_id: userId,
        user_id: userId,
        currency: 'BRL',
        available_balance_cents: 0,
        reserved_balance_cents: 0,
        total_balance_cents: 0,
        total_deposited_cents: 0,
        total_used_cents: 0,
        updated_at: new Date().toISOString(),
      };
      accountsMap.set(userId, account);
    }
    return { ...account };
  },

  async saveAccount(account: WalletAccount): Promise<WalletAccount> {
    accountsMap.set(account.user_id, { ...account });
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection('wallets').doc(account.user_id).set(account, { merge: true });
      }
    } catch {
      // Non-blocking
    }
    return { ...account };
  },

  async getTransactionByIdempotencyKey(key: string): Promise<WalletTransaction | null> {
    return idempotencyMap.get(key) || null;
  },

  async getTransactionById(transactionId: string): Promise<WalletTransaction | null> {
    const found = transactionsList.find(t => t.transaction_id === transactionId);
    return found ? { ...found } : null;
  },

  async recordTransaction(tx: WalletTransaction): Promise<WalletTransaction> {
    // Ledger is append-only and immutable
    transactionsList.push({ ...tx });
    if (tx.idempotency_key) {
      idempotencyMap.set(tx.idempotency_key, { ...tx });
    }
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection('ledger').doc(tx.transaction_id).set(tx);
      }
    } catch {
      // Non-blocking
    }
    return { ...tx };
  },

  async listTransactions(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const userTx = transactionsList
      .filter(t => t.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = userTx.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      transactions: userTx.slice(offset, offset + limit),
      total,
    };
  },

  /**
   * Recalculates exact balance directly from ledger transactions as the single source of truth.
   */
  async computeBalanceFromLedger(userId: string): Promise<{
    available_balance_cents: number;
    reserved_balance_cents: number;
    total_balance_cents: number;
    total_deposited_cents: number;
    total_used_cents: number;
  }> {
    const userTx = transactionsList.filter(
      t => t.user_id === userId && t.status === 'COMPLETED'
    );

    let credits = 0;
    let debits = 0;
    let reserved = 0;
    let deposited = 0;
    let used = 0;

    for (const tx of userTx) {
      const amt = Math.round(tx.amount_cents);
      switch (tx.type) {
        case 'DEPOSIT':
          credits += amt;
          deposited += amt;
          break;
        case 'ADMIN_CREDIT':
        case 'PROMOTIONAL_CREDIT':
        case 'REFUND':
          credits += amt;
          break;
        case 'ADMIN_DEBIT':
          debits += amt;
          break;
        case 'GENERATION_CAPTURE':
          debits += amt;
          used += amt;
          reserved = Math.max(0, reserved - amt);
          break;
        case 'GENERATION_RESERVE':
          reserved += amt;
          break;
        case 'GENERATION_RELEASE':
          reserved = Math.max(0, reserved - amt);
          break;
      }
    }

    const total_balance_cents = credits - debits;
    const available_balance_cents = total_balance_cents - reserved;

    return {
      available_balance_cents,
      reserved_balance_cents: reserved,
      total_balance_cents,
      total_deposited_cents: deposited,
      total_used_cents: used,
    };
  },

  async getTotalPlatformBalance(): Promise<number> {
    let sum = 0;
    for (const acc of accountsMap.values()) {
      sum += acc.total_balance_cents;
    }
    return sum;
  },

  clearForTesting() {
    accountsMap.clear();
    transactionsList.length = 0;
    idempotencyMap.clear();
  }
};
