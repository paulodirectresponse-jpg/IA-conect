import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{Box,CheckCircle2,ChevronRight,CirclePlus,Database,GitBranch,GripVertical,Link2,LoaderCircle,Network,Play,Plus,RotateCcw,Save,Trash2,Unlink2,XCircle}from'lucide-react';
import{apiRequest,ApiError}from'../../services/apiClient.js';
import{BetaCapability,BetaCapabilityMediaType,BetaCapabilityModel}from'../capabilityClient.js';
import{betaLibraryClient,BetaProjectView}from'../libraryClient.js';
import{universalAssetClient,UniversalAssetView}from'../universalAssetClient.js';
import{betaFlowClient,FlowEdge,FlowNode,FlowRecord}from'../flowClient.js';
import{betaFlowRuntimeClient,FlowRunView}from'../flowRuntimeClient.js';

const MEDIA:BetaCapabilityMediaType[]=['TEXT','IMAGE','VIDEO','AUDIO','MODEL_3D','MASK','STRUCTURED_DATA'];
const labels:Record<string,string>={TEXT:'Texto',IMAGE:'Imagem',VIDEO:'Vídeo',AUDIO:'Áudio',MODEL_3D:'3D',MASK:'Máscara',STRUCTURED_DATA:'Dados'};
const color:Record<string,string>={TEXT:'#a78bfa',IMAGE:'#e879f9',VIDEO:'#22d3ee',AUDIO:'#fbbf24',MODEL_3D:'#818cf8',MASK:'#f472b6',STRUCTURED_DATA:'#94a3b8'};
const id=(prefix:string)=>`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const msg=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir a operação.';

function capFor(models:BetaCapabilityModel[],node:FlowNode):BetaCapability|null{
 if(node.kind!=='TOOL'||!node.capability_id)return null;
 const model=models.find(item=>item.model_id===node.model_id);
 return model?.capabilities.find(cap=>cap.id===node.capability_id)||null;
}
function outputs(models:BetaCapabilityModel[],assets:UniversalAssetView[],node:FlowNode):BetaCapabilityMediaType[]{
 if(node.kind==='INPUT')return node.media_type?[node.media_type]:[];
 if(node.kind==='ASSET'){const asset=assets.find(item=>item.asset_id===node.asset_id);return asset?[asset.type as BetaCapabilityMediaType]:node.media_type?[node.media_type]:[];}
 if(node.kind==='TOOL')return capFor(models,node)?.outputs||[];
 return[];
}
function inputs(models:BetaCapabilityModel[],node:FlowNode):BetaCapabilityMediaType[]{
 if(node.kind==='OUTPUT')return node.media_type?[node.media_type]:[];
 if(node.kind==='TOOL')return capFor(models,node)?.inputs||[];
 return[];
}
function titleFor(capabilityId:string){return capabilityId.split('-').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');}

export const BetaFlowsView:React.FC=()=>{
 const[flows,setFlows]=useState<FlowRecord[]>([]);
 const[current,setCurrent]=useState<FlowRecord|null>(null);
 const[name,setName]=useState('Novo fluxo');
 const[description,setDescription]=useState('');
 const[projectId,setProjectId]=useState<string|null>(null);
 const[nodes,setNodes]=useState<FlowNode[]>([]);
 const[edges,setEdges]=useState<FlowEdge[]>([]);
 const[models,setModels]=useState<BetaCapabilityModel[]>([]);
 const[assets,setAssets]=useState<UniversalAssetView[]>([]);
 const[projects,setProjects]=useState<BetaProjectView[]>([]);
 const[selectedId,setSelectedId]=useState<string|null>(null);
 const[linkFrom,setLinkFrom]=useState<string|null>(null);
 const[media,setMedia]=useState<BetaCapabilityMediaType>('IMAGE');
 const[assetId,setAssetId]=useState('');
 const[toolId,setToolId]=useState('');
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const[dirty,setDirty]=useState(false);
 const[run,setRun]=useState<FlowRunView|null>(null);
 const[runInputs,setRunInputs]=useState<Record<string,string>>({});
 const[runBusy,setRunBusy]=useState('');
 const drag=useRef<{id:string;dx:number;dy:number}|null>(null);
 const canvas=useRef<HTMLDivElement|null>(null);

 const load=useCallback(async()=>{
  setBusy('load');setError('');
  try{
   const[flowRows,capData,assetRows,projectRows]=await Promise.all([
    betaFlowClient.list(),
    apiRequest<{models:BetaCapabilityModel[]}>('/api/beta/capabilities'),
    universalAssetClient.list(),
    betaLibraryClient.projects(),
   ]);
   setFlows(flowRows);setModels(capData.models||[]);setAssets(assetRows);setProjects(projectRows);
   const caps=Array.from(new Set((capData.models||[]).flatMap(model=>model.capabilities.map(cap=>cap.id))));
   if(!toolId&&caps.length)setToolId(caps[0]);
  }catch(e){setError(msg(e));}finally{setBusy('');}
 },[toolId]);

 useEffect(()=>{void load()},[]);
 const toolCapabilities=useMemo(()=>Array.from(new Set(models.flatMap(model=>model.capabilities.map(cap=>cap.id)))).sort(),[models]);
 const inputNodes=useMemo(()=>nodes.filter(node=>node.kind==='INPUT'),[nodes]);
 const selected=nodes.find(node=>node.node_id===selectedId)||null;

 const apply=(next:FlowRecord|null)=>{
  setCurrent(next);setName(next?.name||'Novo fluxo');setDescription(next?.description||'');setProjectId(next?.project_id||null);
  setNodes(next?.graph.nodes||[]);setEdges(next?.graph.edges||[]);setSelectedId(null);setLinkFrom(null);setDirty(false);setError('');setRun(null);setRunInputs({});
 };
 const openFlow=async(flowId:string)=>{if(!flowId){apply(null);return;}setBusy('open');try{apply(await betaFlowClient.get(flowId));}catch(e){setError(msg(e));}finally{setBusy('');}};
 const touch=()=>setDirty(true);
 const nextPosition=()=>({x:80+(nodes.length%4)*240,y:80+Math.floor(nodes.length/4)*150});
 const addNode=(node:Omit<FlowNode,'node_id'|'x'|'y'>)=>{const pos=nextPosition(),next={...node,node_id:id('node'),...pos};setNodes(rows=>[...rows,next]);setSelectedId(next.node_id);touch();};

 const addTool=()=>{
  if(!toolId)return;
  const eligible=models.filter(model=>model.capabilities.some(cap=>cap.id===toolId));
  const chosen=eligible.find(model=>model.model_id==='AUTO')||eligible[0];if(!chosen)return;
  addNode({kind:'TOOL',label:titleFor(toolId),capability_id:toolId,model_id:chosen.model_id,prompt:'',controls:{}});
 };
 const addAsset=()=>{
  const asset=assets.find(item=>item.asset_id===assetId);if(!asset)return;
  addNode({kind:'ASSET',label:asset.name,asset_id:asset.asset_id,media_type:asset.type as BetaCapabilityMediaType});
 };
 const removeNode=(nodeId:string)=>{setNodes(rows=>rows.filter(node=>node.node_id!==nodeId));setEdges(rows=>rows.filter(edge=>edge.from_node_id!==nodeId&&edge.to_node_id!==nodeId));if(selectedId===nodeId)setSelectedId(null);if(linkFrom===nodeId)setLinkFrom(null);touch();};
 const patchNode=(patch:Partial<FlowNode>)=>{if(!selectedId)return;setNodes(rows=>rows.map(node=>node.node_id===selectedId?{...node,...patch}:node));touch();};
 const connect=(toId:string)=>{
  if(!linkFrom||linkFrom===toId){setLinkFrom(null);return;}
  const source=nodes.find(node=>node.node_id===linkFrom),target=nodes.find(node=>node.node_id===toId);if(!source||!target)return;
  const common=outputs(models,assets,source).filter(type=>inputs(models,target).includes(type));
  if(!common.length){setError('Esses nós não possuem um tipo de mídia compatível.');setLinkFrom(null);return;}
  if(edges.some(edge=>edge.from_node_id===source.node_id&&edge.to_node_id===target.node_id&&edge.media_type===common[0])){setLinkFrom(null);return;}
  setEdges(rows=>[...rows,{edge_id:id('edge'),from_node_id:source.node_id,to_node_id:target.node_id,media_type:common[0]}]);setLinkFrom(null);touch();
 };
 const save=async()=>{
  setBusy('save');setError('');
  try{
   const payload={name,description,project_id:projectId,graph:{nodes,edges}};
   const saved=current?await betaFlowClient.save(current.flow_id,{...payload,expected_revision:current.revision}):await betaFlowClient.create(payload);
   setCurrent(saved);setFlows(rows=>[saved,...rows.filter(row=>row.flow_id!==saved.flow_id)]);setDirty(false);
  }catch(e){setError(msg(e));}finally{setBusy('');}
 };
 const remove=async()=>{if(!current)return;setBusy('delete');try{await betaFlowClient.remove(current.flow_id);setFlows(rows=>rows.filter(row=>row.flow_id!==current.flow_id));apply(null);}catch(e){setError(msg(e));}finally{setBusy('');}};

 const pointerMove=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(!drag.current||!canvas.current)return;const rect=canvas.current.getBoundingClientRect();
  const x=Math.max(0,Math.min(1200,event.clientX-rect.left-drag.current.dx)),y=Math.max(0,Math.min(760,event.clientY-rect.top-drag.current.dy));
  setNodes(rows=>rows.map(node=>node.node_id===drag.current?.id?{...node,x,y}:node));touch();
 };
 const pointerUp=()=>{drag.current=null;};

 useEffect(()=>{
  if(!run||run.status!=='RUNNING')return;
  const timer=window.setTimeout(async()=>{
   try{
    const next=await betaFlowRuntimeClient.advance(run.run_id);
    setRun(next);
    if(next.status==='SUCCEEDED')setAssets(await universalAssetClient.list());
   }catch(e){setError(msg(e));}
  },2500);
  return()=>window.clearTimeout(timer);
 },[run]);

 const runtimeInputPayload=()=>{
  const payload:Record<string,any>={};
  for(const node of inputNodes){
   const raw=String(runInputs[node.node_id]||'').trim();
   if(node.media_type==='TEXT'){payload[node.node_id]={text:raw};continue;}
   if(node.media_type==='STRUCTURED_DATA'){
    try{payload[node.node_id]={structured:JSON.parse(raw||'{}')};}
    catch{throw new Error('JSON inválido em "'+node.label+'".');}
    continue;
   }
   payload[node.node_id]={asset_id:raw};
  }
  return payload;
 };
 const startRun=async()=>{
  if(!current||dirty){setError('Salve o fluxo antes de executar.');return;}
  setRunBusy('start');setError('');
  try{setRun(await betaFlowRuntimeClient.start(current.flow_id,runtimeInputPayload()));}
  catch(e){setError(msg(e));}finally{setRunBusy('');}
 };
 const retryRun=async()=>{if(!run)return;setRunBusy('retry');setError('');try{setRun(await betaFlowRuntimeClient.retry(run.run_id));}catch(e){setError(msg(e));}finally{setRunBusy('');}};
 const cancelRun=async()=>{if(!run)return;setRunBusy('cancel');setError('');try{setRun(await betaFlowRuntimeClient.cancel(run.run_id));}catch(e){setError(msg(e));}finally{setRunBusy('');}};

 return <main className="ia-beta-flows">
  <header className="ia-beta-flows-head">
   <div><span><Network/> Flows Runtime V1</span><h1>Conecte e execute as ferramentas do IA Conect.</h1><p>O grafo roda como DAG sobre Universal Jobs, com créditos, retries, idempotência e outputs tipados.</p></div>
   <div className="ia-beta-flows-actions">
    <select value={current?.flow_id||''} onChange={event=>void openFlow(event.target.value)}><option value="">Novo fluxo</option>{flows.map(flow=><option key={flow.flow_id} value={flow.flow_id}>{flow.name} · r{flow.revision}</option>)}</select>
    <button onClick={()=>apply(null)}><Plus/>Novo</button>
    <button className="is-primary" onClick={()=>void save()} disabled={Boolean(busy)}>{busy==='save'?<LoaderCircle className="is-spin"/>:<Save/>}Salvar</button>
   </div>
  </header>

  {error&&<div className="ia-beta-flow-error">{error}</div>}
  <section className="ia-beta-flow-meta">
   <label><span>Nome</span><input value={name} onChange={event=>{setName(event.target.value);touch()}}/></label>
   <label><span>Projeto</span><select value={projectId||''} onChange={event=>{setProjectId(event.target.value||null);touch()}}><option value="">Sem projeto</option>{projects.map(project=><option key={project.project_id} value={project.project_id}>{project.name}</option>)}</select></label>
   <label className="is-wide"><span>Descrição</span><input value={description} onChange={event=>{setDescription(event.target.value);touch()}} placeholder="O que este fluxo faz?"/></label>
   <div className="ia-beta-flow-revision"><span>{current?`Revisão ${current.revision}`:'Não salvo'}</span>{dirty&&<strong>Alterações pendentes</strong>}</div>
  </section>

  {current&&<section className="ia-beta-flow-runtime">
   <div className="ia-beta-flow-runtime-head">
    <div><span>Execução</span><strong>{run?run.status:'Pronto para executar'}</strong>{run&&<small>Run {run.run_id} · créditos autorizados {run.authorized_credits_total.toLocaleString('pt-BR')}</small>}</div>
    <div>{run?.status==='FAILED'&&<button onClick={()=>void retryRun()} disabled={Boolean(runBusy)}><RotateCcw/>Retry</button>}{run?.status==='RUNNING'&&<button onClick={()=>void cancelRun()} disabled={Boolean(runBusy)}><XCircle/>Cancelar</button>}<button className="is-primary" onClick={()=>void startRun()} disabled={Boolean(runBusy)||dirty||run?.status==='RUNNING'}>{runBusy==='start'?<LoaderCircle className="is-spin"/>:<Play/>}Executar</button></div>
   </div>
   {inputNodes.length>0&&<div className="ia-beta-flow-runtime-inputs">{inputNodes.map(node=><label key={node.node_id}><span>{node.label} · {labels[node.media_type||'TEXT']}</span>{node.media_type==='TEXT'?<textarea rows={3} value={runInputs[node.node_id]||''} onChange={event=>setRunInputs(values=>({...values,[node.node_id]:event.target.value}))}/>:node.media_type==='STRUCTURED_DATA'?<textarea rows={3} value={runInputs[node.node_id]||''} onChange={event=>setRunInputs(values=>({...values,[node.node_id]:event.target.value}))} placeholder='{"chave":"valor"}'/>:<select value={runInputs[node.node_id]||''} onChange={event=>setRunInputs(values=>({...values,[node.node_id]:event.target.value}))}><option value="">Selecione um asset</option>{assets.filter(asset=>node.media_type==='MASK'?asset.type==='IMAGE':asset.type===node.media_type).map(asset=><option key={asset.asset_id} value={asset.asset_id}>{asset.name}</option>)}</select>}</label>)}</div>}
   {run&&<div className="ia-beta-flow-runtime-status">{run.node_runs.map(item=>{const node=nodes.find(row=>row.node_id===item.node_id);return <div key={item.node_run_id} className={'is-'+item.status.toLowerCase()}><span>{item.status==='SUCCEEDED'?<CheckCircle2/>:item.status==='RUNNING'?<LoaderCircle className="is-spin"/>:item.status==='FAILED'?<XCircle/>:<span className="ia-beta-flow-dot"/>}</span><div><strong>{node?.label||item.node_id}</strong><small>{item.status}{item.retry_count?' · retry '+item.retry_count:''}{item.authorized_credit_price?' · '+item.authorized_credit_price+' créditos':''}</small></div></div>})}</div>}
   {run?.status==='SUCCEEDED'&&<div className="ia-beta-flow-runtime-outputs"><span>Outputs</span>{Object.entries(run.outputs).map(([nodeId,values])=><div key={nodeId}><strong>{nodes.find(node=>node.node_id===nodeId)?.label||nodeId}</strong>{values.map((value,index)=><div key={index}>{value.text&&<p>{value.text}</p>}{value.structured&&<pre>{JSON.stringify(value.structured,null,2)}</pre>}{(value.asset_ids||[]).map(assetId=>{const asset=assets.find(item=>item.asset_id===assetId);return asset?.public_url?<a key={assetId} href={asset.public_url} target="_blank" rel="noreferrer">{asset.name}</a>:<code key={assetId}>{assetId}</code>})}</div>)}</div>)}</div>}
  </section>}

  <div className="ia-beta-flow-layout">
   <aside className="ia-beta-flow-palette">
    <h2>Adicionar nós</h2>
    <section><span>Entrada / saída</span><select value={media} onChange={event=>setMedia(event.target.value as BetaCapabilityMediaType)}>{MEDIA.map(type=><option key={type} value={type}>{labels[type]}</option>)}</select><div><button onClick={()=>addNode({kind:'INPUT',label:`Entrada · ${labels[media]}`,media_type:media})}><CirclePlus/>Entrada</button><button onClick={()=>addNode({kind:'OUTPUT',label:`Saída · ${labels[media]}`,media_type:media})}><CirclePlus/>Saída</button></div></section>
    <section><span>Asset da Library</span><select value={assetId} onChange={event=>setAssetId(event.target.value)}><option value="">Selecione um asset</option>{assets.map(asset=><option key={asset.asset_id} value={asset.asset_id}>{asset.name} · {labels[asset.type]||asset.type}</option>)}</select><button onClick={addAsset} disabled={!assetId}><Database/>Adicionar asset</button></section>
    <section><span>Ferramenta</span><select value={toolId} onChange={event=>setToolId(event.target.value)}>{toolCapabilities.map(cap=><option key={cap} value={cap}>{titleFor(cap)}</option>)}</select><button onClick={addTool} disabled={!toolId}><Box/>Adicionar ferramenta</button></section>
    <div className="ia-beta-flow-help"><GitBranch/><p>Clique na saída de um nó e depois na entrada de outro. O editor conecta apenas tipos compatíveis.</p></div>
   </aside>

   <section className="ia-beta-flow-stage-shell">
    <div className="ia-beta-flow-stage" ref={canvas} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onClick={()=>setSelectedId(null)}>
     <svg className="ia-beta-flow-lines" viewBox="0 0 1400 850" preserveAspectRatio="none">{edges.map(edge=>{const a=nodes.find(n=>n.node_id===edge.from_node_id),b=nodes.find(n=>n.node_id===edge.to_node_id);if(!a||!b)return null;const x1=a.x+190,y1=a.y+52,x2=b.x,y2=b.y+52;return <g key={edge.edge_id}><path d={`M${x1} ${y1} C${x1+80} ${y1},${x2-80} ${y2},${x2} ${y2}`} stroke={color[edge.media_type]||'#64748b'}/><circle cx={(x1+x2)/2} cy={(y1+y2)/2} r="8" onClick={event=>{event.stopPropagation();setEdges(rows=>rows.filter(item=>item.edge_id!==edge.edge_id));touch()}}/></g>})}</svg>
     {nodes.map(node=>{
      const out=outputs(models,assets,node),inn=inputs(models,node),active=selectedId===node.node_id;
      return <article key={node.node_id} className={`ia-beta-flow-node ${active?'is-selected':''}`} style={{left:node.x,top:node.y}} onClick={event=>{event.stopPropagation();setSelectedId(node.node_id)}}>
       {inn.length>0&&<button className="ia-beta-flow-port is-input" title={inn.map(t=>labels[t]).join(', ')} onClick={event=>{event.stopPropagation();connect(node.node_id)}}><ChevronRight/></button>}
       <div className="ia-beta-flow-node-head" onPointerDown={event=>{event.stopPropagation();const rect=(event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();drag.current={id:node.node_id,dx:event.clientX-rect.left,dy:event.clientY-rect.top};(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)}}><GripVertical/><span>{node.kind}</span><button onPointerDown={e=>e.stopPropagation()} onClick={event=>{event.stopPropagation();removeNode(node.node_id)}}><Trash2/></button></div>
       <strong>{node.label}</strong>
       <small>{node.kind==='TOOL'?node.capability_id:node.kind==='ASSET'?(assets.find(a=>a.asset_id===node.asset_id)?.type||node.media_type):node.media_type}</small>
       {out.length>0&&<button className={`ia-beta-flow-port is-output ${linkFrom===node.node_id?'is-linking':''}`} title={out.map(t=>labels[t]).join(', ')} onClick={event=>{event.stopPropagation();setLinkFrom(linkFrom===node.node_id?null:node.node_id)}}><Link2/></button>}
      </article>
     })}
     {!nodes.length&&<div className="ia-beta-flow-empty"><Network/><strong>Canvas vazio</strong><span>Adicione uma entrada, asset ou ferramenta pela lateral.</span></div>}
    </div>
   </section>

   <aside className="ia-beta-flow-inspector">
    <h2>Propriedades</h2>
    {!selected?<div className="ia-beta-flow-empty-inspector">Selecione um nó para editar.</div>:<>
     <label><span>Nome</span><input value={selected.label} onChange={event=>patchNode({label:event.target.value})}/></label>
     {(selected.kind==='INPUT'||selected.kind==='OUTPUT')&&<label><span>Tipo</span><select value={selected.media_type||'IMAGE'} onChange={event=>patchNode({media_type:event.target.value as BetaCapabilityMediaType})}>{MEDIA.map(type=><option key={type} value={type}>{labels[type]}</option>)}</select></label>}
     {selected.kind==='TOOL'&&<>
      <label><span>Capability</span><input value={titleFor(selected.capability_id||'')} disabled/></label>
      <label><span>Modelo</span><select value={selected.model_id||''} onChange={event=>patchNode({model_id:event.target.value})}>{models.filter(model=>model.capabilities.some(cap=>cap.id===selected.capability_id)).map(model=><option key={model.model_id} value={model.model_id}>{model.name}</option>)}</select></label>
      <label><span>Prompt / instrução</span><textarea rows={7} value={selected.prompt||''} onChange={event=>patchNode({prompt:event.target.value})}/></label>
     </>}
     {selected.kind==='ASSET'&&<label><span>Asset</span><input value={assets.find(asset=>asset.asset_id===selected.asset_id)?.name||selected.asset_id||''} disabled/></label>}
     <button className="is-danger" onClick={()=>removeNode(selected.node_id)}><Trash2/>Remover nó</button>
    </>}
    {edges.length>0&&<div className="ia-beta-flow-edge-list"><span>Conexões</span>{edges.map(edge=><button key={edge.edge_id} onClick={()=>{setEdges(rows=>rows.filter(item=>item.edge_id!==edge.edge_id));touch()}}><Unlink2/>{labels[edge.media_type]}</button>)}</div>}
   </aside>
  </div>
  {current&&<footer className="ia-beta-flow-footer"><span>Flow ID: {current.flow_id}</span><button onClick={()=>void remove()} disabled={Boolean(busy)}><Trash2/>Excluir fluxo</button></footer>}
 </main>;
};
