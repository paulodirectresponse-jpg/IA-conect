import{universalAssetService}from'../assets/universalAssetService.js';
import{betaFlowService}from'../flows/flowService.js';
import{betaTemplateService}from'../templates/templateService.js';
import{workflowAppService}from'../apps/workflowAppService.js';
import{betaFlowRuntimeRepository}from'../flows/flowRuntimeRepository.js';
import{betaSharingRepository}from'./sharingRepository.js';
export const betaAnalyticsService={
  async overview(userId:string){
    const[assets,flows,templates,apps,runs,shares]=await Promise.all([universalAssetService.list(userId),betaFlowService.list(userId),betaTemplateService.list(userId),workflowAppService.list(userId),betaFlowRuntimeRepository.listRuns(userId,100),betaSharingRepository.list(userId)]);
    const succeeded=runs.filter(r=>r.status==='SUCCEEDED').length,failed=runs.filter(r=>r.status==='FAILED').length,cancelled=runs.filter(r=>r.status==='CANCELLED').length;
    const capturedCredits=runs.reduce((sum,r)=>sum+Number(r.captured_credits_total||0),0);
    const activeShares=shares.filter(s=>s.status==='ACTIVE').length,shareViews=shares.reduce((sum,s)=>sum+Number(s.view_count||0),0);
    return{resources:{assets:assets.length,flows:flows.length,templates:templates.length,apps:apps.length},execution:{runs:runs.length,succeeded,failed,cancelled,success_rate:runs.length?Number((succeeded/runs.length).toFixed(4)):0,captured_credits:capturedCredits},sharing:{shares:shares.length,active_shares:activeShares,views:shareViews},generated_at:new Date().toISOString()};
  },
};
