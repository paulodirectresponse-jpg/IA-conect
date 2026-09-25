import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('commercial plans stage 3',()=>{
  it('renders the official three-plan experience from server metadata',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('Planos IA Connect');
    expect(wallet).toContain('3 planos simples');
    expect(wallet).toContain('{pack.name}');
    expect(wallet).toContain('{pack.description}');
    expect(wallet).toContain('pack.features.slice(0,3)');
    expect(wallet).not.toContain('packPresentation');
  });

  it('keeps plan selection on the existing secure Pix checkout',()=>{
    const wallet=read('src/components/views/WalletView.tsx');
    expect(wallet).toContain('paymentClient.purchasePack(selectedPack.pack_id,selectedPack.version');
    expect(wallet).toContain('Continuar para o Pix');
    expect(wallet).toContain('Mercado Pago');
  });
});
