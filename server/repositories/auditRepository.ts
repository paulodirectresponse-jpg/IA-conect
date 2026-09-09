import { AuditLog } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';

function db() {
  const database = getAdminDb();
  if (!database) throw new Error('Firestore Admin indisponível.');
  return database;
}

export const auditRepository = {
  async record(log: AuditLog): Promise<AuditLog> {
    await db().collection('audit_logs').doc(log.log_id).create(log);
    return { ...log };
  },

  async list(options: { entity_type?: string; limit?: number; offset?: number } = {}): Promise<{ logs: AuditLog[]; total: number }> {
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = Math.max(0, options.offset || 0);
    const fetchLimit = Math.min(500, Math.max(limit + offset, 100));

    let q: any = db().collection('audit_logs');
    if (options.entity_type) q = q.where('entity_type', '==', options.entity_type);
    q = q.orderBy('created_at', 'desc').limit(fetchLimit);

    const snap = await q.get();
    const all = snap.docs.map((d: any) => d.data() as AuditLog);
    return { logs: all.slice(offset, offset + limit), total: all.length };
  },

  clearForTesting() {
    // Production audit log is immutable in Firestore.
  },
};
