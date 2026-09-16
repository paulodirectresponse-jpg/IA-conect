import React,{useEffect,useRef,useState}from'react';
import{useReducedMotion}from'motion/react';

interface ViewportVideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>,'src'|'autoPlay'|'preload'>{
  src:string;
  eager?:boolean;
  rootMargin?:string;
  playWhenVisible?:boolean;
  deferUntilWindowLoad?:boolean;
}

export const ViewportVideo:React.FC<ViewportVideoProps>=({
  src,
  eager=false,
  rootMargin='240px 0px',
  playWhenVisible=true,
  deferUntilWindowLoad=false,
  muted=true,
  loop=true,
  playsInline=true,
  ...props
})=>{
  const ref=useRef<HTMLVideoElement|null>(null);
  const reduceMotion=useReducedMotion();
  const[nearViewport,setNearViewport]=useState(eager);
  const[visible,setVisible]=useState(eager);
  const[loadReady,setLoadReady]=useState(!deferUntilWindowLoad);

  useEffect(()=>{
    if(!deferUntilWindowLoad){setLoadReady(true);return;}
    let idleId:any=null,timer:number|undefined;
    const start=()=>{
      const idle=(window as any).requestIdleCallback;
      if(typeof idle==='function')idleId=idle(()=>setLoadReady(true),{timeout:1800});
      else timer=window.setTimeout(()=>setLoadReady(true),600);
    };
    if(document.readyState==='complete')start();
    else window.addEventListener('load',start,{once:true});
    return()=>{
      window.removeEventListener('load',start);
      if(idleId!=null&&(window as any).cancelIdleCallback)(window as any).cancelIdleCallback(idleId);
      if(timer)window.clearTimeout(timer);
    };
  },[deferUntilWindowLoad]);

  useEffect(()=>{
    const node=ref.current;
    if(!node)return;
    if(typeof IntersectionObserver==='undefined'){
      setNearViewport(true);
      setVisible(true);
      return;
    }
    const observer=new IntersectionObserver((entries)=>{
      const entry=entries[0];
      if(!entry)return;
      if(entry.isIntersecting)setNearViewport(true);
      setVisible(entry.isIntersecting);
    },{root:null,rootMargin,threshold:0.05});
    observer.observe(node);
    return()=>observer.disconnect();
  },[rootMargin]);

  useEffect(()=>{
    const video=ref.current;
    if(!video)return;
    const sync=()=>{
      const shouldPlay=playWhenVisible&&visible&&!reduceMotion&&!document.hidden;
      if(shouldPlay)void video.play().catch(()=>{});
      else video.pause();
    };
    sync();
    document.addEventListener('visibilitychange',sync);
    video.addEventListener('canplay',sync);
    return()=>{
      document.removeEventListener('visibilitychange',sync);
      video.removeEventListener('canplay',sync);
      video.pause();
    };
  },[visible,reduceMotion,playWhenVisible,src]);

  return <video
    {...props}
    ref={ref}
    src={nearViewport&&loadReady?src:undefined}
    muted={muted}
    loop={loop}
    playsInline={playsInline}
    preload={nearViewport&&loadReady?'metadata':'none'}
  />;
};
