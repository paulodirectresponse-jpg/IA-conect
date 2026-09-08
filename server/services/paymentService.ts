import { getAdminDb } from '../repositories/firebaseAdminClient.js';
import { PaymentRecord, PaymentMethod } from '../../src/types/index.js';

function db(){const d=getAdminDb();if(!d)throw new Error('Firestore Admin indisponível.');return d;}
function notConfigured(){const err:any=new Error('Pagamentos online ainda não foram ativados. O gateway Mercado Pago será conectado antes do lançamento comercial.');err.code='PAYMENTS_NOT_CONFIGURED';throw err;}

/** No fake PIX or client-side confirmation is allowed. Until Mercado Pago is configured,
 * payment creation is deliberately disabled. Admin ledger credit can be used for internal tests. */
export const paymentService={
  async createPayment(_params:{userId:string;amount_cents:number;method:PaymentMethod}):Promise<PaymentRecord>{return notConfigured();},
  async confirmPayment(_paymentId:string,_userId?:string):Promise<any>{const err:any=new Error('Confirmação manual de pagamento é proibida. O saldo só poderá ser creditado por webhook verificado do gateway.');err.code='PAYMENT_CONFIRM_FORBIDDEN';throw err;},
  async getPayment(paymentId:string,userId:string):Promise<PaymentRecord|null>{const doc=await db().collection('payments').doc(paymentId).get();if(!doc.exists)return null;const p=doc.data() as PaymentRecord;return p.user_id===userId?p:null;},
  async listUserPayments(userId:string):Promise<PaymentRecord[]>{const snap=await db().collection('payments').where('user_id','==',userId).orderBy('created_at','desc').limit(50).get();return snap.docs.map(d=>d.data() as PaymentRecord);}
};
