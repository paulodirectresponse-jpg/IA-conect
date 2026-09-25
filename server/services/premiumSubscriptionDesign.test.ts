import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('premium subscription design',()=>{
  it('uses the IA Connect semantic visual system instead of standalone plan colors',()=>{
    const css=read('src/index.css');
    expect(css).toContain('.ia-plans-dialog');
    expect(css).toContain('.ia-plan-card.is-recommended');
    expect(css).toContain('var(--ia-brand)');
    expect(css).toContain('var(--ia-surface-1)');
    expect(css).toContain('.ia-plan-current-banner');
  });

  it('provides an explicit plan comparison before checkout',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('Compare antes de assinar');
    expect(wallet).toContain('Créditos por mês');
    expect(wallet).toContain('Modelos disponíveis');
    expect(wallet).toContain('Saldo único entre categorias');
    expect(wallet).toContain('Rollover máximo');
    expect(wallet).toContain('Custo efetivo por 1.000 créditos');
  });

  it('derives image estimates from the live READY image catalog and labels them as estimates',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain("model.category==='IMAGE'");
    expect(wallet).toContain("model.readiness==='READY'");
    expect(wallet).toContain('model.minimum_credit_price');
    expect(wallet).toContain('Estimativa com imagens');
    expect(wallet).toContain('Estimativas usam os preços mínimos atuais');
    expect(wallet).toContain('workspaceService.listModels().catch(()=>[])');
  });

  it('does not invent model-access tiers between Creator Pro and Studio',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('<Check className="ia-compare-check"/> Todos');
    expect(wallet).not.toContain('modelos premium apenas');
    expect(wallet).not.toContain('modelos exclusivos');
  });
});
