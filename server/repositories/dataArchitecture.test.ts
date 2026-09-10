import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

function sourceFiles(dir:string):string[]{
  const absolute=path.join(root,dir);
  const out:string[]=[];
  for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
    const relative=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...sourceFiles(relative));
    else if(/\.(ts|tsx)$/.test(entry.name)&&!entry.name.endsWith('.test.ts')&&!entry.name.endsWith('.test.tsx'))out.push(relative);
  }
  return out;
}

describe('data architecture invariants',()=>{
  it('keeps Firebase client identity-only',()=>{
    const offenders=sourceFiles('src').filter((file)=>{
      const source=read(file);
      return source.includes('firebase/firestore')||source.includes('firebase/storage');
    });
    expect(offenders).toEqual([]);
    expect(read('src/config/firebase.ts')).toContain("firebase/auth");
  });

  it('keeps Firebase Admin out of runtime code',()=>{
    expect(fs.existsSync(path.join(root,'server/repositories/firebaseAdminClient.ts'))).toBe(false);
    const offenders=sourceFiles('server').filter((file)=>{
      const source=read(file);
      return source.includes('firebase-admin')||source.includes('firebaseAdminClient');
    });
    expect(offenders).toEqual([]);
    const pkg=JSON.parse(read('package.json'));
    expect(pkg.dependencies?.['firebase-admin']).toBeUndefined();
  });

  it('uses Firestore REST for persistent repositories',()=>{
    for(const file of[
      'server/repositories/userRepository.ts',
      'server/repositories/assetRepository.ts',
      'server/repositories/auditRepository.ts',
      'server/repositories/catalogRepository.ts',
      'server/repositories/draftRepository.ts',
      'server/repositories/presetRepository.ts',
      'server/repositories/userPreferencesRepository.ts',
      'server/repositories/creativeEntityRepository.ts',
    ]){
      expect(read(file),file).toContain('firestoreAdminRest');
      expect(read(file),file).not.toContain('getAdminDb');
    }
  });

  it('does not use process memory as workspace persistence',()=>{
    expect(read('server/repositories/draftRepository.ts')).not.toContain('new Map');
    expect(read('server/repositories/presetRepository.ts')).not.toContain('new Map');
    expect(read('server/repositories/userPreferencesRepository.ts')).not.toContain('new Map');
  });

  it('keeps browser data services API-only',()=>{
    for(const file of[
      'src/services/authService.ts',
      'src/services/workspaceService.ts',
      'src/services/assetService.ts',
      'src/services/creativeEntityService.ts',
    ]){
      const source=read(file);
      expect(source,file).not.toContain('firebase/firestore');
      expect(source,file).not.toContain('setDoc(');
      expect(source,file).not.toContain('updateDoc(');
      expect(source,file).not.toContain('deleteDoc(');
    }
  });

  it('keeps catalog runtime persistent with no UI fallback',()=>{
    expect(read('server/repositories/catalogRepository.ts')).toContain('firestoreAdminRest');
    expect(read('src/services/workspaceService.ts')).not.toContain('STUDIO_FALLBACK_MODELS');
    expect(read('src/services/workspaceService.ts')).not.toContain('STUDIO_FALLBACK_PRICING');
    expect(read('server/services/creditPricingService.ts')).not.toContain('STUDIO_FALLBACK_MODELS');
  });

  it('has one backend Firestore transport',()=>{
    expect(read('server/repositories/firestoreClient.ts')).not.toContain('firestoreRestCall');
    expect(read('server/services/assetReferenceResolver.ts')).not.toContain('getAdminStorage');
    expect(read('server/services/authService.ts')).not.toContain('walletRepository');
  });
});
