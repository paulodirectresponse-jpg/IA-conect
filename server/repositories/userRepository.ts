import { UserProfile, UserStatus } from '../../src/types/index.js';
import { getAdminDb } from './firebaseAdminClient.js';

function db() {
  const database = getAdminDb();
  if (!database) throw new Error('Firestore Admin indisponível.');
  return database;
}

export const userRepository = {
  async getById(userId: string): Promise<UserProfile | null> {
    const snap = await db().collection('users').doc(userId).get();
    return snap.exists ? (snap.data() as UserProfile) : null;
  },

  async getByEmail(email: string): Promise<UserProfile | null> {
    const normalized = email.trim().toLowerCase();
    const snap = await db().collection('users').where('email', '==', normalized).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as UserProfile);
  },

  async save(user: UserProfile): Promise<UserProfile> {
    const normalized: UserProfile = {
      ...user,
      email: user.email.trim().toLowerCase(),
      updated_at: user.updated_at || new Date().toISOString(),
    };
    await db().collection('users').doc(normalized.user_id).set(normalized, { merge: true });
    return normalized;
  },

  async updateStatus(userId: string, status: UserStatus): Promise<UserProfile | null> {
    const ref = db().collection('users').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const updated_at = new Date().toISOString();
    await ref.set({ status, updated_at }, { merge: true });
    return { ...(snap.data() as UserProfile), status, updated_at };
  },

  async list(options: { search?: string; limit?: number; offset?: number } = {}): Promise<{ users: UserProfile[]; total: number }> {
    // Admin lists are intentionally bounded. Offset is applied in memory because
    // the existing UI uses numeric offsets; cursor pagination can replace this later.
    const requestedLimit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = Math.max(0, options.offset || 0);
    const fetchLimit = Math.min(500, Math.max(requestedLimit + offset, 100));
    const snap = await db().collection('users').orderBy('created_at', 'desc').limit(fetchLimit).get();
    let users = snap.docs.map((d) => d.data() as UserProfile);

    if (options.search?.trim()) {
      const q = options.search.trim().toLowerCase();
      users = users.filter((u) =>
        u.email.toLowerCase().includes(q) ||
        (u.display_name || '').toLowerCase().includes(q)
      );
    }

    const total = users.length;
    return { users: users.slice(offset, offset + requestedLimit), total };
  },

  async count(): Promise<{ total: number; active: number; suspended: number; admins: number }> {
    const snap = await db().collection('users').get();
    let active = 0;
    let suspended = 0;
    let admins = 0;
    for (const doc of snap.docs) {
      const user = doc.data() as UserProfile;
      if (user.status === 'ACTIVE') active++;
      if (user.status === 'SUSPENDED') suspended++;
      if (user.role === 'ADMIN') admins++;
    }
    return { total: snap.size, active, suspended, admins };
  },

  clearForTesting() {
    // Production source of truth is Firestore; tests should use an emulator/test project.
  },
};
