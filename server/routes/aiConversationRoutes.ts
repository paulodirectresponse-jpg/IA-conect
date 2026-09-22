import{Router,Response}from'express';
import{AuthenticatedRequest,requireAuth}from'../middleware/authMiddleware.js';
import{normalizeBetaPublicError}from'../beta/http/publicError.js';
import{aiConversationService}from'../ai/conversation/conversationService.js';

export const aiConversationRouter=Router();
const failure=(res:Response,error:any,fallback:string)=>{const normalized=normalizeBetaPublicError(error,fallback);return res.status(normalized.status).json({success:false,error:normalized.error});};
aiConversationRouter.use('/ai/conversations',requireAuth);
aiConversationRouter.get('/ai/model',requireAuth,async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.model()});}catch(error){return failure(res,error,'Não foi possível carregar a IA Connect.');}});
aiConversationRouter.get('/ai/conversations',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.list(req.user!.uid)});}catch(error){return failure(res,error,'Não foi possível carregar suas conversas.');}});
aiConversationRouter.post('/ai/conversations',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await aiConversationService.create(req.user!.uid)});}catch(error){return failure(res,error,'Não foi possível criar a conversa.');}});
aiConversationRouter.get('/ai/conversations/:conversationId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.get(req.user!.uid,req.params.conversationId)});}catch(error){return failure(res,error,'Não foi possível carregar a conversa.');}});
aiConversationRouter.delete('/ai/conversations/:conversationId',async(req:AuthenticatedRequest,res)=>{try{return res.json({success:true,data:await aiConversationService.remove(req.user!.uid,req.params.conversationId)});}catch(error){return failure(res,error,'Não foi possível excluir a conversa.');}});
aiConversationRouter.post('/ai/conversations/:conversationId/messages',async(req:AuthenticatedRequest,res)=>{try{return res.status(201).json({success:true,data:await aiConversationService.send(req.user!.uid,req.params.conversationId,req.body||{})});}catch(error){return failure(res,error,'A IA Connect não conseguiu responder agora.');}});
