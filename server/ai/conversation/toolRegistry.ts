import{CAPABILITY_IDS,getCapabilityDefinition,type CapabilityId}from'../../beta/capabilityRegistry.js';
import{routingV2CatalogService}from'../../routing-v2/catalogService.js';

const LABELS:Record<string,string>={
 'text-to-image':'Gerar imagem','image-to-image':'Gerar outra imagem','image-edit':'Editar imagem','inpaint-mask':'Editar com máscara','background-remove-replace':'Remover ou trocar fundo','outpaint':'Expandir imagem','upscale':'Melhorar resolução','variations':'Criar variações',
 'text-to-video':'Gerar vídeo','image-to-video':'Imagem para vídeo','first-frame':'Vídeo com quadro inicial','last-frame':'Vídeo entre quadros','video-extend':'Estender vídeo','video-edit':'Editar vídeo',
 'text-to-speech':'Gerar voz','sound-effects':'Gerar efeitos sonoros','music':'Gerar música','transcription':'Transcrever áudio','subtitles':'Gerar legendas','authorized-voice-clone':'Clonar voz autorizada','dubbing':'Dublar mídia',
 'text-to-3d':'Gerar 3D','image-to-3d':'Imagem para 3D','multi-image-to-3d':'Imagens para 3D','texture-3d':'Texturizar 3D',
};

export const aiConversationToolRegistry={
 all(){return CAPABILITY_IDS.map(id=>{const def=getCapabilityDefinition(id)!;return{id,label:LABELS[id]||id,inputs:def.inputs,outputs:def.outputs,controls:def.controls};});},
 get(id:string){if(!CAPABILITY_IDS.includes(id as CapabilityId))return null;const def=getCapabilityDefinition(id)!;return{id:id as CapabilityId,label:LABELS[id]||id,inputs:def.inputs,outputs:def.outputs,controls:def.controls};},
 async availability(id:string){
  const tool=this.get(id);if(!tool)return{tool:null,available:false,models:[],reason:'Capability desconhecida.'};
  const rows=await routingV2CatalogService.listCapabilityModels([tool.id]);
  const models=rows.filter(model=>model.capabilities.some(cap=>cap.id===tool.id));
  return{tool,available:models.length>0,models,reason:models.length?'':'Nenhum modelo com Route READY está disponível para esta capability.'};
 },
 manifest(){return this.all().map(tool=>({id:tool.id,label:tool.label,inputs:tool.inputs,outputs:tool.outputs,controls:tool.controls}));},
};
