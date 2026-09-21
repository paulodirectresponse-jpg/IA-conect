import React from'react';
import type{FlowEdge,FlowNode}from'../../../beta/flowClient.js';
import{SPACE_BASE_NODE_H,SPACE_WORLD_H,SPACE_WORLD_W,spaceConnectionPath}from'./spaceLayout.js';

interface Props{nodes:FlowNode[];edges:FlowEdge[];nodeHeights:Record<string,number>;}

export const SpaceConnectionLayer:React.FC<Props>=({nodes,edges,nodeHeights})=><svg className="pointer-events-none absolute inset-0 overflow-visible" width={SPACE_WORLD_W} height={SPACE_WORLD_H}>
 {edges.map(edge=>{const a=nodes.find(n=>n.node_id===edge.from_node_id),b=nodes.find(n=>n.node_id===edge.to_node_id);if(!a||!b)return null;return <path key={edge.edge_id} d={spaceConnectionPath(a,b,nodeHeights[a.node_id]||SPACE_BASE_NODE_H,nodeHeights[b.node_id]||SPACE_BASE_NODE_H)} fill="none" stroke="rgba(103,232,249,.34)" strokeWidth={1.4}/>;})}
</svg>;

export default SpaceConnectionLayer;
