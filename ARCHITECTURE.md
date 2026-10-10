# Architecture

## Request flow

```
browser ──► proxy.ts ──► page (server component) ──► service ──► Postgres
   │        (session gate)        │
   │                              └─ renders data; never queries the DB itself
   └─ client form (modal) ──fetch──► app/api/**/route.ts ──► route() wrapper ──► service
```

- **`src/proxy.ts`** — fast gate: no valid session → `/login` (pages) or 401 envelope (API).
  It is not the security boundary; services are.
- **Pages** load data by calling services with the signed-in `Actor`
  (`requirePageActor()`), and wrap calls in `pageData()` so NOT_FOUND → 404 and FORBIDDEN →
  `/no-access`.
- **API routes** are one line each: `export const POST = route(({ req, actor }) => createX(actor, await readJson(req)))`.
  `route()` (src/server/http/route.ts) requires a session, resolves async params and turns any
  thrown error into the envelope `{ ok: false, error: { code, message, fields? } }` via `toAppError`.

## Service rules (src/server/services)

Every write follows the same order:

1. **zod parse** the raw input (shared primitives in `src/lib/validation.ts`: `zMoney`, `zQty`,
   `zFeet`, `zDate`, `zId`, …). Money becomes integer paise, quantities integer milli-units.
2. **Permission + project scope**: `assertCan(actor, "finance.write")`, then
   `assertProjectAccess(tx, actor, projectId, { write: true, lock })` — engineers only reach
   assigned projects; archived projects are read-only.
3. **`inTx()`** — one `db.transaction`. Lock rows that change money or stock
   (`SELECT … FOR UPDATE` on the project row for transactions, on `project_stock` for deliveries
   and usage). DB errors (unique, check) are mapped to CONFLICT / BUSINESS_RULE.
4. **`audit()`** inside the same transaction: actor, action, entity, reason, data.

Reads redact money for roles without `finance.read` (`moneyFor`, `canSeeMoney`) — the UI never
receives the numbers, so hiding them is not just cosmetic.

## Units

| Quantity | Database | Code | Helpers |
|---|---|---|---|
| Money | `numeric(14,2)` rupees | integer **paise** | `src/lib/money.ts` (`paiseFromDb`, `paiseToDb`, `mulQtyRate`, `formatINR`, `formatINRCompact`) |
| Quantity | `numeric(14,3)` | integer **milli-units** | `src/lib/qty.ts` |
| Area / lengths | `numeric(…,2)` | integer **centi-SFT / centi-ft** | `src/lib/area.ts` |
| Dates | `date` | ISO `yyyy-mm-dd` string, Asia/Kolkata | `src/lib/dates.ts` (shown as DD MMM YYYY) |

No float ever holds money. Decimal text is parsed digit by digit (`parseScaledDecimal`).

## Never delete evidence

Financial, stock and evidence rows carry a status (`VOID`, `ARCHIVED`, `INACTIVE`) plus who/when/why.
Unique business numbers ignore voided rows with partial indexes (`… WHERE status <> 'VOID'`), so a
bill or challan number can be re-entered after the wrong entry is voided. Real deletes exist only
for throwaway data: unconfirmed AI drafts (Admin), team assignments, and floors/slabs nothing refers to.

## AI documents

`src/server/ai/types.ts` defines `DocumentReader` (one method: `read(file) → RawExtraction`).
`getReader()` picks Anthropic (structured outputs via `messages.parse` + `zodOutputFormat`) or
OpenRouter (JSON-schema response format) from env, or `null` when there is no key.
The reader returns numbers **as printed strings**; `normalize.ts` converts them and runs the checks
(qty × rate = amount, lines = subtotal, subtotal + tax = total, GSTIN checksum, date sanity).
`drafts.service.ts` stores the draft; `confirmDraft` creates records through the same
`insertTransaction` / `insertReceipt` functions the normal forms use, so the rules are identical.

## Theme and components

- All colours, fonts, radii, shadows and type styles are tokens in `src/app/globals.css` `@theme`.
  No hex colours anywhere else (SVG drawings use `fill-*`/`stroke-*` token classes).
- Reusable components live in `src/components/ui`, one per file (`Button`, `Field`, `Input`,
  `MoneyInput`, `Select`, `Modal`, `ConfirmDialog`, `DataTable`, `Pagination`, `Chip`, `KpiCell`,
  `TitleBlock`, `Panel`, `ProgressRule`, `Toast`, …).
- Forms open in `Modal`; state + server errors via `useApiForm`; one-off actions via `useAction`;
  void/archive/deactivate via `VoidButton` (always asks for a reason). No `alert()`/`confirm()`
  (ESLint `no-alert` is an error).

---

## How to add a field

Example: add "site supervisor phone" to projects.

1. `src/server/db/schema.ts` — add the column (`supervisorPhone: text("supervisor_phone")`).
2. `npm run db:generate -- --name project_supervisor_phone` → review the SQL in `drizzle/`, then `npm run db:migrate`.
3. `src/lib/schemas/project.ts` — add it to the zod schema (`supervisorPhone: zPhone`).
4. `src/server/services/projects.service.ts` — write it in `updateBasics` / `createProject`, return it from `getProject`.
5. UI — add a `Field` to `BasicsFields.tsx` and a row to the overview `DescriptionList`.
6. Tests — extend `tests/integration/projects.test.ts`. Run `npm run verify`.

Money field? Use `money("…")` in the schema, `zMoney` in zod, `paiseToDb/paiseFromDb` in the
service, `MoneyInput` + `<Money>` in the UI, and redact it with `moneyFor(actor, …)`.

## How to add a module

Example: "Equipment register".

1. **Schema**: table with `status` (ACTIVE/INACTIVE or ACTIVE/VOID), `createdBy`, timestamps;
   generate + apply a migration.
2. **Permissions**: reuse an existing permission from `src/lib/access.ts` or add one to the matrix.
3. **Service** `src/server/services/equipment.service.ts`: `xInput` zod schema; `listX` (paginated
   with `pageWindow`/`paged`, scoped with `projectScopeFilter`), `getX`, `createX`, `updateX`,
   `setXStatus` (reason required) — each following parse → permission/scope → `inTx` → `audit`.
4. **Routes** `src/app/api/equipment/route.ts`, `[id]/route.ts`, `[id]/status/route.ts` — one line each with `route()`.
5. **UI**: list page `src/app/(app)/equipment/page.tsx` (`TitleBlock`, `DataTable`, `Pagination`),
   view page `[id]/page.tsx` (`History`, `VoidButton`), a form button in
   `src/components/equipment/EquipmentButton.tsx` using `Modal` + `useApiForm`.
6. **Navigation**: add it to `NAV` in `src/components/shell/nav.ts`.
7. **Tests**: `tests/integration/equipment.test.ts` with `useTestDb()` and `makeWorld()` from
   `tests/support/db.ts`; add the module to the CRUD table in `README.md`.
