import { apiRequest } from '../services/apiClient.js';
import { BetaCapabilityModel } from './capabilityClient.js';

export interface BetaAudioVoice{
  voice_id:string;
  label:string;
  source_asset_id:string|null;
  source_generation_id:string;
  created_at:string;
}

export const betaAudioClient={
  async catalog(){
    const data=await apiRequest<{models:BetaCapabilityModel[]}>('/api/beta/capabilities');
    return (data.models||[]).filter(model=>model.category==='AUDIO');
  },
  voices(){return apiRequest<BetaAudioVoice[]>('/api/beta/audio/voices');},
};
