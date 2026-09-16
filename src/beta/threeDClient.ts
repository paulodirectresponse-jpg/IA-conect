import { apiRequest } from '../services/apiClient.js';
import { BetaCapabilityModel } from './capabilityClient.js';

export const betaThreeDClient={
  async catalog(){
    const data=await apiRequest<{models:BetaCapabilityModel[]}>('/api/beta/capabilities');
    return(data.models||[]).filter(model=>model.category==='MODEL_3D');
  },
};
