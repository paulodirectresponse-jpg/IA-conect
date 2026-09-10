import { UserProfile, UserStatus } from '../../src/types/index.js';
import { firestoreAdminRest } from './firestoreAdminRest.js';

const safe = (value:string) => encodeURIComponent(value);
const dateValue = (value?:string) => {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isFinite(ms) ? ms : 0;
};

function normalizeUser(input:Partial<UserProfile> & {user_id:string}):UserProfile {
  const now = new Date().toISOString();
  const email = String(input.email || '').trim().toLowerCase();
  return {
    user_id:input.user_id,
    email,
    display_name:String(input.display_name || email.split('@')[0] || 'Usuário'),
    avatar_url:String(input.avatar_url || ''),
    role:input.role === 'ADMIN' ? 'ADMIN' : 'USER',
    status:input.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
    created_at:input.created_at || input.last_login_at || input.updated_at || now,
    updated_at:input.updated_at || now,
    last_login_at:input.last_login_at || input.updated_at || input.created_at || now,
  };
}

async function allUsers(limit=500):Promise<UserProfile[]> {
  const rows = await firestoreAdminRest.runQuery({
    from:[{collectionId:'users'}],
    limit:Math.min(500,Math.max(1,limit)),
  });
  return rows
    .map((row:any) => normalizeUser(row.data as any))
    .sort((a,b) => dateValue(b.created_at)-dateValue(a.created_at));
}

export const userRepository = {
  async getById(userId:string):Promise<UserProfile|null> {
    const doc = await firestoreAdminRest.get(`users/${safe(userId)}`);
    return doc.exists ? normalizeUser(doc.data as any) : null;
  },

  async getByEmail(email:string):Promise<UserProfile|null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const rows = await firestoreAdminRest.runQuery({
      from:[{collectionId:'users'}],
      where:{fieldFilter:{field:{fieldPath:'email'},op:'EQUAL',value:{stringValue:normalized}}},
      limit:1,
    });
    return rows[0] ? normalizeUser(rows[0].data as any) : null;
  },

  async save(user:UserProfile):Promise<UserProfile> {
    const existing = await firestoreAdminRest.get(`users/${safe(user.user_id)}`);
    const normalized = normalizeUser({
      ...(existing.exists ? existing.data as any : {}),
      ...user,
      user_id:user.user_id,
      email:user.email,
      updated_at:user.updated_at || new Date().toISOString(),
    });
    await firestoreAdminRest.set(`users/${safe(user.user_id)}`, normalized);
    return normalized;
  },

  async updateStatus(userId:string,status:UserStatus):Promise<UserProfile|null> {
    const current = await this.getById(userId);
    if (!current) return null;
    return this.save({...current,status,updated_at:new Date().toISOString()});
  },

  async list(options:{search?:string;limit?:number;offset?:number}={}):Promise<{users:UserProfile[];total:number}> {
    const requestedLimit = Math.min(100,Math.max(1,options.limit || 20));
    const offset = Math.max(0,options.offset || 0);
    let users = await allUsers(500);

    if (options.search?.trim()) {
      const q = options.search.trim().toLowerCase();
      users = users.filter((user) =>
        String(user.email || '').toLowerCase().includes(q) ||
        String(user.display_name || '').toLowerCase().includes(q)
      );
    }

    return {users:users.slice(offset,offset+requestedLimit),total:users.length};
  },

  async count():Promise<{total:number;active:number;suspended:number;admins:number}> {
    const users = await allUsers(500);
    return {
      total:users.length,
      active:users.filter((u)=>u.status==='ACTIVE').length,
      suspended:users.filter((u)=>u.status==='SUSPENDED').length,
      admins:users.filter((u)=>u.role==='ADMIN').length,
    };
  },

  clearForTesting() {},
};
