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

  it('uses recurring subscription checkout instead of one-time plan purchase',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('subscriptionClient.createCheckout(selectedPack.pack_id,selectedPack.version)');
    expect(wallet).toContain('Assinatura mensal');
    expect(wallet).toContain('window.location.assign(sub.checkout_url)');
    expect(wallet).not.toContain('paymentClient.purchasePack');
  });

  it('supports plan change and cancellation from the wallet',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('subscriptionClient.changePlan');
    expect(wallet).toContain('subscriptionClient.cancel');
    expect(wallet).toContain('Trocar no próximo ciclo');
    expect(wallet).toContain('Cancelar renovação');
  });
});
