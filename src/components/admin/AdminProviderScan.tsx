import React,{useEffect,useMemo,useState}from'react';
import{Activity,CheckCircle2,Database,KeyRound,Link2,RefreshCw,ScanSearch,ShieldCheck,TriangleAlert}from'lucide-react';
import{adminService,CuratedModelFunction,CuratedModelInventory,ProviderModelMatchProposal,ProviderPricingAdmin,ProviderScanResult}from'../../services/adminService.js';
import{ProviderModelMapping,ProviderRegistryItem}from'../../types/index.js';
import{Button}from'../common/Button.js';
import{Card}from'../common/Card.js';

const SECRET_NAMES:Record<string,string>={
 'provider-atlas':'ATLAS_API_KEY',
 'provider-wavespeed':'WAVESPEED_API_KEY',
 'provider-runware':'RUNWARE_API_KEY',
 'provider-fal':'FAL_API_KEY',
 'provider-deepinfra':'DEEPINFRA_API_KEY',
 'provider-replicate':'REPLICATE_API_TOKEN',
 'provider-aiml':'AIML_API_KEY',
 'provider-piapi':'PIAPI_API_KEY',
 'provider-kie':'KIE_API_KEY',
};
const FUNCTION_LABELS:Record<CuratedModelFunction,string>={
 IMAGE_GENERATION:'Gerar imagem',IMAGE_EDIT:'Editar imagem',VIDEO_GENERATION:'Gerar vídeo',VIDEO_EDIT:'Editar vídeo',VIDEO_EXTEND:'Estender vídeo',VOICE:'Voz',MUSIC:'Música',SFX:'Efeitos sonoros',THREE_D:'3D',
};
const MODE_LABELS:Record<ProviderScanResult['discovery_mode'],string>={CATALOG_API:'Catálogo via API',SEARCH_API:'Busca via API',CURATED_REQUIRED:'Curadoria validada'};
const percentage=(value:number)=>`${Math.round(Math.max(0,Math.min(1,value))*100)}%`;

export const AdminProviderScan:React.FC=()=>{
 const[providers,setProviders]=useState<ProviderRegistryItem[]>([]);
 const[scans,setScans]=useState<ProviderScanResult[]>([]);
 const[pricing,setPricing]=useState<ProviderPricingAdmin[]>([]);
 const[mappings,setMappings]=useState<ProviderModelMapping[]>([]);
 const[inventory,setInventory]=useState<CuratedModelInventory|null>(null);
 const[loading,setLoading]=useState(true);
 const[scanning,setScanning]=useState<string|null>(null);
 const[message,setMessage]=useState<string|null>(null);
 const[error,setError]=useState<string|null>(null);

 const load=async()=>{
  setLoading(true);setError(null);
  try{
   const[p,s,i]=await Promise.all([adminService.listProviders(),adminService.getProviderScans(),adminService.getProviderScanInventory()]);
   setProviders(p);setScans(s.latest||[]);setPricing(s.pricing||[]);setMappings(s.mappings||[]);setInventory(i);
  }catch(err:any){setError(err?.message||'Não foi possível carregar o centro de scan.');}
  finally{setLoading(false);}
 };
 useEffect(()=>{void load();},[]);

 const scanByProvider=useMemo(()=>new Map(scans.map(scan=>[scan.provider_id,scan])),[scans]);
 const configuredCount=providers.filter(provider=>provider.is_configured).length;
 const matchedCount=scans.reduce((sum,scan)=>sum+Number(scan.matched_count||0),0);
 const activeMappingCount=mappings.filter(mapping=>mapping.status==='ACTIVE').length;
 const priceKey=(providerId:string,identifier:string,capabilityId:string)=>`${providerId}::${identifier}::${capabilityId}`;
 const verifiedPrices=useMemo(()=>new Set(pricing.filter(row=>row.verified).map(row=>priceKey(row.provider_id,row.provider_model_identifier,String(row.capability_id||'')))),[pricing]);
 const allMatches=useMemo(()=>scans.flatMap(scan=>(scan.matches||[]).map(match=>({...match,scan_at:scan.scanned_at}))).sort((a,b)=>b.confidence-a.confidence),[scans]);

 const runScan=async(providerId?:string)=>{
  setScanning(providerId||'ALL');setError(null);setMessage(null);
  try{
   if(providerId){
    const result=await adminService.scanProviders(providerId);
    const row=Array.isArray(result)?result[0]:result;
    setMessage(`Scan concluído: ${row?.provider_name||providerId} · ${row?.candidate_count||0} candidatos · ${row?.matched_count||0} correspondências.`);
   }else{
    const targets=providers.filter(provider=>provider.is_configured);
    const completed:ProviderScanResult[]=[];
    const failures:string[]=[];
    for(let index=0;index<targets.length;index++){
     const provider=targets[index];
     setMessage(`Escaneando ${index+1}/${targets.length}: ${provider.name}...`);
     try{
      const result=await adminService.scanProviders(provider.provider_id);
      completed.push(Array.isArray(result)?result[0]:result);
     }catch(err:any){
      failures.push(`${provider.name}: ${err?.message||'falha no scan'}`);
     }
    }
    const matches=completed.reduce((sum,row)=>sum+Number(row?.matched_count||0),0);
    setMessage(`Scan geral concluído: ${completed.length}/${targets.length} providers · ${matches} correspondências com o acervo.`);
    if(failures.length)setError(`Alguns providers falharam sem interromper os demais: ${failures.join(' | ')}`);
   }
   await load();
  }catch(err:any){setError(err?.message||'Falha ao executar o scan dos providers.');}
  finally{setScanning(null);}
 };

 const approve=async(match:ProviderModelMatchProposal)=>{
  setError(null);setMessage(null);
  try{
   await adminService.approveProviderMapping({provider_id:match.provider_id,model_id:match.model_id,provider_model_identifier:match.provider_model_identifier,capability_id:match.capability_id});
   setMessage(`Mapping aprovado: ${match.model_name}.`);await load();
  }catch(err:any){setError(err?.message||'Não foi possível aprovar o mapping.');}
 };

 if(loading)return <div className="py-10 text-center text-xs text-[var(--ia-text-3)]">Carregando centro de APIs e modelos...</div>;
 return <div className="space-y-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div><h2 className="text-base font-semibold text-[var(--ia-text-1)] tracking-tight">APIs, modelos & scan</h2><p className="mt-1 text-xs text-[var(--ia-text-3)]">Descoberta dos modelos disponíveis em cada provider e normalização para o catálogo canônico do IA Connect.</p></div>
   <div className="flex gap-2"><Button id="provider-scan-refresh" variant="secondary" size="sm" onClick={()=>void load()} icon={<RefreshCw className="w-3.5 h-3.5"/>}>Atualizar</Button><Button id="provider-scan-all" variant="primary" size="sm" onClick={()=>void runScan()} isLoading={scanning==='ALL'} icon={<ScanSearch className="w-3.5 h-3.5"/>}>Escanear todos</Button></div>
  </div>

  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
   <div className="rounded-xl border border-[var(--ia-line)] bg-[var(--ia-surface-1)] p-4"><div className="text-[10px] uppercase tracking-wider text-[var(--ia-text-3)]">Providers configurados</div><div className="mt-2 text-xl font-black text-[var(--ia-text-1)]">{configuredCount}/{providers.length}</div></div>
   <div className="rounded-xl border border-[var(--ia-line)] bg-[var(--ia-surface-1)] p-4"><div className="text-[10px] uppercase tracking-wider text-[var(--ia-text-3)]">Acervo planejado</div><div className="mt-2 text-xl font-black text-[var(--ia-text-1)]">{inventory?.total_positions||0}</div><div className="mt-1 text-[10px] text-[var(--ia-text-3)]">posições por função</div></div>
   <div className="rounded-xl border border-[var(--ia-line)] bg-[var(--ia-surface-1)] p-4"><div className="text-[10px] uppercase tracking-wider text-[var(--ia-text-3)]">Correspondências</div><div className="mt-2 text-xl font-black text-[var(--ia-text-1)]">{matchedCount}</div><div className="mt-1 text-[10px] text-[var(--ia-text-3)]">no último scan salvo</div></div>
   <div className="rounded-xl border border-[var(--ia-line)] bg-[var(--ia-surface-1)] p-4"><div className="text-[10px] uppercase tracking-wider text-[var(--ia-text-3)]">Mappings ativos</div><div className="mt-2 text-xl font-black text-[var(--ia-text-1)]">{activeMappingCount}</div><div className="mt-1 text-[10px] text-[var(--ia-text-3)]">liberados para roteamento</div></div>
  </div>

  <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.05] p-4 text-xs text-[var(--ia-text-2)]">
   <div className="flex gap-2.5"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-sky-300"/><div><strong className="block text-[var(--ia-text-1)]">Pronto para receber as chaves no Cloudflare</strong><p className="mt-1 leading-relaxed">Cadastre os secrets no Worker <code className="font-mono text-[11px]">ia-conect</code>. Esta tela detecta apenas se a chave existe; o valor nunca é retornado ao navegador. Depois de cadastrar as chaves, recarregue o Admin e execute <strong>Escanear todos</strong>.</p></div></div>
  </div>

  {inventory&&<section className="rounded-xl border border-[var(--ia-line)] bg-[var(--ia-surface-1)] p-4"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-violet-300"/><h3 className="text-xs font-bold text-[var(--ia-text-1)]">Acervo canônico</h3></div><div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">{Object.entries(inventory.counts).map(([fn,count])=><div key={fn} className="rounded-lg border border-[var(--ia-line)] bg-[var(--ia-surface-2)] px-3 py-2.5"><div className="text-[10px] text-[var(--ia-text-3)]">{FUNCTION_LABELS[fn as CuratedModelFunction]||fn}</div><div className="mt-1 text-sm font-bold text-[var(--ia-text-1)]">{count}</div></div>)}</div></section>}

  <Card id="provider-scan-status-card">
   <div className="mb-4"><h3 className="text-xs font-bold text-[var(--ia-text-1)]">Status por provider</h3><p className="mt-1 text-[10px] text-[var(--ia-text-3)]">A chave é detectada no servidor. Providers sem API pública de catálogo continuam em modo de curadoria e validação explícita.</p></div>
   <div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full min-w-[920px] text-left text-xs"><thead><tr className="border-b border-[var(--ia-line)] text-[10px] uppercase tracking-wider text-[var(--ia-text-3)]"><th className="px-5 sm:px-6 py-3">Provider</th><th className="px-3 py-3">Secret</th><th className="px-3 py-3">Descoberta</th><th className="px-3 py-3">Último scan</th><th className="px-3 py-3">Resultados</th><th className="px-5 sm:px-6 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-[var(--ia-line)]">{providers.map(provider=>{const scan=scanByProvider.get(provider.provider_id);return <tr key={provider.provider_id}><td className="px-5 sm:px-6 py-3"><div className="font-semibold text-[var(--ia-text-1)]">{provider.name}</div><div className="mt-0.5 font-mono text-[9px] text-[var(--ia-text-3)]">{provider.provider_id}</div></td><td className="px-3 py-3"><div className="flex items-center gap-1.5">{provider.is_configured?<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400"/>:<TriangleAlert className="h-3.5 w-3.5 text-amber-400"/>}<span className={provider.is_configured?'text-emerald-300':'text-amber-300'}>{provider.is_configured?'Detectada':'Ausente'}</span></div><div className="mt-1 font-mono text-[9px] text-[var(--ia-text-3)]">{SECRET_NAMES[provider.provider_id]||'—'}</div></td><td className="px-3 py-3 text-[var(--ia-text-2)]">{scan?MODE_LABELS[scan.discovery_mode]:'—'}</td><td className="px-3 py-3 text-[var(--ia-text-2)]">{scan?.scanned_at?new Date(scan.scanned_at).toLocaleString('pt-BR'):'Nunca'}</td><td className="px-3 py-3"><div className="text-[var(--ia-text-1)]"><b>{scan?.candidate_count||0}</b> candidatos</div><div className="mt-0.5 text-[10px] text-[var(--ia-text-3)]"><b>{scan?.matched_count||0}</b> correspondências</div>{scan?.error&&<div className="mt-1 max-w-[220px] text-[9px] text-rose-300">{scan.error}</div>}</td><td className="px-5 sm:px-6 py-3 text-right"><Button id={`provider-scan-${provider.provider_id}`} variant="secondary" size="sm" onClick={()=>void runScan(provider.provider_id)} isLoading={scanning===provider.provider_id} icon={<ScanSearch className="h-3.5 w-3.5"/>}>Escanear</Button></td></tr>})}</tbody></table></div>
  </Card>

  <Card id="provider-model-match-card">
   <div className="flex items-start justify-between gap-3 mb-4"><div><h3 className="text-xs font-bold text-[var(--ia-text-1)]">Correspondências modelo × provider</h3><p className="mt-1 text-[10px] text-[var(--ia-text-3)]">Sugestões do normalizador. Mapping só pode ser aprovado quando o preço da capability também estiver verificado.</p></div><div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2.5 py-1 text-[9px] font-bold text-emerald-300"><ShieldCheck className="h-3 w-3"/>Safe routing</div></div>
   {!allMatches.length?<div className="py-8 text-center"><ScanSearch className="mx-auto h-6 w-6 text-[var(--ia-text-3)]"/><p className="mt-2 text-xs text-[var(--ia-text-3)]">Nenhuma correspondência salva ainda. Cadastre as chaves e execute o scan.</p></div>:<div className="overflow-x-auto -mx-5 sm:-mx-6"><table className="w-full min-w-[1020px] text-left text-xs"><thead><tr className="border-b border-[var(--ia-line)] text-[10px] uppercase tracking-wider text-[var(--ia-text-3)]"><th className="px-5 sm:px-6 py-3">Modelo IA Connect</th><th className="px-3 py-3">Função</th><th className="px-3 py-3">Provider / ID</th><th className="px-3 py-3">Confiança</th><th className="px-3 py-3">Preço</th><th className="px-5 sm:px-6 py-3 text-right">Mapping</th></tr></thead><tbody className="divide-y divide-[var(--ia-line)]">{allMatches.map((match,index)=>{const provider=providers.find(row=>row.provider_id===match.provider_id);const verified=verifiedPrices.has(priceKey(match.provider_id,match.provider_model_identifier,match.capability_id));const mapped=match.already_mapped||mappings.some(row=>row.provider_id===match.provider_id&&row.model_id===match.model_id&&row.provider_model_identifier===match.provider_model_identifier&&row.status==='ACTIVE');return <tr key={`${match.provider_id}-${match.model_id}-${index}`}><td className="px-5 sm:px-6 py-3"><div className="font-semibold text-[var(--ia-text-1)]">{match.model_name}</div><div className="mt-0.5 font-mono text-[9px] text-[var(--ia-text-3)]">{match.model_id}</div></td><td className="px-3 py-3"><div className="text-[var(--ia-text-2)]">{FUNCTION_LABELS[match.function_id]}</div><div className="mt-0.5 font-mono text-[9px] text-[var(--ia-text-3)]">{match.capability_id}</div></td><td className="px-3 py-3"><div className="font-medium text-[var(--ia-text-1)]">{provider?.name||match.provider_id}</div><div className="mt-0.5 max-w-[300px] truncate font-mono text-[9px] text-[var(--ia-text-3)]" title={match.provider_model_identifier}>{match.provider_model_identifier}</div></td><td className="px-3 py-3"><div className={`font-bold ${match.confidence>=.9?'text-emerald-300':match.confidence>=.8?'text-sky-300':'text-amber-300'}`}>{percentage(match.confidence)}</div><div className="mt-0.5 text-[9px] text-[var(--ia-text-3)]">{match.match_reason}</div></td><td className="px-3 py-3">{verified?<span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3 w-3"/>Verificado</span>:<span className="inline-flex items-center gap-1 text-amber-300"><TriangleAlert className="h-3 w-3"/>Pendente</span>}</td><td className="px-5 sm:px-6 py-3 text-right">{mapped?<span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold"><Link2 className="h-3.5 w-3.5"/>Ativo</span>:<Button id={`approve-map-${match.provider_id}-${match.model_id}-${index}`} size="sm" variant="secondary" disabled={!verified} onClick={()=>void approve(match)} icon={<Link2 className="h-3.5 w-3.5"/>}>{verified?'Aprovar':'Aguarda preço'}</Button>}</td></tr>})}</tbody></table></div>}
  </Card>

  {message&&<div className="flex items-start gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-xs text-emerald-300"><Activity className="mt-0.5 h-4 w-4 shrink-0"/>{message}</div>}
  {error&&<div className="flex items-start gap-2 rounded-lg border border-rose-400/15 bg-rose-400/[0.05] p-3 text-xs text-rose-300"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0"/>{error}</div>}
 </div>;
};
