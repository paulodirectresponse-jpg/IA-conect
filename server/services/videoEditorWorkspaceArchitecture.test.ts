import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Immersive video editor workspace',()=>{
 it('uses the shared editor workspace without permanent Minhas criações',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  expect(view).toContain('EditorWorkspaceShell');
  expect(view).toContain('EditorAssetPicker');
  expect(view).toContain('VideoEditorPreview');
  expect(view).toContain('VideoNavigationTimeline');
  expect(view).not.toContain('CreationGallery');
  expect(view).not.toContain('Minhas criações');
 });

 it('keeps only the real Stable video editing capabilities',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  expect(view).toContain("'video-edit'");
  expect(view).toContain("'video-extend'");
  for(const unsupported of ["'text-to-video'","'image-to-video'","'first-frame'","'last-frame'"])expect(view).not.toContain(unsupported);
 });

 it('uses the same global library and decouples assets from catalog loading',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  const picker=read('src/components/editors/shared/EditorAssetPicker.tsx');
  expect(view).toContain('assetService.listAssets()');
  expect(view).toContain("filter(asset=>asset.type==='VIDEO')");
  expect(view).toContain('loadCatalog');
  expect(view).toContain('loadVideos');
  expect(view).not.toContain('Promise.all([editorClient.catalog(),assetService.listAssets');
  expect(picker).toContain("assetType='IMAGE'");
  expect(picker).toContain("accept={isVideo?'video/*':'image/*'}");
 });

 it('always exposes Auto plus manual model selection using the shared picker',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  expect(view).toContain('StableGeneratorModelPicker');
  expect(view).toContain("modelId==='AUTO'?'AUTO':model.model_id");
  expect(view).toContain("setModelId('AUTO')");
  expect(view).not.toContain('<select value={model?.model_id');
 });

 it('makes tool navigation independent from route readiness',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  expect(view).toContain('onClick={()=>setTool(item.id)}');
  expect(view).not.toContain('disabled={!available}');
  expect(view).toContain('routeReady');
 });

 it('drives controls from capability metadata and preserves existing execution semantics',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  for(const control of ["controls.has('duration')","controls.has('resolution')","controls.has('aspect_ratio')"])expect(view).toContain(control);
  expect(view).toContain("tool==='video-edit'&&!prompt.trim()");
  expect(view).toContain("audio_enabled:audioEnabled");
  expect(view).toContain('editorClient.create');
  expect(view).toContain('editorClient.quote');
  expect(view).toContain('editorClient.queue');
  expect(view).toContain('refreshWallet');
  expect(view).toContain("new CustomEvent('creations:updated'");
 });

 it('provides real playback scrubbing instead of fake NLE actions',()=>{
  const preview=read('src/components/editors/video/VideoEditorPreview.tsx');
  const timeline=read('src/components/editors/video/VideoNavigationTimeline.tsx');
  expect(preview).toContain('currentTime');
  expect(preview).toContain('requestFullscreen');
  expect(preview).toContain('Original');
  expect(preview).toContain('Resultado');
  expect(timeline).toContain('Scrubbing');
  expect(timeline).toContain('onSeek');
  for(const fake of ['Dividir','Excluir','Keyframe','Transição','Estabilizar','Remover fundo'])expect(preview+timeline).not.toContain(fake);
 });

 it('allows a generated result to become the next non-destructive source',()=>{
  const view=read('src/components/views/VideoEditorView.tsx');
  const preview=read('src/components/editors/video/VideoEditorPreview.tsx');
  expect(view).toContain('useResultAsSource');
  expect(view).toContain("setPreviewMode('result')");
  expect(preview).toContain('Original preservado');
 });
});
