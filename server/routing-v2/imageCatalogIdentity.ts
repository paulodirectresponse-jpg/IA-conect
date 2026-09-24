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

const PROVIDER_WORDS=new Set([
  'openai','google','bytedance','black','forest','labs','bfl','alibaba','ideogram','recraft','krea',
  'meta','luma','xai','wavespeed','runware','atlas','cloud','ai'
]);
const TIER_WORDS=new Set(['pro','lite','turbo','max','dev','large','medium','mini','fast','ultra','standard']);
const STRUCTURAL_VARIANTS=[
  'layer decomposition','sequential','sunburst','flare','preview','experimental'
];
const CAPABILITY_PATTERNS:Array<[RegExp,ImageCapability]>=[
  [/text[s/_-]*to[s/_-]*image/i,'text-to-image'],
  [/image[s/_-]*to[s/_-]*image/i,'image-to-image'],
  [/(reference[s/_-]*to[s/_-]*image|reference[s/_-]*image)/i,'image-to-image'],
  [/(image[s/_-]*edit|edit)/i,'image-edit'],
  [/(inpaint|inpainting)/i,'inpaint-mask'],
  [/(outpaint|outpainting)/i,'outpaint'],
  [/(upscale|upscaler)/i,'upscale'],
  [/(variation|variations)/i,'variations'],
  [/(background[s/_-]*remove|remove[s/_-]*background|background[s/_-]*replace|replace[s/_-]*background)/i,'background-remove-replace'],
];
const NON_IMAGE_PATTERN=/(?:^|[s/_-])(video|3d|audio|tts|speech|music|voice|lip[s_-]*sync)(?:$|[s/_-])/i;
const GENERIC_ENDPOINT_PATTERN=/^(text to image|image to image|image edit|edit|reference to image|inpaint|outpaint|upscale)(?: (fast|multi|ultra|pro|standard|turbo))?$/i;

function cleanWords(value:string){
  return String(value||'')
    .replace(/([a-z])([A-Z])/g,'$1 $2')
    .replace(/[@:./_\\-]+/g,' ')
    .replace(/[[^]]+]/g,m=>` ${m.slice(1,-1)} `)
    .replace(/v(?=d)/gi,'')
    .replace(/s+/g,' ')
    .trim();
}
function title(value:string){
  return value.split(' ').filter(Boolean).map(part=>{
    if(/^(gpt|qwen|flux)$/i.test(part))return part.toUpperCase();
    if(/^d+(?:.d+)*$/.test(part))return part;
    return part.charAt(0).toUpperCase()+part.slice(1);
  }).join(' ');
}
function slug(value:string){return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function uniq<T>(items:T[]){return Array.from(new Set(items));}

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
  const sourceName=cleanWords(name);
  const sourceIdentifier=cleanWords(identifier);
  const joined=`${sourceName} ${sourceIdentifier}`.trim();
  const capabilities=inferCatalogImageCapabilities(joined);
  const generic_endpoint=GENERIC_ENDPOINT_PATTERN.test(sourceName.toLowerCase());
  const technical_variant=/(developer|endpoint|api)/i.test(joined);

  let normalized=cleanWords(sourceName||sourceIdentifier).toLowerCase();
  for(const[pattern]of CAPABILITY_PATTERNS)normalized=normalized.replace(pattern,' ');
  normalized=normalized.replace(/(developer|endpoint|api)/g,' ');
  normalized=normalized.replace(/s+/g,' ').trim();

  const words=normalized.split(' ').filter(Boolean);
  const versionIndex=words.findIndex(word=>/^d+(?:.d+){0,2}$/.test(word));
  const version=versionIndex>=0?words[versionIndex]:'';

  let tier='';
  for(const word of words){
    if(TIER_WORDS.has(word)){tier=word;break;}
  }

  const variantText=STRUCTURAL_VARIANTS.filter(variant=>normalized.includes(variant));
  const consumed=new Set<string>();
  if(version)consumed.add(version);
  if(tier)consumed.add(tier);
  for(const variant of variantText)for(const word of variant.split(' '))consumed.add(word);

  const vendorTokens=new Set(cleanWords(vendor).toLowerCase().split(' ').filter(Boolean));
  const familyTokens=words.filter(word=>
    !consumed.has(word)&&
    !PROVIDER_WORDS.has(word)&&
    !vendorTokens.has(word)&&
    !/^d+(?:.d+){0,2}$/.test(word)
  );

  let family=slug(familyTokens.join(' '));
  if(!family&&versionIndex>0){
    family=slug(words.slice(0,versionIndex).filter(word=>!PROVIDER_WORDS.has(word)).join(' '));
  }
  if(!family&&!generic_endpoint)family=slug(normalized);

  const family_display=title(family.replace(/-/g,' '));
  const variants=uniq(variantText.map(slug));
  const pieces=[family,version,tier,...variants].filter(Boolean);
  const canonical_key=pieces.join(':');

  const displayParts=[family_display];
  if(version)displayParts.push(version);
  if(tier)displayParts.push(title(tier));
  for(const variant of variantText)displayParts.push(title(variant));
  const display_name=displayParts.filter(Boolean).join(' ').trim()||title(normalized);

  return{
    family,
    family_display,
    version,
    tier,
    variants,
    capabilities,
    generic_endpoint,
    technical_variant,
    display_name,
    canonical_key,
  };
}

export function shouldGroupCatalogModels(a:ParsedCatalogModelIdentity,b:ParsedCatalogModelIdentity){
  return Boolean(a.canonical_key&&b.canonical_key&&a.canonical_key===b.canonical_key);
}

export function isCatalogIdentityUsable(identity:ParsedCatalogModelIdentity){
  return Boolean(identity.family&&!identity.generic_endpoint&&!identity.technical_variant);
}
