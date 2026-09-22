import React,{useMemo}from'react';
import{ArrowRight,LoaderCircle,Network,Plus,Sparkles,Trash2}from'lucide-react';
import type{FlowRecord}from'../../beta/flowClient.js';
import type{SpaceHomeItem,SpaceHomePreviewNode}from'../../services/spacesClient.js';

interface Props{
 flows:FlowRecord[];
 homeItems:SpaceHomeItem[];
 loading:boolean;
 creating:boolean;
 deletingId?:string|null;
 openingId?:string|null;
 error?:string;
 onCreate:()=>void;
 onOpen:(flowId:string)=>void;
 onDelete:(flow:FlowRecord)=>void;
}

const ago=(iso:string)=>{const ts=new Date(iso).getTime();if(!Number.isFinite(ts))return'';const diff=Math.max(0,Date.now()-ts),min=Math.floor(diff/60000),hour=Math.floor(min/60),day=Math.floor(hour/24);if(day>0)return day===1?'há 1 dia':`há ${day} dias`;if(hour>0)return hour===1?'há 1 hora':`há ${hour} horas`;if(min>0)return min===1?'há 1 min':`há ${min} min`;return'agora';};

const NodeMedia:React.FC<{node:SpaceHomePreviewNode}>=({node})=>{
 const asset=node.asset,url=asset?.preview_url||asset?.public_url||null;
 if(!asset||!url)return <div className="grid h-full w-full place-items-center bg-[#0d1722] px-2 text-center"><span className="line-clamp-2 text-[7px] font-semibold text-zinc-500">{node.label||'Node'}</span></div>;
 if(asset.type==='IMAGE'||asset.preview_mime_type?.startsWith('image/'))return <img src={url} alt="" loading="lazy" className="h-full w-full bg-black/30 object-contain"/>;
 if(asset.type==='VIDEO')return <video src={asset.public_url||url} poster={asset.preview_mime_type?.startsWith('image/')?url:undefined} muted preload="metadata" playsInline className="h-full w-full bg-black object-contain"/>;
 return <div className="grid h-full w-full place-items-center bg-[#0d1722]"><span className="text-[7px] text-zinc-600">{node.label}</span></div>;
};

const RealWorkspacePreview:React.FC<{flow:FlowRecord;item?:SpaceHomeItem}>=({flow,item})=>{
 const nodes=item?.preview_nodes||[],edges=flow.graph?.edges||[];
 if(!nodes.length)return <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.08),transparent_42%),#0a0f15]"><div className="text-center"><Sparkles className="mx-auto h-6 w-6 text-zinc-700"/><span className="mt-2 block text-[9px] text-zinc-650">Space vazio</span></div></div>;
 const minX=Math.min(...nodes.map(n=>n.x)),minY=Math.min(...nodes.map(n=>n.y));
 const maxX=Math.max(...nodes.map(n=>n.x+n.width)),maxY=Math.max(...nodes.map(n=>n.y+n.height));
 const worldW=Math.max(1,maxX-minX),worldH=Math.max(1,maxY-minY);
 const viewW=360,viewH=215,pad=18;
 const scale=Math.min((viewW-pad*2)/worldW,(viewH-pad*2)/worldH,0.72);
 const ox=(viewW-worldW*scale)/2-minX*scale,oy=(viewH-worldH*scale)/2-minY*scale;
 const nodeMap=new Map<string,SpaceHomePreviewNode>(nodes.map(node=>[node.node_id,node]));
 return <div className="relative h-full overflow-hidden bg-[radial-gradient(rgba(125,211,252,.10)_1px,transparent_1px),#080d13] bg-[size:16px_16px]">
  <svg viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">{edges.map(edge=>{const a=nodeMap.get(edge.from_node_id),b=nodeMap.get(edge.to_node_id);if(!a||!b)return null;const x1=ox+(a.x+a.width)*scale,y1=oy+(a.y+a.height/2)*scale,x2=ox+b.x*scale,y2=oy+(b.y+b.height/2)*scale,curve=Math.max(18,Math.abs(x2-x1)*.42);return <path key={edge.edge_id} d={`M ${x1} ${y1} C ${x1+curve} ${y1}, ${x2-curve} ${y2}, ${x2} ${y2}`} fill="none" stroke="rgba(103,232,249,.42)" strokeWidth="1.25"/>})}</svg>
  {nodes.slice(0,24).map(node=>{const visual=Boolean(node.asset);return <div key={node.node_id} className={`absolute overflow-hidden rounded-[5px] border shadow-lg ${visual?'border-white/[0.12] bg-[#071018]':'border-white/[0.07] bg-[#0d1722]'}`} style={{left:ox+node.x*scale,top:oy+node.y*scale,width:Math.max(24,node.width*scale),height:Math.max(18,node.height*scale)}}>
   <NodeMedia node={node}/>
   <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-black/45 to-transparent"/>
  </div>})}
  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070b10]/45 via-transparent to-black/10"/>
  <div className="absolute left-3 top-3 rounded-lg border border-white/10 bg-black/45 px-2 py-1 text-[7px] font-semibold uppercase tracking-[.12em] text-white/65 backdrop-blur">{nodes.length} nodes · {edges.length} conexões</div>
 </div>;
};

export const SpacesHome:React.FC<Props>=({flows,homeItems,loading,creating,deletingId,openingId,error,onCreate,onOpen,onDelete})=>{const itemMap=useMemo(()=>new Map(homeItems.map(item=>[item.flow.flow_id,item])),[homeItems]);return <div className="h-full overflow-y-auto bg-[#090d12] px-5 py-7 text-zinc-100 sm:px-7 lg:px-9 xl:px-10">
 <div className="mx-auto w-full max-w-[1500px]">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
   <div><span className="text-[9px] font-black uppercase tracking-[.18em] text-cyan-300">Workspace visual</span><h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Spaces</h1><p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-zinc-500">Abra um fluxo existente ou crie um novo espaço para gerar, editar e conectar conteúdo visualmente.</p></div>
   <button onClick={onCreate} disabled={creating} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[10px] font-black text-black shadow-lg transition hover:bg-zinc-100 disabled:opacity-50">{creating?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}Novo Space</button>
  </div>
  {error&&<div role="alert" className="mt-5 rounded-xl border border-rose-400/15 bg-rose-400/[0.05] px-3 py-2 text-[10px] text-rose-300">{error}</div>}
  <div className="mt-8">
   <div className="mb-3 flex items-center justify-between"><h2 className="text-[11px] font-bold text-zinc-300">Seus Spaces</h2><span className="text-[9px] text-zinc-650">{flows.length}</span></div>
   {loading?<div role="status" aria-live="polite" className="grid min-h-[320px] place-items-center rounded-2xl border border-white/[0.05] bg-white/[0.015]"><div className="text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin text-cyan-300"/><p className="mt-2 text-[10px] text-zinc-500">Carregando Spaces…</p></div></div>:flows.length?<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{flows.map(flow=>{const item=itemMap.get(flow.flow_id);return <article key={flow.flow_id} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.065] bg-[#11161d] transition hover:-translate-y-0.5 hover:border-white/[0.14] hover:shadow-2xl">
      <button onClick={()=>onOpen(flow.flow_id)} disabled={openingId===flow.flow_id} aria-label={`Abrir ${flow.name||'Space sem título'}`} className="absolute inset-0 block h-full w-full text-left disabled:cursor-wait">
       <RealWorkspacePreview flow={flow} item={item}/>
       <div className="absolute inset-x-0 bottom-0 min-h-[20%] bg-gradient-to-t from-[#090d12] via-[#090d12]/95 to-transparent px-4 pb-3 pt-10">
        <div className="flex items-end gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-cyan-400/10 bg-[#071923]/90 text-cyan-300 backdrop-blur"><Network className="h-4 w-4"/></div><div className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-white">{flow.name||'Space sem título'}</strong><p className="mt-0.5 truncate text-[8px] text-zinc-500">{(flow.graph?.nodes||[]).length} nodes · Atualizado {ago(flow.updated_at)}</p></div>{openingId===flow.flow_id?<LoaderCircle className="mb-1 h-3.5 w-3.5 animate-spin text-cyan-300"/>:<ArrowRight className="mb-1 h-3.5 w-3.5 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300"/>}</div>
       </div>
      </button>
      <button type="button" onClick={()=>onDelete(flow)} disabled={deletingId===flow.flow_id} title="Excluir Space inteiro" aria-label={`Excluir ${flow.name||'Space sem título'}`} className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-xl border border-white/[0.08] bg-black/60 text-zinc-400 opacity-90 backdrop-blur transition hover:border-rose-400/25 hover:bg-rose-500/15 hover:text-rose-200 disabled:cursor-wait disabled:opacity-60">{deletingId===flow.flow_id?<LoaderCircle className="h-3.5 w-3.5 animate-spin"/>:<Trash2 className="h-3.5 w-3.5"/>}</button>
     </article>})}</div>:<button onClick={onCreate} className="grid min-h-[320px] w-full place-items-center rounded-2xl border border-dashed border-white/[0.07] bg-white/[0.012] text-center hover:border-cyan-400/20 hover:bg-cyan-400/[0.02]"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.07] bg-white/[0.025]"><Plus className="h-5 w-5 text-zinc-600"/></span><strong className="mt-3 block text-[12px] text-zinc-300">Crie seu primeiro Space</strong><span className="mt-1 block text-[9px] text-zinc-600">Comece com um canvas vazio e conecte suas ideias.</span></div></button>}
  </div>
 </div>
</div>;};

export default SpacesHome;
