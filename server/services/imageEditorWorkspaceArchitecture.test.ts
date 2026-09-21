import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Immersive image editor workspace',()=>{
 it('uses an editor-first workspace instead of a permanent creation gallery',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  const shell=read('src/components/editors/shared/EditorWorkspaceShell.tsx');
  expect(view).toContain('EditorWorkspaceShell');
  expect(view).toContain('EditorAssetPicker');
  expect(view).toContain('ImageEditorCanvas');
  expect(view).not.toContain('CreationGallery');
  expect(view).not.toContain('Minhas criações');
  expect(shell).toContain("xl:grid-cols-[88px_minmax(0,1fr)_330px]");
 });

 it('keeps every real image editor capability available',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  for(const capability of ['image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'])expect(view).toContain(capability);
  expect(view).toContain('uploadMask');
  expect(view).toContain('variation_strength');
  expect(view).toContain('background_mode');
  expect(view).toContain('aspect_ratio');
  expect(view).toContain('resolution');
 });

 it('does not invent unsupported image-editing tools',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  for(const fake of ["label:'Brilho'","label:'Contraste'","label:'Saturação'","label:'Nitidez'","label:'Camadas'","label:'Forma'","label:'Texto'"])expect(view).not.toContain(fake);
 });

 it('keeps pricing jobs assets and provider routing server-authoritative',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  const routes=read('server/routes/editorRoutes.ts');
  expect(view).toContain('editorClient.create');
  expect(view).toContain('editorClient.quote');
  expect(view).toContain('editorClient.queue');
  expect(view).toContain('job?.quote?.credit_price');
  expect(view).toContain('refreshWallet');
  expect(view).toContain("new CustomEvent('creations:updated'");
  expect(view).not.toContain('preferred_provider_id');
  expect(routes).toContain('routingV2CatalogService.listCapabilityModels');
  expect(routes).not.toContain('providerRegistry');
  expect(routes).toContain('betaJobOrchestrator');
 });

 it('supports source result comparison and reusing a derived result as the next source',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  const canvas=read('src/components/editors/image/ImageEditorCanvas.tsx');
  expect(view).toContain('useResultAsSource');
  expect(view).toContain("setViewMode('compare')");
  expect(canvas).toContain('comparePosition');
  expect(canvas).toContain('Antes');
  expect(canvas).toContain('Depois');
  expect(canvas).toContain('Comparar');
 });

 it('keeps library selection contextual and uses the same global asset source as Biblioteca',()=>{
  const picker=read('src/components/editors/shared/EditorAssetPicker.tsx');
  const view=read('src/components/views/ImageEditorView.tsx');
  expect(picker).toContain('Buscar na Biblioteca');
  expect(picker).toContain('Biblioteca Global');
  expect(picker).toContain('thumbnail_url||asset.public_url');
  expect(picker).toContain("accept={isVideo?'video/*':'image/*'}");
  expect(view).toContain('assetService.listAssets()');
  expect(view).toContain("filter(asset=>asset.type==='IMAGE')");
  expect(view).not.toContain("assetService.listAssets({type:'IMAGE'})");
  expect(view).toContain("assetService.uploadAsset");
  expect(view).toContain('setPickerOpen(false)');
 });

 it('does not let a catalog failure lock the library or editing tool navigation',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  expect(view).toContain('loadCatalog');
  expect(view).toContain('loadImages');
  expect(view).not.toContain('Promise.all([editorClient.catalog(),assetService.listAssets');
  expect(view).not.toContain('disabled={!available}');
  expect(view).toContain('onClick={()=>setTool(item.id)}');
 });

 it('always exposes Auto plus manual IA selection through the shared model picker',()=>{
  const view=read('src/components/views/ImageEditorView.tsx');
  const picker=read('src/components/workspace/StableGeneratorModelPicker.tsx');
  expect(view).toContain('StableGeneratorModelPicker');
  expect(view).toContain("modelId==='AUTO'?'AUTO':model.model_id");
  expect(view).toContain("setModelId('AUTO')");
  expect(picker).toContain('CompactModelPicker');
 });

 it('does not reconstruct editor availability from optional legacy provider metadata',()=>{
  const routes=read('server/routes/editorRoutes.ts');
  expect(routes).toContain('routingV2CatalogService.listCapabilityModels');
  expect(routes).not.toContain('providersResult');
  expect(routes).not.toContain('pricingResult');
 });
});
