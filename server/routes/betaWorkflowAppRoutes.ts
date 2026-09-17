import {NextFunction,Response,Router} from 'express';
import {AuthenticatedRequest,requireAuth} from '../middleware/authMiddleware.js';
import {workflowAppService} from '../beta/apps/workflowAppService.js';
import {normalizeBetaPublicError} from '../beta/http/publicError.js';
import {featureFlagService} from '../services/featureFlagService.js';

export const betaWorkflowAppRouter=Router();
function failure(res:Response,error:any,fallback:string){const n=normalizeBetaPublicError(error,fallback);return res.status(n.status).json({success:false,error:n.error});}
async function requireApps(_req:AuthenticatedRequest,res:Response,next:NextFunction){try{const flags=await featureFlagService.getPublicFlags();if(!flags['beta.enabled']||!flags['beta.flow_apps'])return failure(res,{code:'BETA_DISABLED'},'Workflow Apps indisponíveis.');next();}catch{return failure(res,{code:'BETA_ACCESS_UNAVAILABLE'},'Não foi possível validar o acesso.');}}
betaWorkflowAppRouter.use('/beta/apps',requireAuth,requireApps);
betaWorkflowAppRouter.get('/beta/apps',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await workflowAppService.list(req.user!.uid)});}catch(e){return failure(res,e,'Não foi possível carregar os Apps.');}});
betaWorkflowAppRouter.post('/beta/apps',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await workflowAppService.create(req.user!.uid,req.body||{})});}catch(e){return failure(res,e,'Não foi possível criar o App.');}});
betaWorkflowAppRouter.get('/beta/apps/:appId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await workflowAppService.get(req.user!.uid,req.params.appId)});}catch(e){return failure(res,e,'Não foi possível carregar o App.');}});
betaWorkflowAppRouter.patch('/beta/apps/:appId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await workflowAppService.update(req.user!.uid,req.params.appId,req.body||{})});}catch(e){return failure(res,e,'Não foi possível atualizar o App.');}});
betaWorkflowAppRouter.post('/beta/apps/:appId/publish',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await workflowAppService.publish(req.user!.uid,req.params.appId)});}catch(e){return failure(res,e,'Não foi possível publicar o App.');}});
betaWorkflowAppRouter.post('/beta/apps/:appId/refresh-revision',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await workflowAppService.refreshRevision(req.user!.uid,req.params.appId)});}catch(e){return failure(res,e,'Não foi possível atualizar a revisão do App.');}});
betaWorkflowAppRouter.post('/beta/apps/:appId/runs',async(req:AuthenticatedRequest,res)=>{try{return res.status(202).json({success:true,data:await workflowAppService.run(req.user!.uid,req.params.appId,req.body||{},String(req.header('Idempotency-Key')||''),req.get('host'),String(req.header('Authorization')||'').replace(/^Bearer\s+/i,''))});}catch(e){return failure(res,e,'Não foi possível executar o App.');}});
betaWorkflowAppRouter.delete('/beta/apps/:appId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await workflowAppService.remove(req.user!.uid,req.params.appId)});}catch(e){return failure(res,e,'Não foi possível remover o App.');}});
