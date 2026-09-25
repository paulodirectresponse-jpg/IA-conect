import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('commercial plans subscription experience',()=>{
  it('renders the official three-plan experience from server metadata',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('Planos IA Connect');
    expect(wallet).toContain('{pack.name}');
    expect(wallet).toContain('{pack.description}');
    expect(wallet).toContain('pack.features.slice(0,3)');
    expect(wallet).not.toContain('packPresentation');
  });

  it('starts recurring checkout directly from the selected plan card',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('subscriptionClient.createCheckout(pack.pack_id,pack.version)');
    expect(wallet).toContain('Assinatura mensal');
    expect(wallet).toContain('Assinar {pack.name}');
    expect(wallet).toContain('Preparando pagamento...');
    expect(wallet).toContain('window.location.assign(sub.checkout_url)');
    expect(wallet).not.toContain('paymentClient.purchasePack');
    expect(wallet).not.toContain('Plano escolhido');
  });

  it('keeps pending checkout state and continuation inside the same plan card',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('Checkout iniciado');
    expect(wallet).toContain('Finalize o pagamento para ativar seu plano.');
    expect(wallet).toContain('Continuar pagamento');
    expect(wallet).toContain('Pagamento em processamento');
    expect(wallet).not.toContain('Assinatura aguardando conclusão no Mercado Pago.');
    expect(wallet).not.toContain('border-amber-300/15 bg-amber-300');
  });

  it('clears an expired pending checkout without requiring a page reload',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain("subscription?.status!=='PENDING'");
    expect(wallet).toContain('subscription.checkout_expires_at');
    expect(wallet).toContain('subscriptionClient.getCurrent()');
  });

  it('supports plan change and cancellation from the wallet',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('subscriptionClient.changePlan(pack.pack_id,pack.version)');
    expect(wallet).toContain('subscriptionClient.cancel');
    expect(wallet).toContain('Mudar para {pack.name}');
    expect(wallet).toContain('Cancelar renovação');
  });
});