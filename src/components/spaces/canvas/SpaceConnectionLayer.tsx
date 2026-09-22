import React from'react';
import type{FlowEdge,FlowNode}from'../../../beta/flowClient.js';
import type{FlowNodeRunView}from'../../../beta/flowRuntimeClient.js';
import{SPACE_BASE_NODE_H,SPACE_WORLD_H,SPACE_WORLD_W,spaceConnectionPath}from'./spaceLayout.js';

interface Props{nodes:FlowNode[];edges:FlowEdge[];nodeHeights:Record<string,number>;nodeRuns?:FlowNodeRunView[];}

export const SpaceConnectionLayer:React.FC<Props>=({nodes,edges,nodeHeights,nodeRuns=[]})=>{const runMap=new Map(nodeRuns.map(run=>[run.node_id,run]));return <svg className="pointer-events-none absolute inset-0 overflow-visible" width={SPACE_WORLD_W} height={SPACE_WORLD_H}>
 {edges.map(edge=>{const a=nodes.find(n=>n.node_id===edge.from_node_id),b=nodes.find(n=>n.node_id===edge.to_node_id);if(!a||!b)return null;const source=runMap.get(edge.from_node_id),target=runMap.get(edge.to_node_id),failed=source?.status==='FAILED'||target?.status==='FAILED',active=source?.status==='SUCCEEDED'&&target?.status==='RUNNING',done=source?.status==='SUCCEEDED'&&target?.status==='SUCCEEDED';const stroke=failed?'rgba(251,113,133,.65)':active?'rgba(103,232,249,.88)':done?'rgba(110,231,183,.46)':'rgba(103,232,249,.28)',width=active?2.2:done?1.7:1.35;return <path key={edge.edge_id} d={spaceConnectionPath(a,b,nodeHeights[a.node_id]||SPACE_BASE_NODE_H,nodeHeights[b.node_id]||SPACE_BASE_NODE_H)} fill="none" stroke={stroke} strokeWidth={width} className={active?'animate-pulse':''}/>;})}
</svg>;};

export default SpaceConnectionLayer;
