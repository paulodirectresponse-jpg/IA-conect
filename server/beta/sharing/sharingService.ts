import crypto from'crypto';
import{universalAssetService}from'../assets/universalAssetService.js';
import{betaFlowService}from'../flows/flowService.js';
import{betaTemplateService}from'../templates/templateService.js';
import{workflowAppService}from'../apps/workflowAppService.js';
import{betaSharingRepository}from'./sharingRepository.js';
import{BetaShareRecord,BetaShareResourceType}from'./sharingTypes.js';
const now=()=>new Date().toISOString();
const clean=(v:any,max:number)=>String(v||'').trim().replace(/\s+/g,' ').slice(0,max);
const hash=(v:string)=>crypto.createHash('sha256').update(v).digest('hex');
function fail(code:string,message:string):never{throw Object.assign(new Error(message),{code});}
function resourceType(v:any):BetaShareResourceType{const t=String(v||'').toUpperCase();if(!['ASSET','FLOW','TEMPLATE','APP'].includes(t))fail('SHARE_RESOURCE_INVALID','Tipo de recurso inválido.');return t as BetaShareResourceType;}
function publicToken(){return crypto.randomBytes(24).toString('base64url');}
async function snapshot(userId:string,type:BetaShareResourceType,id:string){
  if(type==='ASSET'){const a:any=await universalAssetService.get(userId,id);return{title:a.name||a.alias||'Asset',data:{asset_id:a.asset_id,type:a.type,name:a.name,alias:a.alias,status:a.status,public_url:a.public_url,preview_url:a.preview_url,mime_type:a.mime_type,width:a.width,height:a.height,duration_seconds:a.duration_seconds,created_at:a.created_at}};}
  if(type==='FLOW'){const f:any=await betaFlowService.get(userId,id);return{title:f.name,data:{flow_id:f.flow_id,name:f.name,description:f.description,revision:f.revision,status:f.status,graph:f.graph,created_at:f.created_at,updated_at:f.updated_at}};}
  if(type==='TEMPLATE'){const t:any=await betaTemplateService.get(userId,id);return{title:t.name,data:{template_id:t.template_id,name:t.name,description:t.description,category:t.category,tags:t.tags,graph:t.graph,source_flow_revision:t.source_flow_revision,created_at:t.created_at,updated_at:t.updated_at}};}
  const a:any=await workflowAppService.get(userId,id);return{title:a.name,data:{app_id:a.app_id,name:a.name,description:a.description,status:a.status,revision:a.revision,source_type:a.source_type,input_schema:a.input_schema,output_schema:a.output_schema,published_at:a.published_at||null,created_at:a.created_at,updated_at:a.updated_at}};
}
function owned(row:BetaShareRecord|null){if(!row)fail('SHARE_NOT_FOUND','Compartilhamento não encontrado.');return row;}
export const betaSharingService={
  async list(userId:string){return(await betaSharingRepository.list(userId)).map(({token_hash,snapshot,...row})=>({...row,snapshot_summary:{name:String(snapshot?.name||snapshot?.title||row.title),kind:row.resource_type}}));},
  async create(userId:string,input:any){const type=resourceType(input?.resource_type),id=clean(input?.resource_id,160);if(!id)fail('SHARE_RESOURCE_REQUIRED','Selecione um recurso para compartilhar.');const snap=await snapshot(userId,type,id),token=publicToken(),ts=now();const row:BetaShareRecord={share_id:betaSharingRepository.makeId(),user_id:userId,resource_type:type,resource_id:id,title:clean(input?.title,120)||snap.title,status:'ACTIVE',token_hash:hash(token),snapshot:snap.data,view_count:0,created_at:ts,updated_at:ts,revoked_at:null};await betaSharingRepository.save(row);return{share_id:row.share_id,token,title:row.title,resource_type:row.resource_type,created_at:row.created_at};},
  async rotate(userId:string,shareId:string){const row=owned(await betaSharingRepository.get(shareId,userId)),token=publicToken();if(row.status!=='ACTIVE')fail('SHARE_REVOKED','Reative criando um novo compartilhamento.');await betaSharingRepository.save({...row,token_hash:hash(token),updated_at:now()});return{share_id:row.share_id,token};},
  async revoke(userId:string,shareId:string){const row=owned(await betaSharingRepository.get(shareId,userId)),ts=now();return betaSharingRepository.save({...row,status:'REVOKED',revoked_at:ts,updated_at:ts});},
  async resolvePublic(token:string){const raw=clean(token,256);if(raw.length<20)fail('SHARE_NOT_FOUND','Link de compartilhamento inválido.');const row=await betaSharingRepository.getByTokenHash(hash(raw));if(!row||row.status!=='ACTIVE')fail('SHARE_NOT_FOUND','Link de compartilhamento inválido ou revogado.');await betaSharingRepository.save({...row,view_count:Number(row.view_count||0)+1,updated_at:now()});return{share_id:row.share_id,resource_type:row.resource_type,title:row.title,snapshot:row.snapshot,created_at:row.created_at};},
};
