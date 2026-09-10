import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
function files(dir:string):string[]{
 const abs=path.join(root,dir);
 const out:string[]=[];
 for(const entry of fs.readdirSync(abs,{withFileTypes:true})){
  const rel=path.join(dir,entry.name);
  if(entry.isDirectory())out.push(...files(rel));
  else if(/\.(ts|tsx)$/.test(entry.name)&&!entry.name.includes('.test.'))out.push(rel);
 }
 return out;
}
const runtime=[...files('src'),...files('server')];

describe('final IA Connect architecture closure',()=>{
 it('has no legacy wallet or pricing implementation files',()=>{
  for(const file of[
   'server/repositories/walletRepository.ts',
   'server/services/walletService.ts',
   'src/services/walletService.ts',
   'server/services/pricingService.ts',
   'src/components/workspace/PromptEditor.tsx',
   'src/components/workspace/GenerationQuickSettings.tsx',
  ])expect(fs.existsSync(path.join(root,file)),file).toBe(false);
 });

 it('has no legacy wallet symbols in runtime source',()=>{
  const forbidden=['walletRepository','walletService','WalletAccount','WalletTransaction','WALLET_INSUFFICIENT_FUNDS','legacy_wallet_write_enabled','STUDIO_FALLBACK','available_balance_cents','reserved_balance_cents','total_balance_cents'];
  const offenders:string[]=[];
  for(const file of runtime){
   const source=read(file);
   for(const token of forbidden)if(source.includes(token))offenders.push(`${file}: ${token}`);
  }
  expect(offenders).toEqual([]);
 });

 it('keeps customer generation contracts credits-only',()=>{
  const clientFiles=files('src');
  const forbidden=['estimated_cost_cents','maximum_authorized_cost_cents','final_cost_cents','customer_balance_available_cents','balance_after_generation_cents'];
  const offenders:string[]=[];
  for(const file of clientFiles){
   const source=read(file);
   for(const token of forbidden)if(source.includes(token))offenders.push(`${file}: ${token}`);
  }
  expect(offenders).toEqual([]);
  expect(read('server/services/generationService.ts')).not.toContain('walletService');
  expect(read('server/services/generationService.ts')).not.toContain('creditBilling(');
  expect(read('server/services/generationService.ts')).not.toContain('maximum_authorized_cost_cents');
  expect(read('server/services/generationService.ts')).not.toContain('estimated_cost_cents');
 });

 it('has no static pricing fallback in the creator UI',()=>{
  const picker=read('src/components/workspace/CompactModelPicker.tsx');
  expect(picker).not.toContain('customer_price_cents');
  expect(picker).not.toContain('staticModelPrice');
  expect(picker).not.toContain('PricingEntry');
  expect(read('src/services/workspaceService.ts')).not.toContain('listPricing');
  expect(read('server/routes/catalogRoutes.ts')).not.toContain("'/catalog/pricing'");
  expect(read('server/routes/adminRoutes.ts')).not.toContain('pricingService');
  expect(read('server/repositories/catalogRepository.ts')).not.toContain('listPricing');
  expect(read('src/config/studioCatalog.ts')).not.toContain('SEED_PRICING');
 });

 it('uses the persistent catalog for operational pricing monitoring',()=>{
  const source=read('server/services/pricingSyncService.ts');
  expect(source).toContain('catalogRepository.listModels()');
  expect(source).not.toContain('STUDIO_SEED_MODELS');
  expect(source).not.toContain('STUDIO_FALLBACK');
 });

 it('uses Credits V2 as the only customer balance service',()=>{
  expect(read('src/context/AuthContext.tsx')).toContain('creditService');
  expect(read('src/components/views/WalletView.tsx')).toContain('creditService');
  expect(read('src/components/admin/AdminCoupons.tsx')).toContain('creditService');
  expect(read('server/services/creditWalletService.ts')).not.toContain('walletRepository');
 });

 it('exposes one operational health snapshot for administrators',()=>{
  expect(read('server/routes/adminRoutes.ts')).toContain("'/admin/system-health'");
  expect(read('server/services/systemHealthService.ts')).toContain('catalogRepository.listModels()');
  expect(read('server/services/systemHealthService.ts')).toContain('providerRegistry.listAdapters()');
  expect(read('src/components/views/AdminView.tsx')).toContain('Saúde operacional');
 });

 it('projects provider configuration from runtime adapters',()=>{
  const source=read('server/routes/catalogRoutes.ts');
  expect(source).toContain('providerRegistry.listAdapters()');
  expect(source).toContain('adapter.isConfigured()');
 });
});
