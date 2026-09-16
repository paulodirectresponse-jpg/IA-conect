import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';
import{assetService}from'./assetService.js';
import{ASSET_UPLOAD_LIMITS}from'../../src/config/constants.js';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('stage 8 final QA gates',()=>{
  it('accepts representative image uploads and the exact configured image limit',()=>{
    for(const mb of[5,10,25]){
      const result=assetService.validateUpload({mime_type:'image/png',size_bytes:mb*1024*1024,filename:'qa.png'});
      expect(result.type).toBe('IMAGE');
    }
    expect(()=>assetService.validateUpload({mime_type:'image/png',size_bytes:ASSET_UPLOAD_LIMITS.IMAGE.max_bytes+1,filename:'too-large.png'})).toThrow('25 MB');
  });

  it('keeps video and audio validation copy aligned with their real 50 MB limits',()=>{
    expect(assetService.validateUpload({mime_type:'video/mp4',size_bytes:ASSET_UPLOAD_LIMITS.VIDEO.max_bytes,filename:'qa.mp4'}).type).toBe('VIDEO');
    expect(assetService.validateUpload({mime_type:'audio/mpeg',size_bytes:ASSET_UPLOAD_LIMITS.AUDIO.max_bytes,filename:'qa.mp3'}).type).toBe('AUDIO');
    expect(()=>assetService.validateUpload({mime_type:'video/mp4',size_bytes:ASSET_UPLOAD_LIMITS.VIDEO.max_bytes+1,filename:'too-large.mp4'})).toThrow('50 MB');
    expect(()=>assetService.validateUpload({mime_type:'audio/mpeg',size_bytes:ASSET_UPLOAD_LIMITS.AUDIO.max_bytes+1,filename:'too-large.mp3'})).toThrow('50 MB');
  });

  it('keeps optimistic uploads concurrent and releases browser media resources',()=>{
    const source=read('src/services/assetService.ts');
    expect(source).toContain('Math.min(3');
    expect(source).toContain('await Promise.all([');
    expect(source).toContain('URL.createObjectURL(file)');
    expect(source).toContain('URL.revokeObjectURL(previewUrl)');
    expect(source).toContain('bitmap.close()');
  });

  it('recovers active generations after refresh and reduces polling while hidden',()=>{
    const gallery=read('src/components/workspace/CreationGallery.tsx');
    expect(gallery).toContain('generationClient.list(100)');
    expect(gallery).toContain('generationClient.statusBatch(activeGenerationIds)');
    expect(gallery).toContain("document.addEventListener('visibilitychange',onVisibility)");
    expect(gallery).toContain('document.hidden?12000:2200');
    expect(gallery).toContain('document.hidden?12000:150');
  });

  it('keeps cancellation, insufficient-funds and price-change protections intact',()=>{
    const service=read('server/services/generationService.ts');
    const image=read('src/components/views/UnifiedImageCreateView.tsx');
    const video=read('src/components/views/CreateView.tsx');
    expect(service).toContain('creditWalletService.releaseForGeneration(userId,id)');
    expect(service).toContain("code:'PRICE_CHANGED_REQUOTE_REQUIRED'");
    expect(image).toContain("Créditos insuficientes para esta geração.");
    expect(video).toContain("e?.code!=='PRICE_CHANGED_REQUOTE_REQUIRED'");
  });

  it('does not add a service worker that could cache authenticated API responses',()=>{
    const main=read('src/main.tsx');
    expect(main).not.toContain('serviceWorker.register');
    expect(main).not.toContain('navigator.serviceWorker');
  });

  it('uses viewport-controlled video playback and critical-origin preconnect',()=>{
    const video=read('src/components/common/ViewportVideo.tsx');
    const html=read('index.html');
    expect(video).toContain('IntersectionObserver');
    expect(video).toContain("document.addEventListener('visibilitychange',sync)");
    expect(video).toContain("preload={nearViewport&&loadReady?'metadata':'none'}");
    expect(video).toContain('deferUntilWindowLoad');
    expect(html).not.toContain('rel="preconnect" href="https://hzjyhhenajbjxkwkmzdg.supabase.co"');\n    expect(html).toContain('rel="dns-prefetch" href="//hzjyhhenajbjxkwkmzdg.supabase.co"');
  });

  it('keeps the public LCP path lightweight and independent from firebase',()=>{
    const html=read('index.html');
    const main=read('src/main.tsx');
    const publicApp=read('src/PublicApp.tsx');
    const landing=read('src/components/views/PublicLandingView.tsx');
    const brand=read('src/components/common/BrandMark.tsx');
    expect(html).toContain('/brand/ia-connect-app-icon-64-v1.png');
    expect(html).toContain('/enterprise/visuals/planet-hero-wide-v1.webp');
    expect(main).toContain("import PublicApp from'./PublicApp.js'");
    expect(main).toContain("import'./styles/public-entry.css'");
    expect(main).not.toContain("from './App");
    expect(main).not.toContain('AuthProvider');
    expect(main).not.toContain('firebase');
    expect(publicApp).toContain("import('./services/authSessionProbe.js')");
    expect(publicApp).toContain("const AuthenticatedApp=lazy(()=>import('./App.js')");
    expect(landing).toContain('src="/enterprise/visuals/planet-hero-wide-v1.webp"');
    expect(landing).toContain('fetchPriority="high"');
    expect(landing).toContain('const DeferredVideo');
    expect(landing).toContain('const DeferredImage');
    expect(brand).toContain('/brand/ia-connect-logo-oficial-v1.webp');
  });
});
