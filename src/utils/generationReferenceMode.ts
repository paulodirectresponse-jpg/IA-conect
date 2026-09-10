export type CanonicalReferenceSlot='INITIAL'|'END'|'GENERAL';

export interface GenerationReferenceLike {
  asset_id?:string;
  role?:string;
  slot_type?:string;
  alias?:string;
  alias_snapshot?:string;
}

export function canonicalReferenceSlot(ref:GenerationReferenceLike):CanonicalReferenceSlot {
  const raw=String(ref.slot_type||ref.role||'').trim().toUpperCase();
  if(['START_FRAME','INITIAL_FRAME','INITIAL'].includes(raw))return'INITIAL';
  if(['END_FRAME','END'].includes(raw))return'END';
  return'GENERAL';
}

export function pricingReferenceMode(refs:GenerationReferenceLike[]|undefined):string {
  const rows=refs||[];
  if(!rows.length)return'none';
  const slots=rows.map(canonicalReferenceSlot);
  if(slots.includes('INITIAL'))return slots.includes('END')?'initial_end':'initial';
  return rows.length>1?'multi_ref':'reference';
}

export function pricingReferenceCacheKey(refs:GenerationReferenceLike[]|undefined):string {
  const count=(refs||[]).length;
  const band=count<=0?'0':count===1?'1':count<=4?'2-4':'5+';
  return `${pricingReferenceMode(refs)}:${band}`;
}
