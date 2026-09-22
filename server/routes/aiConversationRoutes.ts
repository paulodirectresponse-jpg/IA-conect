import{Router,Response}from'express';
import{AuthenticatedRequest,requireAuth}from'../middleware/authMiddleware.js';
import{normalizeBetaPublicError}from'../beta/http/publicError.js';
import{aiConversationService}from'../ai/conversation/conversationService.js';
import{aiConversationActionService}from'../ai/conversation/actionService.js';

export const aiConversationRouter=Router();
const failure=(res:Response,error:any,fallback:string)=>{const normalized=normalizeBetaPublicError(error,fallback);return res.status(normalized.status).json({success:false,error:normalized.error});};
aiConversationRouter.use('/ai/conversations',requireAuth);
aiConversationRouter.get('/ai/model',requireAuth,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.model()});}catch(error){return failure(res,error,'Não foi possível carregar a IA Connect.');}});
aiConversationRouter.get('/ai/conversations',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.list(req.user!.uid)});}catch(error){return failure(res,error,'Não foi possível carregar suas conversas.');}});
aiConversationRouter.post('/ai/conversations',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await aiConversationService.create(req.user!.uid)});}catch(error){return failure(res,error,'Não foi possível criar a conversa.');}});
aiConversationRouter.get('/ai/conversations/:conversationId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.get(req.user!.uid,req.params.conversationId)});}catch(error){return failure(res,error,'Não foi possível carregar a conversa.');}});
aiConversationRouter.delete('/ai/conversations/:conversationId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.remove(req.user!.uid,req.params.conversationId)});}catch(error){return failure(res,error,'Não foi possível excluir a conversa.');}});
aiConversationRouter.post('/ai/conversations/:conversationId/messages',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await aiConversationService.send(req.user!.uid,req.params.conversationId,req.body||{})});}catch(error){return failure(res,error,'A IA Connect não conseguiu responder agora.');}});

aiConversationRouter.post('/ai/conversations/:conversationId/actions/:actionId/quote',async(req:AuthenticatedRequest,res)=>{
 try{return res.json({success:true,data:await aiConversationActionService.quote(req.user!.uid,req.params.conversationId,req.params.actionId)});}
 catch(error){return failure(res,error,'Não foi possível calcular o preço desta ação.');}
});
aiConversationRouter.post('/ai/conversations/:conversationId/actions/:actionId/confirm',async(req:AuthenticatedRequest,res)=>{
 try{
  const host=req.get('host')||process.env.APP_URL;
  const authorization=String(req.headers.authorization||'');
  const idToken=authorization.startsWith('Bearer ')?authorization.slice(7):undefined;
  return res.json({success:true,data:await aiConversationActionService.confirm(req.user!.uid,req.params.conversationId,req.params.actionId,host,idToken)});
 }catch(error){return failure(res,error,'Não foi possível confirmar esta ação.');}
});
aiConversationRouter.get('/ai/conversations/:conversationId/actions/:actionId',async(req:AuthenticatedRequest,res)=>{
 try{return res.json({success:true,data:await aiConversationActionService.refresh(req.user!.uid,req.params.conversationId,req.params.actionId)});}
 catch(error){return failure(res,error,'Não foi possível atualizar esta ação.');}
});

aiConversationRouter.post('/ai/conversations/:conversationId/actions/:actionId/regenerate',async(req:AuthenticatedRequest,res)=>{
 try{return res.status(201).json({success:true,data:await aiConversationActionService.regenerate(req.user!.uid,req.params.conversationId,req.params.actionId,String(req.body?.asset_id||''))});}
 catch(error){return failure(res,error,'Não foi possível preparar a regeneração deste resultado.');}
});

aiConversationRouter.post('/ai/conversations/:conversationId/actions/:actionId/retry',async(req:AuthenticatedRequest,res)=>{
 try{return res.status(201).json({success:true,data:await aiConversationActionService.retryFailed(req.user!.uid,req.params.conversationId,req.params.actionId)});}
 catch(error){return failure(res,error,'Não foi possível preparar uma nova tentativa.');}
});
aiConversationRouter.post('/ai/conversations/:conversationId/actions/:actionId/cancel',async(req:AuthenticatedRequest,res)=>{
 try{return res.json({success:true,data:await aiConversationActionService.cancel(req.user!.uid,req.params.conversationId,req.params.actionId)});}
 catch(error){return failure(res,error,'Não foi possível cancelar esta geração.');}
});
