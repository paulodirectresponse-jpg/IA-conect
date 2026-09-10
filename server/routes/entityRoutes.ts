import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { creativeEntityRepository, CreativeEntityKind } from '../repositories/creativeEntityRepository.js';

export const entityRouter=Router();
entityRouter.use(requireAuth);

entityRouter.get('/creative-entities',async(req:AuthenticatedRequest,res)=>{
  try{
    const kind=req.query.kind?String(req.query.kind).toUpperCase() as CreativeEntityKind:undefined;
    const projectId=req.query.project_id===undefined?undefined:(String(req.query.project_id||'')||null);
    const rows=await creativeEntityRepository.list(req.user!.uid,kind,projectId);
    res.json({success:true,data:rows});
  }catch(err:any){
    res.status(500).json({success:false,error:{code:'ENTITY_LIST_ERROR',message:err?.message||'Não foi possível carregar as entidades.'}});
  }
});

entityRouter.post('/creative-entities',async(req:AuthenticatedRequest,res)=>{
  try{
    const {kind,name,...rest}=req.body||{};
    if(!kind||!name)return res.status(400).json({success:false,error:{code:'VALIDATION_ERROR',message:'Tipo e nome são obrigatórios.'}});
    const entity=await creativeEntityRepository.save(req.user!.uid,{...rest,kind:String(kind).toUpperCase() as CreativeEntityKind,name:String(name)});
    res.json({success:true,data:entity});
  }catch(err:any){
    res.status(400).json({success:false,error:{code:'ENTITY_SAVE_ERROR',message:err?.message||'Não foi possível salvar a entidade.'}});
  }
});

entityRouter.put('/creative-entities/:entityId/assets',async(req:AuthenticatedRequest,res)=>{
  try{
    const entity=await creativeEntityRepository.setProjectAssets(req.user!.uid,req.params.entityId,Array.isArray(req.body?.asset_ids)?req.body.asset_ids:[]);
    res.json({success:true,data:entity});
  }catch(err:any){
    res.status(400).json({success:false,error:{code:'ENTITY_ASSETS_ERROR',message:err?.message||'Não foi possível atualizar os assets.'}});
  }
});

entityRouter.post('/creative-entities/:entityId/assets/:assetId/toggle',async(req:AuthenticatedRequest,res)=>{
  try{
    const entity=await creativeEntityRepository.toggleProjectAsset(req.user!.uid,req.params.entityId,req.params.assetId);
    res.json({success:true,data:entity});
  }catch(err:any){
    res.status(400).json({success:false,error:{code:'ENTITY_ASSETS_ERROR',message:err?.message||'Não foi possível atualizar os assets.'}});
  }
});

entityRouter.patch('/creative-entities/:entityId/archive',async(req:AuthenticatedRequest,res)=>{
  try{
    const entity=await creativeEntityRepository.archive(req.user!.uid,req.params.entityId);
    res.json({success:true,data:entity});
  }catch(err:any){
    res.status(400).json({success:false,error:{code:'ENTITY_ARCHIVE_ERROR',message:err?.message||'Não foi possível arquivar a entidade.'}});
  }
});

entityRouter.delete('/creative-entities/:entityId',async(req:AuthenticatedRequest,res)=>{
  try{
    await creativeEntityRepository.remove(req.user!.uid,req.params.entityId);
    res.json({success:true});
  }catch(err:any){
    res.status(400).json({success:false,error:{code:'ENTITY_DELETE_ERROR',message:err?.message||'Não foi possível excluir a entidade.'}});
  }
});
