import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRootRouter } from './server/routes/index.js';

async function startServer(){
 const app=express();const PORT=Number(process.env.PORT||3000);app.use('/api',apiRootRouter);app.get('/health',(_req,res)=>res.json({status:'ok',service:'ia-conect',stage:'credits-v2'}));
 if(process.env.NODE_ENV!=='production'){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{const distPath=path.join(process.cwd(),'dist');app.use(express.static(distPath));app.get('*',(_req,res)=>res.sendFile(path.join(distPath,'index.html')));}app.listen(PORT,'0.0.0.0',()=>console.log(`[IA Connect] listening on 0.0.0.0:${PORT}`));
}
startServer().catch(err=>{console.error('Fatal server startup error:',err);process.exit(1);});
