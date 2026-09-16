import React,{useEffect,useRef,useState}from'react';
import{useReducedMotion}from'motion/react';

interface ViewportVideoProps extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>,'src'|'autoPlay'|'preload'>{
  src:string;
  eager?:boolean;
  rootMargin?:string;
  playWhenVisible?:boolean;
}

export const ViewportVideo:React.FC<ViewportVideoProps>=({
  src,
  eager=false,
  rootMargin='240px 0px',
  playWhenVisible=true,
  muted=true,
  loop=true,
  playsInline=true,
  ...props
})=>{
  const ref=useRef<HTMLVideoElement|null>(null);
  const reduceMotion=useReducedMotion();
  const[nearViewport,setNearViewport]=useState(eager);
  const[visible,setVisible]=useState(eager);

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
    src={nearViewport?src:undefined}
    muted={muted}
    loop={loop}
    playsInline={playsInline}
    preload={nearViewport?'metadata':'none'}
  />;
};
