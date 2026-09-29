import { CapabilityId } from '../beta/capabilityRegistry.js';

const TEXT_TO_IMAGE_ONLY_SUFFIXES=new Set(['edit','image-edit','image-to-image','reference-to-image']);
const IMAGE_EDIT_ONLY_SUFFIXES=new Set(['text-to-image']);

export function identifierCapabilityMismatch(identifier:string,capabilityId:string):string|null{
  const operation=String(identifier||'').trim().toLowerCase().replace(/\/+$/,'').split('/').pop()||'';
  if(capabilityId==='text-to-image'&&TEXT_TO_IMAGE_ONLY_SUFFIXES.has(operation)){
    return 'Identifier de edição não pode ser usado como text-to-image.';
  }
  if(['image-edit','image-to-image'].includes(capabilityId)&&IMAGE_EDIT_ONLY_SUFFIXES.has(operation)){
    return 'Identifier text-to-image não pode ser usado como edição.';
  }
  return null;
}

export function suggestedCapabilityForMismatch(identifier:string,capabilityId:string):string|null{
  const operation=String(identifier||'').trim().toLowerCase().replace(/\/+$/,'').split('/').pop()||'';
  if(capabilityId==='text-to-image'&&['edit','image-edit'].includes(operation))return'image-edit';
  if(['image-edit','image-to-image'].includes(capabilityId)&&operation==='text-to-image')return'text-to-image';
  return null;
}

export function filterCompatibleCapabilities(identifier:string,capabilities:readonly string[]){
  return Array.from(new Set(capabilities.filter(capability=>!identifierCapabilityMismatch(identifier,capability))));
}

export function assertIdentifierMatchesCapability(identifier:string,capabilityId:CapabilityId){
  const message=identifierCapabilityMismatch(identifier,capabilityId);
  if(message)throw Object.assign(new Error(message),{code:'ROUTING_V2_MAPPING_CAPABILITY_MISMATCH'});
}
