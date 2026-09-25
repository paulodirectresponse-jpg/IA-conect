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
    expect(wallet).toContain('Imagens estimadas');
    expect(wallet).toContain('Estimativas usam os preços mínimos atuais');
    expect(wallet).toContain('workspaceService.listModels().catch(()=>[])');
  });

  it('keeps subscription action and pending state inside each plan card',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    const css=read('src/index.css');
    expect(wallet).toContain('ia-plan-card-action');
    expect(wallet).toContain('ia-plan-inline-state');
    expect(wallet).toContain('Continuar pagamento');
    expect(css).toContain('.ia-plan-card-cta');
    expect(css).toContain('var(--ia-brand)');
    expect(wallet).not.toContain('Assinatura aguardando conclusão no Mercado Pago.');
  });

  it('makes Pro the dominant middle plan and selected plans visibly stronger',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    const css=read('src/index.css');
    expect(wallet).toContain("pack.pack_id==='pro'?'is-primary-plan':''");
    expect(wallet).toContain('Mais popular');
    expect(css).toContain('.ia-plan-card.is-primary-plan');
    expect(css).toContain('.ia-plan-card.is-primary-plan.is-selected');
    expect(css).toContain('transform:scale(1.055)');
  });

  it('makes the middle Pro card taller as well as wider on desktop',()=>{
    const css=read('src/index.css');
    expect(css).toContain('.ia-plan-card.is-primary-plan');
    expect(css).toContain('min-height:396px');
    expect(css).toContain('margin-block:-18px');
    expect(css).toContain('min-height:408px');
    expect(css).toContain('margin-block:-24px');
  });

  it('shows image and video production estimates without inventing video numbers before READY models exist',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain("model.category==='VIDEO'");
    expect(wallet).toContain("model.readiness==='READY'");
    expect(wallet).toContain('videoEstimate');
    expect(wallet).toContain('vídeos de 5s');
    expect(wallet).toContain('Disponível quando os modelos de vídeo forem ativados');
    expect(wallet).toContain('Aguardando modelos de vídeo');
  });

  it('makes the primary Pro card taller and selected plans visibly dominant on desktop',()=>{
    const css=read('src/index.css');
    expect(css).toContain('.ia-plan-card.is-primary-plan');
    expect(css).toContain('min-height:390px');
    expect(css).toContain('margin-block:-14px');
    expect(css).toContain('min-height:404px');
  });

  it('shows only maximum image and video capacity based on the cheapest READY model',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('const cheapest=Math.min(...imagePrices)');
    expect(wallet).toContain('const maximum=Math.max(1,Math.floor(pack.total_credits/cheapest))');
    expect(wallet).toContain('const cheapestFiveSeconds=Math.min(...videoPrices)*seconds');
    expect(wallet).not.toContain('lower=');
    expect(wallet).toContain('capacidade máxima usando o modelo READY de menor custo disponível');
  });
  it('does not invent model-access tiers between Creator Pro and Studio',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('<Check className="ia-compare-check"/> Todos');
    expect(wallet).not.toContain('modelos premium apenas');
    expect(wallet).not.toContain('modelos exclusivos');
  });
});
