
import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{ChevronDown,ChevronUp,Image as ImageIcon,Music,Package,Palette,Plus,Search,Sparkles,UserRound,Video}from'lucide-react';
import{WorkspaceReference}from'../../types/index.js';

type LibrarySection='ASSETS'|'CHARACTERS'|'PRODUCTS'|'STYLES';
interface PromptComposerProps{
 prompt:string;
 onChangePrompt:(text:string)=>void;
 negativePrompt:string;
 onChangeNegativePrompt:(text:string)=>void;
 onOpenImproveModal:()=>void;
 references:WorkspaceReference[];
 onRequestAddMedia:(section?:LibrarySection)=>void;
 supportsNegativePrompt?:boolean;
 supportsReferences?:boolean;
 maxChars?:number;
}

const isFrameReference=(ref:WorkspaceReference)=>['START_FRAME','INITIAL_FRAME','INITIAL','END_FRAME','END'].includes(String(ref.role||'').toUpperCase());
const escapeRegExp=(value:string)=>value.replace(/[|\\{}()[\]^$+*?.-]/g,'\\$&');

function editorText(editor:HTMLElement){
 if(!editor.textContent)return'';
 return editor.innerText.replace(/\r/g,'').replace(/\u00a0/g,' ');
}
function caretOffset(root:HTMLElement){
 const selection=window.getSelection();
 if(!selection?.rangeCount)return editorText(root).length;
 const range=selection.getRangeAt(0);
 if(!root.contains(range.startContainer))return editorText(root).length;
 const probe=range.cloneRange();
 probe.selectNodeContents(root);
 probe.setEnd(range.startContainer,range.startOffset);
 return probe.toString().length;
}
function restoreCaret(root:HTMLElement,offset:number){
 const selection=window.getSelection();
 if(!selection)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let remaining=Math.max(0,offset),node:Node|null=walker.nextNode(),target:Node|null=null,targetOffset=0;
 while(node){
  const size=node.textContent?.length||0;
  if(remaining<=size){target=node;targetOffset=remaining;break}
  remaining-=size;
  node=walker.nextNode();
 }
 const range=document.createRange();
 if(target)range.setStart(target,targetOffset);
 else{range.selectNodeContents(root);range.collapse(false)}
 range.collapse(true);
 selection.removeAllRanges();
 selection.addRange(range);
}

export const PromptComposer:React.FC<PromptComposerProps>=({
 prompt,onChangePrompt,negativePrompt,onChangeNegativePrompt,onOpenImproveModal,references,onRequestAddMedia,supportsNegativePrompt=true,supportsReferences=true,maxChars=2000,
})=>{
 const[showNegative,setShowNegative]=useState(Boolean(negativePrompt));
 const[mentionOpen,setMentionOpen]=useState(false);
 const[mentionQuery,setMentionQuery]=useState('');
 const[mentionStart,setMentionStart]=useState<number|null>(null);
 const[focused,setFocused]=useState(false);
 const editorRef=useRef<HTMLDivElement>(null);
 const lastEmittedRef=useRef('');
 const lastMentionSignatureRef=useRef('');
 const composingRef=useRef(false);
 const promptReferences=useMemo(()=>references.filter(ref=>!isFrameReference(ref)),[references]);
 const aliasKey=useMemo(()=>promptReferences.map(ref=>ref.alias_snapshot.toLowerCase()).sort().join('|'),[promptReferences]);
 const visibleReferences=useMemo(()=>{
  const q=mentionQuery.trim().toLowerCase();
  return promptReferences.filter(ref=>!q||ref.alias_snapshot.toLowerCase().includes(q)||(ref.asset?.name||'').toLowerCase().includes(q));
 },[promptReferences,mentionQuery]);

 const mentionSignature=useCallback((text:string)=>promptReferences
  .filter(ref=>new RegExp('(^|\\s)@'+escapeRegExp(ref.alias_snapshot)+'(?=$|\\s|[.,!?;:])','i').test(text))
  .map(ref=>ref.alias_snapshot.toLowerCase()).sort().join('|'),[promptReferences]);

 const renderHighlighted=useCallback((text:string,caret?:number)=>{
  const editor=editorRef.current;
  if(!editor)return;
  const aliases=promptReferences.map(ref=>ref.alias_snapshot).filter(Boolean).sort((a,b)=>b.length-a.length);
  const fragment=document.createDocumentFragment();
  if(!aliases.length){
   fragment.append(document.createTextNode(text));
   editor.replaceChildren(fragment);
   if(caret!==undefined)restoreCaret(editor,Math.min(caret,text.length));
   return;
  }
  const re=new RegExp('@('+aliases.map(escapeRegExp).join('|')+')(?=$|\\s|[.,!?;:])','gi');
  let cursor=0;
  for(const match of text.matchAll(re)){
   const index=match.index??0;
   if(index>cursor)fragment.append(document.createTextNode(text.slice(cursor,index)));
   const span=document.createElement('span');
   span.textContent=match[0];
   span.dataset.mention='true';
   span.className='rounded-[4px] bg-cyan-300/12 px-0.5 font-bold text-cyan-200 ring-1 ring-inset ring-cyan-300/20';
   fragment.append(span);
   cursor=index+match[0].length;
  }
  if(cursor<text.length)fragment.append(document.createTextNode(text.slice(cursor)));
  editor.replaceChildren(fragment);
  if(caret!==undefined)restoreCaret(editor,Math.min(caret,text.length));
 },[promptReferences]);

 const detectMention=(value:string,caret:number)=>{
  if(!supportsReferences){setMentionOpen(false);setMentionStart(null);return}
  const before=value.slice(0,caret),match=before.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
  if(!match){setMentionOpen(false);setMentionStart(null);return}
  const q=match[1]||'';
  setMentionQuery(q);
  setMentionStart(caret-q.length-1);
  setMentionOpen(true);
 };

 const syncInput=()=>{
  const editor=editorRef.current;
  if(!editor)return;
  let value=editorText(editor),caret=caretOffset(editor);
  if(value.length>maxChars){
   value=value.slice(0,maxChars);
   caret=Math.min(caret,maxChars);
   renderHighlighted(value,caret);
  }
  lastEmittedRef.current=value;
  onChangePrompt(value);
  detectMention(value,caret);
  if(composingRef.current)return;
  const signature=mentionSignature(value);
  if(signature!==lastMentionSignatureRef.current){
   lastMentionSignatureRef.current=signature;
   requestAnimationFrame(()=>renderHighlighted(value,caret));
  }
 };

 const insertReference=(ref:WorkspaceReference)=>{
  const editor=editorRef.current,caret=editor?caretOffset(editor):prompt.length,start=mentionStart??caret;
  const token='@'+ref.alias_snapshot+' ';
  const next=(prompt.slice(0,start)+token+prompt.slice(caret)).slice(0,maxChars);
  const nextCaret=Math.min(start+token.length,next.length);
  lastEmittedRef.current=next;
  lastMentionSignatureRef.current=mentionSignature(next);
  onChangePrompt(next);
  setMentionOpen(false);
  setMentionQuery('');
  setMentionStart(null);
  requestAnimationFrame(()=>{renderHighlighted(next,nextCaret);editorRef.current?.focus()});
 };

 const mediaIcon=(type?:string)=>type==='VIDEO'?<Video className="w-4 h-4"/>:type==='AUDIO'?<Music className="w-4 h-4"/>:<ImageIcon className="w-4 h-4"/>;
 const openLibrary=(section:LibrarySection)=>{setMentionOpen(false);onRequestAddMedia(section)};

 useEffect(()=>{
  const editor=editorRef.current;
  if(!editor||prompt===lastEmittedRef.current)return;
  const active=document.activeElement===editor,caret=active?caretOffset(editor):undefined;
  lastEmittedRef.current=prompt;
  lastMentionSignatureRef.current=mentionSignature(prompt);
  renderHighlighted(prompt,caret);
 },[prompt,mentionSignature,renderHighlighted]);

 useEffect(()=>{
  const editor=editorRef.current;
  if(!editor)return;
  const active=document.activeElement===editor,caret=active?caretOffset(editor):undefined;
  lastMentionSignatureRef.current=mentionSignature(prompt);
  renderHighlighted(prompt,caret);
 },[aliasKey]);

 return <div className="space-y-2">
  <div className="flex items-center justify-between"><label htmlFor="workspace-prompt-input" className="text-[10px] font-bold text-zinc-300">Prompt</label><span className="text-[8px] font-mono text-zinc-700">{prompt.length}/{maxChars}</span></div>
  <div className="relative rounded-[14px] border border-white/[0.075] bg-[#0a0d12] focus-within:border-cyan-400/25 transition-colors overflow-visible">
   {!prompt&&!focused&&<div className="absolute left-3 right-3 top-3 pointer-events-none text-[11px] font-medium leading-relaxed text-zinc-600">Descreva exatamente o que você quer gerar... Digite @ para usar uma referência.</div>}
   <div
    ref={editorRef}
    id="workspace-prompt-input"
    role="textbox"
    aria-multiline="true"
    aria-label="Prompt"
    contentEditable
    suppressContentEditableWarning
    spellCheck
    onFocus={()=>setFocused(true)}
    onBlur={()=>{setFocused(false);setMentionOpen(false);const editor=editorRef.current;if(editor)renderHighlighted(editorText(editor))}}
    onInput={syncInput}
    onClick={()=>{const editor=editorRef.current;if(editor)detectMention(editorText(editor),caretOffset(editor))}}
    onKeyUp={e=>{if(['Enter','Escape'].includes(e.key))return;const editor=editorRef.current;if(editor)detectMention(editorText(editor),caretOffset(editor))}}
    onKeyDown={e=>{if(!mentionOpen)return;if(e.key==='Escape'){e.preventDefault();setMentionOpen(false)}else if(e.key==='Enter'&&visibleReferences[0]){e.preventDefault();insertReference(visibleReferences[0])}}}
    onCompositionStart={()=>{composingRef.current=true}}
    onCompositionEnd={()=>{composingRef.current=false;syncInput()}}
    onPaste={e=>{e.preventDefault();const text=e.clipboardData.getData('text/plain');document.execCommand('insertText',false,text)}}
    className="relative z-10 w-full min-h-[120px] max-h-[260px] overflow-y-auto p-3 pb-10 bg-transparent border-0 text-[11px] font-medium leading-relaxed text-white caret-cyan-300 outline-none whitespace-pre-wrap break-words selection:bg-cyan-300/20"
   />
   <div className="absolute z-30 left-2.5 right-2.5 bottom-2 flex items-center justify-between gap-2 pointer-events-none">
    <div className="flex items-center gap-1.5 pointer-events-auto">
     {supportsReferences&&<button type="button" onClick={()=>onRequestAddMedia('ASSETS')} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3"/> Referência</button>}
     <button type="button" onClick={onOpenImproveModal} disabled={!prompt.trim()} className="h-7 px-2 rounded-lg border border-white/[0.07] bg-white/[0.035] hover:bg-white/[0.06] disabled:opacity-30 text-[8px] font-semibold text-zinc-400 hover:text-white flex items-center gap-1"><Sparkles className="w-3 h-3 text-cyan-300"/> Melhorar</button>
    </div>
    {supportsReferences&&<span className="text-[8px] text-zinc-700">@ para mencionar</span>}
   </div>

   {supportsReferences&&mentionOpen&&<div className="absolute z-[100] left-2 top-full mt-1.5 w-[330px] max-w-[calc(100%-16px)] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#171719] shadow-[0_24px_70px_rgba(0,0,0,.72)]">
    <div className="p-2 border-b border-white/[0.055]"><div className="h-9 px-2.5 rounded-xl bg-[#111214] border border-white/[0.06] flex items-center gap-2"><Search className="w-3.5 h-3.5 text-zinc-600"/><span className="text-[10px] flex-1 truncate text-zinc-500">{mentionQuery?'Buscar: '+mentionQuery:'Referências desta geração'}</span></div></div>
    <div className="max-h-48 overflow-y-auto p-1.5">
     {visibleReferences.map(ref=>{const asset=ref.asset,imageUrl=asset?.thumbnail_url||asset?.public_url;return <button key={ref.asset_id} type="button" onMouseDown={e=>{e.preventDefault();insertReference(ref)}} className="w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-white/[0.07]"><div className="w-10 h-10 rounded-lg bg-[#0b0e13] overflow-hidden shrink-0 flex items-center justify-center text-zinc-500 border border-white/[0.06]">{asset?.type==='IMAGE'&&imageUrl?<img src={imageUrl} className="w-full h-full object-cover" alt=""/>:mediaIcon(asset?.type)}</div><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-white truncate">{asset?.name||ref.alias_snapshot}</p><span className="text-[8px] font-mono font-bold text-cyan-300">@{ref.alias_snapshot}</span></div></button>})}
     {!visibleReferences.length&&<div className="px-3 py-4 text-center"><p className="text-[9px] text-zinc-600">Nenhuma referência anexada.</p></div>}
    </div>
    <div className="border-t border-white/[0.055] p-1.5">
     <p className="px-2 pt-1 pb-1.5 text-[7px] font-bold uppercase tracking-[0.16em] text-zinc-700">Abrir biblioteca completa</p>
     {[
      {label:'Mídia',icon:ImageIcon,section:'ASSETS' as LibrarySection},
      {label:'Personagens',icon:UserRound,section:'CHARACTERS' as LibrarySection},
      {label:'Produtos',icon:Package,section:'PRODUCTS' as LibrarySection},
      {label:'Estilos',icon:Palette,section:'STYLES' as LibrarySection},
     ].map(({label,icon:Icon,section})=><button key={section} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>openLibrary(section)} className="w-full h-9 px-2.5 rounded-xl flex items-center gap-2.5 text-left hover:bg-white/[0.07]"><div className="w-6 h-6 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] grid place-items-center text-cyan-200"><Icon className="w-3.5 h-3.5"/></div><span className="text-[9px] font-semibold text-zinc-200">{label}</span></button>)}
    </div>
   </div>}
  </div>
  {supportsNegativePrompt&&<div><button type="button" onClick={()=>setShowNegative(v=>!v)} className="text-[9px] text-zinc-600 hover:text-zinc-300 flex items-center gap-1 py-0.5">{showNegative?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>} Negative prompt</button>{showNegative&&<textarea value={negativePrompt} onChange={e=>onChangeNegativePrompt(e.target.value)} placeholder="Elementos que devem ser evitados..." rows={2} className="mt-1.5 w-full rounded-xl border border-white/[0.07] bg-[#0a0d12] p-2.5 text-[10px] text-white placeholder:text-zinc-600 outline-none resize-none"/>}</div>}
 </div>;
};
