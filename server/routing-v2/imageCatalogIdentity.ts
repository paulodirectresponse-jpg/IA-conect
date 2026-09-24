export type ImageCapability=
  |'text-to-image'|'image-to-image'|'image-edit'|'inpaint-mask'
  |'background-remove-replace'|'outpaint'|'upscale'|'variations';

export interface ParsedCatalogModelIdentity{
  family:string;
  family_display:string;
  version:string;
  tier:string;
  variants:string[];
  capabilities:ImageCapability[];
  generic_endpoint:boolean;
  technical_variant:boolean;
  display_name:string;
  canonical_key:string;
}

const PROVIDER_PHRASES=[
  'black forest labs','wavespeed ai','atlas cloud',
  'openai','google','bytedance','bfl','alibaba','meta','luma','xai','wavespeed','runware',
];
const TIER_WORDS=new Set(['pro','lite','turbo','max','dev','large','medium','mini','fast','ultra','standard']);
const STRUCTURAL_VARIANTS=['layer decomposition','sequential','sunburst','flare','preview','experimental'];

const CAPABILITY_PATTERNS:Array<[RegExp,ImageCapability]>=[
  [/\btext[\s/_-]*to[\s/_-]*image\b/i,'text-to-image'],
  [/\bimage[\s/_-]*to[\s/_-]*image\b/i,'image-to-image'],
  [/\b(reference[\s/_-]*to[\s/_-]*image|reference[\s/_-]*image)\b/i,'image-to-image'],
  [/\b(image[\s/_-]*edit|edit)\b/i,'image-edit'],
  [/\b(inpaint|inpainting)\b/i,'inpaint-mask'],
  [/\b(outpaint|outpainting)\b/i,'outpaint'],
  [/\b(upscale|upscaler)\b/i,'upscale'],
  [/\b(variation|variations)\b/i,'variations'],
  [/\b(background[\s/_-]*remove|remove[\s/_-]*background|background[\s/_-]*replace|replace[\s/_-]*background)\b/i,'background-remove-replace'],
];

const NON_IMAGE_PATTERN=/(?:^|[\s/_-])(video|3d|audio|tts|speech|music|voice|lip[\s_-]*sync)(?:$|[\s/_-])/i;
const GENERIC_ENDPOINT_PATTERN=/^(text to image|image to image|image edit|edit|reference to image|inpaint|outpaint|upscale)(?: (fast|multi|ultra|pro|standard|turbo))?$/i;

function uniq<T>(items:T[]){return Array.from(new Set(items));}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function title(value:string){
  return value.split(' ').filter(Boolean).map(part=>{
    if(/^(gpt|qwen|flux)$/i.test(part))return part.toUpperCase();
    if(/^\d+(?:\.\d+)*$/.test(part))return part;
    return part.charAt(0).toUpperCase()+part.slice(1);
  }).join(' ');
}
function spaced(value:string){
  return String(value||'')
    .replace(/([a-z])([A-Z])/g,'$1 $2')
    .replace(/[\[\](){}]/g,' ')
    .replace(/[@:/_\\-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function extractVersion(name:string,identifier:string){
  for(const value of [name,identifier]){
    const match=String(value||'').match(/(?:^|[^a-z0-9])v?(\d+(?:\.\d+){0,2})(?=$|[^a-z0-9])/i);
    if(match?.[1])return match[1];
  }
  return'';
}
function removeLiteralPhrase(value:string,phrase:string){
  const escaped=phrase.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&').replace(/\s+/g,'\\s+');
  return value.replace(new RegExp('\\b'+escaped+'\\b','ig'),' ');
}
function stripProviderWords(value:string,vendor:string){
  let out=value;
  const phrases=[...PROVIDER_PHRASES,String(vendor||'').trim().toLowerCase()].filter(Boolean).sort((a,b)=>b.length-a.length);
  for(const phrase of phrases)out=removeLiteralPhrase(out,phrase);
  return out;
}

export function inferCatalogImageCapabilities(...values:string[]):ImageCapability[]{
  const raw=values.filter(Boolean).join(' ');
  if(NON_IMAGE_PATTERN.test(raw))return[];
  const found:ImageCapability[]=[];
  for(const[pattern,capability]of CAPABILITY_PATTERNS)if(pattern.test(raw))found.push(capability);
  return uniq(found);
}

export function isNonImageCatalogEntry(...values:string[]){
  return NON_IMAGE_PATTERN.test(values.filter(Boolean).join(' '));
}

export function parseCatalogModelIdentity(name:string,identifier:string,vendor=''):ParsedCatalogModelIdentity{
  const originalName=String(name||'').trim();
  const originalIdentifier=String(identifier||'').trim();
  const joined=originalName+' '+originalIdentifier;
  const capabilities=inferCatalogImageCapabilities(joined);
  const genericCandidate=spaced(originalName).toLowerCase().replace(/\./g,' ');
  const generic_endpoint=GENERIC_ENDPOINT_PATTERN.test(genericCandidate);
  const technical_variant=/\b(developer|endpoint|api)\b/i.test(joined);
  const version=extractVersion(originalName,originalIdentifier);

  let normalized=spaced(originalName||originalIdentifier).toLowerCase();
  for(const[pattern]of CAPABILITY_PATTERNS)normalized=normalized.replace(pattern,' ');
  normalized=normalized.replace(/\b(developer|endpoint|api)\b/g,' ');

  const variantText=STRUCTURAL_VARIANTS.filter(variant=>normalized.includes(variant));
  for(const variant of variantText)normalized=removeLiteralPhrase(normalized,variant);

  let tier='';
  const wordsBeforeTier=normalized.replace(/\./g,' ').split(/\s+/).filter(Boolean);
  for(const word of wordsBeforeTier){
    if(TIER_WORDS.has(word)){tier=word;break;}
  }
  if(tier)normalized=removeLiteralPhrase(normalized,tier);

  if(version){
    const escaped=version.replace(/\./g,'\\.');
    normalized=normalized.replace(new RegExp('(?:^|\\s)v?'+escaped+'(?=\\s|$)','ig'),' ');
  }

  normalized=stripProviderWords(normalized,vendor)
    .replace(/[.@]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  const family=generic_endpoint?'':slug(normalized);
  const family_display=title(family.replace(/-/g,' '));
  const variants=uniq(variantText.map(slug));
  const canonical_key=[family,version,tier,...variants].filter(Boolean).join(':');

  const displayParts=[family_display];
  if(version)displayParts.push(version);
  if(tier)displayParts.push(title(tier));
  for(const variant of variantText)displayParts.push(title(variant));

  return{
    family,
    family_display,
    version,
    tier,
    variants,
    capabilities,
    generic_endpoint,
    technical_variant,
    display_name:displayParts.filter(Boolean).join(' ').trim()||title(normalized),
    canonical_key,
  };
}

export function shouldGroupCatalogModels(a:ParsedCatalogModelIdentity,b:ParsedCatalogModelIdentity){
  return Boolean(a.canonical_key&&b.canonical_key&&a.canonical_key===b.canonical_key);
}

export function isCatalogIdentityUsable(identity:ParsedCatalogModelIdentity){
  return Boolean(identity.family&&!identity.generic_endpoint&&!identity.technical_variant);
}
