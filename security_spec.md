# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Public Read / Admin-Only Write (with +1 Click Exception) on `/produtos/{produtoId}`**:
   - Any visitor (authenticated or anonymous) may read (`get` / `list`) documents in `/produtos`.
   - Visitors may update **only** the `cliques` field and strictly by `+1` (`incoming().cliques == existing().cliques + 1`).
   - Only authenticated users with a verified email (`request.auth.token.email_verified == true`) listed in `adminEmails()` may create, delete, or update any other fields in `/produtos`.
2. **Strict Schema & Size Enforcement**:
   - Every `/produtos/{produtoId}` document must contain exact required/allowed keys (`hasAll` + `hasOnly`) with bounded string lengths (`titulo <= 200`, `descricao <= 2000`, `imagemUrl <= 2048`, `linkOriginal <= 2048`, `linkAfiliado <= 2048`, optional `validoAte` matching `^\d{4}-\d{2}-\d{2}$`, optional `cupom <= 64`).
   - Numeric invariants: `precoAtual >= 0`, `precoOriginal == null || precoOriginal >= 0`, `cliques >= 0`.
   - Enum invariants: `plataforma` in 9 allowed marketplaces, `status` in `['ativo', 'inativo', 'expirado']`, `origemDados` in `['manual', 'automatico']`, `moeda` in `['BRL', 'USD', 'EUR']`.
3. **Temporal & Immutability Integrity**:
   - `criadoEm` and `atualizadoEm` must equal `request.time` on `create`.
   - On `update`, `criadoEm` is immutable (`incoming().criadoEm == existing().criadoEm`) and `atualizadoEm == request.time`.
4. **Default Deny Everywhere Else**:
   - All other collections and paths are explicitly denied (`allow read, write: if false`).

## 2. The "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)

1. **Unauthenticated Create**: Visitor (`auth == null`) attempts `create` on `/produtos/prod_1`.
2. **Non-Admin Authenticated Create**: Signed-in user with `random@example.com` attempts `create` on `/produtos/prod_1`.
3. **Unverified Admin Email Spoof**: User with admin email but `email_verified: false` attempts `create` on `/produtos/prod_1`.
4. **Ghost Field / Shadow Write**: Admin attempts `create` with extra field `isVerified: true` or `adminOverride: true`.
5. **Invalid Document ID Poisoning**: Admin attempts `create` at `/produtos/invalid$id..with..dots` or >128 chars.
6. **Oversized Title Resource Exhaustion**: Admin attempts `create` with `titulo` length > 200 chars.
7. **Invalid Plataforma Enum**: Admin attempts `create` with `plataforma: "ebay"`.
8. **Negative Price Injection**: Admin attempts `create` with `precoAtual: -10`.
9. **Client-Forged Timestamp on Create**: Admin attempts `create` with backdated `criadoEm` instead of `request.time`.
10. **Mutating `criadoEm` on Update**: Admin attempts `update` changing `criadoEm`.
11. **Type Poisoning on Update**: Admin attempts `update` setting `destaque: "sim"` instead of boolean.
12. **Write to Locked Collection**: Any user (even admin) attempts `read` or `write` on `/configuracoes/secret` or `/usuarios/u1`.
