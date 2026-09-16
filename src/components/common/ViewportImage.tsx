import React,{useEffect,useRef,useState}from'react';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>,'src'>{
  src:string;
  eager?:boolean;
  rootMargin?:string;
}

export const ViewportImage:React.FC<Props>=({src,eager=false,rootMargin='80px 0px',...props})=>{
  const ref=useRef<HTMLImageElement|null>(null);
  const[ready,setReady]=useState(eager);
  useEffect(()=>{
    if(eager){setReady(true);return;}
    const node=ref.current;
    if(!node)return;
    if(typeof IntersectionObserver==='undefined'){setReady(true);return;}
    const observer=new IntersectionObserver((entries)=>{
      if(entries[0]?.isIntersecting){
        setReady(true);
        observer.disconnect();
      }
    },{root:null,rootMargin,threshold:0.01});
    observer.observe(node);
    return()=>observer.disconnect();
  },[eager,rootMargin]);
  return <img {...props} ref={ref} src={ready?src:undefined}/>;
};
