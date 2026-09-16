import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

describe('PR-02 capability architecture',()=>{
  it('keeps provider secrets and direct provider calls out of the Beta client',()=>{
    const source=fs.readFileSync(path.join(process.cwd(),'src/beta/capabilityClient.ts'),'utf8');
    expect(source).not.toMatch(/provider_id|provider_model_identifier|api[_-]?key/i);
    expect(source).not.toMatch(/wavespeed|atlas/i);
  });

  it('protects the public capability endpoint with auth',()=>{
    const source=fs.readFileSync(path.join(process.cwd(),'server/routes/betaCapabilityRoutes.ts'),'utf8');
    expect(source).toContain("'/beta/capabilities',requireAuth");
  });
});
