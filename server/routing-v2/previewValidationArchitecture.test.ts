import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source=fs.readFileSync(path.join(process.cwd(),'server/routes/previewRoutingV2ValidationRoutes.ts'),'utf8');

describe('Routing V2 preview validation controls',()=>{
  it('keeps synthetic runtime administration behind auth and the preview validation guard',()=>{
    expect(source).toContain("post('/preview/routing-v2/runtime-admin',requireAuth,validationGuard");
    expect(source).toContain("process.env.ROUTING_V2_PREVIEW");
    expect(source).toContain("/^routing-v2-runtime-[a-z0-9-]+@example\\.com$/");
  });

  it('supports explicit demotion after the admin endpoints are validated',()=>{
    expect(source).toContain("role:enabled?'ADMIN':'USER'");
  });
});
