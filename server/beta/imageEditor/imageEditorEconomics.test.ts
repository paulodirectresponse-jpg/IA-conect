import fs from 'fs';
import path from 'path';
import { describe,expect,it } from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('PR-10 Image Editor economics',()=>{
  it('uses the existing image per-output credit pricing authority',()=>{
    const pricing=read('server/services/creditPricingService.ts');
    expect(pricing).toContain("function isImageMode(mode:GenerationMode){return mode==='TEXT_TO_IMAGE'||mode==='IMAGE_TO_IMAGE';}");
    expect(pricing).toContain("pricing_unit:image?'PER_OUTPUT'");
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain('betaEconomicsService.resolveQuote');
  });

  it('passes operation dimensions identically through pricing options',()=>{
    const jobs=read('server/beta/jobs/jobOrchestrator.ts');
    expect(jobs).toContain('editor_operation:request.controls.editor_operation');
    expect(jobs).toContain('background_mode:request.controls.background_mode');
    expect(jobs).toContain('variation_strength:request.controls.variation_strength');
  });

  it('does not hardcode credit prices or provider COGS in the editor UI',()=>{
    const ui=read('src/beta/views/BetaImageEditorView.tsx');
    expect(ui).not.toMatch(/credit_price\s*[:=]\s*\d+/);
    expect(ui).not.toMatch(/provider_cost|safe_cogs|customer_price/i);
  });
});
