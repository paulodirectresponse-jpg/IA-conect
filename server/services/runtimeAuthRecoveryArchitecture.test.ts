import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('runtime auth recovery architecture',()=>{
  it('does not mislabel datastore outages as invalid Firebase sessions',()=>{
    const source=read('server/middleware/authMiddleware.ts');
    expect(source).toContain("code:'AUTH_SESSION_INVALID'");
    expect(source).toContain("code:'AUTH_BACKEND_UNAVAILABLE'");
    expect(source).toContain('[Auth] Account datastore unavailable:');
  });

  it('exposes a safe dependency diagnostic without returning secret values',()=>{
    const route=read('server/routes/systemRoutes.ts');
    const service=read('server/services/runtimeDependencyHealthService.ts');
    expect(route).toContain("systemRouter.get('/runtime-health'");
    expect(service).toContain("key:'firebase-service-account'");
    expect(service).toContain("key:'firestore'");
    expect(service).toContain("key:'providers'");
    expect(service).toContain("key:'credit-packs'");
    expect(service).not.toContain('private_key:');
    expect(service).not.toContain('client_email:');
  });
});
