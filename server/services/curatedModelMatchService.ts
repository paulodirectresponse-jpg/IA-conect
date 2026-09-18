import { CURATED_MODEL_BLUEPRINTS, CuratedModelBlueprint, CuratedModelFunction } from '../../src/config/curatedModelInventory.js';
import { ProviderModelMapping } from '../../src/types/index.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import type { ProviderScanCandidate } from './providerModelScanService.js';

export interface ProviderModelMatchProposal{
  provider_id:string;
  model_id:string;
  model_name:string;
  function_id:CuratedModelFunction;
  capability_id:string;
  provider_model_identifier:string;
  candidate_name:string;
  confidence:number;
  match_reason:string;
  already_mapped:boolean;
  provider_pricing_metadata?:unknown;
}

const capabilityByFunction:Record<CuratedModelFunction,string>={
  IMAGE_GENERATION:'text-to-image',IMAGE_EDIT:'image-edit',VIDEO_GENERATION:'text-to-video',VIDEO_EDIT:'video-edit',VIDEO_EXTEND:'video-extend',
  VOICE:'text-to-speech',MUSIC:'music',SFX:'sound-effects',THREE_D:'image-to-3d',
};

function normalize(value:string){
  return String(value||'').toLowerCase()
    .replace(/google|openai|black forest labs|black-forest-labs|bytedance|alibaba|wavespeed ai|wavespeed-ai|kwaivgi|xai|x-ai|recraft ai|recraft-ai|tencent|hyper3d|resemble ai|resemble-ai/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function tokens(value:string){return new Set(normalize(value).split(' ').filter(Boolean));}
function exactAlias(row:CuratedModelBlueprint,candidate:ProviderScanCandidate){
  const id=normalize(candidate.provider_model_identifier),name=normalize(candidate.name);
  return row.aliases.some(alias=>{const n=normalize(alias);return Boolean(n)&&(n===id||n===name);});
}
function containsAlias(row:CuratedModelBlueprint,candidate:ProviderScanCandidate){
  const hay=` ${normalize(candidate.provider_model_identifier)} ${normalize(candidate.name)} `;
  return row.aliases.some(alias=>{const n=normalize(alias);return n.length>=5&&hay.includes(` ${n} `);});
}
function overlapScore(row:CuratedModelBlueprint,candidate:ProviderScanCandidate){
  const wanted=tokens(row.aliases.join(' ')),have=tokens(`${candidate.provider_model_identifier} ${candidate.name}`);
  if(!wanted.size||!have.size)return 0;
  let common=0;for(const token of wanted)if(have.has(token))common++;
  return common/Math.max(1,Math.min(wanted.size,have.size));
}
function functionSignal(row:CuratedModelBlueprint,candidate:ProviderScanCandidate){
  const text=normalize(`${candidate.provider_model_identifier} ${candidate.name} ${(candidate.capabilities||[]).join(' ')}`);
  if(row.function_id==='VIDEO_EDIT')return /\b(edit|modify|video edit)\b/.test(text)?0.12:-0.24;
  if(row.function_id==='VIDEO_EXTEND')return /\b(extend|extension|continue|continuation)\b/.test(text)?0.12:-0.24;
  if(row.function_id==='IMAGE_EDIT')return /\b(edit|fill|inpaint|outpaint)\b/.test(text)?0.1:0;
  if(row.function_id==='VOICE')return /\b(tts|speech|voice)\b/.test(text)?0.08:0;
  if(row.function_id==='MUSIC')return /\b(music|audio|song)\b/.test(text)?0.06:0;
  if(row.function_id==='SFX')return /\b(sfx|sound effect|sound effects|audio)\b/.test(text)?0.06:0;
  if(row.function_id==='THREE_D')return /\b(3d|mesh|trellis|rodin|meshy|tripo|hunyuan)\b/.test(text)?0.06:0;
  if(row.function_id==='VIDEO_GENERATION'&&/\b(edit|extend|extension|modify)\b/.test(text))return-0.35;
  if(row.function_id==='IMAGE_GENERATION'&&/\b(edit|fill|inpaint|outpaint)\b/.test(text))return-0.25;
  return 0;
}
function score(row:CuratedModelBlueprint,candidate:ProviderScanCandidate){
  if(exactAlias(row,candidate))return 1;
  if(containsAlias(row,candidate))return Math.max(0,Math.min(0.96,0.84+functionSignal(row,candidate)));
  const overlap=overlapScore(row,candidate);
  return Math.max(0,Math.min(0.94,overlap*0.78+functionSignal(row,candidate)));
}

export const curatedModelMatchService={
  async propose(providerId:string,candidates:ProviderScanCandidate[],knownMappings?:ProviderModelMapping[]):Promise<ProviderModelMatchProposal[]>{
    const mappings=knownMappings||await catalogRepository.listMappings();
    const existing=new Set(mappings.filter(mapping=>mapping.provider_id===providerId).map(mapping=>`${mapping.model_id}::${mapping.provider_model_identifier}`));
    const byModel=new Map<string,ProviderModelMatchProposal>();
    for(const candidate of candidates){
      let best:ProviderModelMatchProposal|null=null;
      for(const row of CURATED_MODEL_BLUEPRINTS){
        const confidence=score(row,candidate);
        if(confidence<0.72)continue;
        const proposal:ProviderModelMatchProposal={
          provider_id:providerId,model_id:row.model_id,model_name:row.name,function_id:row.function_id,
          capability_id:capabilityByFunction[row.function_id],provider_model_identifier:candidate.provider_model_identifier,candidate_name:candidate.name,
          confidence:Number(confidence.toFixed(3)),match_reason:confidence>=0.99?'exact_alias':confidence>=0.84?'alias_match':'token_match',
          already_mapped:existing.has(`${row.model_id}::${candidate.provider_model_identifier}`),
        };
        if(!best||proposal.confidence>best.confidence)best=proposal;
      }
      if(!best)continue;
      const previous=byModel.get(best.model_id);
      if(!previous||best.confidence>previous.confidence)byModel.set(best.model_id,best);
    }
    return Array.from(byModel.values()).sort((a,b)=>b.confidence-a.confidence||a.model_name.localeCompare(b.model_name));
  },
};