import React from 'react';

type Size='xs'|'sm'|'md'|'lg';
const sizeMap:Record<Size,{coin:string;text:string,gap:string}>={
  xs:{coin:'h-3 w-3',text:'text-[9px]',gap:'gap-1'},
  sm:{coin:'h-3.5 w-3.5',text:'text-[10px]',gap:'gap-1'},
  md:{coin:'h-4 w-4',text:'text-[12px]',gap:'gap-1.5'},
  lg:{coin:'h-5 w-5',text:'text-[18px]',gap:'gap-2'},
};

export const CreditCoin:React.FC<{size?:Size;className?:string}>=({size='sm',className=''})=>{
  const s=sizeMap[size];
  return <span aria-hidden="true" className={`relative inline-grid shrink-0 place-items-center rounded-full border border-sky-200/35 bg-gradient-to-br from-cyan-300 via-sky-400 to-blue-600 shadow-[0_0_10px_rgba(56,189,248,.28)] ${s.coin} ${className}`}>
    <span className="absolute inset-[2px] rounded-full border border-white/25 bg-gradient-to-br from-white/18 to-transparent"/>
    <span className="relative block h-[28%] w-[28%] rotate-45 rounded-[1px] bg-white/90 shadow-[0_0_4px_rgba(255,255,255,.65)]"/>
  </span>;
};

export const CreditAmount:React.FC<{
  value:number|null|undefined;
  size?:Size;
  className?:string;
  valueClassName?:string;
  prefix?:string;
  suffix?:React.ReactNode;
  showCoin?:boolean;
}>=({value,size='sm',className='',valueClassName='',prefix='',suffix,showCoin=true})=>{
  const normalized=Math.max(0,Number(value||0));
  const s=sizeMap[size];
  return <span className={`inline-flex items-center whitespace-nowrap tabular-nums ${s.gap} ${s.text} ${className}`} aria-label={`${prefix}${normalized.toLocaleString('pt-BR')} créditos`}>
    {prefix&&<span aria-hidden="true">{prefix}</span>}
    <span className={valueClassName}>{normalized.toLocaleString('pt-BR')}</span>
    {showCoin&&<CreditCoin size={size}/>}
    {suffix}
  </span>;
};

export const formatCreditNumber=(value:number|null|undefined)=>Math.max(0,Number(value||0)).toLocaleString('pt-BR');
