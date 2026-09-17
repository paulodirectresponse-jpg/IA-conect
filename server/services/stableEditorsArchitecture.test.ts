import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Stable image and video editors',()=>{
 it('exposes both editors as Stable destinations',()=>{
  const app=read('src/App.tsx'),sidebar=read('src/components/layout/Sidebar.tsx'),layout=read('src/components/layout/AppLayout.tsx');
  expect(app).toContain("currentSafeView==='edit-image'");
  expect(app).toContain("currentSafeView==='edit-video'");
  expect(sidebar).toContain("id: 'edit-image'");
  expect(sidebar).toContain("id: 'edit-video'");
  expect(layout).toContain("currentView === 'edit-image'");
  expect(layout).toContain("currentView === 'edit-video'");
 });
 it('keeps the complete requested image editor toolset',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  for(const capability of ['image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'])expect(view).toContain(capability);
  expect(view).toContain('canvas ref={maskRef}');
  expect(view).toContain('editor_mask:true');
 });
 it('limits the Stable video editor to extend and edit',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  expect(view).toContain("'video-extend'");
  expect(view).toContain("'video-edit'");
  expect(view).not.toContain("'text-to-video'");
  expect(view).not.toContain("'image-to-video'");
  expect(view).not.toContain("'first-frame'");
  expect(view).not.toContain("'last-frame'");
 });
 it('uses Universal Jobs, Assets, wallet and the universal Minhas criações',()=>{
  const routes=read('server/routes/editorRoutes.ts'),image=read('src/components/views/ImageEditorView.tsx'),video=read('src/components/views/VideoEditorView.tsx');
  expect(routes).toContain('betaJobOrchestrator.create');
  expect(routes).toContain('betaJobOrchestrator.quote');
  expect(routes).toContain('betaJobOrchestrator.queue');
  expect(routes).toContain('assetRepository.getAsset');
  expect(image).toContain('CreationGallery defaultFilter="IMAGE"');
  expect(video).toContain('CreationGallery defaultFilter="VIDEO"');
  expect(image).toContain('refreshWallet');
  expect(video).toContain('refreshWallet');
  expect(image).toContain("new CustomEvent('creations:updated'");
  expect(video).toContain("new CustomEvent('creations:updated'");
 });
 it('keeps provider choice server-governed and does not expose provider secrets',()=>{
  const routes=read('server/routes/editorRoutes.ts'),client=read('src/services/editorClient.ts');
  expect(routes).toContain('providerChoices');
  expect(routes).toContain("provider.status!=='ACTIVE'");
  expect(routes).toContain('configured.get');
  expect(routes).toContain('verifiedPriceKeys');
  expect(client).not.toMatch(/api[_-]?key|authorization|bearer/i);
 });
 it('does not create parallel jobs, assets or libraries',()=>{
  const routes=read('server/routes/editorRoutes.ts');
  expect(routes).not.toMatch(/editor_jobs|image_editor_assets|video_editor_assets|editor_library/);
 });
});
