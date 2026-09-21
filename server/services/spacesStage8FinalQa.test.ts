import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 8 final QA',()=>{
 it('keeps the toolbar usable on narrow screens without changing desktop controls',()=>{
  const toolbar=read('src/components/spaces/canvas/SpaceToolbar.tsx');
  expect(toolbar).toContain('overflow-x-auto');
  expect(toolbar).toContain('sm:overflow-visible');
  expect(toolbar).toContain('hidden sm:inline');
  expect(toolbar).toContain('sm:hidden');
  expect(toolbar).toContain('aria-label="Executar workflow completo"');
 });

 it('makes Inspector and quick menu responsive on small screens',()=>{
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  const menu=read('src/components/spaces/canvas/SpaceQuickMenu.tsx');
  expect(inspector).toContain('inset-x-3');
  expect(inspector).toContain('sm:inset-x-auto');
  expect(inspector).toContain('aria-label="Inspector avançado do node"');
  expect(menu).toContain('w-[min(300px,calc(100vw-24px))]');
  expect(menu).toContain('role="dialog"');
 });

 it('provides essential keyboard shortcuts without hijacking text inputs',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("target?.closest('input,textarea,select,[contenteditable=\"true\"]')");
  expect(workspace).toContain("event.key==='Escape'");
  expect(workspace).toContain("event.key.toLowerCase()==='d'");
  expect(workspace).toContain("event.key==='Delete'||event.key==='Backspace'");
  expect(workspace).toContain("event.key.toLowerCase()==='f'");
  expect(workspace).toContain("event.key==='/'");
 });

 it('announces important loading and error states to assistive technology',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(workspace).toContain('role="alert" aria-live="assertive"');
  expect(workspace).toContain('role="status" aria-live="polite"');
  expect(home).toContain('role="alert"');
  expect(home).toContain('role="status" aria-live="polite"');
 });

 it('turns the empty canvas into an actionable first-use state',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('Adicionar primeira ferramenta');
  expect(workspace).toContain('onClick={openAddMenu}');
  expect(workspace).toContain('role="application"');
  expect(workspace).toContain('aria-label="Canvas do Space"');
 });

 it('exposes accessible names for node and history controls',()=>{
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  const preview=read('src/components/spaces/nodes/NodeResultPreview.tsx');
  for(const label of ['Entrada do node','Saída do node; arraste para conectar','Nome do node','Abrir Inspector','Executar daqui para frente','Duplicar node','Excluir node'])expect(shell).toContain(label);
  expect(preview).toContain('alt="Resultado gerado"');
  expect(preview).toContain('aria-label="Resultado em vídeo"');
  expect(preview).toContain('aria-label="Ver resultado anterior"');
  expect(preview).toContain('aria-label="Ver resultado mais recente"');
 });

 it('shows feedback while opening a Space and avoids O(n²) Home preview lookup',()=>{
  const view=read('src/components/views/SpacesView.tsx');
  const home=read('src/components/spaces/SpacesHome.tsx');
  expect(view).toContain('openingId');
  expect(view).toContain('setOpeningId(flowId)');
  expect(home).toContain('const itemMap=useMemo');
  expect(home).toContain('itemMap.get(flow.flow_id)');
  expect(home).not.toContain('homeItems.find');
 });

 it('surfaces terminal run failures instead of silently stopping polling',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("next.status==='FAILED'");
  expect(workspace).toContain("next.status==='CANCELLED'");
  expect(workspace).toContain("next.error_message||'A execução do Space falhou.");
 });

 it('keeps final QA scoped to Spaces without introducing a new runtime or persistence model',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const inspector=read('src/components/spaces/inspector/SpaceAdvancedInspector.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.save');
  expect(inspector).not.toContain('apiRequest');
  expect(inspector).not.toContain('localStorage');
 });
});