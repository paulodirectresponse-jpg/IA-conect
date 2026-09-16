import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';
const root=process.cwd();const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
describe('mobile Dashboard stage 4A',()=>{
 const css=()=>read('src/styles/mobile-dashboard.css');
 it('keeps Dashboard navigation intact',()=>{const d=read('src/components/views/DashboardView.tsx');for(const s of['ia-dashboard-layout','ia-dashboard-main','ia-dashboard-rail',"onNavigate('create-image')","onNavigate('create-video')","onNavigate('history')"])expect(d).toContain(s)});
 it('uses one column and keeps rail',()=>{const s=css();expect(s).toContain('.ia-dashboard-layout{grid-template-columns:minmax(0,1fr)!important');expect(s).toContain('.ia-dashboard-rail{display:flex!important');expect(s).toContain('order:2')});
 it('stacks launch cards with touch targets',()=>{const s=css();expect(s).toContain('.ia-dashboard-launchpad{grid-template-columns:minmax(0,1fr)!important');expect(s).toContain('.ia-dashboard-launch{min-height:112px!important');expect(s).toContain('.ia-dashboard-history-link{min-height:44px');expect(s).toContain('.ia-dashboard-quick-list button{min-height:56px!important')});
 it('uses horizontal model rail',()=>{const s=css();for(const x of['grid-auto-flow:column!important','overflow-x:auto!important','scroll-snap-type:x mandatory','.ia-dashboard .ia-model-showcase-card{scroll-snap-align:start'])expect(s).toContain(x)});
 it('keeps responsive recent creations',()=>{const s=css();expect(s).toContain('.ia-dashboard-recent-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important');expect(s).toContain('@media(max-width:359px)');expect(s).toContain('.ia-dashboard-recent-grid{grid-template-columns:minmax(0,1fr)!important}')});
 it('isolates overrides to phones',()=>{const s=css();expect(s).toContain('@media(max-width:767px)');expect(s).not.toContain('@media(min-width:768px)')});
});
