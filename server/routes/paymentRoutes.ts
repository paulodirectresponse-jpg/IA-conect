import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { paymentService } from '../services/paymentService.js';

export const paymentRouter = Router();

paymentRouter.post('/payments/webhook', async (req, res) => {
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  if (!dataId) return res.status(200).json({ok:true,ignored:true});

  try {
    const result = await paymentService.processWebhook({
      headers:req.headers as any,
      dataId,
      eventType:String(req.body?.type || req.query.type || ''),
      action:String(req.body?.action || ''),
    });
    return res.status(200).json({ok:true,...result});
  } catch (err:any) {
    if (err?.code === 'INVALID_WEBHOOK_SIGNATURE') return res.status(401).json({ok:false});
    console.error('[MercadoPagoWebhook]', err?.message || err);
    return res.status(500).json({ok:false});
  }
});

paymentRouter.post('/payments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { amount_cents, method } = req.body;

    const payment = await paymentService.createPayment({
      userId: uid,
      amount_cents: Number(amount_cents),
      method: method || 'PIX',
    });

    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PAYMENT_CREATE_ERROR', message: err.message } });
  }
});

/**
 * Checks status of a payment order.
 */
paymentRouter.get('/payments/:paymentId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const payment = await paymentService.getPayment(req.params.paymentId, uid);
    if (!payment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Pagamento não encontrado.' } });
    }
    res.json({ success: true, data: payment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PAYMENT_FETCH_ERROR', message: err.message } });
  }
});

/**
 * Confirms payment and credits wallet atomically with ledger entry.
 */
paymentRouter.post('/payments/:paymentId/confirm', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const result = await paymentService.confirmPayment(req.params.paymentId, uid);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'PAYMENT_CONFIRM_ERROR', message: err.message } });
  }
});

/**
 * Lists user payment orders.
 */
paymentRouter.get('/payments', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const list = await paymentService.listUserPayments(uid);
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'PAYMENTS_LIST_ERROR', message: err.message } });
  }
});

// ==========================================
// ETAPA 3: ADMIN DIAGNOSTICS & AUDIT
// ==========================================

/**
 * Diagnostic tool for Admin: verifies Firebase Storage connection, permissions, and signed URL generation.
 */
