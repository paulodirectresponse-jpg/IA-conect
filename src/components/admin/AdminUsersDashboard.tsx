import React,{useEffect,useMemo,useState}from'react';
import{CreditCard,Tag,Users,WalletCards}from'lucide-react';
import{adminService,CouponAdminEntry}from'../../services/adminService.js';
import{AdminDonutChart,AdminRankedBars}from'./AdminVisualCharts.js';

export const AdminUsersDashboard:React.FC=()=>{
 const[stats,setStats]=useState<any>(null),[coupons,setCoupons]=useState<CouponAdminEntry[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{Promise.all([adminService.getDashboardStats(),adminService.listCoupons()]).then(([s,c])=>{setStats(s);setCoupons(c)}).catch(console.error).finally(()=>setLoading(false))},[]);
 const activeCoupons=coupons.filter(c=>c.active).length;
 const redemptions=useMemo(()=>coupons.reduce((n,c)=>n+Number(c.usage?.redeemed||0),0),[coupons]);
 const activeUsers=Number(stats?.active_users||0),totalUsers=Number(stats?.total_users||0),inactiveUsers=Math.max(0,totalUsers-activeUsers);
 const couponRanking=useMemo(()=>coupons.slice().sort((a,b)=>Number(b.usage?.redeemed||0)-Number(a.usage?.redeemed||0)).slice(0,8),[coupons]);
 return <div className="space-y-4">
  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3"><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Users className="w-4 h-4"/>Usuários</div><div className="mt-2 text-xl font-black text-white">{loading?'—':totalUsers.toLocaleString('pt-BR')}</div><p className="text-[10px] text-zinc-500 mt-1">{activeUsers.toLocaleString('pt-BR')} ativos</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><WalletCards className="w-4 h-4"/>Créditos em contas</div><div className="mt-2 text-xl font-black text-white">{loading?'—':Number(stats?.total_platform_credits||0).toLocaleString('pt-BR')}</div><p className="text-[10px] text-zinc-500 mt-1">disponíveis + reservados</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><Tag className="w-4 h-4"/>Cupons ativos</div><div className="mt-2 text-xl font-black text-white">{loading?'—':activeCoupons}</div><p className="text-[10px] text-zinc-500 mt-1">de {coupons.length} cadastrados</p></div><div className="ia-admin-panel"><div className="flex items-center gap-2 text-[9px] text-zinc-600"><CreditCard className="w-4 h-4"/>Resgates</div><div className="mt-2 text-xl font-black text-white">{loading?'—':redemptions.toLocaleString('pt-BR')}</div><p className="text-[10px] text-zinc-500 mt-1">cupons resgatados</p></div></div>
  <div className="grid xl:grid-cols-2 gap-4">
   <AdminDonutChart title="Atividade da base" subtitle="Usuários ativos versus demais contas." center={`${totalUsers?((activeUsers/totalUsers)*100).toFixed(0):0}%`} segments={[{label:'Ativos',value:activeUsers,color:'#38bdf8'},{label:'Demais contas',value:inactiveUsers,color:'#52525b'}]}/>
   <AdminDonutChart title="Estado dos cupons" subtitle="Disponibilidade comercial atual." center={`${activeCoupons}/${coupons.length}`} segments={[{label:'Ativos',value:activeCoupons,color:'#34d399'},{label:'Inativos',value:Math.max(0,coupons.length-activeCoupons),color:'#71717a'}]}/>
  </div>
  <AdminRankedBars title="Cupons com mais resgates" subtitle="Ajuda a enxergar rapidamente quais ações estão realmente sendo usadas." rows={couponRanking.map((coupon,index)=>({label:coupon.name||coupon.code,value:Number(coupon.usage?.redeemed||0),detail:coupon.active?'ativo':'inativo',color:coupon.active?['#38bdf8','#a78bfa','#34d399'][index%3]:'#71717a'}))}/>
 </div>;
};
