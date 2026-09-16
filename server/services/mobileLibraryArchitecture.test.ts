import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('mobile Library stage 3',()=>{
  it('replaces the long project sidebar with a phone-only project selector',()=>{
    const hub=read('src/components/views/LibraryHubView.tsx');
    const css=read('src/index.css');
    expect(hub).toContain('ia-library-mobile-project-trigger');
    expect(hub).toContain('ResponsiveDialogShell');
    expect(hub).toContain('Escolher projeto');
    expect(hub).toContain('Criar projeto');
    expect(css).toContain('.ia-library-mobile-project-trigger{display:none}');
    expect(css).toContain('.ia-library-nav{display:none!important}');
    expect(css).toContain('.ia-library-project-sheet');
  });

  it('keeps the desktop Library navigation and project width intact',()=>{
    const hub=read('src/components/views/LibraryHubView.tsx');
    expect(hub).toContain('ia-library-nav xl:w-[244px]');
    expect(hub).toContain('ia-library-global-card');
    expect(hub).toContain('ia-library-projects');
  });

  it('uses two-column phone asset grids and touch-sized actions without changing desktop grid classes',()=>{
    const assets=read('src/components/views/AssetsView.tsx');
    const css=read('src/index.css');
    expect(assets).toContain('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5');
    expect(assets).toContain('ia-library-card-action');
    expect(assets).toContain('ia-library-external');
    expect(css).toContain('grid-template-columns:repeat(2,minmax(0,1fr))!important');
    expect(css).toContain('width:40px!important');
    expect(css).toContain('opacity:1!important');
  });

  it('prevents iOS input zoom in Library search, category and editor controls',()=>{
    const assets=read('src/components/views/AssetsView.tsx');
    const css=read('src/index.css');
    expect(assets).toContain('ia-library-search-input');
    expect(assets).toContain('ia-library-category-select');
    expect(css).toContain('.ia-library-search-input');
    expect(css).toContain('.ia-library-category-select');
    expect(css).toContain('font-size:16px!important');
  });

  it('turns entity creation and image pickers into fullscreen phone workflows',()=>{
    const entity=read('src/components/views/EntityLibraryView.tsx');
    const single=read('src/components/views/SingleImageEntityLibraryView.tsx');
    const css=read('src/index.css');
    expect(entity).toContain('ia-entity-modal-backdrop');
    expect(entity).toContain('ia-entity-picker-backdrop');
    expect(single).toContain('ia-entity-modal-backdrop');
    expect(single).toContain('ia-entity-picker-backdrop');
    expect(css).toContain('.ia-entity-modal,');
    expect(css).toContain('height:100dvh!important');
    expect(css).toContain('border-radius:0!important');
    expect(css).toContain('padding:10px 12px calc(10px + env(safe-area-inset-bottom))!important');
  });

  it('uses touch copy for entity reference slots while retaining desktop drag copy',()=>{
    const entity=read('src/components/views/EntityLibraryView.tsx');
    const single=read('src/components/views/SingleImageEntityLibraryView.tsx');
    expect(entity).toContain('ia-desktop-copy');
    expect(entity).toContain('Toque para escolher uma imagem');
    expect(single).toContain('ia-mobile-copy');
    expect(single).toContain('Toque para escolher');
  });

  it('keeps entity delete controls accessible on touch screens',()=>{
    const entity=read('src/components/views/EntityLibraryView.tsx');
    const single=read('src/components/views/SingleImageEntityLibraryView.tsx');
    const css=read('src/index.css');
    expect(entity).toContain('ia-entity-delete');
    expect(single).toContain('ia-entity-delete');
    expect(css).toContain('.ia-entity-card .ia-entity-delete');
    expect(css).toContain('min-width:40px');
  });

  it('marks the active project and keeps Asset Picker filters horizontally usable',()=>{
    const picker=read('src/components/workspace/AssetPickerModal.tsx');
    const css=read('src/index.css');
    expect(picker).toContain('ia-asset-picker-project-chip');
    expect(picker).toContain("scope==='GLOBAL'?'is-active");
    expect(picker).toContain('ia-asset-picker-filters');
    expect(css).toContain('.ia-asset-picker-project-chip.is-active');
    expect(css).toContain('.ia-asset-picker-filters');
    expect(css).toContain('flex-wrap:nowrap!important');
  });

  it('isolates Stage 3 visual overrides to phone breakpoints',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile Library — Stage 3'));
    expect(stage).toContain('@media(max-width:767px)');
    expect(stage).toContain('@media(max-width:359px)');
    expect(stage).not.toContain('@media(min-width:768px)');
  });
});
