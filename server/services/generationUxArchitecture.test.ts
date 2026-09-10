import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('phase 3 generation invariants',()=>{
  it('validates the authorized retail quote without repricing it live before submission',()=>{
    const source=read('server/services/generationService.ts');
    const createStart=source.indexOf('async createAndStartGeneration');
    const refreshStart=source.indexOf('async refreshGenerationState',createStart);
    const createBlock=source.slice(createStart,refreshStart);
    expect(createBlock).toContain('force_live_quote:false');
    expect(createBlock).toContain('generationExecutionEconomics(price,reservation.authorized_net_backing_micros)');
    expect(createBlock).not.toContain('normal_floor_margin_percent/100');
  });

  it('keeps live provider routing after credits are reserved',()=>{
    const source=read('server/services/generationService.ts');
    const routeStart=source.indexOf('async function routeAndSubmit');
    const createStart=source.indexOf('async createAndStartGeneration');
    const routeBlock=source.slice(routeStart,createStart);
    expect(routeBlock).toContain('force_live_quote:true');
    expect(routeBlock).toContain('submitCandidate');
  });

  it('renders prompt text only once',()=>{
    const source=read('src/components/workspace/PromptComposer.tsx');
    expect(source).not.toContain('highlightRef');
    expect(source).not.toContain('highlightedPrompt');
    expect(source).not.toContain('text-transparent');
    expect((source.match(/<textarea/g)||[]).length).toBeGreaterThanOrEqual(1);
  });

  it('keeps image generation errors next to the submit action',()=>{
    const source=read('src/components/workspace/UnifiedImageCreatorPanel.tsx');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
    expect(source).toContain('Geração enviada. Aguardando o processamento...');
  });

  it('does not advertise internal economics in the customer quote route',()=>{
    const source=read('server/routes/generationRoutes.ts');
    expect(source).not.toContain('Margem operacional');
    expect(source).not.toContain('Preço protegido por cotação ao vivo');
  });
});
