import fs from'node:fs';
import path from'node:path';
import{describe,expect,it}from'vitest';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');

describe('mobile shell stage 1',()=>{
  it('enables viewport safe areas without changing the desktop viewport scale',()=>{
    const html=read('index.html');
    expect(html).toContain('width=device-width, initial-scale=1.0, viewport-fit=cover');
  });

  it('uses dynamic viewport height and safe-area rules only below desktop breakpoints',()=>{
    const css=read('src/index.css');
    const stage=css.slice(css.indexOf('Responsive mobile shell — Stage 1'));
    expect(stage).toContain('@media(max-width:1023px)');
    expect(stage).toContain('height:100dvh!important');
    expect(stage).toContain('env(safe-area-inset-top)');
    expect(stage).toContain('env(safe-area-inset-bottom)');
    expect(stage).toContain('@media(max-width:359px)');
    expect(stage).not.toContain('@media(min-width:1024px)');
  });

  it('keeps the existing desktop sidebar and navbar geometry intact',()=>{
    const sidebar=read('src/components/layout/Sidebar.tsx');
    const navbar=read('src/components/layout/Navbar.tsx');
    expect(sidebar).toContain('w-[236px]');
    expect(sidebar).toContain('lg:static lg:translate-x-0');
    expect(navbar).toContain('h-[68px]');
    expect(navbar).toContain('hidden min-w-0 lg:flex');
  });

  it('locks mobile background scroll and supports Escape when the drawer is open',()=>{
    const layout=read('src/components/layout/AppLayout.tsx');
    expect(layout).toContain("window.matchMedia('(max-width: 1023px)')");
    expect(layout).toContain("classList.toggle('ia-mobile-nav-lock'");
    expect(layout).toContain("event.key === 'Escape'");
    expect(layout).toContain('ia-shell-main-standard');
    expect(layout).toContain('ia-shell-main-create');
  });

  it('exposes accessible drawer state from the mobile navbar',()=>{
    const navbar=read('src/components/layout/Navbar.tsx');
    const sidebar=read('src/components/layout/Sidebar.tsx');
    expect(navbar).toContain('aria-controls="ia-mobile-sidebar"');
    expect(navbar).toContain('aria-expanded={sidebarOpen}');
    expect(sidebar).toContain('id="ia-mobile-sidebar"');
    expect(sidebar).toContain('aria-label="Navegação principal"');
  });

  it('provides a reusable bottom-sheet/fullscreen dialog foundation',()=>{
    const dialog=read('src/components/common/ResponsiveDialogShell.tsx');
    const css=read('src/index.css');
    expect(dialog).toContain("mobileMode?:'sheet'|'fullscreen'");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain("event.key==='Escape'");
    expect(dialog).toContain("classList.add('ia-dialog-open')");
    expect(css).toContain('.ia-responsive-dialog-surface[data-mobile-mode="fullscreen"]');
    expect(css).toContain('border-radius:20px 20px 0 0');
  });

  it('protects very narrow phones without removing core navbar actions',()=>{
    const css=read('src/index.css');
    const navbar=read('src/components/layout/Navbar.tsx');
    expect(css).toContain('@media(max-width:359px)');
    expect(css).toContain('.ia-shell-account-chevron{display:none}');
    expect(navbar).toContain('ia-shell-theme-button');
    expect(navbar).toContain("navigate('wallet')");
    expect(navbar).toContain('ia-shell-account-trigger');
  });
});
