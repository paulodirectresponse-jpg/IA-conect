const GENERIC_VIDEO_ENDPOINT_NAME=/^(?:image to video(?: (?:fast|turbo|spicy))?|text to video(?: (?:fast|turbo|spicy))?|reference to video|first frame to video|last frame to video|video|video edit(?: (?:fast|turbo|spicy))?|video extend(?: (?:fast|turbo|spicy))?|talking avatar)$/i;
const VIDEO_ENDPOINT_SEGMENT=/^(?:(?:image|text|reference|first[-_]?frame|last[-_]?frame)[-_]to[-_]video(?:[-_](?:fast|turbo|spicy))?|i2v|t2v|r2v|v2v|video[-_](?:edit|extend)(?:[-_](?:fast|turbo|spicy))?)$/i;
const RESOLUTION_SEGMENT=/^\d{3,4}p$/i;
const PROVIDER_NAMESPACE_SEGMENTS=new Set(['aiml','atlas','atlascloud','alibaba','blackforestlabs','bfl','bytedance','deepinfra','fal','google','ideogram','kie','krea','luma','meta','openai','piapi','recraft','replicate','runware','wavespeed','wavespeedai','xai']);

function normalizedEndpointName(value:string){
  return String(value||'').toLowerCase().replace(/[\s/_-]+/g,' ').trim();
}

function modelWords(value:string){
  return String(value||'')
    .replace(/[-_@/:]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word=>{
      if(/^(gpt|flux|qwen|i2v|t2v)$/i.test(word))return word.toUpperCase();
      if(/^v\d+(?:\.\d+)*$/i.test(word))return word.toUpperCase();
      if(/^\d+(?:\.\d+)*$/.test(word))return word;
      return word.charAt(0).toUpperCase()+word.slice(1);
    })
    .join(' ');
}

/**
 * Providers sometimes return an operation label (for example "Image To Video")
 * instead of the model name. When the provider ID carries the model family,
 * derive a useful label from that ID and remove its capability/quality suffix.
 */
export function providerIdentifierModelName(name:string,identifier:string,vendor=''){
  if(!GENERIC_VIDEO_ENDPOINT_NAME.test(normalizedEndpointName(name)))return'';
  const parts=String(identifier||'').trim().split(/[/:]+/).map(part=>part.trim()).filter(Boolean);
  if(!parts.length)return'';

  const vendorKey=String(vendor||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  while(parts.length>1){
    const firstKey=parts[0].toLowerCase().replace(/[^a-z0-9]/g,'');
    if(firstKey!==vendorKey&&!PROVIDER_NAMESPACE_SEGMENTS.has(firstKey))break;
    parts.shift();
  }

  while(parts.length>1&&(RESOLUTION_SEGMENT.test(parts[parts.length-1])||VIDEO_ENDPOINT_SEGMENT.test(parts[parts.length-1])))parts.pop();
  const candidate=parts.join(' ');
  return modelWords(candidate);
}

function seedanceIdentifierName(identifier:string){
  const parts=String(identifier||'').trim().split(/[/:]+/).map(part=>part.trim()).filter(Boolean);
  const seedanceIndex=parts.findIndex(part=>/seedance/i.test(part));
  if(seedanceIndex<0)return'';
  const modelParts=[parts[seedanceIndex]];
  for(const part of parts.slice(seedanceIndex+1)){
    if(RESOLUTION_SEGMENT.test(part)||VIDEO_ENDPOINT_SEGMENT.test(part))break;
    modelParts.push(part);
  }
  return modelParts.join(' ');
}

function cleanVideoModelName(value:string){
  let name=String(value||'').trim();
  if(!name||(/[/:]/.test(name)&&!/[\s]/.test(name)))return'';
  name=name
    .replace(/\bseedance[-_\s]+v?(\d+)[-_](\d+)(?=$|[-_\s])/i,'Seedance $1.$2')
    .replace(/(?:image|text|reference|first[-_ ]frame|last[-_ ]frame)[\s/_-]*to[\s/_-]*video(?:[\s/_-]*(?:fast|turbo|spicy))?/gi,' ')
    .replace(/\b(?:i2v|t2v|r2v|v2v|\d{3,4}p|4k|8k|uhd)\b/gi,' ')
    .replace(/\bvideo[\s_-]*(?:edit|extend)\b/gi,' ')
    .replace(/(\d)\.(\d)/g,'$1§$2')
    .replace(/[._/:@]+/g,' ')
    .replace(/§/g,'.')
    .replace(/[-_]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
  name=name.replace(/^bytedance\s+(?=seedance\b)/i,'');
  name=name.replace(/\bseedance\s+v(\d+(?:\.\d+)*)/i,'Seedance $1');
  name=name.replace(/\bseedance\s+(\d+)\.0\b/i,'Seedance $1');
  name=name.replace(/\s+video$/i,'').trim();
  return modelWords(name);
}

/**
 * Collapses provider task/resolution endpoints onto the underlying video model.
 * Meaningful variants such as Fast, Mini, Lite and Pro remain part of identity.
 */
export function canonicalizeUnifiedVideoCatalogIdentity(name:string,identifier:string,vendor=''){
  const fromName=GENERIC_VIDEO_ENDPOINT_NAME.test(normalizedEndpointName(name))?'':cleanVideoModelName(name);
  const fromIdentifier=cleanVideoModelName(seedanceIdentifierName(identifier)||providerIdentifierModelName(name,identifier,vendor)||identifier);
  const displayName=[fromName,fromIdentifier].filter(Boolean)
    .sort((a,b)=>b.split(/\s+/).length-a.split(/\s+/).length)[0]||'';
  if(!displayName)return null;
  const identity=normalizeUnifiedCatalogSearch(displayName).replace(/\s+/g,'-');
  if(!identity)return null;
  return{catalog_key:`video:${identity}`,display_name:displayName};
}

export function normalizeUnifiedCatalogSearch(value:string){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}

export function normalizeUnifiedCatalogDisplayName(name:string,identifiers:string[],vendor=''){
  for(const identifier of identifiers){
    const resolved=providerIdentifierModelName(name,identifier,vendor);
    if(resolved)return resolved;
  }
  return name;
}
