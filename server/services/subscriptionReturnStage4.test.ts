import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('subscription return stage 4',()=>{
  it('routes Mercado Pago return directly to wallet',()=>{
    const app=read('src/App.tsx');
    expect(app).toContain("params.get('subscription')==='return'");
    expect(app).toContain("setActiveView('wallet')");
    expect(app).toContain('<WalletView onNavigate={navigate}/>');
  });

  it('polls the subscription on return and refreshes wallet data',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain("params.get('subscription')!=='return'");
    expect(wallet).toContain('for(let attempt=0;attempt<8;attempt++)');
    expect(wallet).toContain('subscriptionClient.getCurrent()');
    expect(wallet).toContain('refreshWallet()');
    expect(wallet).toContain("next.searchParams.delete('subscription')");
  });

  it('shows first-party active pending and failed states instead of gateway copy',()=>{
    const notice=read('src/components/views/SubscriptionReturnNotice.tsx');
    expect(notice).toContain('Assinatura ativada');
    expect(notice).toContain('Confirmação em andamento');
    expect(notice).toContain('Não foi possível concluir');
    expect(notice).toContain('Começar a criar');
    expect(notice).toContain('Continuar pagamento');
    expect(notice).toContain('Ver planos');
    expect(notice).not.toContain('Mercado Pago');
  });

  it('uses IA Connect semantic tokens and no generic warning treatment',()=>{
    const css=read('src/index.css');
    expect(css).toContain('.ia-subscription-return');
    expect(css).toContain('var(--ia-brand)');
    expect(css).toContain('var(--ia-success)');
    expect(css).toContain('var(--ia-danger)');
    expect(css).not.toContain('.ia-subscription-return{background:yellow');
  });
});
