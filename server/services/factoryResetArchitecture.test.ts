import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('controlled greenfield factory reset',()=>{
  it('uses an AI-only allowlist and explicitly protects all user-owned records',()=>{
    const source=read('server/services/factoryResetService.ts');
    expect(source).toContain("'Firebase Auth de usuários reais'");
    expect(source).toContain('PROTECTED USER DATA MUST NEVER BE DELETED');
    for(const protectedCollection of ['assets','credit_accounts','credit_lots','credit_transactions','credit_reservations','payments','subscriptions','billing_records','beta_economic_ledger','beta_library_items','beta_projects','beta_spaces']){
      expect(source).toMatch(new RegExp(`PROTECTED_COLLECTIONS=.*['"]${protectedCollection}['"]`));
    }
    expect(source).toContain("SYNTHETIC_RUNTIME_COLLECTIONS.map(x=>`${x} (somente routing-v2 sintético)`)");
    expect(source).toContain('wholesale.includes(collection)?found:found.filter(isSyntheticRuntime)');
  });

  it('requires protected environment snapshot fingerprint and explicit confirmation',()=>{
    const source=read('server/services/factoryResetService.ts');
    for(const proof of ['ROUTING_V2_PREVIEW','FACTORY_RESET_PRODUCTION_ENABLED','FACTORY_RESET_APPROVAL_SHA256','FACTORY_RESET_SNAPSHOT_REQUIRED','FACTORY_RESET_INVENTORY_CHANGED','RESET_AI_CONFIGURATION_ONLY_PRESERVE_ALL_REAL_USER_DATA'])expect(source).toContain(proof);
    expect(source).toContain("mode:'HYBRID'");
  });

  it('routes generator catalog and execution through READY inventory',()=>{
    expect(read('server/routes/catalogRoutes.ts')).toContain('routingV2CatalogService.listGeneratorModels()');
    expect(read('server/routes/generationRoutes.ts')).toContain('routingV2ExecutionService.preview');
    expect(read('server/services/generationService.ts')).toContain('return routingV2ExecutionService.start');
  });
});
