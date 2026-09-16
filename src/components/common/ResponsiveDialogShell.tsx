import React,{useEffect,useRef}from'react';
import{createPortal}from'react-dom';

interface ResponsiveDialogShellProps{
  open:boolean;
  onClose:()=>void;
  children:React.ReactNode;
  ariaLabel?:string;
  ariaLabelledBy?:string;
  className?:string;
  backdropClassName?:string;
  mobileMode?:'sheet'|'fullscreen';
  desktopMaxWidth?:number;
  closeOnBackdrop?:boolean;
}

export const ResponsiveDialogShell:React.FC<ResponsiveDialogShellProps>=({
  open,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  className='',
  backdropClassName='',
  mobileMode='sheet',
  desktopMaxWidth=760,
  closeOnBackdrop=true,
})=>{
  const surfaceRef=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    if(!open)return;
    document.documentElement.classList.add('ia-dialog-open');
    const previous=document.activeElement as HTMLElement|null;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown',onKeyDown);
    window.requestAnimationFrame(()=>surfaceRef.current?.focus());
    return()=>{
      document.removeEventListener('keydown',onKeyDown);
      document.documentElement.classList.remove('ia-dialog-open');
      previous?.focus?.();
    };
  },[open,onClose]);

  if(!open||typeof document==='undefined')return null;

  return createPortal(
    <div
      className={`ia-responsive-dialog-backdrop ${backdropClassName}`}
      onMouseDown={(event)=>{if(closeOnBackdrop&&event.target===event.currentTarget)onClose();}}
    >
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        data-mobile-mode={mobileMode}
        className={`ia-responsive-dialog-surface ${className}`}
        style={{'--ia-dialog-desktop-max':`${desktopMaxWidth}px`} as React.CSSProperties}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};
