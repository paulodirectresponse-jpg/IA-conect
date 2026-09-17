import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-20 final warning policy',()=>{
  it('documents known non-blocking CSS optimizer warnings without weakening release gates',()=>{
    const policy=read('PR20_KNOWN_NONBLOCKING_WARNINGS.md');
    const ci=read('.github/workflows/ci.yml');
    expect(policy).toContain('não bloqueantes');
    expect(policy).toContain('Stable');
    expect(ci).toContain('npm run build');
    expect(ci).toContain('assert-performance-budget.mjs');
    expect(ci).toContain('npm test -- --passWithNoTests');
    expect(ci).toContain('Browser performance QA — Fast 3G + 4G');
  });
});
