import type{BetaCapabilityMediaType}from'../../../beta/capabilityClient.js';
import type{FlowNode}from'../../../beta/flowClient.js';
import{SPACE_BASE_NODE_H,SPACE_WORLD_H,SPACE_WORLD_W,spaceNodeWidth}from'./spaceLayout.js';

export type SpaceActionGroup='POPULAR'|'TRANSFORMAR'|'VÍDEO';
export interface ContextualActionDefinition{
 id:string;label:string;capability:string;description:string;group:SpaceActionGroup;accepts:BetaCapabilityMediaType[];
}

export const CONTEXTUAL_ACTIONS:ContextualActionDefinition[]=[
 {id:'image-to-image',label:'Gerar outra imagem',capability:'image-to-image',description:'Use esta imagem como referência para uma nova criação.',group:'POPULAR',accepts:['IMAGE']},
 {id:'image-edit',label:'Editar imagem',capability:'image-edit',description:'Transforme a imagem preservando-a como origem.',group:'POPULAR',accepts:['IMAGE']},
 {id:'image-to-video',label:'Gerar vídeo',capability:'image-to-video',description:'Anime esta imagem e continue o fluxo em vídeo.',group:'POPULAR',accepts:['IMAGE']},
 {id:'video-edit',label:'Editar vídeo',capability:'video-edit',description:'Transforme este vídeo com IA.',group:'VÍDEO',accepts:['VIDEO']},
 {id:'video-extend',label:'Estender vídeo',capability:'video-extend',description:'Continue o vídeo preservando a sequência.',group:'VÍDEO',accepts:['VIDEO']},
];

export function contextualActionsFor(types:BetaCapabilityMediaType[]){
 return CONTEXTUAL_ACTIONS.filter(action=>action.accepts.some(type=>types.includes(type)));
}

function overlaps(x:number,y:number,w:number,h:number,node:FlowNode){
 const nw=spaceNodeWidth(node),nh=SPACE_BASE_NODE_H;
 return x<node.x+nw+36&&x+w+36>node.x&&y<node.y+nh+36&&y+h+36>node.y;
}

export function smartConnectedNodePosition(source:FlowNode,nodes:FlowNode[],preferred?:{x:number;y:number}){
 const width=340,height=SPACE_BASE_NODE_H;
 const startX=Math.max(source.x+spaceNodeWidth(source)+120,preferred?.x??0);
 const startY=preferred&&Math.abs(preferred.y-source.y)>220?preferred.y:source.y;
 const candidates=[0,220,-220,440,-440,660,-660];
 for(const dy of candidates){
  const x=Math.max(0,Math.min(SPACE_WORLD_W-width,startX));
  const y=Math.max(0,Math.min(SPACE_WORLD_H-height,startY+dy));
  if(!nodes.some(node=>node.node_id!==source.node_id&&overlaps(x,y,width,height,node)))return{x,y};
 }
 return{x:Math.max(0,Math.min(SPACE_WORLD_W-width,startX)),y:Math.max(0,Math.min(SPACE_WORLD_H-height,startY+880))};
}