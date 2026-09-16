import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('IA Conect Beta PR-01 shell architecture', () => {
  const root = process.cwd();
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

  it('keeps the Beta application lazy-loaded from the stable app', () => {
    const app = read('src/App.tsx');
    expect(app).toContain("const BetaApp=lazy(()=>import('./beta/BetaApp.js')");
    expect(app).toContain("activeView==='beta'&&betaEnabled");
  });

  it('gates the Beta entry with a public feature flag', () => {
    const flags = read('src/beta/betaFlags.ts');
    const access = read('src/beta/services/betaAccessService.ts');
    const navbar = read('src/components/layout/Navbar.tsx');
    expect(flags).toContain("flag_key: 'beta.enabled'");
    expect(access).toContain("BETA_FLAG_KEY = 'beta.enabled'");
    expect(navbar).toContain('betaEnabled &&');
    expect(navbar).toContain("navigate('beta')");
  });

  it('seeds all planned Beta module flags disabled except the shell', () => {
    const flags = read('src/beta/betaFlags.ts');
    for (const key of ['beta.audio','beta.three_d','beta.flows','beta.templates','beta.flow_apps','beta.batch','beta.brand_kit','beta.sharing']) {
      expect(flags).toContain(`flag_key: '${key}'`);
    }
    expect(flags).toMatch(/flag_key: 'beta\.enabled'[\s\S]*?is_enabled: true/);
    expect(flags).toMatch(/flag_key: 'beta\.audio'[\s\S]*?is_enabled: false/);
  });

  it('isolates Beta styles and preserves phone breakpoints', () => {
    const css = read('src/beta/styles/beta.css');
    expect(css).toContain('.ia-beta-shell');
    expect(css).toContain('@media(max-width:767px)');
    expect(css).toContain('@media(max-width:359px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  });

  it('provides an explicit route back to the stable application', () => {
    const betaApp = read('src/beta/BetaApp.tsx');
    expect(betaApp).toContain('Voltar à versão atual');
    expect(betaApp).toContain('onExit');
  });
});
