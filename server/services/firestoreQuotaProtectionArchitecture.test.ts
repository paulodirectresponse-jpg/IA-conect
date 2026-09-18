import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('Firestore quota protection',()=>{
  it('deduplicates authenticated profile reads',()=>{
    const source=read('server/repositories/userRepository.ts');
    expect(source).toContain('USER_CACHE_TTL_MS');
    expect(source).toContain('userInflight');
    expect(source).toContain('cacheUser(user.user_id,normalized)');
  });

  it('adds a quota circuit breaker and query dedupe',()=>{
    const source=read('server/repositories/firestoreAdminRest.ts');
    expect(source).toContain('firestoreRateLimitedUntil');
    expect(source).toContain('FIRESTORE_RATE_LIMIT_ACTIVE');
    expect(source).toContain('queryInflight');
    expect(source).toContain('QUERY_CACHE_TTL_MS');
  });

  it('reports resource exhaustion explicitly',()=>{
    const source=read('server/services/runtimeDependencyHealthService.ts');
    expect(source).toContain('FIRESTORE_RESOURCE_EXHAUSTED');
    expect(source).toContain('response_error_status');
    expect(source).toContain('retry_after');
  });

  it('never offers bootstrap when the authenticated profile is unavailable',()=>{
    const source=read('src/components/views/SettingsView.tsx');
    expect(source).toContain('profile && !isAdmin');
    expect(source).toContain('Não refaça o cadastro nem reivindique administrador');
  });
});
