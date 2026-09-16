import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('mobile Studio stage 2',()=>{
  it('keeps desktop split-view panel widths while adding phone Create/Results tabs',()=>{
    const video=read('src/components/views/CreateView.tsx');
    const image=read('src/components/views/UnifiedImageCreateView.tsx');
    const layout=read('src/components/workspace/MobileStudioLayout.tsx');
    const videoPanel=read('src/components/workspace/CreatorPanel.tsx');
    const imagePanel=read('src/components/workspace/UnifiedImageCreatorPanel.tsx');
    expect(video).toContain('<MobileStudioLayout activeCount={mobileActiveCount}');
    expect(image).toContain('<MobileStudioLayout activeCount={mobileActiveCount}');
    expect(layout).toContain('Criar');
    expect(layout).toContain('Resultados');
    expect(layout).toContain('role="tablist"');
    expect(videoPanel).toContain('md:w-[352px] xl:w-[368px]');
    expect(imagePanel).toContain('md:w-[352px] xl:w-[368px]');
  });

  it('reports active jobs to the mobile Results badge without changing polling semantics',()=>{
    const gallery=read('src/components/workspace/CreationGallery.tsx');
    expect(gallery).toContain('onActiveCountChange?:(count:number)=>void');
    expect(gallery).toContain('onActiveCountChange?.(activeCount)');
    expect(gallery).toContain('generationClient.statusBatch(activeGenerationIds)');
    expect(gallery).toContain('document.hidden?12000:2200');
  });

  it('uses visualViewport to survive the mobile keyboard and keeps submit action sticky',()=>{
    const layout=read('src/components/workspace/MobileStudioLayout.tsx');
    const css=read('src/index.css');
    expect(layout).toContain('window.visualViewport');
    expect(layout).toContain("'ia-mobile-keyboard-open'");
    expect(css).toContain('.ia-generator-actionbar');
    expect(css).toContain('position:sticky');
    expect(css).toContain('font-size:16px!important');
    expect(css).toContain('scroll-padding-bottom:132px');
  });

  it('turns the model dropdown into a phone bottom sheet without changing the desktop dropdown',()=>{
    const picker=read('src/components/workspace/CompactModelPicker.tsx');
    const css=read('src/index.css');
    expect(picker).toContain('ia-model-picker-backdrop');
    expect(picker).toContain('ia-model-picker-menu');
    expect(picker).toContain("window.matchMedia('(max-width: 767px)')");
    expect(picker).toContain("e.key==='Escape'");
    expect(css).toContain('.ia-model-picker-menu');
    expect(css).toContain('position:fixed!important');
    expect(css).toContain('border-radius:20px 20px 0 0!important');
    expect(css).toContain('@media(min-width:768px)');
  });

  it('uses the responsive fullscreen shell for the Asset Picker on phones',()=>{
    const picker=read('src/components/workspace/AssetPickerModal.tsx');
    const dialog=read('src/components/common/ResponsiveDialogShell.tsx');
    const css=read('src/index.css');
    expect(picker).toContain('ResponsiveDialogShell');
    expect(picker).toContain('mobileMode="fullscreen"');
    expect(picker).toContain('backdropClassName="ia-asset-picker-backdrop"');
    expect(dialog).toContain('backdropClassName?:string');
    expect(css).toContain('.ia-asset-picker-body');
    expect(css).toContain('flex-direction:column');
    expect(css).toContain('.ia-asset-picker-sidebar');
    expect(css).toContain('overflow-x:auto!important');
  });

  it('uses touch copy and larger reference targets only on mobile',()=>{
    const video=read('src/components/workspace/CreatorPanel.tsx');
    const image=read('src/components/workspace/UnifiedImageCreatorPanel.tsx');
    const css=read('src/index.css');
    expect(video).toContain('ia-mobile-copy');
    expect(video).toContain('toque para adicionar');
    expect(image).toContain('Adicionar referência');
    expect(video).toContain('ia-reference-thumb');
    expect(image).toContain('ia-reference-thumb');
    expect(css).toContain('.ia-mobile-copy{display:none}');
    expect(css).toContain('.ia-desktop-copy{display:none!important}');
    expect(css).toContain('width:56px!important');
  });

  it('constrains generated media to the phone viewport with horizontal snap',()=>{
    const gallery=read('src/components/workspace/CreationGallery.tsx');
    const css=read('src/index.css');
    expect(gallery).toContain('ia-creation-strip');
    expect(gallery).toContain('ia-creation-card');
    expect(css).toContain('scroll-snap-type:x mandatory');
    expect(css).toContain('width:min(86vw,calc(100vw - 32px))!important');
  });

  it('keeps all Stage 2 visual overrides under the phone breakpoint',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile Studio — Stage 2'));
    expect(stage).toContain('@media(max-width:767px)');
    expect(stage).toContain('@media(max-width:479px)');
    expect(stage).toContain('@media(min-width:768px)');
    expect(stage.indexOf('.ia-generator-actionbar')).toBeGreaterThan(stage.indexOf('@media(max-width:767px)'));
  });
});
