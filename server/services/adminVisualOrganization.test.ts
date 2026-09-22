import fs from'fs';
import path from'path';
import{describe,expect,it}from'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');

describe('admin visual organization',()=>{
 it('organizes administration into a persistent responsibility navigation',()=>{
  const view=read('src/components/views/AdminView.tsx');
  expect(view).toContain('ia-admin-layout');
  expect(view).toContain('ia-admin-nav');
  expect(view).toContain('Visão geral');
  expect(view).toContain('IA & Roteamento');
  expect(view).toContain('Financeiro');
  expect(view).toContain('Usuários');
  expect(view).toContain('Sistema');
 });

 it('keeps each heavy admin area lazily visible through one active pane',()=>{
  const view=read('src/components/views/AdminView.tsx');
  expect(view).toContain("pane(activeTab==='overview')");
  expect(view).toContain("pane(activeTab==='ai-routing')");
  expect(view).toContain("pane(activeTab==='finance')");
  expect(view).toContain("pane(activeTab==='users')");
  expect(view).toContain("pane(activeTab==='system')");
 });

 it('uses disclosure sections to reduce visual overload in secondary tools',()=>{
  const view=read('src/components/views/AdminView.tsx');
  expect(view).toContain('ia-admin-disclosure');
  expect(view).toContain('Economia detalhada');
  expect(view).toContain('Usuários & créditos');
  expect(view).toContain('Feature flags');
  expect(view).toContain('Auditoria');
 });

 it('ships responsive admin-specific visual hierarchy in the global design system',()=>{
  const css=read('src/index.css');
  expect(css).toContain('.ia-admin-hero');
  expect(css).toContain('.ia-admin-nav-item.is-active');
  expect(css).toContain('.ia-admin-section-header');
  expect(css).toContain('@media(max-width:899px)');
  expect(css).toContain('html[data-theme="light"] .ia-admin-hero');
 });
});
