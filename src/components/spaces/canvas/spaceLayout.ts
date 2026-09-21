import type{FlowNode}from'../../../beta/flowClient.js';

export const SPACE_WORLD_W=8000;
export const SPACE_WORLD_H=5000;
export const SPACE_NODE_W=260;
export const SPACE_BASE_NODE_H=170;

export function spaceConnectionPath(a:FlowNode,b:FlowNode,aH:number,bH:number){
 const x1=a.x+SPACE_NODE_W,y1=a.y+aH/2,x2=b.x,y2=b.y+bH/2,c=Math.max(80,Math.abs(x2-x1)*.45);
 return`M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}`;
}
