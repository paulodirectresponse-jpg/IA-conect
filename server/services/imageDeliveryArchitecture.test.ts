import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('stage 6 image delivery architecture',()=>{
  it('keeps PNG masters and generates versioned AVIF/WebP derivatives at build time',()=>{
    const packageJson=JSON.parse(read('package.json'));
    const script=read('scripts/optimize-static-images.mjs');
    expect(packageJson.scripts.build).toContain('npm run images:optimize');
    expect(packageJson.devDependencies.sharp).toBeTruthy();
    expect(script).toContain("create-image-cat-desktop.png");
    expect(script).toContain("create-video-surfer-desktop.png");
    expect(script).toContain("planet-hero-wide.png");
    expect(script).toContain("nano-banana-pro-image.png");
    expect(script).toContain(".webp({quality:82");
    expect(script).toContain(".avif({quality:64");
    expect(fs.existsSync(path.join(root,'public/enterprise/visuals/planet-hero-wide.png'))).toBe(true);
    expect(fs.existsSync(path.join(root,'public/model-covers/gpt-image-2.png'))).toBe(true);
  });

  it('uses browser format negotiation with PNG fallback for enterprise art',()=>{
    const config=read('src/config/enterpriseVisualAssets.ts');
    const layout=read('src/components/layout/AppLayout.tsx');
    const css=read('src/styles/enterprise-theme.css');
    expect(config).toContain('cssImageSet');
    expect(config).toContain("-v1.avif");
    expect(config).toContain("-v1.webp");
    expect(layout).toContain('cssImageSet(enterpriseVisualAssets.homePlanet)');
    expect(css).toContain("image-set(url('/enterprise/visuals/planet-hero-wide-v1.avif')");
    expect(css).toContain("url('/enterprise/visuals/planet-hero-wide.png') type('image/png')");
  });

  it('renders large image model covers through picture sources',()=>{
    const covers=read('src/config/imageModelCovers.ts');
    const picker=read('src/components/workspace/CompactModelPicker.tsx');
    const panel=read('src/components/workspace/UnifiedImageCreatorPanel.tsx');
    expect(covers).toContain('getImageModelCoverSources');
    expect(picker).toContain('<source srcSet={coverSources.avif} type="image/avif"/>');
    expect(picker).toContain('<source srcSet={coverSources.webp} type="image/webp"/>');
    expect(panel).toContain('selectedCoverSources={selectedCoverSources}');
  });

  it('sets long immutable caching only on versioned static derivatives',()=>{
    const headers=read('public/_headers');
    expect(headers).toContain('max-age=31536000, immutable');
    expect(headers).toContain('/enterprise/visuals/*-v1.avif');
    expect(headers).toContain('/model-covers/*-v1.webp');
    expect(headers).toContain('stale-while-revalidate=604800');
  });

  it('uses thumbnails for list/card surfaces while preserving originals for detail views',()=>{
    const community=read('src/components/views/CommunityView.tsx');
    const dashboard=read('src/components/views/DashboardView.tsx');
    const history=read('src/components/views/HistoryView.tsx');
    expect(community).toContain('src={item.thumbnail_url||item.result_url}');
    expect(community).toContain('src={selected.result_url}');
    expect(dashboard).toContain('src={g.thumbnail_url||g.result_url!}');
    expect(history).toContain('sources={[g.thumbnail_url,g.result_url,...(g.result_urls||[])]}');
  });

  it('preserves provider thumbnails when a provider returns one',()=>{
    const generation=read('server/services/generationService.ts');
    expect(generation).toContain('g.thumbnail_url=status.thumbnail_url||outputs[0]||null');
    expect(generation).toContain("i===0&&generation.thumbnail_url?generation.thumbnail_url:url");
  });
});
