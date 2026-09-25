import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('IA Conect credit coin visual system',()=>{
  it('uses one reusable blue credit coin component across primary product surfaces',()=>{
    const coin=read('src/components/common/CreditAmount.tsx');
    const navbar=read('src/components/layout/Navbar.tsx');
    const picker=read('src/components/workspace/CompactModelPicker.tsx');
    const controls=read('src/components/workspace/GeneratorControls.tsx');
    const wallet=read('src/components/views/WalletView.tsx');
    expect(coin).toContain('from-cyan-300 via-sky-400 to-blue-600');
    expect(coin).toContain('aria-label');
    expect(navbar).toContain('<CreditAmount value={balance}');
    expect(picker).toContain('<CreditAmount value={unitPrice(m)}');
    expect(controls).toContain('<CreditAmount value={price}');
    expect(controls).toContain('<CreditAmount value={balance}');
    expect(wallet).toContain('<CreditAmount value={wallet?.available_credits');
  });

  it('shows direct model prices without legacy starting-at or cr suffix copy',()=>{
    const picker=read('src/components/workspace/CompactModelPicker.tsx');
    expect(picker).not.toContain('a partir de');
    expect(picker).not.toContain(' cr');
    expect(picker).not.toContain('cr/img');
    expect(picker).not.toContain('cr/s');
  });

  it('keeps generator CTAs and route retail prices on the coin visual language',()=>{
    const image=read('src/components/workspace/UnifiedImageCreatorPanel.tsx');
    const video=read('src/components/workspace/CreatorPanel.tsx');
    const routing=read('src/components/admin/AdminRoutingV2.tsx');
    expect(image).toContain('primaryPrice={!p.hasPendingReferences?p.totalPrice:null}');
    expect(video).toContain('primaryPrice={!p.hasPendingReferences?p.totalEstimatedCostCents:null}');
    expect(routing).toContain('<CreditAmount value={best.pricing_snapshot.retail_price_credits}');
    expect(routing).not.toContain('retail_price_credits} cr');
  });
});
