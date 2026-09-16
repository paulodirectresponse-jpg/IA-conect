import React,{useState}from'react';
import{Images,Sparkles}from'lucide-react';

type MobileStudioPane='CREATE'|'RESULTS';

interface MobileStudioLayoutProps{
  creator:React.ReactNode;
  gallery:React.ReactNode;
  activeCount?:number;
  initialPane?:MobileStudioPane;
}

export const MobileStudioLayout:React.FC<MobileStudioLayoutProps>=({
  creator,
  gallery,
  activeCount=0,
  initialPane='CREATE',
})=>{
  const[pane,setPane]=useState<MobileStudioPane>(initialPane);
  return <div className="ia-generator-workspace ia-mobile-studio-layout flex h-full min-h-0">
    <div className="ia-mobile-studio-tabs" role="tablist" aria-label="Área do Studio">
      <button
        type="button"
        role="tab"
        aria-selected={pane==='CREATE'}
        aria-controls="ia-mobile-studio-create"
        onClick={()=>setPane('CREATE')}
        className={pane==='CREATE'?'is-active':''}
      >
        <Sparkles className="h-4 w-4"/>
        <span>Criar</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={pane==='RESULTS'}
        aria-controls="ia-mobile-studio-results"
        onClick={()=>setPane('RESULTS')}
        className={pane==='RESULTS'?'is-active':''}
      >
        <Images className="h-4 w-4"/>
        <span>Resultados</span>
        {activeCount>0&&<span className="ia-mobile-studio-count" aria-label={`${activeCount} gerações em andamento`}>{activeCount}</span>}
      </button>
    </div>

    <div
      id="ia-mobile-studio-create"
      role="tabpanel"
      aria-hidden={pane!=='CREATE'}
      data-mobile-pane="CREATE"
      data-active={pane==='CREATE'?'true':'false'}
      className="ia-mobile-studio-pane ia-mobile-studio-create"
    >
      {creator}
    </div>
    <div
      id="ia-mobile-studio-results"
      role="tabpanel"
      aria-hidden={pane!=='RESULTS'}
      data-mobile-pane="RESULTS"
      data-active={pane==='RESULTS'?'true':'false'}
      className="ia-mobile-studio-pane ia-mobile-studio-results"
    >
      {gallery}
    </div>
  </div>;
};
