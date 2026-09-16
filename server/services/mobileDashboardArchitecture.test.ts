import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('mobile Dashboard stage 4A',()=>{
  it('keeps the existing Dashboard business structure and navigation intact',()=>{
    const dashboard=read('src/components/views/DashboardView.tsx');
    expect(dashboard).toContain('ia-dashboard-layout');
    expect(dashboard).toContain('ia-dashboard-main');
    expect(dashboard).toContain('ia-dashboard-rail');
    expect(dashboard).toContain("onNavigate('create-image')");
    expect(dashboard).toContain("onNavigate('create-video')");
    expect(dashboard).toContain("onNavigate('history')");
  });

  it('turns the phone Dashboard into a single-column composition without hiding the rail',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile Dashboard — Stage 4A'));
    expect(stage).toContain('.ia-dashboard-layout{grid-template-columns:minmax(0,1fr)!important');
    expect(stage).toContain('.ia-dashboard-rail{display:flex!important');
    expect(stage).toContain('order:2');
  });

  it('stacks creation launch cards and exposes touch-sized controls',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile Dashboard — Stage 4A'));
    expect(stage).toContain('.ia-dashboard-launchpad{grid-template-columns:minmax(0,1fr)!important');
    expect(stage).toContain('.ia-dashboard-launch{min-height:112px!important');
    expect(stage).toContain('.ia-dashboard-history-link{min-height:44px');
    expect(stage).toContain('.ia-dashboard-quick-list button{min-height:56px!important');
  });

  it('uses a horizontal scroll-snap rail for featured models on phones',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile Dashboard — Stage 4A'));
    expect(stage).toContain('.ia-dashboard .ia-model-showcase-grid{display:grid!important');
    expect(stage).toContain('grid-auto-flow:column!important');
    expect(stage).toContain('overflow-x:auto!important');
    expect(stage).toContain('scroll-snap-type:x mandatory');
    expect(stage).toContain('.ia-dashboard .ia-model-showcase-card{scroll-snap-align:start');
  });

  it('keeps recent creations in two columns on normal phones and one on narrow phones',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile Dashboard — Stage 4A'));
    expect(stage).toContain('.ia-dashboard-recent-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important');
    expect(stage).toContain('@media(max-width:359px)');
    expect(stage).toContain('.ia-dashboard-recent-grid{grid-template-columns:minmax(0,1fr)!important}');
  });

  it('isolates Stage 4A visual overrides to phone breakpoints',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile Dashboard — Stage 4A'));
    expect(stage).toContain('@media(max-width:767px)');
    expect(stage).toContain('@media(max-width:359px)');
    expect(stage).not.toContain('@media(min-width:768px)');
  });
});
