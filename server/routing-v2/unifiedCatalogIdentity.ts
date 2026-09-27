const GENERIC_VIDEO_ENDPOINT_NAME=/^(?:image to video(?: (?:fast|turbo|spicy))?|text to video(?: (?:fast|turbo|spicy))?|video|video edit(?: (?:fast|turbo|spicy))?|video extend(?: (?:fast|turbo|spicy))?|talking avatar)$/i;
const VIDEO_ENDPOINT_SEGMENT=/^(?:(?:image|text)[-_]to[-_]video(?:[-_](?:fast|turbo|spicy))?|i2v|t2v|video[-_](?:edit|extend)(?:[-_](?:fast|turbo|spicy))?)$/i;
const RESOLUTION_SEGMENT=/^\d{3,4}p$/i;
const PROVIDER_NAMESPACE_SEGMENTS=new Set(['atlas','atlascloud','deepinfra','fal','kie','piapi','replicate','runware','wavespeed','wavespeedai']);

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
  const firstKey=parts[0].toLowerCase().replace(/[^a-z0-9]/g,'');
  if(parts.length>1&&(firstKey===vendorKey||PROVIDER_NAMESPACE_SEGMENTS.has(firstKey)))parts.shift();

  while(parts.length>1&&(RESOLUTION_SEGMENT.test(parts[parts.length-1])||VIDEO_ENDPOINT_SEGMENT.test(parts[parts.length-1])))parts.pop();
  const candidate=parts.join(' ');
  return modelWords(candidate);
}

export function normalizeUnifiedCatalogSearch(value:string){
  return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
