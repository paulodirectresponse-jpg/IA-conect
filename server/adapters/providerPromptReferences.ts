import { ProviderGenerationParams, ProviderGenerationReference } from './videoProviderAdapter.js';

type ProviderKind = 'atlas' | 'wavespeed';
type ReferenceType = 'IMAGE' | 'VIDEO' | 'AUDIO';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function providerToken(
  modelId: string,
  provider: ProviderKind,
  type: ReferenceType,
  index: number
) {
  if (modelId === 'seedance-2-5') {
    const base = type === 'IMAGE' ? 'image' : type === 'VIDEO' ? 'video' : 'audio';
    // Atlas documents Seedance references as @Image1/@Video1/@Audio1,
    // while WaveSpeed uses lowercase @image1/@video1/@audio1.
    const label = provider === 'atlas' ? `${base[0].toUpperCase()}${base.slice(1)}` : base;
    return `@${label}${index}`;
  }

  if (modelId === 'minimax-h3') {
    const label = type === 'IMAGE' ? 'Picture' : type === 'VIDEO' ? 'Video' : 'Audio';
    return `<${label} ${index}>`;
  }

  // WAN 3.x reference-to-video addresses uploaded references positionally.
  const label = type === 'IMAGE' ? 'Image' : type === 'VIDEO' ? 'Video' : 'Audio';
  return `${label} ${index}`;
}

function localAliases(ref: ProviderGenerationReference) {
  return Array.from(
    new Set(
      [ref.prompt_alias, ref.alias]
        .filter(Boolean)
        .map((value) => String(value).replace(/^@/, '').trim())
        .filter(Boolean)
    )
  );
}

/**
 * UI aliases are intentionally provider-agnostic (e.g. @img1). Providers use
 * different prompt vocabularies, so this is the single boundary where aliases
 * are translated immediately before submission.
 */
export function compileProviderReferencePrompt(
  params: ProviderGenerationParams,
  provider: ProviderKind
) {
  let prompt = params.prompt;
  const counters: Record<ReferenceType, number> = { IMAGE: 0, VIDEO: 0, AUDIO: 0 };
  const semanticInstructions:string[] = [];

  for (const ref of params.references) {
    if ((ref.slot_type || 'GENERAL') !== 'GENERAL') continue;
    const type = String(ref.type || 'IMAGE').toUpperCase() as ReferenceType;
    if (!['IMAGE', 'VIDEO', 'AUDIO'].includes(type)) continue;
    const index = ++counters[type];
    const token = providerToken(params.model_id, provider, type, index);
    const semanticRole=String(ref.semantic_role||'GENERAL').toUpperCase();
    if(semanticRole==='CHARACTER')semanticInstructions.push(`Keep the person/character identity from ${token} consistent in the result.`);
    else if(semanticRole==='PRODUCT')semanticInstructions.push(`Preserve the product/object identity, shape, colors and defining details from ${token}.`);
    else if(semanticRole==='STYLE')semanticInstructions.push(`Use ${token} only as a visual style reference for lighting, palette, texture and art direction; do not copy its subject.`);

    for (const alias of localAliases(ref)) {
      const rx = new RegExp(`@${escapeRegex(alias)}\\b`, 'g');
      prompt = prompt.replace(rx, token);
    }
  }

  return semanticInstructions.length?`${semanticInstructions.join(' ')}\n${prompt}`:prompt;
}
