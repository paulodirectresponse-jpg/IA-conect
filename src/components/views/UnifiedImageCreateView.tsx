import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{Asset,Generation,GenerationRequestDraft,ModelRegistryItem,WorkspaceReference}from'../../types/index.js';
import{workspaceService}from'../../services/workspaceService.js';
import{assetService}from'../../services/assetService.js';
import{generationClient}from'../../services/generationClient.js';
import{getModelCapabilities}from'../../services/modelCapabilities.js';
import{adaptationSummary,planImageConfiguration}from'../../services/generationConfigurationPolicy.js';
import{DEFAULT_PRESERVATION_RULES}from'../../config/constants.js';
import{useAuth}from'../../context/AuthContext.js';
import{AssetPickerContentView,AssetPickerModal}from'../workspace/AssetPickerModal.js';
import{CreationGallery}from'../workspace/CreationGallery.js';
import{UnifiedImageCreatorPanel}from'../workspace/UnifiedImageCreatorPanel.js';

interface Props{onUseImageForVideo?:(asset:Asset)=>void;initialEditAsset?:Asset|null;}
type SelectionMode='AUTO'|'MANUAL';
type SemanticRole='CHARACTER'|'PRODUCT'|'STYLE'|'GENERAL';
const terminal=(s:string)=>['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(s);
function localAlias(refs:WorkspaceReference[]){const used=new Set(refs.map(r=>r.alias_snapshot.toLowerCase()));let i=1;while(used.has(`img${i}`))i++;return`img${i}`;}
function referenceFor(asset:Asset,refs:WorkspaceReference[],alias?:string,role:SemanticRole='GENERAL'):WorkspaceReference{const d=DEFAULT_PRESERVATION_RULES.GENERIC;return{asset_id:asset.asset_id,alias_snapshot:alias||localAlias(refs),role,priority:'HIGH',preservation_rules:d.preserve,flexible_rules:d.flexible,asset};}
function ratioFromAsset(asset:Asset){if(!asset.width||!asset.height)return'1:1';const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a,d=gcd(asset.width,asset.height);return`${Math.round(asset.width/d)}:${Math.round(asset.height/d)}`;}
const resolutionRank=(v:string)=>({'1K':1,'1.5K':1.5,'2K':2,'4K':4}[v.toUpperCase()]||0);
const quoteKey=(model:ModelRegistryItem,plan:ReturnType<typeof planImageConfiguration>)=>JSON.stringify({m:model.model_id,mode:plan.mode,r:plan.resolution,a:plan.aspectRatio,refs:plan.references.map(ref=>[ref.asset_id,ref.role])});

export const UnifiedImageCreateView:React.FC<Props>=({onUseImageForVideo,initialEditAsset})=>{
 const{wallet,refreshWallet}=useAuth();
 const[models,setModels]=useState<ModelRegistryItem[]>([]);
 const[assets,setAssets]=useState<Asset[]>([]);
 const[favoriteModelIds,setFavoriteModelIds]=useState<string[]>([]);
 const[recentModelIds,setRecentModelIds]=useState<string[]>([]);
 const[selectionMode,setSelectionMode]=useState<SelectionMode>('AUTO');
 const[manualModelId,setManualModelId]=useState('');
 const[prompt,setPrompt]=useState('');
 const[references,setReferences]=useState<WorkspaceReference[]>([]);
 const[aspectRatio,setAspectRatio]=useState('1:1');
 const[resolution,setResolution]=useState('1K');
 const[seed,setSeed]=useState<number|''>('');
 const[showAdvanced,setShowAdvanced]=useState(false);
 const[pickerOpen,setPickerOpen]=useState(false);
 const[pickerView,setPickerView]=useState<AssetPickerContentView>('ASSETS');
 const[pickerRole,setPickerRole]=useState<SemanticRole>('GENERAL');
 const[generating,setGenerating]=useState(false);
 const[generation,setGeneration]=useState<Generation|null>(null);
 const[error,setError]=useState('');
 const[adaptationNotice,setAdaptationNotice]=useState('');
 const[quotedPricesByModelId,setQuotedPricesByModelId]=useState<Record<string,number|null>>({});
 const[priceLoadingModelIds,setPriceLoadingModelIds]=useState<string[]>([]);
 const[uploadBusy,setUploadBusy]=useState(false);
 const pollRef=useRef<any>(null),quoteSeq=useRef(0),quoteCache=useRef(new Map<string,number>());

 useEffect(()=>{let mounted=true;Promise.all([workspaceService.listModels().catch(()=>[]),assetService.listAssets().catch(()=>[]),workspaceService.getUserPreferences().catch(()=>({favorite_model_ids:[],recent_model_ids:[]}as any))]).then(([rows,assetRows,prefs])=>{if(!mounted)return;const imageModels=rows.filter(m=>m.category==='IMAGE'&&m.status!=='INACTIVE');setModels(imageModels);if(imageModels.length)setManualModelId(imageModels[0].model_id);setAssets(assetRows||[]);setFavoriteModelIds(prefs.favorite_model_ids||[]);setRecentModelIds(prefs.recent_model_ids||[])});return()=>{mounted=false;if(pollRef.current)clearTimeout(pollRef.current)}},[]);

 const editImage=useCallback((asset:Asset)=>{setError('');setSelectionMode('AUTO');setPrompt('');setReferences([referenceFor(asset,[])]);setAspectRatio(ratioFromAsset(asset));setAdaptationNotice('');window.scrollTo({top:0,behavior:'smooth'})},[]);
 useEffect(()=>{if(initialEditAsset?.type==='IMAGE')editImage(initialEditAsset)},[initialEditAsset?.asset_id,editImage]);

 const mode=references.length?'IMAGE_TO_IMAGE':'TEXT_TO_IMAGE';
 const manualModel=models.find(m=>m.model_id===manualModelId)||models[0]||null;
 const modelPlans=useMemo(()=>Object.fromEntries(models.map(model=>[model.model_id,planImageConfiguration(model,{resolution,aspectRatio,references,seed})])),[models,resolution,aspectRatio,references,seed]);
 const adaptationLabelsByModelId=useMemo(()=>Object.fromEntries(models.map(model=>[model.model_id,adaptationSummary(modelPlans[model.model_id]?.changes||[])])),[models,modelPlans]);
 const blockedReasonsByModelId=useMemo(()=>Object.fromEntries(models.map(model=>[model.model_id,modelPlans[model.model_id]?.valid?'':modelPlans[model.model_id]?.blockedReason||'Configuração não suportada']).filter(([,reason])=>Boolean(reason))),[models,modelPlans]);
 const strictCompatible=useMemo(()=>models.filter(model=>{const caps=getModelCapabilities(model);return caps.supported_modes.includes(mode)&&caps.supported_resolutions.includes(resolution)&&caps.supported_aspect_ratios.includes(aspectRatio)&&references.length<=caps.max_reference_images}),[models,mode,resolution,aspectRatio,references.length]);

 useEffect(()=>{
  const seq=++quoteSeq.current,baseline:Record<string,number|null>={},missing:Array<{model:ModelRegistryItem;plan:ReturnType<typeof planImageConfiguration>;key:string}>=[];
  for(const model of models){const plan=modelPlans[model.model_id];if(!plan?.valid){baseline[model.model_id]=null;continue}const key=quoteKey(model,plan),cached=quoteCache.current.get(key);if(cached!=null)baseline[model.model_id]=cached;else{baseline[model.model_id]=quotedPricesByModelId[model.model_id]??null;missing.push({model,plan,key})}}
  setQuotedPricesByModelId(baseline);setPriceLoadingModelIds(missing.map(row=>row.model.model_id));if(!missing.length)return;
  const timer=window.setTimeout(async()=>{const next={...baseline};await Promise.all(missing.map(async({model,plan,key})=>{try{const preview=await generationClient.quote({model_id:model.model_id,mode:plan.mode,prompt:'pricing preview',references:plan.references,settings:{duration_seconds:1,resolution:plan.resolution,aspect_ratio:plan.aspectRatio,number_of_outputs:1,seed:plan.seed===''?null:plan.seed}});const price=Number((preview.request_draft as any).retail_credit_price);if(!Number.isFinite(price)||price<=0)throw new Error('Preço indisponível');quoteCache.current.set(key,price);next[model.model_id]=price}catch{next[model.model_id]=null}}));if(seq===quoteSeq.current){setQuotedPricesByModelId(next);setPriceLoadingModelIds([])}},160);
  return()=>window.clearTimeout(timer);
 },[models,modelPlans]);

 const autoModel=useMemo(()=>{
  const exact=[...strictCompatible],candidates=exact.length?exact:models.filter(model=>modelPlans[model.model_id]?.valid);
  return candidates.sort((a,b)=>{
   if(!exact.length){const diff=(modelPlans[a.model_id]?.changes.length||0)-(modelPlans[b.model_id]?.changes.length||0);if(diff)return diff;}
   return(quotedPricesByModelId[a.model_id]??Number.MAX_SAFE_INTEGER)-(quotedPricesByModelId[b.model_id]??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name);
  })[0]||null;
 },[strictCompatible,models,modelPlans,quotedPricesByModelId]);
 useEffect(()=>{
  if(selectionMode!=='AUTO'||!autoModel||strictCompatible.length)return;
  const plan=modelPlans[autoModel.model_id];if(!plan?.valid||!plan.changes.length)return;
  setResolution(plan.resolution);setAspectRatio(plan.aspectRatio);setReferences(plan.references);setSeed(plan.seed);setAdaptationNotice(plan.changes.map(item=>item.message).join(' '));
 },[selectionMode,autoModel?.model_id,strictCompatible.length,modelPlans]);
 const activeModel=selectionMode==='AUTO'?autoModel:manualModel;
 const activeCaps=activeModel?getModelCapabilities(activeModel):null;
 const availableResolutions=useMemo(()=>{const values=selectionMode==='MANUAL'&&activeCaps?activeCaps.supported_resolutions:Array.from(new Set(strictCompatible.flatMap(model=>getModelCapabilities(model).supported_resolutions)));return[...values].sort((a,b)=>resolutionRank(a)-resolutionRank(b))},[selectionMode,activeCaps,strictCompatible]);
 const totalPrice=activeModel?quotedPricesByModelId[activeModel.model_id]??null:null,quoteLoading=Boolean(activeModel&&priceLoadingModelIds.includes(activeModel.model_id)),balance=wallet?.available_credits??0,hasBalance=totalPrice!=null&&balance>=totalPrice;

 const applyModel=async(model:ModelRegistryItem)=>{const plan=modelPlans[model.model_id]||planImageConfiguration(model,{resolution,aspectRatio,references,seed});if(!plan.valid){setError(plan.blockedReason||'Esta IA não suporta a configuração atual.');return}setSelectionMode('MANUAL');setManualModelId(model.model_id);setResolution(plan.resolution);setAspectRatio(plan.aspectRatio);setReferences(plan.references);setSeed(plan.seed);setAdaptationNotice(plan.changes.map(item=>item.message).join(' '));setError('');const prefs=await workspaceService.trackRecentModel(model.model_id,plan.mode).catch(()=>null);if(prefs)setRecentModelIds(prefs.recent_model_ids||[])};
 const selectAuto=()=>{setSelectionMode('AUTO');setAdaptationNotice('');setError('')};
 const openPicker=(view:AssetPickerContentView='ASSETS',role:SemanticRole='GENERAL')=>{setPickerView(view);setPickerRole(role);setPickerOpen(true)};
 const addReference=(asset:Asset,role:SemanticRole=pickerRole)=>setReferences(prev=>{if(prev.some(ref=>ref.asset_id===asset.asset_id))return prev;const max=activeCaps?.max_reference_images||Math.max(1,...models.map(model=>getModelCapabilities(model).max_reference_images));if(role!=='GENERAL'){const withoutRole=prev.filter(ref=>String(ref.role||'GENERAL').toUpperCase()!==role);return[...withoutRole,referenceFor(asset,withoutRole,undefined,role)].slice(0,max)}if(prev.length>=max)return prev;return[...prev,referenceFor(asset,prev,undefined,'GENERAL')]});
 const handlePicked=(asset:Asset)=>addReference(asset,pickerRole);
 const removeReference=(id:string)=>setReferences(prev=>prev.filter(ref=>ref.asset_id!==id));
 const quickUpload=useCallback(async(files:File[],role:SemanticRole='GENERAL')=>{const images=files.filter(file=>file.type.startsWith('image/'));if(!images.length)return;setUploadBusy(true);try{for(const file of images){const asset=await assetService.uploadAsset({file,category:'GENERIC'});setAssets(prev=>[asset,...prev.filter(row=>row.asset_id!==asset.asset_id)]);addReference(asset,role)}}catch(e:any){setError(e?.message||'Não foi possível enviar a imagem.')}finally{setUploadBusy(false)}},[activeCaps,models,pickerRole]);
 useEffect(()=>{const onPaste=(e:ClipboardEvent)=>{const files=Array.from(e.clipboardData?.files||[]).filter(file=>file.type.startsWith('image/'));if(files.length)void quickUpload(files)};window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste)},[quickUpload]);

 const restoreGeneration=(saved:Generation)=>{setError('');setSelectionMode('MANUAL');setManualModelId(saved.model_id);setPrompt(saved.original_prompt||'');setAspectRatio(saved.aspect_ratio||'1:1');setResolution(saved.resolution||'1K');setSeed(saved.seed??'');const restored:WorkspaceReference[]=[];(saved.references||[]).forEach((snapshot,index)=>{const asset=assets.find(row=>row.asset_id===snapshot.asset_id);if(asset)restored.push(referenceFor(asset,restored,snapshot.alias||`img${index+1}`,'GENERAL'))});setReferences(restored);setAdaptationNotice('');window.scrollTo({top:0,behavior:'smooth'})};
 const refreshAssets=async()=>{const rows=await assetService.listAssets().catch(()=>[]);if(rows.length)setAssets(rows)};
 const poll=(id:string)=>{pollRef.current=setTimeout(async()=>{try{const next=await generationClient.get(id);setGeneration(next);window.dispatchEvent(new CustomEvent('generation:updated',{detail:next}));if(next.status==='SUCCEEDED'){await Promise.all([refreshAssets(),refreshWallet()]);setGenerating(false);return}if(terminal(next.status)){setGenerating(false);if(next.status==='FAILED')setError(next.error_message||'A geração falhou.');return}poll(id)}catch(e:any){setGenerating(false);setError(e?.message||'Falha ao consultar a geração.')}},2200)};
 const startDraft=async(draft:GenerationRequestDraft)=>{const started=await generationClient.create(draft);setGeneration(started);window.dispatchEvent(new CustomEvent('generation:updated',{detail:started}));if(terminal(started.status)){setGenerating(false);if(started.status==='SUCCEEDED')await Promise.all([refreshAssets(),refreshWallet()]);else setError(started.error_message||'A geração não pôde ser concluída.');return}poll(started.generation_id)};
 const quoteCurrent=()=>generationClient.quote({model_id:activeModel!.model_id,mode,prompt:prompt.trim(),references,settings:{duration_seconds:1,resolution,aspect_ratio:aspectRatio,number_of_outputs:1,seed:typeof seed==='number'?seed:null}});
 const generate=async()=>{setError('');if(!prompt.trim())return setError('Descreva a imagem que deseja criar.');if(!activeModel)return setError('Escolha uma IA ou use Auto.');if(quoteLoading||totalPrice==null)return setError('Aguarde a cotação desta configuração.');if(!hasBalance)return setError('Créditos insuficientes para esta geração.');try{setGenerating(true);let preview=await quoteCurrent(),draft:any=preview.request_draft;if(!draft.has_sufficient_funds)throw Object.assign(new Error('Créditos insuficientes para esta geração.'),{code:'CREDIT_INSUFFICIENT_FUNDS'});const current=Number(draft.retail_credit_price);if(Number.isFinite(current)&&current>0)setQuotedPricesByModelId(prev=>({...prev,[activeModel.model_id]:current}));try{await startDraft(draft as GenerationRequestDraft)}catch(e:any){if(e?.code!=='PRICE_CHANGED_REQUOTE_REQUIRED')throw e;preview=await quoteCurrent();draft=preview.request_draft;if(!draft.has_sufficient_funds)throw Object.assign(new Error('Créditos insuficientes para esta geração.'),{code:'CREDIT_INSUFFICIENT_FUNDS'});await startDraft(draft as GenerationRequestDraft)}}catch(e:any){setGenerating(false);setError(e?.message||'Não foi possível iniciar a geração.')}};
 const useForVideo=async(asset:Asset)=>{try{const d=DEFAULT_PRESERVATION_RULES.GENERIC;await workspaceService.saveDraft({model_id:'AUTO',mode:'IMAGE_TO_VIDEO',prompt:'',references:[{asset_id:asset.asset_id,alias_snapshot:'img1',role:'START_FRAME',priority:'HIGH',preservation_rules:d.preserve,flexible_rules:d.flexible,asset}],settings:{duration_seconds:5,resolution:'720p',aspect_ratio:ratioFromAsset(asset),number_of_outputs:1,audio_enabled:true}});onUseImageForVideo?.(asset)}catch(e:any){setError(e?.message||'Não foi possível preparar esta imagem para vídeo.')}};

 return <div className="flex h-full min-h-0 bg-[#0b0e13]">
  <UnifiedImageCreatorPanel models={models} selectionMode={selectionMode} selectedModelId={selectionMode==='AUTO'?autoModel?.model_id||'':manualModelId} autoResolvedModel={autoModel} onSelectAuto={selectAuto} onSelectModel={applyModel} favoriteModelIds={favoriteModelIds} recentModelIds={recentModelIds} onToggleFavorite={async id=>{const prefs=await workspaceService.toggleFavoriteModel(id);setFavoriteModelIds(prefs.favorite_model_ids||[])}} references={references} onOpenPicker={openPicker} onRemoveReference={removeReference} onQuickUpload={quickUpload} uploadBusy={uploadBusy} prompt={prompt} onChangePrompt={setPrompt} aspectRatio={aspectRatio} onChangeAspectRatio={setAspectRatio} resolution={resolution} onChangeResolution={setResolution} availableResolutions={availableResolutions} activeModel={activeModel} showAdvanced={showAdvanced} onToggleAdvanced={()=>setShowAdvanced(v=>!v)} seed={seed} onChangeSeed={setSeed} totalPrice={totalPrice} balance={balance} hasBalance={hasBalance} generating={generating} priceLoading={quoteLoading} onGenerate={generate} error={error} livePricesByModelId={quotedPricesByModelId} priceLoadingModelIds={priceLoadingModelIds} adaptationLabelsByModelId={adaptationLabelsByModelId} blockedReasonsByModelId={blockedReasonsByModelId} adaptationNotice={adaptationNotice}/>
  <CreationGallery defaultFilter="IMAGE" title="Minhas criações" subtitle="Imagens, vídeos e histórico do seu studio." liveGeneration={generation} onRestoreGeneration={restoreGeneration} onUseImageAsReference={asset=>addReference(asset,'GENERAL')} onEditImage={editImage} onCreateVideoFromImage={useForVideo}/>
  <AssetPickerModal isOpen={pickerOpen} onClose={()=>setPickerOpen(false)} availableAssets={assets} onSelectAsset={handlePicked} onAssetUploaded={asset=>setAssets(prev=>[asset,...prev.filter(row=>row.asset_id!==asset.asset_id)])} attachedAssetIds={references.map(ref=>ref.asset_id)} title="Adicionar referência" subtitle="Pessoa, produto, estilo ou qualquer imagem da sua Biblioteca." defaultTab="LIBRARY" defaultContentView={pickerView} allowedTypes={['IMAGE']}/>
 </div>;
};
