export interface CanonicalImageModelDefinition{
  canonical_id:string;
  display_name:string;
  vendor:string;
  aliases:string[];
  default_capabilities:string[];
}

export const CANONICAL_IMAGE_MODELS:CanonicalImageModelDefinition[]=[
  {canonical_id:'gpt-image-2-5-sunburst',display_name:'GPT Image 2.5 Sunburst',vendor:'OpenAI',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'gpt image 2.5 sunburst','gpt-image-2.5-sunburst','openai:gpt-image@2.5-sunburst',
    'openai/gpt-image-2.5-sunburst','openai/gpt-image-2.5-sunburst/text-to-image','openai/gpt-image-2.5-sunburst/edit',
  ]},
  {canonical_id:'gpt-image-2-5-flare',display_name:'GPT Image 2.5 Flare',vendor:'OpenAI',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'gpt image 2.5 flare','gpt-image-2.5-flare','openai:gpt-image@2.5-flare',
    'openai/gpt-image-2.5-flare','openai/gpt-image-2.5-flare/text-to-image','openai/gpt-image-2.5-flare/edit',
  ]},
  {canonical_id:'gpt-image-2',display_name:'GPT Image 2',vendor:'OpenAI',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'gpt image 2','gpt-image-2','openai:gpt-image@2','openai/gpt-image-2',
    'openai/gpt-image-2/text-to-image','openai/gpt-image-2/edit',
  ]},
  {canonical_id:'nano-banana-2',display_name:'Nano Banana 2',vendor:'Google',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'nano banana 2','nano-banana-2','nanobanana 2','google:4@3','gemini nano banana 2',
  ]},
  {canonical_id:'nano-banana-pro',display_name:'Nano Banana Pro',vendor:'Google',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'nano banana pro','nano-banana-pro','nanobanana pro','google:4@2','gemini nano banana pro',
  ]},
  {canonical_id:'seedream-5-0-pro',display_name:'Seedream 5.0 Pro',vendor:'ByteDance',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'seedream 5.0 pro','seedream-5.0-pro','seedream 5 pro','bytedance:seedream@5.0-pro',
  ]},
  {canonical_id:'qwen-image-3-0-pro',display_name:'Qwen Image 3.0 Pro',vendor:'Alibaba',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'qwen image 3.0 pro','qwen-image-3.0-pro','qwen image 3 pro','alibaba:qwen-image@3.0-pro',
  ]},
  {canonical_id:'flux-2-pro',display_name:'FLUX.2 Pro',vendor:'Black Forest Labs',default_capabilities:['text-to-image','image-to-image','image-edit'],aliases:[
    'flux.2 pro','flux 2 pro','flux.2 [pro]','flux-2-pro','bfl:5@1','black forest labs flux 2 pro',
  ]},
  {canonical_id:'ideogram-4-0',display_name:'Ideogram 4.0',vendor:'Ideogram',default_capabilities:['text-to-image'],aliases:[
    'ideogram 4.0','ideogram 4','ideogram-4.0','ideogram:4@0',
  ]},
  {canonical_id:'recraft-v4-1-pro',display_name:'Recraft V4.1 Pro',vendor:'Recraft',default_capabilities:['text-to-image'],aliases:[
    'recraft v4.1 pro','recraft 4.1 pro','recraft-v4.1-pro','recraft:v4.1-pro@0',
  ]},
  {canonical_id:'krea-2-large',display_name:'Krea 2 Large',vendor:'Krea',default_capabilities:['text-to-image','image-to-image'],aliases:[
    'krea 2 large','krea-2-large','krea:krea@2-large',
  ]},
  {canonical_id:'z-image-turbo',display_name:'Z-Image Turbo',vendor:'Alibaba',default_capabilities:['text-to-image','image-to-image'],aliases:[
    'z image turbo','z-image-turbo','zimage turbo','runware:z-image@turbo','wavespeed-ai/z-image/turbo',
  ]},
];

const CAPABILITY_SUFFIXES=[
  'text-to-image','image-to-image','image-edit','edit','inpaint','inpainting','outpaint','outpainting',
  'upscale','upscaler','variation','variations','background-remove','remove-background','background-replace','replace-background',
];

export function normalizeImageModelText(value:string){
  let raw=String(value||'').toLowerCase().trim();
  raw=raw.replace(/\[[^\]]+\]/g,m=>` ${m.slice(1,-1)} `);
  raw=raw.replace(/[@:./_\\-]+/g,' ');
  raw=raw.replace(/\b(openai|google|bytedance|black forest labs|bfl|alibaba|ideogram|recraft|krea|meta|luma|xai|wavespeed ai|wavespeed)\b/g,' ');
  raw=raw.replace(/\s+/g,' ').trim();
  for(const suffix of CAPABILITY_SUFFIXES){
    const normalized=suffix.replace(/-/g,' ');
    if(raw.endsWith(` ${normalized}`))raw=raw.slice(0,-normalized.length-1).trim();
  }
  return raw.replace(/\s+/g,' ').trim();
}

function numericTokens(value:string){return normalizeImageModelText(value).match(/\d+(?:\.\d+)?/g)||[];}
function tokenSet(value:string){return new Set(normalizeImageModelText(value).split(' ').filter(Boolean));}
function fuzzyScore(left:string,right:string){
  const a=tokenSet(left),b=tokenSet(right);
  if(!a.size||!b.size)return 0;
  const intersection=[...a].filter(token=>b.has(token)).length;
  return (2*intersection)/(a.size+b.size);
}
function compatibleVersions(left:string,right:string){
  const a=numericTokens(left),b=numericTokens(right);
  if(!a.length||!b.length)return true;
  return a.join('|')===b.join('|');
}

const aliasIndex=new Map<string,CanonicalImageModelDefinition>();
for(const definition of CANONICAL_IMAGE_MODELS){
  for(const value of [definition.canonical_id,definition.display_name,...definition.aliases]){
    aliasIndex.set(normalizeImageModelText(value),definition);
  }
}

export function resolveCanonicalImageModel(name:string,identifier:string,vendor=''){
  const candidates=[name,identifier,`${vendor} ${name}`,`${vendor} ${identifier}`].filter(Boolean);
  for(const candidate of candidates){
    const exact=aliasIndex.get(normalizeImageModelText(candidate));
    if(exact)return exact;
  }
  let best:{definition:CanonicalImageModelDefinition;score:number}|null=null;
  for(const candidate of candidates){
    for(const definition of CANONICAL_IMAGE_MODELS){
      if(!compatibleVersions(candidate,definition.display_name))continue;
      const score=Math.max(
        fuzzyScore(candidate,definition.display_name),
        ...definition.aliases.map(alias=>fuzzyScore(candidate,alias)),
      );
      if(score>=0.88&&(!best||score>best.score))best={definition,score};
    }
  }
  return best?.definition||null;
}

export function catalogSearchTerms(query:string){
  const q=String(query||'').trim();
  if(!q)return['image'];
  const normalized=normalizeImageModelText(q);
  const matched=CANONICAL_IMAGE_MODELS.filter(definition=>{
    const haystack=[definition.display_name,definition.canonical_id,...definition.aliases].map(normalizeImageModelText);
    return haystack.some(value=>value.includes(normalized)||normalized.includes(value));
  });
  const terms=[q];
  for(const definition of matched.slice(0,4))terms.push(definition.display_name);
  if(/gpt/i.test(q))terms.push('gpt image');
  if(/nano/i.test(q))terms.push('nano banana');
  if(/seedream/i.test(q))terms.push('seedream');
  return Array.from(new Set(terms.map(term=>term.trim()).filter(term=>term.length>=2))).slice(0,6);
}
