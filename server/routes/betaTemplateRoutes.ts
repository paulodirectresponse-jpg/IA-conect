import {NextFunction,Response,Router} from 'express';
import {AuthenticatedRequest,requireAuth} from '../middleware/authMiddleware.js';
import {featureFlagService} from '../services/featureFlagService.js';
import {betaTemplateService} from '../beta/templates/templateService.js';
import {normalizeBetaPublicError} from '../beta/http/publicError.js';

export const betaTemplateRouter=Router();
function failure(res:Response,error:any,fallback:string){const n=normalizeBetaPublicError(error,fallback);return res.status(n.status).json({success:false,error:n.error});}
async function requireTemplates(_req:AuthenticatedRequest,res:Response,next:NextFunction){try{const flags=await featureFlagService.getPublicFlags();if(!flags['beta.enabled']||!flags['beta.templates'])return failure(res,{code:'BETA_DISABLED'},'Templates indisponíveis.');next();}catch{return failure(res,{code:'BETA_ACCESS_UNAVAILABLE'},'Não foi possível validar o acesso.');}}
betaTemplateRouter.use('/beta/templates',requireAuth,requireTemplates);
betaTemplateRouter.get('/beta/templates',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaTemplateService.list(req.user!.uid)});}catch(e){return failure(res,e,'Não foi possível carregar os templates.');}});
betaTemplateRouter.post('/beta/templates',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await betaTemplateService.createFromFlow(req.user!.uid,req.body||{})});}catch(e){return failure(res,e,'Não foi possível criar o template.');}});
betaTemplateRouter.patch('/beta/templates/:templateId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaTemplateService.update(req.user!.uid,req.params.templateId,req.body||{})});}catch(e){return failure(res,e,'Não foi possível atualizar o template.');}});
betaTemplateRouter.post('/beta/templates/:templateId/instantiate',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await betaTemplateService.instantiate(req.user!.uid,req.params.templateId,req.body||{})});}catch(e){return failure(res,e,'Não foi possível usar o template.');}});
betaTemplateRouter.delete('/beta/templates/:templateId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await betaTemplateService.remove(req.user!.uid,req.params.templateId)});}catch(e){return failure(res,e,'Não foi possível remover o template.');}});
