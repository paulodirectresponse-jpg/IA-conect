import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, AudioLines, Box, Folder, FolderPlus, Image as ImageIcon, Layers3, LoaderCircle, MoreHorizontal, Play, RefreshCw, Search, Sparkles, Star, Tag, Trash2, Video } from 'lucide-react';
import { ApiError } from '../../services/apiClient.js';
import { AssetType } from '../../types/index.js';
import { betaLibraryClient, BetaCollectionView, BetaLibraryAssetView, BetaLibraryFilters, BetaLibraryIntent, BetaProjectView } from '../libraryClient.js';

interface Props{onIntent:(intent:BetaLibraryIntent)=>void;}

const TYPES:Array<{value:'ALL'|AssetType;label:string}>=[
  {value:'ALL',label:'Tudo'},{value:'IMAGE',label:'Imagens'},{value:'VIDEO',label:'Vídeos'},{value:'AUDIO',label:'Áudio'},{value:'MODEL_3D',label:'3D'},
];

function mediaIcon(type:AssetType){
  if(type==='IMAGE')return ImageIcon;
  if(type==='VIDEO')return Video;
  if(type==='AUDIO')return AudioLines;
  return Box;
}
function formatBytes(value:number){
  if(!value)return'—';
  const units=['B','KB','MB','GB'];let size=value,index=0;
  while(size>=1024&&index<units.length-1){size/=1024;index++;}
  return `${size>=10||index===0?Math.round(size):size.toFixed(1)} ${units[index]}`;
}

export const BetaLibraryView:React.FC<Props>=({onIntent})=>{
  const [items,setItems]=useState<BetaLibraryAssetView[]>([]);
  const [projects,setProjects]=useState<BetaProjectView[]>([]);
  const [collections,setCollections]=useState<BetaCollectionView[]>([]);
  const [filters,setFilters]=useState<BetaLibraryFilters>({type:'ALL',limit:24});
  const [searchDraft,setSearchDraft]=useState('');
  const [cursor,setCursor]=useState<string|null>(null);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [selected,setSelected]=useState<BetaLibraryAssetView|null>(null);
  const [projectName,setProjectName]=useState('');
  const [collectionName,setCollectionName]=useState('');
  const [saving,setSaving]=useState<string|null>(null);

  const loadOrganization=useCallback(async()=>{
    const [nextProjects,nextCollections]=await Promise.all([betaLibraryClient.projects(),betaLibraryClient.collections()]);
    setProjects(nextProjects);setCollections(nextCollections);
  },[]);

  const loadPage=useCallback(async(append=false,requestedCursor?:string|null)=>{
    append?setLoadingMore(true):setLoading(true);
    try{
      const page=await betaLibraryClient.list({...filters,cursor:append?(requestedCursor||undefined):undefined});
      setItems(current=>append?[...current,...page.items]:page.items);
      setCursor(page.next_cursor);setHasMore(page.has_more);setError(null);
    }catch(err:any){
      setError(err instanceof ApiError?err.message:'Não foi possível carregar a Library.');
    }finally{append?setLoadingMore(false):setLoading(false);}
  },[filters]);

  useEffect(()=>{
    const id=window.setTimeout(()=>setFilters(current=>({...current,search:searchDraft.trim()||undefined})),220);
    return()=>window.clearTimeout(id);
  },[searchDraft]);

  useEffect(()=>{void loadPage(false)},[loadPage]);
  useEffect(()=>{void loadOrganization().catch(()=>setError('Não foi possível carregar projetos e coleções.'))},[loadOrganization]);

  const updateItem=async(asset:BetaLibraryAssetView,patch:any)=>{
    setSaving(asset.asset_id);
    try{
      const updated=await betaLibraryClient.organize(asset.asset_id,patch);
      setItems(current=>current.map(item=>item.asset_id===updated.asset_id?updated:item));
      setSelected(current=>current?.asset_id===updated.asset_id?updated:current);
      await loadOrganization();
      setError(null);
    }catch(err:any){setError(err instanceof ApiError?err.message:'Não foi possível organizar o asset.');}
    finally{setSaving(null);}
  };

  const createProject=async()=>{
    const name=projectName.trim();if(!name)return;
    setSaving('project:create');
    try{setProjects(await betaLibraryClient.createProject({name}));setProjectName('');setError(null);}
    catch(err:any){setError(err instanceof ApiError?err.message:'Não foi possível criar o projeto.');}
    finally{setSaving(null);}
  };
  const createCollection=async()=>{
    const name=collectionName.trim();if(!name)return;
    setSaving('collection:create');
    try{
      setCollections(await betaLibraryClient.createCollection({name,project_id:filters.project_id||null}));
      setCollectionName('');setError(null);
    }catch(err:any){setError(err instanceof ApiError?err.message:'Não foi possível criar a coleção.');}
    finally{setSaving(null);}
  };
  const removeProject=async(projectId:string)=>{
    setSaving(`project:${projectId}`);
    try{
      setProjects(await betaLibraryClient.deleteProject(projectId));
      setCollections(await betaLibraryClient.collections());
      if(filters.project_id===projectId)setFilters(current=>({...current,project_id:undefined,collection_id:undefined}));
      await loadPage(false);
    }catch(err:any){setError(err instanceof ApiError?err.message:'Não foi possível remover o projeto.');}
    finally{setSaving(null);}
  };
  const removeCollection=async(collectionId:string)=>{
    setSaving(`collection:${collectionId}`);
    try{
      setCollections(await betaLibraryClient.deleteCollection(collectionId));
      if(filters.collection_id===collectionId)setFilters(current=>({...current,collection_id:undefined}));
      await loadPage(false);
    }catch(err:any){setError(err instanceof ApiError?err.message:'Não foi possível remover a coleção.');}
    finally{setSaving(null);}
  };

  const runIntent=async(asset:BetaLibraryAssetView,action:'REMIX'|'USE_IN')=>{
    setSaving(`${action}:${asset.asset_id}`);
    try{onIntent(action==='REMIX'?await betaLibraryClient.remix(asset.asset_id):await betaLibraryClient.useIn(asset.asset_id));setError(null);}
    catch(err:any){setError(err instanceof ApiError?err.message:'Não foi possível preparar o asset.');}
    finally{setSaving(null);}
  };

  const visibleCollections=useMemo(()=>collections.filter(collection=>!filters.project_id||!collection.project_id||collection.project_id===filters.project_id),[collections,filters.project_id]);

  return <main className="ia-beta-library">
    <aside className="ia-beta-library-sidebar">
      <div className="ia-beta-library-side-head"><span>Organização</span><strong>Projetos</strong></div>
      <button className={!filters.project_id?'is-selected':''} onClick={()=>setFilters(current=>({...current,project_id:undefined,collection_id:undefined}))}><Archive/><span>Todos os assets</span></button>
      {projects.map(project=><div className="ia-beta-library-side-row" key={project.project_id}>
        <button className={filters.project_id===project.project_id?'is-selected':''} onClick={()=>setFilters(current=>({...current,project_id:project.project_id,collection_id:undefined}))}>
          <Folder/><span>{project.name}</span><em>{project.asset_count}</em>
        </button>
        <button className="ia-beta-library-side-delete" aria-label={`Excluir ${project.name}`} disabled={Boolean(saving)} onClick={()=>void removeProject(project.project_id)}><Trash2/></button>
      </div>)}
      <div className="ia-beta-library-create-row">
        <input value={projectName} onChange={e=>setProjectName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void createProject()}} placeholder="Novo projeto"/>
        <button aria-label="Criar projeto" disabled={!projectName.trim()||Boolean(saving)} onClick={()=>void createProject()}><FolderPlus/></button>
      </div>

      <div className="ia-beta-library-side-head is-secondary"><span>Organização</span><strong>Coleções</strong></div>
      <button className={!filters.collection_id?'is-selected':''} onClick={()=>setFilters(current=>({...current,collection_id:undefined}))}><Layers3/><span>Todas</span></button>
      {visibleCollections.map(collection=><div className="ia-beta-library-side-row" key={collection.collection_id}>
        <button className={filters.collection_id===collection.collection_id?'is-selected':''} onClick={()=>setFilters(current=>({...current,collection_id:collection.collection_id}))}>
          <Layers3/><span>{collection.name}</span><em>{collection.asset_count}</em>
        </button>
        <button className="ia-beta-library-side-delete" aria-label={`Excluir ${collection.name}`} disabled={Boolean(saving)} onClick={()=>void removeCollection(collection.collection_id)}><Trash2/></button>
      </div>)}
      <div className="ia-beta-library-create-row">
        <input value={collectionName} onChange={e=>setCollectionName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void createCollection()}} placeholder="Nova coleção"/>
        <button aria-label="Criar coleção" disabled={!collectionName.trim()||Boolean(saving)} onClick={()=>void createCollection()}><FolderPlus/></button>
      </div>
    </aside>

    <section className="ia-beta-library-main">
      <div className="ia-beta-library-heading">
        <div><span>Library 2.0</span><h1>Seus assets, em qualquer mídia.</h1></div>
        <button className="ia-beta-library-refresh" onClick={()=>void loadPage(false)} disabled={loading}><RefreshCw className={loading?'is-spin':''}/><span>Atualizar</span></button>
      </div>

      <div className="ia-beta-library-toolbar">
        <label className="ia-beta-library-search"><Search/><input value={searchDraft} onChange={e=>setSearchDraft(e.target.value)} placeholder="Buscar nome ou alias"/></label>
        <div className="ia-beta-library-type-tabs">{TYPES.map(type=><button key={type.value} className={filters.type===type.value?'is-selected':''} onClick={()=>setFilters(current=>({...current,type:type.value}))}>{type.label}</button>)}</div>
        <select className="ia-beta-library-compact-select" value={filters.origin||''} onChange={event=>setFilters(current=>({...current,origin:event.target.value||undefined}))}>
          <option value="">Todas as origens</option><option value="UPLOAD">Uploads</option><option value="GENERATED">Gerados</option><option value="DERIVED">Derivados</option>
        </select>
        <label className="ia-beta-library-tag-filter"><Tag/><input value={filters.tag||''} onChange={event=>setFilters(current=>({...current,tag:event.target.value.trimStart()||undefined}))} placeholder="Filtrar tag"/></label>
        <button className={filters.favorite?'ia-beta-filter-toggle is-selected':'ia-beta-filter-toggle'} onClick={()=>setFilters(current=>({...current,favorite:current.favorite?undefined:true}))}><Star/>Favoritos</button>
      </div>

      {error&&<div className="ia-beta-library-error" role="status"><span>{error}</span><button onClick={()=>void loadPage(false)}>Tentar novamente</button></div>}

      {loading&&items.length===0?<div className="ia-beta-library-loading"><LoaderCircle className="is-spin"/>Carregando Library…</div>:
      items.length===0?<div className="ia-beta-library-empty"><Archive/><strong>Nenhum asset encontrado</strong><span>Ajuste os filtros ou gere novos conteúdos no IA Conect.</span></div>:
      <div className="ia-beta-library-grid">
        {items.map(asset=>{
          const Icon=mediaIcon(asset.type);
          return <article className="ia-beta-library-card" key={asset.asset_id}>
            <button className="ia-beta-library-preview" onClick={()=>setSelected(asset)} aria-label={`Abrir ${asset.name}`}>
              {asset.type==='IMAGE'&&asset.preview_url?<img src={asset.preview_url} alt="" loading="lazy"/>:
               asset.type==='VIDEO'&&asset.preview_url?<><video src={asset.preview_url} muted preload="metadata"/><span className="ia-beta-library-play"><Play/></span></>:
               <div className="ia-beta-library-placeholder"><Icon/><span>{asset.type==='MODEL_3D'?'Modelo 3D':asset.type==='AUDIO'?'Áudio':'Asset'}</span></div>}
            </button>
            <div className="ia-beta-library-card-body">
              <div className="ia-beta-library-card-title"><div><strong>{asset.name}</strong><span>{asset.type.replace('MODEL_3D','3D')} · {formatBytes(asset.size_bytes)}</span></div>
                <button className={asset.is_favorite?'is-favorite':''} aria-label="Favoritar" disabled={saving===asset.asset_id} onClick={()=>void updateItem(asset,{is_favorite:!asset.is_favorite})}><Star/></button>
              </div>
              {asset.tags.length>0&&<div className="ia-beta-library-tags">{asset.tags.slice(0,3).map(tag=><span key={tag}>#{tag}</span>)}</div>}
              <div className="ia-beta-library-card-actions">
                <button disabled={Boolean(saving)} onClick={()=>void runIntent(asset,'REMIX')}><Sparkles/>Remix</button>
                <button disabled={Boolean(saving)} onClick={()=>void runIntent(asset,'USE_IN')}><MoreHorizontal/>Usar em</button>
              </div>
            </div>
          </article>;
        })}
      </div>}

      {hasMore&&<div className="ia-beta-library-load-more"><button disabled={loadingMore} onClick={()=>void loadPage(true,cursor)}>{loadingMore?<><LoaderCircle className="is-spin"/>Carregando…</>:'Carregar mais'}</button></div>}
    </section>

    {selected&&<div className="ia-beta-library-drawer-backdrop" onClick={()=>setSelected(null)}>
      <aside className="ia-beta-library-drawer" onClick={event=>event.stopPropagation()}>
        <div className="ia-beta-library-drawer-head"><div><span>{selected.type.replace('MODEL_3D','3D')}</span><h2>{selected.name}</h2></div><button onClick={()=>setSelected(null)}>×</button></div>
        {(selected.type==='AUDIO'||selected.type==='VIDEO')&&selected.preview_url&&<div className="ia-beta-library-drawer-media">
          {selected.type==='AUDIO'?<audio controls preload="metadata" src={selected.preview_url}/>:<video controls preload="metadata" src={selected.preview_url}/>}
        </div>}
        <div className="ia-beta-library-drawer-section">
          <label>Projeto<select value={selected.project_id||''} onChange={event=>void updateItem(selected,{project_id:event.target.value||null,collection_ids:[]})}>
            <option value="">Sem projeto</option>{projects.map(project=><option key={project.project_id} value={project.project_id}>{project.name}</option>)}
          </select></label>
          <div><span className="ia-beta-library-field-label">Coleções</span><div className="ia-beta-library-collection-chips">
            {collections.filter(collection=>!selected.project_id||!collection.project_id||collection.project_id===selected.project_id).map(collection=>{
              const active=selected.collection_ids.includes(collection.collection_id);
              return <button key={collection.collection_id} className={active?'is-selected':''} onClick={()=>void updateItem(selected,{collection_ids:active?selected.collection_ids.filter(id=>id!==collection.collection_id):[...selected.collection_ids,collection.collection_id]})}>{collection.name}</button>;
            })}
          </div></div>
          <label>Tags<div className="ia-beta-library-tag-input"><Tag/><input defaultValue={selected.tags.join(', ')} key={selected.asset_id+selected.updated_at} onBlur={event=>void updateItem(selected,{tags:event.target.value.split(',')})} placeholder="produto, campanha, personagem"/></div></label>
        </div>
        <div className="ia-beta-library-drawer-meta"><span>Origem <strong>{selected.origin}</strong></span><span>Modelo <strong>{selected.source_model_id||'—'}</strong></span><span>Alias <strong>@{selected.alias}</strong></span></div>
        <div className="ia-beta-library-drawer-actions"><button onClick={()=>void runIntent(selected,'REMIX')}><Sparkles/>Remix</button><button onClick={()=>void runIntent(selected,'USE_IN')}><MoreHorizontal/>Usar em</button></div>
      </aside>
    </div>}
  </main>;
};
