import { assetReferenceResolver } from '../services/assetReferenceResolver.js';
import { BetaJob, BetaJobRequest } from '../beta/jobs/jobTypes.js';
import { routingV2ExecutionService } from './executionService.js';

function dimensions(request:BetaJobRequest){
  return{
    resolution:request.controls.resolution,
    aspect_ratio:request.controls.aspect_ratio,
    duration_seconds:request.controls.duration_seconds,
    model_variant:request.controls.model_variant,
    audio_enabled:request.controls.audio_enabled,
    mesh_mode:request.controls.mesh_mode,
    pbr:request.controls.pbr,
    target_faces:request.controls.target_faces,
    topology:request.controls.topology,
    output_format:request.controls.output_format,
  };
}

async function executionReferences(userId:string,request:BetaJobRequest){
  if(!request.references.length)return[];
  const resolved=await assetReferenceResolver.resolveReferenceAssetUrls(userId,request.references.map(ref=>ref.asset_id));
  return resolved.map(asset=>{
    const source=request.references.find(ref=>ref.asset_id===asset.asset_id);
    return{
      url:asset.provider_accessible_url,
      type:asset.type,
      role:source?.role||source?.slot_type||'REFERENCE',
    };
  });
}

export const routingV2JobBridge={
  async preview(userId:string,request:BetaJobRequest){
    return routingV2ExecutionService.preview({
      user_id:userId,
      model_id:request.model_id,
      capability_id:request.capability_id,
      duration_seconds:request.controls.duration_seconds,
      number_of_outputs:request.controls.number_of_outputs,
      character_count:request.capability_id==='text-to-speech'?request.prompt.length:undefined,
      dimensions:dimensions(request),
      prompt:request.prompt,
      negative_prompt:request.negative_prompt,
    });
  },

  async start(job:BetaJob,userId:string,authorization:{credit_price:number;client_request_id:string}){
    if(job.user_id!==userId)throw Object.assign(new Error('Job não pertence ao usuário.'),{code:'JOB_NOT_FOUND'});
    const refs=await executionReferences(userId,job.request);
    return routingV2ExecutionService.start({
      user_id:userId,
      model_id:job.request.model_id,
      capability_id:job.request.capability_id,
      prompt:job.request.prompt,
      negative_prompt:job.request.negative_prompt,
      duration_seconds:job.request.controls.duration_seconds,
      number_of_outputs:job.request.controls.number_of_outputs,
      character_count:job.request.capability_id==='text-to-speech'?job.request.prompt.length:undefined,
      dimensions:dimensions(job.request),
      parameters:{
        resolution:job.request.controls.resolution,
        aspect_ratio:job.request.controls.aspect_ratio,
        seed:job.request.controls.seed,
        motion_strength:job.request.controls.motion_strength,
        audio_enabled:job.request.controls.audio_enabled,
        model_variant:job.request.controls.model_variant,
        ...(job.request.controls.pricing_options||{}),
      },
      references:refs,
      client_request_id:authorization.client_request_id,
      source_job_id:job.job_id,
      authorized_credit_price:authorization.credit_price,
    });
  },

  async refresh(job:BetaJob,userId:string){
    if(job.user_id!==userId)throw Object.assign(new Error('Job não pertence ao usuário.'),{code:'JOB_NOT_FOUND'});
    if(!job.linked_generation_id)throw Object.assign(new Error('Job ainda não possui geração vinculada.'),{code:'JOB_GENERATION_REQUIRED'});
    return routingV2ExecutionService.refresh(job.linked_generation_id,userId);
  },
};
