import React,{useCallback,useEffect,useState}from'react';
import type{FlowRecord}from'../../beta/flowClient.js';
import{ApiError}from'../../services/apiClient.js';
import{spacesClient}from'../../services/spacesClient.js';
import{SpacesHome}from'../spaces/SpacesHome.js';
import{SpaceWorkspace}from'../spaces/SpaceWorkspace.js';

const errorText=(error:any)=>error instanceof ApiError?error.message:error?.message||'Não foi possível concluir esta operação.';

export const SpacesView:React.FC=()=>{
 const[flows,setFlows]=useState<FlowRecord[]>([]);
 const[current,setCurrent]=useState<FlowRecord|null>(null);
 const[loading,setLoading]=useState(true);
 const[creating,setCreating]=useState(false);
 const[error,setError]=useState('');

 const load=useCallback(async()=>{setLoading(true);setError('');try{setFlows(await spacesClient.list());}catch(e){setError(errorText(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);

 const create=async()=>{setCreating(true);setError('');try{const flow=await spacesClient.create({name:'Space sem título',description:'Workspace visual de criação.',project_id:null,graph:{nodes:[],edges:[]}});setFlows(rows=>[flow,...rows.filter(row=>row.flow_id!==flow.flow_id)]);setCurrent(flow);}catch(e){setError(errorText(e));}finally{setCreating(false);}};
 const open=async(flowId:string)=>{setError('');try{setCurrent(await spacesClient.get(flowId));}catch(e){setError(errorText(e));}};
 const updated=(flow:FlowRecord)=>{setCurrent(flow);setFlows(rows=>[flow,...rows.filter(row=>row.flow_id!==flow.flow_id)].sort((a,b)=>new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()));};
 const back=()=>{setCurrent(null);void load();};

 if(current)return <SpaceWorkspace flow={current} onBack={back} onUpdated={updated}/>;
 return <SpacesHome flows={flows} loading={loading} creating={creating} error={error} onCreate={()=>void create()} onOpen={id=>void open(id)}/>;
};

export default SpacesView;
