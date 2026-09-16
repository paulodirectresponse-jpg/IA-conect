import { apiRequest } from '../services/apiClient.js';
import { BetaCapabilityModel } from './capabilityClient.js';

export const betaImageEditorClient={
  async catalog(){
    const data=await apiRequest<{models:BetaCapabilityModel[]}>('/api/beta/capabilities');
    return(data.models||[]).filter(model=>model.category==='IMAGE'&&model.capabilities.some(cap=>['image-edit','inpaint-mask','background-remove-replace','outpaint','upscale','variations'].includes(cap.id)));
  },
  markMask(assetId:string){return apiRequest(`/api/assets/${encodeURIComponent(assetId)}`,{method:'PATCH',body:JSON.stringify({media_metadata:{editor_mask:true}})});},
};
