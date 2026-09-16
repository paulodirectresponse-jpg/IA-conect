import { apiRequest } from '../services/apiClient.js';
import { BetaCapabilityModel } from './capabilityClient.js';

const VIDEO_CAPS=new Set(['text-to-video','image-to-video','first-frame','last-frame','video-extend','video-edit']);

export const betaVideoClient={
  async catalog(){
    const data=await apiRequest<{models:BetaCapabilityModel[]}>('/api/beta/capabilities');
    return(data.models||[]).filter(model=>
      (model.category==='VIDEO'||model.model_id==='AUTO')&&model.capabilities.some(cap=>VIDEO_CAPS.has(cap.id))
    );
  },
};
