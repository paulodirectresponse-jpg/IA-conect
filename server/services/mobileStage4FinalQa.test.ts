import fs from'node:fs';import path from'node:path';import{describe,expect,it}from'vitest';
const root=process.cwd(),read=(f:string)=>fs.readFileSync(path.join(root,f),'utf8');
describe('mobile stage 4 complete + stage 5 regression guards',()=>{
 const css=()=>read('src/styles/mobile-stage4.css');
 it('loads mobile stage globally with authenticated styles',()=>expect(read('src/styles/fullAppStyles.ts')).toContain("import'./mobile-stage4.css'"));
 it('covers every stage 4 destination',()=>{const s=css();for(const c of['.ia-community','.ia-wallet','.ia-history','.ia-settings','.ia-admin'])expect(s).toContain(c)});
 it('keeps changes phone-only and preserves desktop ownership',()=>{const s=css();expect(s).toContain('@media(max-width:767px)');expect(s).toContain('@media(max-width:359px)');expect(s).not.toContain('@media(min-width:768px)')});
 it('prevents iOS form zoom and provides touch-sized primary controls',()=>{const s=css();expect(s).toContain('font-size:16px!important');expect(s).toContain('min-height:44px!important');expect(s).toContain('touch-action:manipulation')});
 it('handles wide financial/admin data with deliberate horizontal scrolling',()=>{const s=css();expect(s).toContain('.ia-wallet table{min-width:560px}');expect(s).toContain('.ia-admin table{min-width:640px}');expect(s).toContain('-webkit-overflow-scrolling:touch')});
 it('makes Community and Wallet dialogs usable as phone fullscreen surfaces',()=>{const s=css();expect(s).toContain('min-height:100dvh!important');expect(s).toContain('max-height:100dvh!important');expect(s).toContain('border-radius:0!important')});
 it('preserves core business logic source files',()=>{for(const f of['CommunityView.tsx','WalletView.tsx','HistoryView.tsx','SettingsView.tsx','AdminView.tsx'])expect(fs.existsSync(path.join(root,'src/components/views',f))).toBe(true)});
});
