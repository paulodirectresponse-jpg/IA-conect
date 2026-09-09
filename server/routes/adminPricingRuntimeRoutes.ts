import { Router } from 'express';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { pricingSyncService } from '../services/pricingSyncService.js';
import { pricingSettingsService } from '../services/pricingSettingsService.js';
import { quoteCacheService } from '../services/quoteCacheService.js';

export const adminPricingRuntimeRouter = Router();

adminPricingRuntimeRouter.get('/admin/pricing/live', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    let result = await pricingSyncService.getLatestSnapshot();
    if (!result.rows.length) result = await pricingSyncService.runHourlySync();
    return res.json({ success:true, data:result });
  } catch (err:any) {
    console.error('[AdminPricingSnapshot]', err?.message || err);
    return res.status(500).json({ success:false, error:{ code:'PRICING_SNAPSHOT_FAILED', message:err?.message || 'Não foi possível executar a verificação dos provedores.' } });
  }
});

adminPricingRuntimeRouter.get('/admin/pricing/settings', requireAuth, requireAdmin, async (_req:AuthenticatedRequest,res)=>{
  try{return res.json({success:true,data:await pricingSettingsService.get(true)});}catch(err:any){return res.status(500).json({success:false,error:{code:'PRICING_SETTINGS_FAILED',message:err?.message||'Não foi possível carregar a margem global.'}});}
});

adminPricingRuntimeRouter.post('/admin/pricing/settings', requireAuth, requireAdmin, async (req:AuthenticatedRequest,res)=>{
  try{
    const margin=Number(req.body?.gross_margin_percent);
    if(!Number.isFinite(margin)||margin<10||margin>80)return res.status(400).json({success:false,error:{code:'INVALID_MARGIN',message:'A margem deve ficar entre 10% e 80%.'}});
    const settings=await pricingSettingsService.set(margin,req.user?.uid);
    quoteCacheService.invalidateAll();
    const snapshot=await pricingSyncService.runHourlySync().catch(()=>null);
    return res.json({success:true,data:{settings,snapshot}});
  }catch(err:any){return res.status(500).json({success:false,error:{code:'PRICING_SETTINGS_SAVE_FAILED',message:err?.message||'Não foi possível salvar a margem global.'}});}
});

adminPricingRuntimeRouter.post('/admin/pricing/sync', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res) => {
  try {
    const result = await pricingSyncService.runHourlySync();
    return res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[AdminPricingSync]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: {
        code: err?.code || 'PRICING_SYNC_FAILED',
        message: err?.message || 'Não foi possível atualizar os preços agora.',
      },
    });
  }
});