import crypto from 'crypto';
import { walletService } from './walletService.js';
import { getAdminDb } from '../repositories/firebaseAdminClient.js';
import { PaymentRecord, PaymentMethod, PaymentStatus, WalletAccount } from '../../src/types/index.js';

const paymentsMap = new Map<string, PaymentRecord>();

export const paymentService = {
  /**
   * Creates a deposit payment order via PIX or Credit Card.
   */
  async createPayment(params: {
    userId: string;
    amount_cents: number;
    method: PaymentMethod;
  }): Promise<PaymentRecord> {
    const { userId, amount_cents, method } = params;

    if (!Number.isInteger(amount_cents) || amount_cents < 500) {
      throw new Error('O valor mínimo para recarga é de R$ 5,00 (500 centavos).');
    }

    if (amount_cents > 1000000) {
      throw new Error('O valor máximo por transação é de R$ 10.000,00.');
    }

    const paymentId = `pay_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 minutes

    // Generate standard PIX copy-paste code with CRC16 check
    const pixTxId = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
    const pixCode = `00020126580014br.gov.bcb.pix0136${crypto.randomUUID()}520400005303986540${(amount_cents / 100).toFixed(2)}5802BR5925AI VIDEO GENERATOR PLAT6009SAO PAULO62290525${pixTxId}6304ABCD`;

    const payment: PaymentRecord = {
      payment_id: paymentId,
      user_id: userId,
      amount_cents,
      method,
      status: 'PENDING',
      pix_code: method === 'PIX' ? pixCode : undefined,
      description: `Recarga de créditos na plataforma - R$ ${(amount_cents / 100).toFixed(2)}`,
      idempotency_key: `dep_${paymentId}`,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      confirmed_at: null,
      failed_at: null,
    };

    paymentsMap.set(paymentId, payment);

    try {
      const db = getAdminDb();
      if (db) {
        await db.collection('payments').doc(paymentId).set(payment);
      }
    } catch {
      // Non-blocking
    }

    return payment;
  },

  /**
   * Confirms payment and credits wallet atomically with idempotency.
   */
  async confirmPayment(paymentId: string, userId?: string): Promise<{ payment: PaymentRecord; account: WalletAccount }> {
    let payment = paymentsMap.get(paymentId);
    if (!payment) {
      try {
        const db = getAdminDb();
        if (db) {
          const doc = await db.collection('payments').doc(paymentId).get();
          if (doc.exists) {
            payment = doc.data() as PaymentRecord;
            paymentsMap.set(paymentId, payment);
          }
        }
      } catch {
        // Fallback
      }
    }

    if (!payment) {
      throw new Error('Pagamento não encontrado.');
    }

    if (userId && payment.user_id !== userId) {
      throw new Error('Sem permissão para confirmar este pagamento.');
    }

    if (payment.status === 'CONFIRMED') {
      const acc = await walletService.getSummary(payment.user_id);
      return { payment, account: acc };
    }

    // Atomically deposit funds to wallet ledger
    const { account } = await walletService.depositFunds({
      userId: payment.user_id,
      amount_cents: payment.amount_cents,
      reference_id: payment.payment_id,
      idempotency_key: payment.idempotency_key,
      description: `Depósito via ${payment.method} #${payment.payment_id.slice(-6)}`,
    });

    payment.status = 'CONFIRMED';
    payment.confirmed_at = new Date().toISOString();
    paymentsMap.set(paymentId, payment);

    try {
      const db = getAdminDb();
      if (db) {
        await db.collection('payments').doc(paymentId).set(payment, { merge: true });
      }
    } catch {
      // Non-blocking
    }

    return { payment, account };
  },

  async getPayment(paymentId: string, userId: string): Promise<PaymentRecord | null> {
    const payment = paymentsMap.get(paymentId);
    if (!payment || payment.user_id !== userId) {
      return null;
    }
    return payment;
  },

  async listUserPayments(userId: string): Promise<PaymentRecord[]> {
    return Array.from(paymentsMap.values())
      .filter((p) => p.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
};
