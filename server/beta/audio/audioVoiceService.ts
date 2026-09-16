import crypto from 'crypto';
import { firestoreAdminRest } from '../../repositories/firestoreAdminRest.js';

export interface BetaAudioVoiceView{
  voice_id:string;
  label:string;
  source_asset_id:string|null;
  source_generation_id:string;
  created_at:string;
}

interface StoredVoice extends BetaAudioVoiceView{
  user_id:string;
  provider_id:string;
  provider_voice_id:string;
  consent_at:string;
}

const safe=(value:string)=>encodeURIComponent(value);

function providerVoiceFromResult(structured:any,text?:string|null){
  const candidates:any[]=[];
  if(structured&&typeof structured==='object'){
    candidates.push(structured);
    if(Array.isArray(structured.outputs))candidates.push(...structured.outputs);
  }
  for(const value of candidates){
    if(!value||typeof value!=='object')continue;
    for(const key of ['voice_id','custom_voice_id','voiceId']){
      const found=String(value[key]||'').trim();
      if(found)return found;
    }
  }
  const raw=String(text||'').trim();
  if(raw&&raw.length<=160&&!/^https?:\/\//i.test(raw))return raw;
  return null;
}

function publicVoice(row:StoredVoice):BetaAudioVoiceView{
  return{voice_id:row.voice_id,label:row.label,source_asset_id:row.source_asset_id,source_generation_id:row.source_generation_id,created_at:row.created_at};
}

export const audioVoiceService={
  providerCloneId(generationId:string){return `ia_${String(generationId).replace(/[^a-zA-Z0-9]/g,'').slice(-28)||'voiceclone'}`;},
  async captureClone(params:{
    userId:string;generationId:string;providerId:string;sourceAssetId?:string|null;label?:string|null;
    consentAt:string;resultStructured?:any;resultText?:string|null;providerVoiceIdFallback?:string|null;
  }){
    const providerVoiceId=providerVoiceFromResult(params.resultStructured,params.resultText)||String(params.providerVoiceIdFallback||'').trim()||null;
    if(!providerVoiceId)throw Object.assign(new Error('O provedor não retornou um identificador de voz reutilizável.'),{code:'VOICE_CLONE_RESULT_INVALID'});
    const voiceId='voice_'+crypto.createHash('sha256').update(`${params.userId}:${params.generationId}`).digest('hex').slice(0,24);
    const row:StoredVoice={
      voice_id:voiceId,user_id:params.userId,label:String(params.label||'Minha voz').trim().slice(0,80)||'Minha voz',
      source_asset_id:params.sourceAssetId||null,source_generation_id:params.generationId,
      provider_id:params.providerId,provider_voice_id:providerVoiceId,consent_at:params.consentAt,created_at:new Date().toISOString(),
    };
    await firestoreAdminRest.set(`beta_audio_voices/${safe(voiceId)}`,row);
    return publicVoice(row);
  },

  async list(userId:string):Promise<BetaAudioVoiceView[]>{
    const rows=await firestoreAdminRest.runQuery({
      from:[{collectionId:'beta_audio_voices'}],
      where:{fieldFilter:{field:{fieldPath:'user_id'},op:'EQUAL',value:{stringValue:userId}}},
      limit:100,
    }).catch(()=>[] as any[]);
    return rows.map((item:any)=>item.data as StoredVoice).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)).map(publicVoice);
  },

  async resolvePrivate(userId:string,voiceId:string,providerId:string){
    const doc=await firestoreAdminRest.get(`beta_audio_voices/${safe(voiceId)}`);
    if(!doc.exists)throw Object.assign(new Error('Voz não encontrada.'),{code:'AUDIO_VOICE_NOT_FOUND'});
    const row=doc.data as StoredVoice;
    if(row.user_id!==userId)throw Object.assign(new Error('Voz não encontrada.'),{code:'AUDIO_VOICE_NOT_FOUND'});
    if(row.provider_id!==providerId)throw Object.assign(new Error('Esta voz ainda não possui uma rota compatível neste provedor.'),{code:'AUDIO_VOICE_PROVIDER_UNAVAILABLE'});
    return{provider_voice_id:row.provider_voice_id};
  },
};
