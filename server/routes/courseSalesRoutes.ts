import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { paymentService } from '../services/paymentService.js';
import { ANIMATION_3D_COURSE_ID, courseOfferService } from '../services/courseOfferService.js';
import { courseEntitlementService } from '../services/courseEntitlementService.js';

export const courseSalesRouter = Router();

courseSalesRouter.get('/course-sales/animation-3d/offer', (_req, res) => {
  const offer=courseOfferService.get(ANIMATION_3D_COURSE_ID);
  if(!offer)return res.status(404).json({success:false,error:{code:'COURSE_NOT_FOUND',message:'Curso não encontrado.'}});
  return res.json({success:true,data:offer});
});

courseSalesRouter.post('/course-sales/animation-3d/checkout', requireAuth, async (req:AuthenticatedRequest,res) => {
  try{
    const offer=courseOfferService.get(ANIMATION_3D_COURSE_ID);
    if(!offer)return res.status(404).json({success:false,error:{code:'COURSE_NOT_FOUND',message:'Curso não encontrado.'}});
    const payment=await paymentService.createCoursePayment({
      userId:req.user!.uid,
      courseId:offer.course_id,
      courseVersion:offer.version,
      method:'PIX',
    });
    return res.json({success:true,data:payment});
  }catch(err:any){
    const code=err?.code||'COURSE_CHECKOUT_ERROR';
    const status=code==='PAYMENTS_NOT_CONFIGURED'?503:400;
    return res.status(status).json({success:false,error:{code,message:err?.message||'Não foi possível iniciar o pagamento.'}});
  }
});

courseSalesRouter.get('/course-sales/animation-3d/access', requireAuth, async (req:AuthenticatedRequest,res) => {
  try{
    const entitlement=await courseEntitlementService.get(ANIMATION_3D_COURSE_ID,req.user!.uid);
    return res.json({success:true,data:{active:entitlement?.status==='ACTIVE',entitlement}});
  }catch(err:any){
    return res.status(500).json({success:false,error:{code:'COURSE_ACCESS_FETCH_ERROR',message:err?.message||'Não foi possível consultar o acesso ao curso.'}});
  }
});
