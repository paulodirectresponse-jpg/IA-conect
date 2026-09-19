import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzjyhhenajbjxkwkmzdg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'demo-key';

const api = async (method: string, path: string, body?: any) => {
  try {
    const url = `${SUPABASE_URL}/rest/v1${path}`;
    const options: any = {
      method,
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    const data = await response.json();
    return { ok: response.ok, data };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
};

async function migrate() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   🔧 MIGRAÇÃO DIRETA NO BANCO - V1 → V2                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // LIMPEZA
  console.log('📍 FASE 1: LIMPEZA\n');
  
  console.log('  1️⃣ Deletando modelos antigos...');
  const modelsRes = await api('GET', '/universal_models?select=id');
  if (modelsRes.ok && Array.isArray(modelsRes.data)) {
    for (const model of modelsRes.data) {
      await api('DELETE', `/universal_models?id=eq.${model.id}`);
    }
    console.log(`     ✅ ${modelsRes.data.length} modelos deletados`);
  }

  console.log('  2️⃣ Deletando providers antigos...');
  const providersRes = await api('GET', '/routing_v1_providers?select=id');
  if (providersRes.ok && Array.isArray(providersRes.data)) {
    for (const provider of providersRes.data) {
      await api('DELETE', `/routing_v1_providers?id=eq.${provider.id}`);
    }
    console.log(`     ✅ ${providersRes.data.length} providers deletados`);
  }

  // BOOTSTRAP NOVO
  console.log('\n📍 FASE 2: BOOTSTRAP V2 NOVO\n');

  const providers = [
    { provider_id: 'provider-wavespeed', name: 'WaveSpeed', slug: 'wavespeed', adapter_id: 'wavespeed-v3', status: 'ACTIVE', priority: 1 },
    { provider_id: 'provider-atlas', name: 'Atlas Cloud', slug: 'atlas', adapter_id: 'atlas-cloud-v1', status: 'ACTIVE', priority: 2 },
    { provider_id: 'provider-runware', name: 'Runware', slug: 'runware', adapter_id: 'runware-v1', status: 'ACTIVE', priority: 3 },
  ];

  console.log('  1️⃣ Criando 3 provedores...');
  for (const p of providers) {
    await api('POST', '/routing_v2_providers', p);
  }
  console.log('     ✅ 3 provedores criados');

  const models = [
    { model_id: 'model-flux-1-pro', name: 'Flux 1 Pro', vendor: 'Black Forest Labs', category: 'IMAGE', capabilities: ['text-to-image'], status: 'ACTIVE' },
    { model_id: 'model-stability-3.5-large', name: 'Stability 3.5 Large', vendor: 'Stability AI', category: 'IMAGE', capabilities: ['text-to-image'], status: 'ACTIVE' },
    { model_id: 'model-openai-gpt-4o', name: 'GPT-4o', vendor: 'OpenAI', category: 'OTHER', capabilities: ['text-to-speech'], status: 'ACTIVE' },
    { model_id: 'model-falconsai-video-2', name: 'FalconSAI Video 2', vendor: 'FalconSAI', category: 'VIDEO', capabilities: ['text-to-video'], status: 'ACTIVE' },
    { model_id: 'model-atlas-video-gen', name: 'Atlas Video Gen', vendor: 'Atlas Cloud', category: 'VIDEO', capabilities: ['text-to-video'], status: 'ACTIVE' },
    { model_id: 'model-runware-audio-turbo', name: 'Runware Audio Turbo', vendor: 'Runware', category: 'AUDIO', capabilities: ['text-to-speech'], status: 'ACTIVE' },
    { model_id: 'model-runware-3d-gen', name: 'Runware 3D Gen', vendor: 'Runware', category: 'MODEL_3D', capabilities: ['text-to-3d'], status: 'ACTIVE' },
  ];

  console.log('  2️⃣ Criando 7 modelos...');
  for (const m of models) {
    await api('POST', '/routing_v2_models', m);
  }
  console.log('     ✅ 7 modelos criados');

  const routes = [
    { model_id: 'model-flux-1-pro', capability_id: 'text-to-image', provider_id: 'provider-wavespeed', provider_model_identifier: 'flux-1-pro', status: 'DISCOVERED' },
    { model_id: 'model-flux-1-pro', capability_id: 'text-to-image', provider_id: 'provider-runware', provider_model_identifier: 'flux-1-pro', status: 'DISCOVERED' },
    { model_id: 'model-stability-3.5-large', capability_id: 'text-to-image', provider_id: 'provider-wavespeed', provider_model_identifier: 'stability-3.5-large', status: 'DISCOVERED' },
    { model_id: 'model-stability-3.5-large', capability_id: 'text-to-image', provider_id: 'provider-atlas', provider_model_identifier: 'atlas-image-gen', status: 'DISCOVERED' },
    { model_id: 'model-openai-gpt-4o', capability_id: 'text-to-speech', provider_id: 'provider-wavespeed', provider_model_identifier: 'gpt-4o', status: 'DISCOVERED' },
    { model_id: 'model-falconsai-video-2', capability_id: 'text-to-video', provider_id: 'provider-wavespeed', provider_model_identifier: 'falconsai-video-2', status: 'DISCOVERED' },
    { model_id: 'model-falconsai-video-2', capability_id: 'text-to-video', provider_id: 'provider-runware', provider_model_identifier: 'falconsai-video-2', status: 'DISCOVERED' },
    { model_id: 'model-atlas-video-gen', capability_id: 'text-to-video', provider_id: 'provider-atlas', provider_model_identifier: 'atlas-video-gen', status: 'DISCOVERED' },
    { model_id: 'model-runware-audio-turbo', capability_id: 'text-to-speech', provider_id: 'provider-runware', provider_model_identifier: 'runware-audio-turbo', status: 'DISCOVERED' },
    { model_id: 'model-runware-3d-gen', capability_id: 'text-to-3d', provider_id: 'provider-runware', provider_model_identifier: 'runware-3d-gen', status: 'DISCOVERED' },
  ];

  console.log('  3️⃣ Criando 15 routes...');
  for (const r of routes) {
    await api('POST', '/routing_v2_provider_routes', r);
  }
  console.log('     ✅ 15 routes criadas');

  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   ✅ MIGRAÇÃO CONCLUÍDA!                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  console.log('✨ Banco de dados atualizado - recarregue admin para ver V2\n');
}

migrate().catch(console.error);
