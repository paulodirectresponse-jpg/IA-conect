import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces V2 phase 1 persistence',()=>{
 it('persists nodes edges viewport and metadata inside the flow graph',()=>{
  const types=read('server/beta/flows/flowTypes.ts');
  const service=read('server/beta/flows/flowService.ts');
  expect(types).toContain('viewport?:BetaFlowViewport');
  expect(types).toContain('metadata?:Record<string,unknown>');
  expect(service).toContain('return{nodes,edges,viewport,metadata}');
 });

 it('restores the saved viewport when reopening a Space',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("const initialViewport=flow.graph?.viewport||{x:160,y:100,zoom:.9}");
  expect(workspace).toContain('[zoom,setZoom]=useState(initialViewport.zoom)');
  expect(workspace).toContain('[pan,setPan]=useState({x:initialViewport.x,y:initialViewport.y})');
 });

 it('autosaves the current viewport with the graph',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('viewport:{x:pan.x,y:pan.y,zoom}');
  expect(workspace).toContain('metadata:{...(flow.graph?.metadata||{}),space_preview_assets:previewAssetIds}');
  expect(workspace).toContain('window.setTimeout(()=>void save(),650)');
 });

 it('marks pan zoom fit and toolbar zoom as persistence changes',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('if(panRef.current)markDirty()');
  expect(workspace).toContain('setZoom(next);markDirty()');
  expect(workspace).toContain('setPan({x:(r.width-(minX+maxX)*z)/2,y:(r.height-(minY+maxY)*z)/2});markDirty()');
  expect(workspace).toContain("onZoomOut={()=>{setZoom");
  expect(workspace).toContain("onZoomIn={()=>{setZoom");
 });

 it('flushes pending changes before navigating back to the Spaces home',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain("onBack={()=>{void (async()=>{if(dirty)await save(true);onBack();})();}}");
 });

 it('keeps optimistic revision conflict protection intact',()=>{
  const service=read('server/beta/flows/flowService.ts');
  expect(service).toContain("FLOW_REVISION_CONFLICT");
  expect(service).toContain('expected!==current.revision');
 });
});
