import crypto from 'crypto';
import { Generation, GenerationMode, GenerationAttemptLog } from '../../src/types/index.js';
import { generationRepository } from '../repositories/generationRepository.js';
import { smartRouterService } from './smartRouterService.js';
import { walletService } from './walletService.js';
import { assetReferenceResolver } from './assetReferenceResolver.js';
import { providerRegistry } from '../adapters/providerRegistry.js';
import { assetRepository } from '../repositories/assetRepository.js';
import { getAdminStorage } from '../repositories/firebaseAdminClient.js';
import { getFirebaseConfig } from '../repositories/firestoreClient.js';

interface GenerationReferenceInput{asset_id:string;slot_type?:'INITIAL'|'END'|'GENERAL';}
interface StartParams{userId:string;model_id:string;prompt:string;negative_prompt?:string;duration_seconds:number;resolution:string;aspect_ratio:string;number_of_outputs:number;seed?:number|null;motion_strength?:number|null;references?:GenerationReferenceInput[];requested_provider_id?:string;client_request_id?:string;reqHost?:string;}
function inferMode(refs:GenerationReferenceInput[]):GenerationMode{if(!refs.length)return'TEXT_TO_VIDEO';if(refs.some(r=>r.slot_type==='INITIAL'))return'IMAGE_TO_VIDEO';return'REFERENCE_TO_VIDEO';}
function terminal(status:string){return ['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(status);}

async function archiveResult(userId:string,generationId:string,url:string){
 try{
  const response=await fetch(url);if(!response.ok)throw new Error(`Result download HTTP ${response.status}`);const length=Number(response.headers.get('content-length')||0);if(length>300*1024*1024)throw new Error('Resultado excede limite de 300MB.');const buffer=Buffer.from(await response.arrayBuffer());
  const storage=getAdminStorage(),cfg=getFirebaseConfig();if(!storage||!cfg.storageBucket)throw new Error('Storage indisponível.');const contentType=response.headers.get('content-type')||'video/mp4';const storagePath=`users/${userId}/generations/${generationId}/result.mp4`;await storage.bucket(cfg.storageBucket).file(storagePath).save(buffer,{resumable:false,contentType,metadata:{cacheControl:'private,max-age=3600'}});
  const asset=await assetRepository.createAsset({owner_user_id:userId,type:'VIDEO',category:'GENERIC',name:`Generation ${generationId.slice(-6)}`,alias:`generation_${generationId.slice(-6)}`,storage_path:storagePath,mime_type:contentType,size_bytes:buffer.length,status:'READY'});return asset;
 }catch(err:any){console.warn('[GenerationArchive]',err?.message);return null;}
}

export const generationService={
 async createAndStartGeneration(params:StartParams):Promise<Generation>{
  if(!params.model_id||!params.prompt?.trim())throw Object.assign(new Error('Modelo e prompt são obrigatórios.'),{code:'VALIDATION_ERROR'});if(!Number.isInteger(params.duration_seconds)||params.duration_seconds<=0)throw new Error('Duração inválida.');if(!Number.isInteger(params.number_of_outputs)||params.number_of_outputs<1||params.number_of_outputs>4)throw new Error('Quantidade de saídas inválida.');
  const clientId=params.client_request_id||crypto.randomUUID();const existing=await generationRepository.findByClientRequest(params.userId,clientId);if(existing)return existing;
  const refs=params.references||[];const mode=inferMode(refs);const generationId=`gen_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  const decision=await smartRouterService.selectProvider({userId:params.userId,model_id:params.model_id,mode,duration_seconds:params.duration_seconds,resolution:params.resolution,number_of_outputs:params.number_of_outputs,generation_id:generationId});
  const reserveAmount=decision.selected.customer_price_cents;const now=new Date().toISOString();let generation:Generation={generation_id:generationId,user_id:params.userId,status:'QUEUED',model_id:params.model_id,provider_id:decision.selected.provider_id,mode,original_prompt:params.prompt.trim(),compiled_prompt:params.prompt.trim(),prompt_compiler_version:'stage3-router-1.0',duration_seconds:params.duration_seconds,resolution:params.resolution,aspect_ratio:params.aspect_ratio,estimated_cost_cents:reserveAmount,maximum_authorized_cost_cents:reserveAmount,final_cost_cents:0,currency:'BRL',client_request_id:clientId,progress_percent:0,result_asset_id:null,result_url:null,thumbnail_url:null,error_code:null,error_message:null,attempt_count:0,references_count:refs.length,created_at:now,submitted_at:null,completed_at:null,failed_at:null};
  await generationRepository.saveGeneration(generation);generation.status='RESERVING_FUNDS';await generationRepository.saveGeneration(generation);
  await walletService.reserveForGeneration({userId:params.userId,amount_cents:reserveAmount,generation_id:generationId,idempotency_key:`reserve:${generationId}`,description:`Reserva geração ${params.model_id}`});
  try{
   const resolved=await assetReferenceResolver.resolveReferenceAssetUrls(params.userId,refs.map(r=>r.asset_id),params.reqHost);const enriched=resolved.map(r=>({...r,slot_type:refs.find(x=>x.asset_id===r.asset_id)?.slot_type||'GENERAL' as const}));
   const compatible=[decision.selected,...decision.candidates.filter(c=>c.provider_id!==decision.selected.provider_id&&c.customer_price_cents<=reserveAmount)];let lastError:any=null;
   for(let i=0;i<compatible.length;i++){
    const candidate=compatible[i],adapter=providerRegistry.getAdapter(candidate.provider_id);if(!adapter||!adapter.isConfigured())continue;const attemptId=`att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;const attempt:GenerationAttemptLog={attempt_id:attemptId,generation_id:generationId,attempt_number:i+1,provider_id:candidate.provider_id,status:'SUBMITTED',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    try{
     generation.provider_id=candidate.provider_id;generation.attempt_count=i+1;await generationRepository.saveGeneration(generation);
     const job=await adapter.submitGeneration({generation_id:generationId,user_id:params.userId,model_id:params.model_id,mode,prompt:params.prompt.trim(),negative_prompt:params.negative_prompt,duration_seconds:params.duration_seconds,resolution:params.resolution,aspect_ratio:params.aspect_ratio,number_of_outputs:params.number_of_outputs,seed:params.seed,motion_strength:params.motion_strength,references:enriched});attempt.provider_job_id=job.provider_job_id;attempt.updated_at=new Date().toISOString();await generationRepository.recordAttemptLog(attempt);
     generation.provider_job_id=job.provider_job_id;generation.status='SUBMITTED';generation.submitted_at=new Date().toISOString();await generationRepository.saveGeneration(generation);return generation;
    }catch(err:any){lastError=err;attempt.status='FAILED';attempt.error_message=err?.message||'Falha ao enviar';attempt.updated_at=new Date().toISOString();await generationRepository.recordAttemptLog(attempt);}
   }
   throw lastError||Object.assign(new Error('Todos os providers compatíveis falharam antes de aceitar o job.'),{code:'PROVIDER_SUBMISSION_FAILED'});
  }catch(err:any){await walletService.releaseForGeneration({userId:params.userId,amount_cents:reserveAmount,generation_id:generationId,idempotency_key:`release:${generationId}:submit-failure`,reason:'Liberação por falha antes do processamento'}).catch(()=>{});generation.status='FAILED';generation.error_code=err?.code||'GENERATION_SUBMIT_FAILED';generation.error_message=err?.message||'Falha ao iniciar geração';generation.failed_at=new Date().toISOString();await generationRepository.saveGeneration(generation);throw err;}
 },

 async refreshGenerationState(generation:Generation):Promise<Generation>{
  if(terminal(generation.status)||!generation.provider_job_id)return generation;const adapter=providerRegistry.getAdapter(generation.provider_id);if(!adapter||!adapter.isConfigured())return generation;
  let status;try{status=await adapter.checkStatus(generation.provider_job_id);}catch(err:any){console.warn('[GenerationPoll]',generation.generation_id,err?.message);return generation;}
  if(status.status==='QUEUED'||status.status==='PROCESSING'){generation.status=status.status;generation.progress_percent=status.progress_percent??generation.progress_percent;return generationRepository.saveGeneration(generation);}
  if(status.status==='FAILED'){
   const reserved=generation.maximum_authorized_cost_cents||generation.estimated_cost_cents||0;if(reserved>0)await walletService.releaseForGeneration({userId:generation.user_id,amount_cents:reserved,generation_id:generation.generation_id,idempotency_key:`release:${generation.generation_id}:provider-failure`,reason:'Provider finalizou com falha'}).catch(()=>{});generation.status='FAILED';generation.progress_percent=0;generation.error_code=status.error_code||'PROVIDER_GENERATION_FAILED';generation.error_message=status.error_message||'A geração falhou no provider.';generation.failed_at=new Date().toISOString();return generationRepository.saveGeneration(generation);
  }
  const finalCost=generation.estimated_cost_cents||0;if(finalCost>0)await walletService.captureForGeneration({userId:generation.user_id,amount_cents:finalCost,generation_id:generation.generation_id,idempotency_key:`capture:${generation.generation_id}`});
  generation.status='SUCCEEDED';generation.progress_percent=100;generation.final_cost_cents=finalCost;generation.completed_at=new Date().toISOString();generation.result_url=status.result_video_url||null;generation.thumbnail_url=status.thumbnail_url||null;
  if(status.result_video_url){const asset=await archiveResult(generation.user_id,generation.generation_id,status.result_video_url);if(asset)generation.result_asset_id=asset.asset_id;}
  return generationRepository.saveGeneration(generation);
 },

 async getGeneration(id:string,userId:string){const g=await generationRepository.getGeneration(id);if(!g||g.user_id!==userId)return null;return this.refreshGenerationState(g);},
 async listUserGenerations(userId:string,limit=50){const list=await generationRepository.listUserGenerations(userId,limit);return Promise.all(list.map(g=>terminal(g.status)?g:this.refreshGenerationState(g)));},
 async cancelGeneration(id:string,userId:string){const g=await generationRepository.getGeneration(id);if(!g||g.user_id!==userId)throw new Error('Geração não encontrada.');if(terminal(g.status))return g;if(g.provider_job_id){const adapter=providerRegistry.getAdapter(g.provider_id);const cancelled=adapter?.cancelJob?await adapter.cancelJob(g.provider_job_id):false;if(!cancelled)throw new Error('Este provider não permite cancelar depois que o job foi enviado.');}
  const reserved=g.maximum_authorized_cost_cents||g.estimated_cost_cents||0;if(reserved>0)await walletService.releaseForGeneration({userId,amount_cents:reserved,generation_id:id,idempotency_key:`release:${id}:cancel`,reason:'Cancelamento do usuário'});g.status='CANCELLED';g.failed_at=new Date().toISOString();return generationRepository.saveGeneration(g);}
};
