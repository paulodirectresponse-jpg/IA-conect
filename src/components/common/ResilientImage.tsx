import React,{useMemo,useState}from'react';
import{ImageOff,RefreshCw}from'lucide-react';

interface Props{
  sources:Array<string|null|undefined>;
  alt:string;
  className?:string;
  loading?:'eager'|'lazy';
  showRetry?:boolean;
}

export const ResilientImage:React.FC<Props>=({sources,alt,className='',loading='lazy',showRetry=true})=>{
  const urls=useMemo(()=>Array.from(new Set(sources.map(v=>String(v||'').trim()).filter(v=>/^https:\/\//i.test(v)))),[sources]);
  const[index,setIndex]=useState(0);
  const[failed,setFailed]=useState(false);
  const retry=()=>{setIndex(0);setFailed(false);};
  if(!urls.length||failed){
    return <div className={`ia-media-unavailable ${className}`} role="img" aria-label={alt||'Imagem indisponível'}>
      <div className="ia-media-unavailable-inner">
        <ImageOff className="w-5 h-5"/>
        <span>Imagem indisponível</span>
        {showRetry&&urls.length>0&&<button type="button" onClick={retry}><RefreshCw className="w-3 h-3"/>Tentar novamente</button>}
      </div>
    </div>;
  }
  return <img
    key={urls[index]}
    src={urls[index]}
    alt={alt}
    loading={loading}
    decoding="async"
    referrerPolicy="no-referrer"
    className={className}
    onError={()=>{
      if(index+1<urls.length)setIndex(index+1);
      else setFailed(true);
    }}
  />;
};
