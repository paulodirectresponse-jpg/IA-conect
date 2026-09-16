import { Router,Response,NextFunction } from 'express';
import { requireAuth,AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { catalogRepository } from '../repositories/catalogRepository.js';
import { audioVoiceService } from '../beta/audio/audioVoiceService.js';
import { normalizeBetaPublicError } from '../beta/http/publicError.js';

export const betaAudioRouter=Router();

async function requireAudioEnabled(_req:AuthenticatedRequest,res:Response,next:NextFunction){
  try{
    const[beta,audio]=await Promise.all([
      catalogRepository.getFeatureFlag('beta.enabled'),
      catalogRepository.getFeatureFlag('beta.audio'),
    ]);
    if(!beta?.is_enabled||!audio?.is_enabled){
      const normalized=normalizeBetaPublicError({code:'AUDIO_MODULE_DISABLED'});
      return res.status(normalized.status).json({success:false,error:normalized.error});
    }
    next();
  }catch{
    const normalized=normalizeBetaPublicError({code:'BETA_ACCESS_UNAVAILABLE'});
    return res.status(normalized.status).json({success:false,error:normalized.error});
  }
}

betaAudioRouter.use('/beta/audio',requireAuth,requireAudioEnabled);

betaAudioRouter.get('/beta/audio/voices',async(req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await audioVoiceService.list(req.user!.uid)});}
  catch(error:any){
    const normalized=normalizeBetaPublicError(error,'Não foi possível carregar suas vozes.');
    return res.status(normalized.status).json({success:false,error:normalized.error});
  }
});
