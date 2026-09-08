# Architecture Document — Etapa 1: Plataforma de Geração com IA

## 1. Visão Arquitetural Full-Stack

A aplicação adota arquitetura cliente-servidor com separação estrita de responsabilidades:
- **Frontend SPA**: React 18 com TypeScript, Tailwind CSS, Lucide Icons e Vite.
- **Backend API**: Node.js com Express e TypeScript, servindo rotas `/api/*` e estáticos.
- **Camada de Identidade**: Firebase Authentication (Client SDK + Server Token Verification).
- **Banco de Dados & Persistência**: Google Cloud Firestore com regras de segurança granulares (`firestore.rules`).

---

## 2. Diagrama do Fluxo de Autenticação e Autorização

```
[ Usuário ]
    │
    ▼
1. Login / Registro (Firebase Client SDK)
    │
    ▼
2. onAuthStateChanged dispara no AuthContext
    │
    ▼
3. Recupera ID Token assinado: await user.getIdToken()
    │
    ▼
4. Requisição GET /api/auth/me com header: Authorization: Bearer <ID_TOKEN>
    │
    ▼
5. Backend Express (authMiddleware):
   ├── Decodifica e valida assinatura do ID Token
   ├── Extrai uid e email oficiais
   ├── Consulta userRepository
   ├── Valida se status !== 'SUSPENDED'
   └── Injeta req.user e req.userProfile
    │
    ▼
6. Retorna { user, wallet }
    │
    ▼
7. Frontend atualiza estado e desbloqueia o Dashboard
```

---

## 3. Modelo de Dados e Invariantes do Ledger

### 3.1 WalletAccount
```typescript
interface WalletAccount {
  account_id: string;              // Vinculado 1:1 com user_id
  user_id: string;
  currency: 'BRL';
  available_balance_cents: number; // Saldo disponível para uso imediato
  reserved_balance_cents: number;  // Saldo bloqueado durante gerações pendentes
  total_balance_cents: number;     // available + reserved
  total_deposited_cents: number;   // Total histórico de depósitos
  total_used_cents: number;        // Total histórico consumido em gerações
  updated_at: string;
}
```

### 3.2 WalletTransaction (Ledger Imutável)
```typescript
interface WalletTransaction {
  transaction_id: string;
  user_id: string;
  type: WalletTransactionType;    // DEPOSIT | ADMIN_CREDIT | ADMIN_DEBIT | GENERATION_RESERVE | GENERATION_CAPTURE | GENERATION_RELEASE | REFUND | PROMOTIONAL_CREDIT
  amount_cents: number;           // Inteiro não-negativo em centavos
  balance_after_cents: number;
  status: 'COMPLETED' | 'PENDING' | 'REJECTED' | 'CANCELLED';
  description: string;
  idempotency_key?: string;       // Previne duplicação de transações
  metadata?: Record<string, any>;
  created_at: string;
}
```

---

## 4. Política de Segurança e Segredos

1. **Isolamento de Credenciais**:
   - Chaves de API de provedores e segredos administrativos nunca são expostos no frontend ou salvos no banco de dados.
   - Residem exclusivamente em variáveis de ambiente e Secret Manager.

2. **Segredo de Bootstrap vs Senha de Login**:
   - `ADMIN_BOOTSTRAP_SECRET` é um token técnico utilizado exclusivamente na inicialização da instância no endpoint `/api/admin/bootstrap`.
   - O login dos usuários e administradores é feito exclusivamente através de credenciais gerenciadas pelo Firebase Authentication.

3. **Status de Provedores na Etapa 1**:
   - Provedores como Atlas Cloud, WaveSpeed e Fal AI estão cadastrados com `is_configured: false`.
   - O campo `is_configured` é de controle exclusivo do backend e não pode ser sobrescrito pelo cliente.
   - Adapters e conexões reais de execução de IA serão introduzidos na Etapa 3.
