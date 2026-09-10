import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{Asset,AssetType,Generation,GenerationRequestDraft,ModelRegistryItem,WorkspaceReference}from'../../types/index.js';
import{workspaceService}from'../../services/workspaceService.js';
import{generationClient}from'../../services/generationClient.js';
import{assetService}from'../../services/assetService.js';
import{useAuth}from'../../context/AuthContext.js';
import{findCompatibleModels,getModelCapabilities,mergeModelCapabilities,validateConfiguration}from'../../services/modelCapabilities.js';
import{adaptationSummary,planVideoConfiguration,VideoConfigurationPlan}from'../../services/generationConfigurationPolicy.js';
import{DEFAULT_PRESERVATION_RULES}from'../../config/constants.js';
import{generationIntentResolver}from'../../services/generationIntentResolver.js';
import{CreatorPanel}from'../workspace/CreatorPanel.js';
import{CreationGallery}from'../workspace/CreationGallery.js';
import{ImprovePromptModal}from'../workspace/ImprovePromptModal.js';
import{AssetPickerModal}from'../workspace/AssetPickerModal.js';
import{ReferenceRulesModal}from'../workspace/ReferenceRulesModal.js';

function localAliasFor(a:Asset,refs:WorkspaceReference[]){const p=a.type==='VIDEO'?'video':a.type==='AUDIO'?'audio':'img',used=new Set(refs.map(r=>r.alias_snapshot.toLowerCase()));let i=1;while(used.has(`${p}${i}`))i++;return`${p}${i}`;}
function ratioFromAsset(asset:Asset){if(!asset.width||!asset.height)return null;const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a,d=gcd(asset.width,asset.height);return`${Math.round(asset.width/d)}:${Math.round(asset.height/d)}`;}
const terminal=(status:string)=>['SUCCEEDED','FAILED','CANCELLED','REFUNDED'].includes(status);
const frameRef=(asset:Asset,role:'START_FRAME'|'END_FRAME'):WorkspaceReference=>{const d=DEFAULT_PRESERVATION_RULES.GENERIC;return{asset_id:asset.asset_id,alias_snapshot:role==='START_FRAME'?'start_frame':'end_frame',role,priority:'HIGH',preservation_rules:d.preserve,flexible_rules:d.flexible,asset};};
const refsForPlan=(plan:VideoConfigurationPlan)=>{const refs=[...plan.references];if(plan.initialImage)refs.unshift(frameRef(plan.initialImage,'START_FRAME'));if(plan.endImage)refs.push(frameRef(plan.endImage,'END_FRAME'));return refs;};
const quoteKey=(model:ModelRegistryItem,plan:VideoConfigurationPlan)=>JSON.stringify({m:model.model_id,mode:plan.mode,r:plan.resolution,d:plan.durationSeconds,a:plan.aspectRatio,audio:plan.audioEnabled,refs:refsForPlan(plan).map(ref=>[ref.asset_id,ref.role])});
interface Props{initialAsset?:Asset|null;onEditImage?:(asset:Asset)=>void;}

export const CreateView:React.FC<Props>=({initialAsset,onEditImage})=>{
 const{wallet,refreshWallet}=useAuth();
 const[models,setModels]=useState<ModelRegistryItem[]>([]);
 const[selectionMode,setSelectionMode]=useState<'AUTO'|'MANUAL'>('AUTO');
 const[manualModelId,setManualModelId]=useState('');
 const[initialImage,setInitialImage]=useState<Asset|null>(null);
 const[endImage,setEndImage]=useState<Asset|null>(null);
 const[prompt,setPrompt]=useState('');
 const[negativePrompt,setNegativePrompt]=useState('');
 const[references,setReferences]=useState<WorkspaceReference[]>([]);
 const[durationSeconds,setDurationSeconds]=useState(5);
 const[resolution,setResolution]=useState('720p');
 const[aspectRatio,setAspectRatio]=useState('16:9');
 const[showAdvanced,setShowAdvanced]=useState(false);
 const[seed,setSeed]=useState<number|''>('');
 const[motionStrength,setMotionStrength]=useState(5);
 const[audioEnabled,setAudioEnabled]=useState(true);
 const[availableAssets,setAvailableAssets]=useState<Asset[]>([]);
 const[favoriteModelIds,setFavoriteModelIds]=useState<string[]>([]);
 const[recentModelIds,setRecentModelIds]=useState<string[]>([]);
 const[isImproveModalOpen,setIsImproveModalOpen]=useState(false);
 const[isAssetPickerOpen,setIsAssetPickerOpen]=useState(false);
 const[pickerTargetSlot,setPickerTargetSlot]=useState<'INITIAL'|'END'|'GENERAL'>('GENERAL');
 const[selectedRefForRules,setSelectedRefForRules]=useState<WorkspaceReference|null>(null);
 const[validationErrors,setValidationErrors]=useState<string[]>([]);
 const[generationError,setGenerationError]=useState('');
 const[adaptationNotice,setAdaptationNotice]=useState('');
 const[validating,setValidating]=useState(false);
 const[generating,setGenerating]=useState(false);
 const[generation,setGeneration]=useState<Generation|null>(null);
 const[quotedPricesByModelId,setQuotedPricesByModelId]=useState<Record<string,number|null>>({});
 const[priceLoadingModelIds,setPriceLoadingModelIds]=useState<string[]>([]);
 const[uploadBusy,setUploadBusy]=useState(false);
 const autosaveTimerRef=useRef<any>(null),generationPollRef=useRef<any>(null),quoteSeqRef=useRef(0),quoteCacheRef=useRef(new Map<string,number>());

 useEffect(()=>{let mounted=true;Promise.all([workspaceService.listModels(),assetService.listAssets().catch(()=>[]),workspaceService.getUserPreferences().catch(()=>({favorite_model_ids:[],recent_model_ids:[]}as any))]).then(([rows,assets,prefs])=>{if(!mounted)return;const active=rows.filter(m=>m.status!=='INACTIVE'&&m.category==='VIDEO');setModels(active);if(active.length)setManualModelId(active[0].model_id);setAvailableAssets(assets);setFavoriteModelIds(prefs.favorite_model_ids||[]);setRecentModelIds(prefs.recent_model_ids||[])}).catch(()=>{});return()=>{mounted=false;if(autosaveTimerRef.current)clearTimeout(autosaveTimerRef.current);if(generationPollRef.current)clearTimeout(generationPollRef.current)}},[]);
 useEffect(()=>{if(initialAsset?.type==='IMAGE'){setInitialImage(initialAsset);setReferences([]);const r=ratioFromAsset(initialAsset);if(r)setAspectRatio(r)}},[initialAsset?.asset_id]);

 const manualModel=useMemo(()=>models.find(m=>m.model_id===manualModelId)||models[0]||null,[models,manualModelId]);
 const autoCapabilities=useMemo(()=>mergeModelCapabilities(models),[models]);
 const refsWithFrames=useMemo(()=>{const out=[...references];if(initialImage)out.unshift(frameRef(initialImage,'START_FRAME'));if(endImage)out.push(frameRef(endImage,'END_FRAME'));return out},[references,initialImage,endImage]);
 const inferredIntent=useMemo(()=>generationIntentResolver.resolveMode({model:selectionMode==='MANUAL'?manualModel:undefined,prompt,references,initialAsset:initialImage,endAsset:endImage}),[selectionMode,manualModel,prompt,references,initialImage,endImage]);
 const mode=inferredIntent.mode;
 const modelPlans=useMemo(()=>{const out:Record<string,VideoConfigurationPlan>={};for(const model of models)out[model.model_id]=planVideoConfiguration(model,{resolution,durationSeconds,aspectRatio,initialImage,endImage,references,audioEnabled,seed,motionStrength});return out},[models,resolution,durationSeconds,aspectRatio,initialImage,endImage,references,audioEnabled,seed,motionStrength]);
 const adaptationLabelsByModelId=useMemo(()=>Object.fromEntries(models.map(model=>[model.model_id,adaptationSummary(modelPlans[model.model_id]?.changes||[])])),[models,modelPlans]);
 const blockedReasonsByModelId=useMemo(()=>Object.fromEntries(models.map(model=>[model.model_id,modelPlans[model.model_id]?.valid?'':modelPlans[model.model_id]?.blockedReason||'Configuração não suportada']).filter(([,reason])=>Boolean(reason))),[models,modelPlans]);

 const counts=useMemo(()=>{const r={IMAGE:0,VIDEO:0,AUDIO:0};references.forEach(x=>{r[x.asset?.type||'IMAGE']++});return r},[references]);
 const autoCompatibleModels=useMemo(()=>findCompatibleModels(models,{mode,imageCount:counts.IMAGE,videoCount:counts.VIDEO,audioCount:counts.AUDIO,hasStartImage:Boolean(initialImage),hasEndImage:Boolean(endImage),desiredResolution:resolution,desiredDuration:durationSeconds,desiredAspectRatio:aspectRatio,promptLength:prompt.length,usesNegativePrompt:Boolean(negativePrompt.trim())}).filter(model=>!audioEnabled||Boolean(getModelCapabilities(model).supports_audio_generation)),[models,mode,counts,initialImage,endImage,resolution,durationSeconds,aspectRatio,prompt.length,negativePrompt,audioEnabled]);

 useEffect(()=>{
  const seq=++quoteSeqRef.current,baseline:Record<string,number|null>={},missing:Array<{model:ModelRegistryItem;plan:VideoConfigurationPlan;key:string}>=[];
  for(const model of models){
   const plan=modelPlans[model.model_id];
   if(!plan?.valid){baseline[model.model_id]=null;continue}
   const key=quoteKey(model,plan),cached=quoteCacheRef.current.get(key);
   if(cached!=null)baseline[model.model_id]=cached;
   else{baseline[model.model_id]=quotedPricesByModelId[model.model_id]??null;missing.push({model,plan,key})}
  }
  setQuotedPricesByModelId(baseline);
  setPriceLoadingModelIds(missing.map(x=>x.model.model_id));
  if(!missing.length)return;
  const timer=setTimeout(async()=>{
   const next={...baseline};
   await Promise.all(missing.map(async({model,plan,key})=>{try{const r=await generationClient.quote({model_id:model.model_id,mode:plan.mode,prompt:'pricing preview',negative_prompt:negativePrompt,references:refsForPlan(plan),settings:{duration_seconds:plan.durationSeconds,resolution:plan.resolution,aspect_ratio:plan.aspectRatio,number_of_outputs:1,seed:plan.seed===''?null:plan.seed,motion_strength:plan.motionStrength,audio_enabled:plan.audioEnabled}});const price=Number((r.request_draft as any).retail_credit_price);if(!Number.isFinite(price)||price<=0)throw new Error('Preço indisponível');quoteCacheRef.current.set(key,price);next[model.model_id]=price}catch{next[model.model_id]=null}}));
   if(seq===quoteSeqRef.current){setQuotedPricesByModelId(next);setPriceLoadingModelIds([])}
  },160);
  return()=>clearTimeout(timer);
 },[models,modelPlans,negativePrompt]);

 const autoResolvedModel=useMemo(()=>{
  const exact=[...autoCompatibleModels];
  const candidates=exact.length?exact:models.filter(model=>modelPlans[model.model_id]?.valid);
  return candidates.sort((a,b)=>{
   if(!exact.length){
    const score=(model:ModelRegistryItem)=>(modelPlans[model.model_id]?.changes||[]).reduce((total,item)=>total+(item.field==='references'?8:item.field==='audio'?5:item.field==='mode'?4:1),0);
    const diff=score(a)-score(b);if(diff)return diff;
   }
   return(quotedPricesByModelId[a.model_id]??Number.MAX_SAFE_INTEGER)-(quotedPricesByModelId[b.model_id]??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name);
  })[0]||null;
 },[autoCompatibleModels,models,modelPlans,quotedPricesByModelId]);
 useEffect(()=>{
  if(selectionMode!=='AUTO'||!autoResolvedModel||autoCompatibleModels.length)return;
  const plan=modelPlans[autoResolvedModel.model_id];if(!plan?.valid||!plan.changes.length)return;
  setResolution(plan.resolution);setDurationSeconds(plan.durationSeconds);setAspectRatio(plan.aspectRatio);setInitialImage(plan.initialImage);setEndImage(plan.endImage);setReferences(plan.references);setAudioEnabled(plan.audioEnabled);setSeed(plan.seed);setMotionStrength(plan.motionStrength);setAdaptationNotice(plan.changes.map(item=>item.message).join(' '));
 },[selectionMode,autoResolvedModel?.model_id,autoCompatibleModels.length]);
 const selectedModel=selectionMode==='AUTO'?autoResolvedModel:manualModel;
 const activeCapabilities=useMemo(()=>selectionMode==='AUTO'?(autoResolvedModel?getModelCapabilities(autoResolvedModel):autoCapabilities):getModelCapabilities(manualModel),[selectionMode,autoResolvedModel,autoCapabilities,manualModel]);
 const compatibility=useMemo(()=>validateConfiguration(selectedModel,{mode,duration_seconds:durationSeconds,resolution,aspect_ratio:aspectRatio,references:refsWithFrames,negative_prompt:negativePrompt,promptText:prompt,has_start_image:Boolean(initialImage),has_end_image:Boolean(endImage)}),[selectedModel,mode,durationSeconds,resolution,aspectRatio,refsWithFrames,negativePrompt,prompt,initialImage,endImage]);
 useEffect(()=>{setValidationErrors(compatibility.errors);setGenerationError('')},[compatibility]);
 const totalPrice=selectedModel?quotedPricesByModelId[selectedModel.model_id]??null:null;
 const balance=wallet?.available_credits??0,hasBalance=totalPrice!=null&&balance>=totalPrice;

 const addGeneralAsset=(asset:Asset)=>setReferences(prev=>prev.some(r=>r.asset_id===asset.asset_id)?prev:[...prev,{asset_id:asset.asset_id,alias_snapshot:localAliasFor(asset,prev),role:'GENERAL',priority:'HIGH',preservation_rules:DEFAULT_PRESERVATION_RULES.GENERIC.preserve,flexible_rules:DEFAULT_PRESERVATION_RULES.GENERIC.flexible,asset}]);
 const applyModelPlan=async(model:ModelRegistryItem)=>{
  const plan=modelPlans[model.model_id]||planVideoConfiguration(model,{resolution,durationSeconds,aspectRatio,initialImage,endImage,references,audioEnabled,seed,motionStrength});
  if(!plan.valid){setGenerationError(plan.blockedReason||'Esta IA não consegue executar a configuração atual.');return}
  setSelectionMode('MANUAL');setManualModelId(model.model_id);setResolution(plan.resolution);setDurationSeconds(plan.durationSeconds);setAspectRatio(plan.aspectRatio);setInitialImage(plan.initialImage);setEndImage(plan.endImage);setReferences(plan.references);setAudioEnabled(plan.audioEnabled);setSeed(plan.seed);setMotionStrength(plan.motionStrength);setAdaptationNotice(plan.changes.map(item=>item.message).join(' '));setGenerationError('');
  const prefs=await workspaceService.trackRecentModel(model.model_id,plan.mode).catch(()=>null);if(prefs)setRecentModelIds(prefs.recent_model_ids||[]);
 };
 const selectAuto=()=>{setSelectionMode('AUTO');setAdaptationNotice('');setGenerationError('')};
 const handleAssetPicked=(asset:Asset)=>{if(pickerTargetSlot==='INITIAL'){setInitialImage(asset);setReferences([]);const ratio=ratioFromAsset(asset);if(ratio)setAspectRatio(ratio);setAdaptationNotice('Modo de quadro inicial ativado. O formato foi alinhado à imagem e referências extras ficam fora desta geração.')}else if(pickerTargetSlot==='END'){setEndImage(asset);setReferences([]);setAdaptationNotice('Quadro final ativado. Referências extras ficam fora desta geração.')}else addGeneralAsset(asset)};
 const openPicker=(slot:'INITIAL'|'END'|'GENERAL')=>{setPickerTargetSlot(slot);setIsAssetPickerOpen(true)};
 const generalAllowed=selectionMode==='AUTO'||Boolean(activeCapabilities.supported_modes.includes('REFERENCE_TO_VIDEO'));
 const allowedPickerTypes:AssetType[]=pickerTargetSlot==='GENERAL'&&generalAllowed?(['IMAGE','VIDEO','AUDIO'].filter(t=>t==='IMAGE'?activeCapabilities.supports_image_reference:t==='VIDEO'?activeCapabilities.supports_video_reference:activeCapabilities.supports_audio_reference)as AssetType[]):['IMAGE'];
 const filteredPickerAssets=pickerTargetSlot==='GENERAL'?availableAssets:availableAssets.filter(a=>a.type==='IMAGE');
 const quickUpload=useCallback(async(target:'INITIAL'|'END'|'GENERAL',files:File[])=>{const usable=files.filter(file=>target==='GENERAL'||file.type.startsWith('image/'));if(!usable.length)return;setUploadBusy(true);try{for(const file of usable){const asset=await assetService.uploadAsset({file,category:file.type.startsWith('video/')?'MOTION':file.type.startsWith('audio/')?'AUDIO_REFERENCE':'GENERIC'});setAvailableAssets(prev=>[asset,...prev.filter(x=>x.asset_id!==asset.asset_id)]);if(target==='INITIAL'){setInitialImage(asset);setReferences([]);const ratio=ratioFromAsset(asset);if(ratio)setAspectRatio(ratio);break}if(target==='END'){setEndImage(asset);setReferences([]);break}addGeneralAsset(asset)}}finally{setUploadBusy(false)}},[]);
 useEffect(()=>{const onPaste=(e:ClipboardEvent)=>{const files=Array.from(e.clipboardData?.files||[]).filter(file=>file.type.startsWith('image/')||file.type.startsWith('video/')||file.type.startsWith('audio/'));if(!files.length)return;void quickUpload(!initialImage&&files[0].type.startsWith('image/')?'INITIAL':'GENERAL',files)};window.addEventListener('paste',onPaste);return()=>window.removeEventListener('paste',onPaste)},[quickUpload,initialImage]);

 const restoreGeneration=(saved:Generation)=>{setPrompt(saved.original_prompt||'');setNegativePrompt(saved.negative_prompt||'');setSelectionMode('MANUAL');setManualModelId(saved.model_id);setDurationSeconds(saved.duration_seconds||5);setResolution(saved.resolution||'720p');setAspectRatio(saved.aspect_ratio||'16:9');setSeed(saved.seed??'');setMotionStrength(saved.motion_strength??5);setAudioEnabled(saved.audio_enabled!==false);const snaps=saved.references||[],d=DEFAULT_PRESERVATION_RULES.GENERIC;const resolved=snaps.map((snap,index)=>{const asset=availableAssets.find(x=>x.asset_id===snap.asset_id);return asset?{snap,asset,ref:{asset_id:asset.asset_id,alias_snapshot:snap.alias||`ref${index+1}`,role:snap.slot_type==='INITIAL'?'START_FRAME':snap.slot_type==='END'?'END_FRAME':'GENERAL',priority:'HIGH' as const,preservation_rules:d.preserve,flexible_rules:d.flexible,asset}}:null}).filter(Boolean)as any[];setInitialImage(resolved.find(x=>x.snap.slot_type==='INITIAL')?.asset||null);setEndImage(resolved.find(x=>x.snap.slot_type==='END')?.asset||null);setReferences(resolved.filter(x=>!['INITIAL','END'].includes(x.snap.slot_type||'GENERAL')).map(x=>x.ref));setAdaptationNotice('');window.scrollTo({top:0,behavior:'smooth'})};
 const useImageForVideo=(asset:Asset)=>{setInitialImage(asset);setReferences([]);const r=ratioFromAsset(asset);if(r)setAspectRatio(r);window.scrollTo({top:0,behavior:'smooth'})};
 const persistDraft=useCallback(async()=>{try{await workspaceService.saveDraft({model_id:selectionMode==='AUTO'?'AUTO':manualModelId,mode,prompt,negative_prompt:negativePrompt,references:refsWithFrames,settings:{duration_seconds:durationSeconds,resolution,aspect_ratio:aspectRatio,number_of_outputs:1,seed:seed===''?null:seed,motion_strength:motionStrength,audio_enabled:audioEnabled}})}catch{}},[selectionMode,manualModelId,mode,prompt,negativePrompt,refsWithFrames,durationSeconds,resolution,aspectRatio,seed,motionStrength,audioEnabled]);
 useEffect(()=>{if(autosaveTimerRef.current)clearTimeout(autosaveTimerRef.current);autosaveTimerRef.current=setTimeout(persistDraft,700);return()=>clearTimeout(autosaveTimerRef.current)},[persistDraft]);

 const refreshAssets=async()=>{const rows=await assetService.listAssets().catch(()=>[]);if(rows.length)setAvailableAssets(rows)};
 const pollGeneration=(id:string)=>{generationPollRef.current=setTimeout(async()=>{try{const next=await generationClient.get(id);setGeneration(next);window.dispatchEvent(new CustomEvent('generation:updated',{detail:next}));if(next.status==='SUCCEEDED'){await Promise.all([refreshAssets(),refreshWallet()]);setGenerating(false);return}if(terminal(next.status)){setGenerating(false);if(next.status==='FAILED')setGenerationError(next.error_message||'A geração falhou.');return}pollGeneration(id)}catch(e:any){setGenerating(false);setGenerationError(e?.message||'Falha ao consultar a geração.')}},2200)};
 const quoteCurrent=()=>generationClient.quote({model_id:selectedModel!.model_id,mode,prompt,negative_prompt:negativePrompt,references:refsWithFrames,settings:{duration_seconds:durationSeconds,resolution,aspect_ratio:aspectRatio,number_of_outputs:1,seed:seed===''?null:seed,motion_strength:motionStrength,audio_enabled:audioEnabled}});
 const startDraft=async(draft:GenerationRequestDraft)=>{const started=await generationClient.create(draft);setGeneration(started);window.dispatchEvent(new CustomEvent('generation:updated',{detail:started}));if(terminal(started.status)){setGenerating(false);if(started.status==='SUCCEEDED')await Promise.all([refreshAssets(),refreshWallet()]);else setGenerationError(started.error_message||'A geração não pôde ser concluída.');return}pollGeneration(started.generation_id)};
 const handleGenerate=async()=>{if(!selectedModel||compatibility.errors.length||totalPrice==null||generating)return;setGenerationError('');setValidating(true);try{let quoted=await quoteCurrent(),draft:any=quoted.request_draft;if(!draft.has_sufficient_funds){setGenerationError('Créditos insuficientes para esta geração.');return}const current=Number(draft.retail_credit_price);if(Number.isFinite(current)&&current>0)setQuotedPricesByModelId(prev=>({...prev,[selectedModel.model_id]:current}));setGenerating(true);setValidating(false);try{await startDraft(draft as GenerationRequestDraft)}catch(e:any){if(e?.code!=='PRICE_CHANGED_REQUOTE_REQUIRED')throw e;quoted=await quoteCurrent();draft=quoted.request_draft;if(!draft.has_sufficient_funds)throw Object.assign(new Error('Créditos insuficientes para esta geração.'),{code:'CREDIT_INSUFFICIENT_FUNDS'});await startDraft(draft as GenerationRequestDraft)}}catch(e:any){setGenerating(false);setGenerationError(e?.message||'Não foi possível iniciar esta geração.')}finally{setValidating(false)}};

 return <div className="flex h-full min-h-0 bg-[#0b0e13]">
  <CreatorPanel models={models} selectionMode={selectionMode} selectedModelId={selectionMode==='AUTO'?autoResolvedModel?.model_id||'':manualModelId} autoResolvedModel={autoResolvedModel} onSelectAuto={selectAuto} onSelectModel={applyModelPlan} favoriteModelIds={favoriteModelIds} recentModelIds={recentModelIds} onToggleFavorite={async id=>{const prefs=await workspaceService.toggleFavoriteModel(id);setFavoriteModelIds(prefs.favorite_model_ids||[])}} initialImage={initialImage} endImage={endImage} references={references} onOpenPicker={openPicker} onRemoveSlot={slot=>slot==='INITIAL'?setInitialImage(null):setEndImage(null)} onRemoveReference={id=>setReferences(prev=>prev.filter(ref=>ref.asset_id!==id))} onConfigureReference={setSelectedRefForRules} onQuickUpload={quickUpload} uploadBusy={uploadBusy} resolvedMode={mode} modeExplanation={inferredIntent.explanation} prompt={prompt} onChangePrompt={setPrompt} negativePrompt={negativePrompt} onChangeNegativePrompt={setNegativePrompt} onOpenImproveModal={()=>setIsImproveModalOpen(true)} aspectRatio={aspectRatio} onChangeAspectRatio={setAspectRatio} durationSeconds={durationSeconds} onChangeDuration={setDurationSeconds} resolution={resolution} onChangeResolution={setResolution} capabilities={activeCapabilities} showAdvanced={showAdvanced} onToggleAdvanced={()=>setShowAdvanced(v=>!v)} seed={seed} onChangeSeed={setSeed} motionStrength={motionStrength} onChangeMotionStrength={setMotionStrength} audioEnabled={audioEnabled} onChangeAudioEnabled={setAudioEnabled} totalEstimatedCostCents={totalPrice} availableBalanceCents={balance} hasSufficientFunds={hasBalance} onGenerate={handleGenerate} validating={validating} generating={generating} validationErrors={validationErrors} generationError={generationError} livePricesByModelId={quotedPricesByModelId} priceLoadingModelIds={priceLoadingModelIds} adaptationLabelsByModelId={adaptationLabelsByModelId} blockedReasonsByModelId={blockedReasonsByModelId} adaptationNotice={adaptationNotice}/>
  <CreationGallery defaultFilter="VIDEO" title="Minhas criações" subtitle="Vídeos, imagens e histórico do seu studio." liveGeneration={generation} onRestoreGeneration={restoreGeneration} onUseImageAsReference={addGeneralAsset} onEditImage={onEditImage} onCreateVideoFromImage={useImageForVideo}/>
  <ImprovePromptModal isOpen={isImproveModalOpen} onClose={()=>setIsImproveModalOpen(false)} prompt={prompt} references={references} modelName={selectedModel?.name} onApply={setPrompt}/>
  <AssetPickerModal isOpen={isAssetPickerOpen} onClose={()=>setIsAssetPickerOpen(false)} availableAssets={filteredPickerAssets} onSelectAsset={handleAssetPicked} onAssetUploaded={asset=>setAvailableAssets(prev=>[asset,...prev.filter(x=>x.asset_id!==asset.asset_id)])} attachedAssetIds={refsWithFrames.map(ref=>ref.asset_id)} title="Adicionar mídia" subtitle="Escolha da Biblioteca ou arraste um arquivo diretamente no slot." defaultTab="LIBRARY" allowedTypes={allowedPickerTypes.length?allowedPickerTypes:['IMAGE']}/>
  <ReferenceRulesModal isOpen={Boolean(selectedRefForRules)} onClose={()=>setSelectedRefForRules(null)} reference={selectedRefForRules} onApply={next=>setReferences(prev=>prev.map(ref=>ref.asset_id===next.asset_id?next:ref))}/>
 </div>;
};
