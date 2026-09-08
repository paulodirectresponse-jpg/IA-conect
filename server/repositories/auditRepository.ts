import { AuditLog } from '../../src/types/index.js';

const auditLogsList: AuditLog[] = [];

export const auditRepository = {
  async record(log: AuditLog): Promise<AuditLog> {
    auditLogsList.unshift({ ...log });
    return { ...log };
  },

  async list(options: { entity_type?: string; limit?: number; offset?: number } = {}): Promise<{ logs: AuditLog[]; total: number }> {
    let list = [...auditLogsList];
    if (options.entity_type) {
      list = list.filter(l => l.entity_type === options.entity_type);
    }
    const total = list.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;

    return {
      logs: list.slice(offset, offset + limit),
      total,
    };
  },

  clearForTesting() {
    auditLogsList.length = 0;
  }
};
