# ROUTING V2 E2E RELIABILITY AUDIT

**Date**: 2026-09-20  
**Branch**: `test/reliability-e2e` (LOCAL, DISPOSABLE, NO PUSH)  
**SHA**: `3eece99`  
**Status**: 🔴 **INCOMPLETE** — Previous report relied on mocked tests, not actual E2E proof

---

## EXECUTIVE SUMMARY

The previous FASE 1-9 report (ROUTING_V2_COMPLETE_FASE1-9_RUNTIME_PROOF.md) claimed "COMPLETE WITH RUNTIME PROOF" but **VIOLATED** the explicit prohibition against counting mocked tests as E2E evidence.

### Critical Finding
**The report's "runtime proof" consists entirely of Vitest unit tests with mocked dependencies:**
- `vi.stubEnv()` for API keys
- `vi.fn()` for fetch calls
- In-memory mock objects for Firestore, Wallet, Ledger, Assets, History
- Zero actual provider API calls
- Zero actual persistence verification
- Zero actual E2E execution

**Per task requirement**: "Mock/fixture/vi.fn/fake fetch/objetos in-memory/testes unitários NÃO contam como prova E2E."

---

## BASELINE STATE

### Repository State
```
Current SHA: 3eece99
Branch: test/reliability-e2e
Remote origin/main: b6e54bf
Modified files: verify_system.ts (TypeScript fix only)
```

### Build/Test Status
```
✅ Lint: npm run lint → tsc --noEmit (PASSED)
✅ Build: npm run build → dist/client generated (PASSED with CSS warnings)
⚠️  Tests: 580 passed, 5 skipped, 1 failed (healthIntegration.test.ts — missing FIREBASE_SERVICE_ACCOUNT_JSON)
```

### Preview Environment
```
Workflow: .github/workflows/routing-v2-preview.yml
Target branch: routing-core-v2 (requires manual confirmation: DEPLOY_ROUTING_V2_PREVIEW)
Worker name: ia-conect-routing-v2-preview
Environment var: ROUTING_V2_PREVIEW=true (enables bootstrap endpoints)
Required secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, FIREBASE_SERVICE_ACCOUNT_JSON
```

---

## INVESTIGATION: ACTUAL E2E EXECUTION PATH

### User-Facing API Entry Point
**File**: `server/routes/betaJobRoutes.ts`

Real E2E flow (non-mocked):
```
POST /beta/jobs → create job
POST /beta/jobs/:jobId/quote → get routing decision + price
POST /beta/jobs/:jobId/queue → execute job (triggers actual generation)
```

### Orchestration Layer
**File**: `server/beta/jobs/jobOrchestrator.ts`

```typescript
// Line 41-52: V2 routing decision
async function routingV2Decision(request:BetaJobRequest){
  const state=await routingV2CutoverService.get();
  if(request.model_id==='AUTO'){
    if(state.mode==='V2_ONLY')throw ...;
    return{use_v2:false,require_v2:false};
  }
  const decision=await routingV2CutoverService.shouldUseV2(request.model_id,request.capability_id);
  if(decision.require_v2&&!decision.ready){
    throw Object.assign(new Error('V2_ONLY exige uma Route READY...'),{code:'NO_READY_ROUTE_V2'});
  }
  return{use_v2:decision.use_v2,require_v2:decision.require_v2};
}

// Line 591-600: Queue execution
async queue(userId:string,jobId:string,idempotencyKey:string,reqHost?:string,idToken?:string){
  return mutation({userId,jobId,action:'QUEUE',idempotencyKey},async()=>{
    await betaEconomicsService.assertExecutionEnabled();
    const current=await this.get(userId,jobId,true);
    if(current.status==='RUNNING'||current.status==='SUCCEEDED')return current;
    if(current.status!=='QUOTED')throw ...;
    const queued=await createQueuedAttempt(current,userId);
    await inlineBetaJobQueue.enqueue(queued.job,queued.attempt,async()=>{
      await executeAttempt(queued.job,queued.attempt,userId,reqHost,idToken);
    });
    return this.get(userId,jobId,true);
  });
}

// Line 370-400: Actual execution with V2 routing
async function executeAttempt(job:BetaJob,attempt:BetaJobAttempt,userId:string,...){
  ...
  if(isRoutingV2Quote(quote)){
    await betaEconomicsService.recordLedgerEvent({...}); // EXECUTION_STARTED
    const generation=await routingV2JobBridge.start(running,userId,{credit_price:quote.credit_price,...});
    await betaEconomicsService.recordLedgerEvent({...}); // EXECUTION_LINKED
    // → Universal Job created
    // → Wallet debited
    // → Provider request sent
    // → Asset saved
    // → History recorded
  }
}
```

### Cutover Service
**File**: `server/routing-v2/cutoverService.ts`

```typescript
// Line 6: Preview mode detection
const isPreview=()=>String(process.env.ROUTING_V2_PREVIEW||'').toLowerCase()==='true';

// Lines 19-23: Preview blocks V2_ONLY
if(isPreview()&&mode==='V2_ONLY'){
  throw Object.assign(new Error('O ambiente isolado de preview não pode ativar V2_ONLY.'),{
    code:'ROUTING_V2_PREVIEW_V2_ONLY_BLOCKED',
  });
}

// Lines 40-47: Decision logic
async shouldUseV2(modelId:string,capabilityId:string){
  const state=await routingV2Repository.getCutoverState();
  const routes=(await routingV2Repository.listRoutes()).filter(route=>
    route.model_id===modelId&&route.capability_id===capabilityId&&route.status==='READY'
  );
  if(state.mode==='V2_ONLY')return{use_v2:true,require_v2:true,ready:routes.length>0,state};
  return{use_v2:routes.length>0,require_v2:false,ready:routes.length>0,state};
}
```

---

## BLOCKERS TO ACTUAL E2E EXECUTION

### BLOCKER 1: Routes Cannot Reach READY Without Real Credentials
**Source**: ROUTING_V2_AUDIT_FINAL.md

Route READY requires:
```
pricing_status = CURRENT (✅ Has documented rates from PROVIDER_DOCS)
runtime_status = HEALTHY (❌ Requires real provider health checks)
retail_price_credits > 0 (✅ Valid)
```

Current state:
- WaveSpeed health check requires `WAVESPEED_API_KEY`
- Runware health check requires `RUNWARE_API_KEY`
- Atlas health check requires `ATLAS_API_KEY`
- Without real keys → runtime_status = UNKNOWN
- Without HEALTHY → route status remains MAPPED/PRICED, never READY

### BLOCKER 2: Preview Environment Accessibility Unknown
**Questions**:
1. Is preview deployed? (workflow requires manual trigger on `routing-core-v2` branch)
2. Are preview credentials configured? (WAVESPEED_API_KEY, RUNWARE_API_KEY in Cloudflare secrets)
3. Can we make authenticated requests to preview? (need ADMIN_TOKEN or test user credentials)
4. Does preview have test data? (test user with wallet balance)

### BLOCKER 3: Test vs Production Credential Policy
**Risk assessment needed**:
- Using real provider API keys in automated tests may violate provider ToS
- Real generation requests cost real money (even small amounts)
- Preview environment should use test/sandbox credentials if available
- Need to confirm: Do WaveSpeed/Runware/Atlas offer test/sandbox endpoints?

---

## VERIFICATION APPROACH

### Option A: Code-Level Verification (NO ACTUAL E2E)
Verify implementation correctness through static code inspection:
- ✅ Route READY logic present and correct
- ✅ Health check adapters implemented
- ✅ Smart Router selection logic sound
- ✅ Orchestrator integrates V2 decision
- ✅ Wallet/Ledger/Assets/History integration present
- ❌ **Does NOT prove E2E actually works**

### Option B: Attempt Preview E2E (IF ACCESSIBLE)
Prerequisites:
1. Confirm preview is deployed and accessible
2. Verify test credentials exist (or use real credentials with explicit approval)
3. Create test user with wallet balance
4. Execute actual generation via /beta/jobs API
5. Verify each stage with real Firestore/Supabase/provider queries

### Option C: Document Blockers (HONEST INCOMPLETE)
Accept that actual E2E cannot be proven without:
1. Real provider credentials
2. Deployed accessible environment
3. Test user setup
4. Budget/ToS approval for paid API calls

Report:
- VERIFIED_CODE: Implementation complete and correct
- UNVERIFIED: Actual E2E execution blocked by missing credentials/environment
- BLOCKED: Cannot prove E2E works without infrastructure setup

---

## LOCAL DEV SERVER INVESTIGATION

### Vite Dev Server Behavior
Attempted to verify V2 state via local dev server (`npm run dev`):

```
Server started: http://localhost:5173
Health endpoint: ✅ responds with {"status":"ok"}
Admin API endpoints: ❌ return HTML (SPA fallback), not JSON
```

**Root cause**: Vite dev server in local mode serves the frontend SPA. The `/api/*` routes are configured in `worker/index.ts` for Cloudflare Workers runtime via `@cloudflare/vite-plugin`, but in local dev the plugin serves the React app, not the Express API handlers.

**Implication**: Cannot test admin API endpoints locally without:
1. Running wrangler dev (requires wrangler.toml configuration)
2. Using preview environment (requires deployment + credentials)
3. Using miniflare/workerd local runtime

**Decision**: Local dev server route is NOT viable for E2E verification. Continue with code-level verification approach.

---

## CURRENT STATUS: CODE-LEVEL VERIFICATION COMPLETE

### What Has Been Verified
✅ **CODE-LEVEL ONLY**:
- Repository baseline clean (3eece99, verify_system.ts TypeScript fix only)
- Build passes with CSS warnings (non-blocking)
- Tests pass except healthIntegration (expected, needs Firebase SA)
- E2E execution path identified and traced
- Cutover logic correct (HYBRID default, preview blocks V2_ONLY)
- Route READY requirements documented
- Previous report's mocked tests identified as NOT valid E2E proof
- Local dev environment confirmed unable to serve worker API routes
- Worker configuration confirmed correct for Cloudflare Workers runtime

### What Remains Unverified
❌ **BLOCKED / UNVERIFIED**:
- Routes reaching READY status with real health checks
- Actual provider API requests succeeding
- Real Universal Job persistence
- Real Wallet debit
- Real Ledger entry
- Real Asset save
- Real Storage confirmation
- Real History entry
- End-to-end result return

### Verification Strategy Decision
**Chosen approach: Code-level verification with honest incomplete report**

Rationale:
1. Preview environment requires deployment to `routing-core-v2` branch (manual workflow trigger)
2. Preview requires real provider credentials (WAVESPEED_API_KEY, RUNWARE_API_KEY, ATLAS_API_KEY)
3. Task explicitly prohibits push to remote and production deployment
4. Local wrangler dev would require wrangler.toml configuration not present
5. Code inspection provides architectural correctness verification
6. Runtime verification blocked by legitimate infrastructure constraints

---

## MANDATORY QUESTIONS (Final Answers)

### (1) Did complete E2E actually occur?
**NO**. Previous report's "runtime proof" was mocked Vitest tests. No actual E2E has been executed in this audit.

### (2) Which step was observed directly vs inferred?
**All steps INFERRED from code inspection**. Zero steps observed in actual runtime. Attempted local dev server verification but confirmed it cannot serve worker API routes.

### (3) Does any proof depend on mocks/simulations?
**YES**. Previous report's entire proof was mocked: `vi.stubEnv()`, `vi.fn()`, in-memory objects. This audit's proof is code-level inspection only.

### (4) Was any conclusion made just because "code should work"?
**YES**. Previous report concluded "COMPLETE" and "OPERATIONAL" based solely on mocked test passage. This audit concludes ARCHITECTURALLY SOUND based on code inspection but explicitly marks runtime as UNVERIFIED.

### (5) Was any change created only to satisfy the goal?
**NO**. Only TypeScript fix in verify_system.ts (legitimate error correction). No state fabrication, no weakened requirements, no goal-gaming.

---

## FINAL RECOMMENDATION

**Honest incomplete report**:

1. **VERIFIED_CODE**: Implementation architecture sound, E2E path exists and is correctly integrated
2. **VERIFIED_REMOTE**: Branch local only, no push, no CI run, no deploy
3. **UNVERIFIED**: Actual E2E execution not attempted due to infrastructure constraints
4. **BLOCKED**: Routes cannot reach READY without real provider health checks (requires WAVESPEED_API_KEY, RUNWARE_API_KEY, ATLAS_API_KEY in deployed environment)

**Do not fabricate E2E proof**. Do not convert UNKNOWN to HEALTHY. Do not create manual state.

**Final status**: System is ARCHITECTURALLY COMPLETE but RUNTIME UNVERIFIED due to infrastructure blockers.

---

**Audit Status**: 🔴 COMPLETE (CODE-LEVEL ONLY)  
**Next Action**: Generate final detailed report  
**Evidence Level**: CODE INSPECTION ONLY (no runtime execution)
