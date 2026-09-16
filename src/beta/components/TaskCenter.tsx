import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Check, Clock3, LoaderCircle, RotateCcw, X, XCircle } from 'lucide-react';
import { ApiError } from '../../services/apiClient.js';
import { betaTaskClient, BetaTaskStatus, BetaTaskView } from '../taskClient.js';

const STATUS_LABEL:Record<BetaTaskStatus,string>={
  QUEUED:'Na fila',
  RUNNING:'Executando',
  COMPLETED:'Concluída',
  FAILED:'Falhou',
  CANCELLED:'Cancelada',
};

const capabilityLabel=(value:string)=>({
  'text-to-image':'Imagem',
  'image-to-image':'Imagem',
  'image-edit':'Edição de imagem',
  'text-to-video':'Vídeo',
  'image-to-video':'Vídeo',
  'first-frame':'Vídeo',
  'last-frame':'Vídeo',
}[value]||value||'Tarefa');

const statusIcon=(status:BetaTaskStatus)=>{
  if(status==='COMPLETED')return Check;
  if(status==='FAILED')return AlertTriangle;
  if(status==='CANCELLED')return XCircle;
  if(status==='RUNNING')return LoaderCircle;
  return Clock3;
};

const active=(task:BetaTaskView)=>task.status==='QUEUED'||task.status==='RUNNING';

export const TaskCenter:React.FC=()=>{
  const [open,setOpen]=useState(false);
  const [tasks,setTasks]=useState<BetaTaskView[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [actionKey,setActionKey]=useState<string|null>(null);

  const refresh=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true);
    try{
      const next=await betaTaskClient.list(30);
      setTasks(next);
      setError(null);
    }catch(err:any){
      const message=err instanceof ApiError?err.message:'Não foi possível atualizar as tarefas.';
      setError(message);
    }finally{
      if(!silent)setLoading(false);
    }
  },[]);

  useEffect(()=>{void refresh(false)},[refresh]);

  const hasActive=tasks.some(active);
  useEffect(()=>{
    const interval=window.setInterval(()=>{
      if(document.visibilityState==='visible')void refresh(true);
    },hasActive?5000:15000);
    return()=>window.clearInterval(interval);
  },[hasActive,refresh]);

  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[open]);

  const activeCount=useMemo(()=>tasks.filter(active).length,[tasks]);

  const runAction=async(task:BetaTaskView,verb:'retry'|'cancel')=>{
    const key=`${verb}:${task.task_id}`;
    setActionKey(key);
    try{
      const updated=verb==='retry'?await betaTaskClient.retry(task.task_id):await betaTaskClient.cancel(task.task_id);
      setTasks(current=>current.map(item=>item.task_id===updated.task_id?updated:item));
      setError(null);
      await refresh(true);
    }catch(err:any){
      setError(err instanceof ApiError?err.message:'Não foi possível concluir a ação.');
      await refresh(true);
    }finally{
      setActionKey(null);
    }
  };

  return <div className="ia-beta-task-center">
    <button
      type="button"
      className={`ia-beta-task-trigger${activeCount?' is-active':''}`}
      aria-expanded={open}
      aria-controls="ia-beta-task-panel"
      onClick={()=>setOpen(value=>!value)}
    >
      <Activity aria-hidden="true"/>
      <span className="ia-beta-task-trigger-label">Tarefas</span>
      {activeCount>0&&<span className="ia-beta-task-count" aria-label={`${activeCount} tarefas ativas`}>{activeCount}</span>}
    </button>

    {open&&<section id="ia-beta-task-panel" className="ia-beta-task-panel" aria-label="Central de tarefas">
      <div className="ia-beta-task-panel-head">
        <div>
          <span>Execuções</span>
          <h2>Central de tarefas</h2>
        </div>
        <button type="button" className="ia-beta-task-close" aria-label="Fechar central de tarefas" onClick={()=>setOpen(false)}><X aria-hidden="true"/></button>
      </div>

      {error&&<div className="ia-beta-task-fetch-error" role="status">
        <span>{error}</span>
        <button type="button" onClick={()=>void refresh(false)}>Atualizar</button>
      </div>}

      <div className="ia-beta-task-list" aria-live="polite">
        {loading&&tasks.length===0&&<div className="ia-beta-task-empty"><LoaderCircle className="is-spin" aria-hidden="true"/><span>Carregando tarefas…</span></div>}
        {!loading&&tasks.length===0&&<div className="ia-beta-task-empty"><Activity aria-hidden="true"/><span>Nenhuma execução recente.</span></div>}
        {tasks.map(task=>{
          const Icon=statusIcon(task.status);
          const retrying=actionKey===`retry:${task.task_id}`;
          const cancelling=actionKey===`cancel:${task.task_id}`;
          return <article className={`ia-beta-task-item status-${task.status.toLowerCase()}`} key={task.task_id}>
            <div className="ia-beta-task-status-icon"><Icon className={task.status==='RUNNING'?'is-spin':''} aria-hidden="true"/></div>
            <div className="ia-beta-task-copy">
              <div className="ia-beta-task-title-row">
                <strong>{capabilityLabel(task.capability_id)}</strong>
                <span>{STATUS_LABEL[task.status]}</span>
              </div>
              <p>{task.error?.message||`Tentativa ${Math.max(1,task.attempt_count)} · ${task.model_id}`}</p>
              {(task.can_retry||task.can_cancel)&&<div className="ia-beta-task-actions">
                {task.can_retry&&<button type="button" disabled={Boolean(actionKey)} onClick={()=>void runAction(task,'retry')}>
                  <RotateCcw aria-hidden="true"/>{retrying?'Tentando…':'Tentar novamente'}
                </button>}
                {task.can_cancel&&<button type="button" disabled={Boolean(actionKey)} onClick={()=>void runAction(task,'cancel')}>
                  <X aria-hidden="true"/>{cancelling?'Cancelando…':'Cancelar'}
                </button>}
              </div>}
            </div>
          </article>;
        })}
      </div>
    </section>}
  </div>;
};
