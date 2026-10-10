# CLAUDE.md — SiteBook rules (short)

Next.js 16 is newer than most training data: check `node_modules/next/dist/docs/` before using an
API you are unsure of (`proxy.ts` not middleware; `params`/`searchParams` are Promises).

**Run `npm run verify` (typecheck + lint + test + build) before calling anything done.**

## Layers
- Pages and API routes stay thin. Pages call services; routes are one line through `route()`.
- Business rules live in `src/server/services`, always in this order:
  zod parse → `assertCan` + `assertProjectAccess` → `inTx` (row locks where money/stock change) → `audit`.
- Throw `AppError` (or helpers `forbidden/notFound/rule/conflict`); `route()` maps it to the JSON envelope.
- Shared zod primitives (money, qty, date, id, text) live in `src/lib/validation.ts`.

## Money, quantities, dates
- INR. DB `numeric(14,2)`; code = integer paise. Never floats. Use `src/lib/money.ts`.
- Quantities: integer milli-units (`src/lib/qty.ts`). Areas: centi-SFT (`src/lib/area.ts`).
- Format: `₹1,06,00,000` in tables, `₹1.06 Cr` / `₹14.80 L` in cards. Dates DD MMM YYYY.

## Roles (server-enforced)
- Admin: everything. Manager: everything except users. Viewer: read-only.
- Engineer: field work on assigned projects only (attendance, deliveries, usage, progress, photos,
  uploads). Engineers never receive money values — redact in services, not just the UI.

## Domain
- Actual cost = expense transactions + labor attendance + machinery, paid or not.
  Pending = unpaid costs − contractor payments, per vendor. Client balance = contract value
  (or estimate) − client received.
- Phases fixed: Excavation, Civil, Interior. Activities are custom.
- Stock never negative (locked `project_stock` + CHECK).
- AI drafts never count until a person confirms them.
- Never hard-delete financial, stock or evidence records: void/archive/deactivate with a reason.
  Unique numbers ignore VOID rows (partial indexes). Real deletes only for drafts/throwaway data (Admin).

## UI
- Follow `DESIGN.md`: tokens only in `src/app/globals.css` (no hex elsewhere), 0 radius, hairlines,
  hard offset shadow on modals only, Space Grotesk for numbers/labels, Inter for text.
- Reusable components in `src/components/ui`, one per file. Forms open in `Modal`.
- Mobile first at 390px, 44px touch targets, plain words, sentence case, one primary action per screen.
- No `alert()` / `confirm()` — use `Toast` and `ConfirmDialog` / `VoidButton`.
- Every list is paginated.

## Tests
- Unit: `tests/unit`. Integration: `tests/integration`, only against `TEST_DATABASE_URL`
  (guarded in `resolveDatabaseUrl`). Add an integration test for every new service rule.
