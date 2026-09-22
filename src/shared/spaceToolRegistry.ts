export type SpaceToolGroup='POPULAR'|'TRANSFORMAR'|'VÍDEO';
export type SpaceToolIcon='IMAGE'|'VIDEO'|'WAND'|'AUDIO'|'MODEL_3D';

export interface SpaceToolDefinition{
 id:string;
 capability:string;
 label:string;
 description:string;
 group:SpaceToolGroup;
 accepts:string[];
 icon:SpaceToolIcon;
 root:boolean;
 contextual:boolean;
 rootOrder?:number;
}

export const SPACE_TOOL_REGISTRY=[
 {id:'text-to-image',capability:'text-to-image',label:'Gerar imagem',description:'Comece com um prompt de imagem.',group:'POPULAR',accepts:[],icon:'IMAGE',root:true,contextual:false,rootOrder:1},
 {id:'text-to-video',capability:'text-to-video',label:'Gerar vídeo',description:'Comece com um prompt de vídeo.',group:'POPULAR',accepts:[],icon:'VIDEO',root:true,contextual:false,rootOrder:2},
 {id:'image-edit',capability:'image-edit',label:'Editar imagem',description:'Transforme uma imagem preservando-a como referência.',group:'TRANSFORMAR',accepts:['IMAGE'],icon:'WAND',root:true,contextual:true,rootOrder:3},
 {id:'video-edit',capability:'video-edit',label:'Editar vídeo',description:'Transforme um vídeo com IA.',group:'VÍDEO',accepts:['VIDEO'],icon:'WAND',root:true,contextual:true,rootOrder:4},
 {id:'video-extend',capability:'video-extend',label:'Estender vídeo',description:'Continue um vídeo preservando a sequência.',group:'VÍDEO',accepts:['VIDEO'],icon:'VIDEO',root:true,contextual:true,rootOrder:5},
 {id:'image-to-image',capability:'image-to-image',label:'Gerar outra imagem',description:'Use esta imagem como referência para uma nova criação.',group:'POPULAR',accepts:['IMAGE'],icon:'IMAGE',root:false,contextual:true},
 {id:'image-to-video',capability:'image-to-video',label:'Gerar vídeo',description:'Anime esta imagem e continue o fluxo em vídeo.',group:'POPULAR',accepts:['IMAGE'],icon:'VIDEO',root:false,contextual:true},
 {id:'background-remove-replace',capability:'background-remove-replace',label:'Remover ou trocar fundo',description:'Isole o assunto ou crie um novo fundo.',group:'TRANSFORMAR',accepts:['IMAGE'],icon:'WAND',root:false,contextual:true},
 {id:'upscale',capability:'upscale',label:'Melhorar resolução',description:'Aumente definição e qualidade da imagem.',group:'TRANSFORMAR',accepts:['IMAGE'],icon:'WAND',root:false,contextual:true},
 {id:'outpaint',capability:'outpaint',label:'Expandir imagem',description:'Expanda a cena para além das bordas atuais.',group:'TRANSFORMAR',accepts:['IMAGE'],icon:'IMAGE',root:false,contextual:true},
 {id:'variations',capability:'variations',label:'Criar variações',description:'Gere novas versões preservando a referência.',group:'TRANSFORMAR',accepts:['IMAGE'],icon:'IMAGE',root:false,contextual:true},
 {id:'inpaint-mask',capability:'inpaint-mask',label:'Editar com máscara',description:'Edite uma região específica usando uma máscara.',group:'TRANSFORMAR',accepts:['IMAGE','MASK'],icon:'WAND',root:false,contextual:false},
 {id:'first-frame',capability:'first-frame',label:'Vídeo com quadro inicial',description:'Use uma imagem como quadro inicial do vídeo.',group:'VÍDEO',accepts:['IMAGE'],icon:'VIDEO',root:false,contextual:false},
 {id:'last-frame',capability:'last-frame',label:'Vídeo entre quadros',description:'Defina quadros inicial e final para orientar o vídeo.',group:'VÍDEO',accepts:['IMAGE'],icon:'VIDEO',root:false,contextual:false},
 {id:'text-to-speech',capability:'text-to-speech',label:'Gerar voz',description:'Transforme texto em áudio falado.',group:'POPULAR',accepts:['TEXT'],icon:'AUDIO',root:false,contextual:false},
 {id:'music',capability:'music',label:'Gerar música',description:'Crie áudio musical a partir de instruções.',group:'POPULAR',accepts:['TEXT'],icon:'AUDIO',root:false,contextual:false},
 {id:'text-to-3d',capability:'text-to-3d',label:'Gerar 3D',description:'Crie um modelo 3D a partir de texto.',group:'POPULAR',accepts:['TEXT'],icon:'MODEL_3D',root:false,contextual:false},
 {id:'image-to-3d',capability:'image-to-3d',label:'Imagem para 3D',description:'Transforme uma imagem em modelo 3D.',group:'TRANSFORMAR',accepts:['IMAGE'],icon:'MODEL_3D',root:false,contextual:false},
 {id:'multi-image-to-3d',capability:'multi-image-to-3d',label:'Imagens para 3D',description:'Use múltiplas referências para criar um modelo 3D.',group:'TRANSFORMAR',accepts:['IMAGE'],icon:'MODEL_3D',root:false,contextual:false},
] as const satisfies readonly SpaceToolDefinition[];

export const SPACE_CAPABILITY_IDS=SPACE_TOOL_REGISTRY.map(tool=>tool.capability);

export function spaceRootTools(){
 return SPACE_TOOL_REGISTRY.filter(tool=>tool.root).slice().sort((a,b)=>(('rootOrder'in a?a.rootOrder:99))-(('rootOrder'in b?b.rootOrder:99)));
}

export function spaceToolsForOutputTypes(types:readonly string[]){
 return SPACE_TOOL_REGISTRY.filter(tool=>tool.contextual&&tool.accepts.some(type=>types.includes(type)));
}

export function spaceToolByCapability(capability:string){
 return SPACE_TOOL_REGISTRY.find(tool=>tool.capability===capability)||null;
}

export function spaceToolLabel(capability:string){
 return spaceToolByCapability(capability)?.label||capability;
}
