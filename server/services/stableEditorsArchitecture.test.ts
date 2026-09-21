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
  const canvas=read('src/components/editors/image/ImageEditorCanvas.tsx');
  for(const capability of ['image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'])expect(view).toContain(capability);
  expect(canvas).toContain('<canvas ref={maskRef}');
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
 it('uses Universal Generations, Assets and wallet without a parallel editor lifecycle',()=>{
  const root=read('server/routes/index.ts'),image=read('src/components/views/ImageEditorView.tsx'),video=read('src/components/views/VideoEditorView.tsx'),picker=read('src/components/editors/shared/EditorAssetPicker.tsx');
  expect(root).not.toContain('editorRouter');
  expect(image).toContain('universalGenerationClient.quote');
  expect(image).toContain('universalGenerationClient.create');
  expect(video).toContain('universalGenerationClient.quote');
  expect(video).toContain('universalGenerationClient.create');
  expect(image).toContain('EditorAssetPicker');
  expect(picker).toContain('Biblioteca');
  expect(video).toContain('EditorAssetPicker');
  expect(image).toContain('refreshWallet');
  expect(video).toContain('refreshWallet');
  expect(image).toContain("new CustomEvent('creations:updated'");
  expect(video).toContain("new CustomEvent('creations:updated'");
 });
 it('keeps provider choice server-governed and does not expose provider secrets',()=>{
  const routes=read('server/routes/generationRoutes.ts'),client=read('src/services/universalGenerationClient.ts');
  expect(routes).toContain('routingV2AutoModelSelectionService.select');
  expect(routes).toContain('generationService.createAndStartGeneration');
  expect(client).not.toMatch(/api[_-]?key|authorization|bearer/i);
 });
 it('does not mount a parallel editor API',()=>{
  const root=read('server/routes/index.ts');
  expect(root).not.toContain('editorRouter');
  const image=read('src/components/views/ImageEditorView.tsx');
  const video=read('src/components/views/VideoEditorView.tsx');
  expect(image+video).not.toContain('editorClient');
 });
});
