import { UserProfile, UserStatus } from '../../src/types/index.js';

// In-memory backing store for fast retrieval and immediate consistency
const usersMap = new Map<string, UserProfile>();

export const userRepository = {
  async getById(userId: string): Promise<UserProfile | null> {
    return usersMap.get(userId) || null;
  },

  async getByEmail(email: string): Promise<UserProfile | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of usersMap.values()) {
      if (user.email.toLowerCase() === normalized) {
        return user;
      }
    }
    return null;
  },

  async save(user: UserProfile): Promise<UserProfile> {
    usersMap.set(user.user_id, { ...user });
    return { ...user };
  },

  async updateStatus(userId: string, status: UserStatus): Promise<UserProfile | null> {
    const user = usersMap.get(userId);
    if (!user) return null;
    user.status = status;
    user.updated_at = new Date().toISOString();
    usersMap.set(userId, user);
    return { ...user };
  },

  async list(options: { search?: string; limit?: number; offset?: number } = {}): Promise<{ users: UserProfile[]; total: number }> {
    let all = Array.from(usersMap.values());
    if (options.search) {
      const q = options.search.toLowerCase();
      all = all.filter(u => u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q));
    }
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = all.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const sliced = all.slice(offset, offset + limit);

    return { users: sliced, total };
  },

  async count(): Promise<{ total: number; active: number; suspended: number; admins: number }> {
    let total = 0;
    let active = 0;
    let suspended = 0;
    let admins = 0;

    for (const u of usersMap.values()) {
      total++;
      if (u.status === 'ACTIVE') active++;
      if (u.status === 'SUSPENDED') suspended++;
      if (u.role === 'ADMIN') admins++;
    }

    return { total, active, suspended, admins };
  },

  clearForTesting() {
    usersMap.clear();
  }
};
