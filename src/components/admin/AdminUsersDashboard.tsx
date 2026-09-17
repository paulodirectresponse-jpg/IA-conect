import React,{useEffect,useMemo,useState}from'react';
import{CreditCard,Tag,Users,WalletCards}from'lucide-react';
import{adminService,CouponAdminEntry}from'../../services/adminService.js';

export const AdminUsersDashboard:React.FC=()=>{
 const[stats,setStats]=useState<any>(null),[coupons,setCoupons]=useState<CouponAdminEntry[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{Promise.all([adminService.getDashboardStats(),adminService.listCoupons()]).then(([s,c])=>{setStats(s);setCoupons(c)}).catch(console.error).finally(()=>setLoading(false))},[]);
 const activeCoupons=coupons.filter(c=>c.active).length;
 const redemptions=useMemo(()=>coupons.reduce((n,c)=>n+Number(c.usage?.redeemed||0),0),[coupons]);
 const activePct=stats?.total_users?Math.max(0,Math.min(100,(Number(stats.active_users||0)/Number(stats.total_users))*100)):0;
 return <div className="space-y-4">
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Users className="w-4 h-4"/>Usuários</div><div className="mt-2 text-xl font-black text-white">{loading?'—':Number(stats?.total_users||0).toLocaleString('pt-BR')}</div><p className="text-[10px] text-zinc-500 mt-1">{Number(stats?.active_users||0).toLocaleString('pt-BR')} ativos</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><WalletCards className="w-4 h-4"/>Créditos em contas</div><div className="mt-2 text-xl font-black text-white">{loading?'—':Number(stats?.total_platform_credits||0).toLocaleString('pt-BR')}</div><p className="text-[10px] text-zinc-500 mt-1">disponíveis + reservados</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Tag className="w-4 h-4"/>Cupons ativos</div><div className="mt-2 text-xl font-black text-white">{loading?'—':activeCoupons}</div><p className="text-[10px] text-zinc-500 mt-1">de {coupons.length} cadastrados</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><CreditCard className="w-4 h-4"/>Resgates</div><div className="mt-2 text-xl font-black text-white">{loading?'—':redemptions.toLocaleString('pt-BR')}</div><p className="text-[10px] text-zinc-500 mt-1">cupons resgatados</p></div></div>
  <section className="ia-admin-panel"><div className="flex items-center justify-between text-[10px]"><div><h3 className="text-xs font-bold text-white">Atividade da base</h3><p className="text-zinc-600 mt-1">Proporção de usuários atualmente ativos.</p></div><strong className="text-sky-200">{activePct.toFixed(1)}%</strong></div><div className="mt-4 h-3 rounded-full bg-white/[0.05] overflow-hidden"><div className="h-full rounded-full bg-sky-400/70" style={{width:`${activePct}%`}}/></div></section>
 </div>;
};
