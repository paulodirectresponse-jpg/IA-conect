# Security Specification & Security Invariants

This document outlines the strict zero-trust security invariants, Attribute-Based Access Control (ABAC) rules, and the "Dirty Dozen" malicious payload defense matrix for the AI Generation Platform (Stage 1).

---

## 1. Core Data Invariants

1. **Zero Client Authority Over Balance**:
   - The user cannot directly modify `wallet_accounts` or `wallet_transactions`.
   - All balance changes must originate from the server-side ledger engine.
   - Financial values are strictly non-negative integers in cents (`amount_cents >= 0`).

2. **Immutable Financial Ledger**:
   - `wallet_transactions` once created can NEVER be updated or deleted.
   - Every ledger transaction must reference a valid user, type, amount, status, and unique `idempotency_key`.

3. **Ownership Boundary**:
   - Users can only read documents where `resource.data.user_id == request.auth.uid` (or matching path ID).
   - Users cannot list or read other users' transactions, wallet snapshots, or private assets.

4. **Zero Client Authority Over RBAC**:
   - Normal users can NEVER assign themselves `role = "ADMIN"`.
   - On registration or profile update, the `role` and `status` fields can only be mutated by verified Admins.

5. **Server-Side Validation for Sensitive Operations**:
   - Admin actions (credit/debit, suspending users, pricing adjustments) require server-side token validation and generate an immutable `AuditLog`.

6. **Provider Credential Isolation**:
   - Providers stored in Firestore NEVER store API keys or secrets. Secret credentials reside exclusively in server environment / Secret Manager.

7. **Pricing Protection**:
   - Separation of `provider_cost_cents` and `customer_price_cents`.
   - Price modifications exceeding 50% require explicit confirmation in UI and strict admin authorization.

8. **Promotion Expiration**:
   - Expired promotions (`expires_at <= now`) cannot be applied to customer billing.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following attack vectors are explicitly blocked by our Firestore Security Rules and backend validation:

1. **Self-Escalation Attack**: User submits `{ "role": "ADMIN" }` in `users/{userId}` create/update.
   - *Result*: PERMISSION_DENIED.

2. **Free-Money Balance Tampering**: User attempts direct update to `wallet_accounts/{userId}` with `{ "available_balance_cents": 9999999 }`.
   - *Result*: PERMISSION_DENIED.

3. **Ledger Forgery**: User attempts write to `wallet_transactions/{txId}` claiming `{ "type": "DEPOSIT", "amount_cents": 50000 }`.
   - *Result*: PERMISSION_DENIED.

4. **Cross-User Snooping**: User A attempts to read `/wallet_transactions` or `/users/{userB}` belonging to User B.
   - *Result*: PERMISSION_DENIED.

5. **Negative Balance Exploit**: Malicious request attempts debit resulting in negative available balance (`available_balance_cents < 0`).
   - *Result*: REJECTED by backend ledger transaction with code `WALLET_INSUFFICIENT_FUNDS`.

6. **Idempotency Replay Attack**: Submitting the same `idempotency_key` twice for an admin credit or payment capture.
   - *Result*: REJECTED / Idempotent return of existing transaction without re-crediting.

7. **Audit Trail Erasure**: Malicious admin or user attempts delete or update on `/audit_logs/{logId}`.
   - *Result*: PERMISSION_DENIED (Audit logs are strictly append-only).

8. **Suspended User Bypass**: Suspended user attempts to invoke sensitive operations or generation state transitions.
   - *Result*: REJECTED (server and rules check `status == "ACTIVE"`).

9. **Model/Provider Manipulation by Regular User**: Regular user attempts write to `/models`, `/providers`, `/pricing`, or `/promotions`.
   - *Result*: PERMISSION_DENIED.

10. **Shadow Key Injection**: Injecting unexpected payload fields (`{ "admin_bypass": true }`) in resource updates.
    - *Result*: PERMISSION_DENIED (rules enforce key constraints).

11. **Floating Point Rounding Attack**: Sending non-integer or fractional money values (e.g., `10.50`).
    - *Result*: REJECTED (must be strict integer cents).

12. **Secret Leakage in Provider Registry**: Attempting to store an API key in `/providers/{id}`.
    - *Result*: BLOCKED (schema strictly excludes secret tokens).
