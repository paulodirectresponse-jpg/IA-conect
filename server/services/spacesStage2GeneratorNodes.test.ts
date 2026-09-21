import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('Spaces stage 2 generator nodes',()=>{
 it('uses dedicated image and video generator nodes inside the shared shell',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  expect(workspace).toContain('ImageGeneratorNode');
  expect(workspace).toContain('VideoGeneratorNode');
  expect(workspace).toContain("['text-to-image','image-to-image']");
  expect(workspace).toContain("['text-to-video','image-to-video']");
  expect(workspace).toContain('SpaceNodeShell');
 });

 it('keeps preview and prompt available together instead of replacing configuration after success',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(generator).toContain('Seu resultado aparecerá aqui');
  expect(generator).toContain('value={node.prompt||');
  expect(generator).toContain('{preview||');
  expect(generator).not.toMatch(/preview\?[^:]+:<textarea/);
 });

 it('derives generation controls from the Routing V2 capability catalog',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  const routes=read('server/routes/spacesRoutes.ts');
  expect(generator).toContain("controls.has('aspect_ratio')");
  expect(generator).toContain("controls.has('resolution')");
  expect(generator).toContain("controls.has('duration')");
  expect(generator).toContain('supported_aspect_ratios');
  expect(generator).toContain('supported_resolutions');
  expect(generator).toContain('supported_durations');
  expect(routes).toContain('routingV2CatalogService.listCapabilityModels');
 });

 it('keeps Auto first-class and clears incompatible controls on manual model changes',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(generator).toContain('Auto · IA Conect escolhe por você');
  expect(generator).toContain("model_id:e.target.value,controls:{}");
  expect(generator).not.toContain('provider_id');
 });

 it('never invents a generation price in the card',()=>{
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(generator).toContain('nodeRun?.authorized_credit_price');
  expect(generator).toContain('Calculado ao executar');
  expect(generator).not.toMatch(/price\s*=\s*\d+/);
 });

 it('gives generator cards more room without enlarging asset and editor nodes',()=>{
  const layout=read('src/components/spaces/canvas/spaceLayout.ts');
  const shell=read('src/components/spaces/nodes/SpaceNodeShell.tsx');
  const connections=read('src/components/spaces/canvas/SpaceConnectionLayer.tsx');
  expect(layout).toContain('SPACE_GENERATOR_NODE_W=340');
  expect(layout).toContain('spaceNodeWidth');
  expect(shell).toContain('spaceNodeWidth(node)');
  expect(connections).toContain('spaceConnectionPath');
 });

 it('preserves the existing Spaces runtime and does not create a second generation backend',()=>{
  const workspace=read('src/components/spaces/SpaceWorkspace.tsx');
  const generator=read('src/components/spaces/nodes/GeneratorNode.tsx');
  expect(workspace).toContain('spacesClient.start');
  expect(workspace).toContain('spacesClient.advance');
  expect(generator).not.toContain('universalGenerationClient');
  expect(generator).not.toContain('apiRequest');
  expect(generator).not.toContain('spacesClient');
 });
});