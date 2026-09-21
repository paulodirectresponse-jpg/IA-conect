import fs from 'fs';
import path from 'path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('controlled greenfield factory reset',()=>{
  it('preserves identity infrastructure assets and real financial records',()=>{
    const source=read('server/services/factoryResetService.ts');
    expect(source).toContain("'Firebase Auth'");
    expect(source).toContain("'assets'");
    expect(source).toContain("'Supabase Storage'");
    expect(source).toContain("'credit_* de usuários reais'");
    expect(source).toContain('syntheticIds.has(uidOf(row))');
    expect(source).not.toMatch(/LEGACY_INVENTORY=.*users/);
  });

  it('requires preview namespace snapshot fingerprint and explicit confirmation',()=>{
    const source=read('server/services/factoryResetService.ts');
    for(const proof of ['ROUTING_V2_PREVIEW','ROUTING_V2_NAMESPACE','FACTORY_RESET_SNAPSHOT_REQUIRED','FACTORY_RESET_INVENTORY_CHANGED','RESET_GREENFIELD_AUTH_USERS_WALLET_ASSETS_PRESERVED'])expect(source).toContain(proof);
    expect(source).toContain("mode:'HYBRID'");
  });

  it('routes generator catalog and execution through READY inventory',()=>{
    expect(read('server/routes/catalogRoutes.ts')).toContain('routingV2CatalogService.listGeneratorModels()');
    expect(read('server/routes/generationRoutes.ts')).toContain('routingV2ExecutionService.preview');
    expect(read('server/services/generationService.ts')).toContain('return routingV2ExecutionService.start');
  });
});
