# Product Specification — Etapa 1: Fundação da Plataforma de Geração com IA

## 1. Visão Geral do Produto
A plataforma comercial de geração de conteúdo com Inteligência Artificial é projetada para viabilizar operações financeiras reais com integridade contábil estrita, créditos pré-pagos, suporte a múltiplos provedores de geração por API e roteamento automático baseado em custo.

A **Etapa 1** estabelece a base e fundação arquitetural definitiva:
- Sistema de Autenticação baseado em Firebase Authentication como fonte única da verdade;
- Carteira e Ledger Contábil imutável em centavos de Real (`BRL`);
- Controle de Acesso Baseado em Papéis (RBAC: `USER` e `ADMIN`);
- Painel Administrativo para gestão de usuários, provedores, modelos, tarifas, promoções, feature flags e auditoria;
- Catálogo de Provedores e Modelos (Metadata Registry).

---

## 2. Invariantes e Regras de Negócio da Etapa 1

### 2.1 Autenticação e Gestão de Sessão
- **Única Fonte da Verdade**: Firebase Authentication (`firebaseUser`). Nenhum estado secundário ou callback ad-hoc determina a validade da sessão.
- **Fluxo de Inicialização**:
  ```
  Firebase Auth -> onAuthStateChanged -> firebaseUser -> /api/auth/me (ID Token) -> Profile & Wallet -> Dashboard
  ```
- **Idempotência de Perfil e Carteira**: Se um usuário autenticado no Firebase ainda não possuir perfil ou carteira cadastrados, o backend realiza o provisionamento seguro com saldo inicial estritamente zero (`available_balance_cents = 0`).
- **Usuários Suspensos**: O status `SUSPENDED` é validado e bloqueado no backend (HTTP 403 `USER_SUSPENDED`), impedindo qualquer acesso a rotas protegidas da API.

### 2.2 Bootstrap Administrativo
- O primeiro administrador da instância pode ser reivindicado pelo endpoint seguro `/api/admin/bootstrap`.
- O parâmetro de ambiente `ADMIN_BOOTSTRAP_SECRET` representa um **segredo técnico de provisionamento do servidor**, e **não** uma senha de login de usuário.
- Nenhum e-mail ou credencial administrativa é hardcoded no código; o arquivo `.env.example` contém exclusivamente placeholders vazios.

### 2.3 Semântica do Registro de Provedores (Registry)
- **Status da Etapa 1**: Todos os provedores (Atlas Cloud, WaveSpeed, Fal AI) e modelos (WAN 2.1, Kling 1.5, Hunyuan) estão catalogados como **Metadados de Registro (REGISTERED)**.
- **Ausência Deliberada de Execução**: Não existem adapters de execução, requisições reais a APIs de IA ou health checks simulados na Etapa 1.
- **is_configured**: Campo de autoridade estrita do servidor (`false` na Etapa 1). Não pode ser definido ou falsificado pela interface do cliente.
- As integrações funcionais com clusters de geração pertencem à Etapa 3 (após a entrega do Workspace na Etapa 2).

### 2.4 Arquitetura Financeira (Ledger em Centavos)
- Todas as operações contábeis utilizam números inteiros representando centavos (`BRL`), eliminando erros de arredondamento de ponto flutuante.
- O saldo é derivado diretamente do histórico imutável de transações (`wallet_transactions`).
- Nenhum débito pode resultar em saldo disponível negativo (`available_balance_cents < 0`).
- Todas as transações administrativas de crédito e débito exigem `idempotency_key` e justificativa registrada em `audit_logs`.
