import React,{useEffect,useRef,useState}from'react';
import{Box,LoaderCircle,RotateCw}from'lucide-react';

interface PrimitiveData{positions:Float32Array;indices?:Uint16Array|Uint32Array;}

function accessorComponents(type:string){return type==='SCALAR'?1:type==='VEC2'?2:type==='VEC3'?3:type==='VEC4'?4:3;}
function componentBytes(type:number){return type===5126||type===5125?4:type===5123||type===5122?2:1;}

function parseGlb(buffer:ArrayBuffer):PrimitiveData[]{
 const view=new DataView(buffer);
 if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67)throw new Error('Arquivo GLB inválido.');
 let offset=12,json:any=null,bin:ArrayBuffer|null=null;
 while(offset+8<=view.byteLength){
  const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
  const chunk=buffer.slice(offset,offset+length);offset+=length;
  if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk).replace(/\0+$/,''));
  if(type===0x004e4942)bin=chunk;
 }
 if(!json||!bin)throw new Error('GLB sem geometria legível.');
 const out:PrimitiveData[]=[];
 const readAccessor=(index:number)=>{
  const accessor=json.accessors?.[index],bufferView=json.bufferViews?.[accessor?.bufferView];
  if(!accessor||!bufferView)throw new Error('Accessor 3D inválido.');
  const comps=accessorComponents(accessor.type),bytes=componentBytes(accessor.componentType);
  const start=(bufferView.byteOffset||0)+(accessor.byteOffset||0),stride=bufferView.byteStride||comps*bytes;
  return{accessor,comps,bytes,start,stride};
 };
 for(const mesh of json.meshes||[]){
  for(const primitive of mesh.primitives||[]){
   const positionIndex=primitive.attributes?.POSITION;
   if(positionIndex===undefined)continue;
   const p=readAccessor(positionIndex);
   if(p.accessor.componentType!==5126||p.comps<3)continue;
   const positions=new Float32Array(p.accessor.count*3),dv=new DataView(bin);
   for(let i=0;i<p.accessor.count;i++)for(let j=0;j<3;j++)positions[i*3+j]=dv.getFloat32(p.start+i*p.stride+j*4,true);
   let indices:Uint16Array|Uint32Array|undefined;
   if(primitive.indices!==undefined){
    const ix=readAccessor(primitive.indices),idv=new DataView(bin);
    if(ix.accessor.componentType===5123){indices=new Uint16Array(ix.accessor.count);for(let i=0;i<ix.accessor.count;i++)indices[i]=idv.getUint16(ix.start+i*ix.stride,true);}
    if(ix.accessor.componentType===5125){indices=new Uint32Array(ix.accessor.count);for(let i=0;i<ix.accessor.count;i++)indices[i]=idv.getUint32(ix.start+i*ix.stride,true);}
   }
   out.push({positions,indices});
  }
 }
 if(!out.length)throw new Error('Nenhuma malha compatível encontrada no GLB.');
 return out;
}

function compile(gl:WebGLRenderingContext,type:number,source:string){
 const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)||'Shader inválido.');
 return shader;
}

export const Model3DPreview:React.FC<{url:string;label?:string;compact?:boolean}>=({url,label='Modelo 3D',compact=false})=>{
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const[status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const[message,setMessage]=useState('Carregando modelo 3D…');
 useEffect(()=>{
  const canvas=canvasRef.current;if(!canvas)return;
  let disposed=false,raf=0,cleanup=()=>{};
  setStatus('loading');setMessage('Carregando modelo 3D…');
  (async()=>{
   try{
    const response=await fetch(url);if(!response.ok)throw new Error('Não foi possível carregar o modelo.');
    const meshes=parseGlb(await response.arrayBuffer());if(disposed)return;
    const gl=canvas.getContext('webgl',{antialias:true,alpha:true});if(!gl)throw new Error('WebGL não está disponível neste navegador.');const uintIndices=gl.getExtension('OES_element_index_uint');
    const vertex=compile(gl,gl.VERTEX_SHADER,`
      attribute vec3 a_position;uniform float u_angle;uniform vec3 u_center;uniform float u_scale;
      varying float v_depth;
      void main(){vec3 p=(a_position-u_center)*u_scale;float c=cos(u_angle),s=sin(u_angle);vec3 r=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);r.y=r.y*0.92-r.z*0.16;v_depth=r.z;gl_Position=vec4(r.x,r.y,r.z*0.18,1.0);}
    `);
    const fragment=compile(gl,gl.FRAGMENT_SHADER,`
      precision mediump float;varying float v_depth;
      void main(){float shade=clamp(.68+v_depth*.18,.38,.96);gl_FragColor=vec4(.28*shade,.78*shade,1.0*shade,1.0);}
    `);
    const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Falha ao inicializar o viewer.');
    const posLoc=gl.getAttribLocation(program,'a_position'),angleLoc=gl.getUniformLocation(program,'u_angle'),centerLoc=gl.getUniformLocation(program,'u_center'),scaleLoc=gl.getUniformLocation(program,'u_scale');
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(const mesh of meshes)for(let i=0;i<mesh.positions.length;i+=3)for(let j=0;j<3;j++){const v=mesh.positions[i+j];min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);}
    const center=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2],span=Math.max(max[0]-min[0],max[1]-min[1],max[2]-min[2])||1,scale=1.55/span;
    const gpu=meshes.map(mesh=>{const vb=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,mesh.positions,gl.STATIC_DRAW);let ib:WebGLBuffer|null=null;if(mesh.indices){if(mesh.indices instanceof Uint32Array&&!uintIndices)throw new Error('Este navegador não suporta índices 3D de 32 bits.');ib=gl.createBuffer()!;gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);}return{...mesh,vb,ib};});
    const resize=()=>{const dpr=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}gl.viewport(0,0,canvas.width,canvas.height);};
    const started=performance.now();
    const draw=(time:number)=>{if(disposed)return;resize();gl.clearColor(.015,.027,.043,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.useProgram(program);gl.uniform1f(angleLoc,(time-started)/6500);gl.uniform3f(centerLoc,center[0],center[1],center[2]);gl.uniform1f(scaleLoc,scale);for(const mesh of gpu){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.enableVertexAttribArray(posLoc);gl.vertexAttribPointer(posLoc,3,gl.FLOAT,false,0,0);if(mesh.indices&&mesh.ib){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ib);gl.drawElements(gl.TRIANGLES,mesh.indices.length,mesh.indices instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0);}else gl.drawArrays(gl.TRIANGLES,0,mesh.positions.length/3);}raf=requestAnimationFrame(draw);};
    setStatus('ready');raf=requestAnimationFrame(draw);
    cleanup=()=>{cancelAnimationFrame(raf);for(const mesh of gpu){gl.deleteBuffer(mesh.vb);if(mesh.ib)gl.deleteBuffer(mesh.ib);}gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);};
   }catch(error:any){if(!disposed){setStatus('error');setMessage(error?.message||'Não foi possível visualizar este GLB.');}}
  })();
  return()=>{disposed=true;cancelAnimationFrame(raf);cleanup();};
 },[url]);

 return <div className={compact?'ia-beta-3d-preview is-compact':'ia-beta-3d-preview'}>
  <canvas ref={canvasRef} aria-label={label}/>
  {status!=='ready'&&<div className="ia-beta-3d-preview-state">{status==='loading'?<LoaderCircle className="is-spin"/>:<Box/>}<span>{message}</span></div>}
  {status==='ready'&&<div className="ia-beta-3d-preview-hint"><RotateCw/>Rotação automática</div>}
 </div>;
};
