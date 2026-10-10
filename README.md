# SiteBook

Construction project management and cost tracking for **Mylaru Infra** — residential and commercial
projects in India. Projects are created through a 5-step wizard (floors, slabs, estimate); every
transaction, labor day, delivery and progress update is recorded against a project; bills and
delivery challans can be read by AI into drafts that a person confirms.

Stack: Next.js 16 (App Router, `proxy.ts`, async params) · TypeScript strict · Tailwind 4 (all tokens
in `src/app/globals.css`) · PostgreSQL + Drizzle ORM + drizzle-kit migrations · zod · jose JWT
session cookie + bcrypt · Vitest.

---

## Quick start (local)

Requirements: Node 22+, Docker (only for Postgres).

```bash
cp .env.example .env            # then set SESSION_SECRET (openssl rand -base64 48)
npm install
docker compose up -d db         # Postgres on localhost:55432, creates sitebook + sitebook_test
npm run db:migrate              # apply drizzle migrations to the dev DB
npm run db:seed                 # demo data (3 live projects + 1 archived)
npm run dev                     # http://localhost:3000
```

Re-seed from scratch at any time with `npm run db:seed -- --reset` (wipes the **dev** DB only).

### Demo logins

| Role     | Email               | Password       | Sees |
|----------|---------------------|----------------|------|
| Admin    | admin@mylaru.in     | `Admin@123`    | Everything, including users and settings |
| Manager  | manager@mylaru.in   | `Manager@123`  | Everything except users |
| Engineer | engineer@mylaru.in  | `Engineer@123` | Villa Project + Metro Plaza only, never money |
| Engineer | kiran@mylaru.in     | `Engineer@123` | Greenwood Shed only (engineer-only project) |
| Viewer   | viewer@mylaru.in    | `Viewer@123`   | Read-only, all projects |

### What the seed covers

- **Villa Project** (residential, G+2, 5,300 SFT × ₹2,000 = ₹1,06,00,000): all 8 transaction types,
  two voided transactions, pending payments to a vendor and a labor party, a purchase order,
  **partial deliveries** (200 bags bought, 120 received), a voided delivery and a voided usage,
  progress in all three phases plus an archived activity, site photos, a drawing and an agreement,
  and AI drafts in every state (confirmed, pending with failing checks, pending delivery challan,
  pending manual draft with no AI data).
- **Metro Plaza Retail** (commercial, basement + G+2 + terrace, trapezoid plot, contract value):
  an **advance** paid to a machinery vendor, a voided delivery, a voided PO, a rejected draft.
- **Greenwood Shed** (other, irregular plot, **no GPS** → dashboard reminder): assigned only to
  Kiran, field records only.
- **Old Duplex (cancelled)**: archived, read-only.
- An inactive vendor and an inactive labor type.

### AI reader

Set `ANTHROPIC_API_KEY` (default provider, structured outputs) or `AI_PROVIDER=openrouter` with
`OPENROUTER_API_KEY`. With no key, uploads still create a draft and the person types the details.
Nothing read by AI counts anywhere until a person confirms the draft.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm test` | All Vitest tests (unit + integration) |
| `npm run test:unit` / `npm run test:integration` | One suite |
| `npm run verify` | typecheck + lint + test + build — run before every commit |
| `npm run db:generate -- --name <change>` | New migration from `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run db:seed` | Demo data (`-- --reset` wipes the dev DB first) |
| `npm run user:create -- --email a@b.in --password '…' --name "A B" --role ADMIN` | Create or reset a user |

Integration tests use **`TEST_DATABASE_URL` only**. They refuse to run if it is missing, equals
`DATABASE_URL`, or the database name does not contain `test`. Each test truncates the test DB.

---

## Deploying with Docker (friend's domain)

```bash
# on the server
cp .env.example .env    # set SESSION_SECRET, POSTGRES_PASSWORD, COOKIE_SECURE=true, AI key
docker compose --profile app up -d --build        # db → migrate → app on :3000
docker compose --profile app run --rm tools npm run user:create -- --email you@domain.in --password '…' --role ADMIN
```

Put a TLS reverse proxy in front of port 3000 (Caddy is the simplest:
`sitebook.example.com { reverse_proxy localhost:3000 }`). Uploaded files live in the `uploads`
volume and the database in `pgdata` — back both up. Remove the `ports` mapping for `db` in
production if you do not need direct database access.

---

## CRUD coverage by module

Checked module by module before release. "Void/archive" means the row is kept with who did it, when
and why (audit log); financial, stock and evidence rows are never hard-deleted.

| Module | List | Create | View | Edit | Void / archive | Permission (server-enforced) |
|---|---|---|---|---|---|---|
| Projects | `/projects` (search, status filter, paginated) | `/projects/new` 5-step wizard | `/projects/[id]` (7 tabs) | Section modals: basics, site, building, estimate | Status → Archived (reason); restore | Admin/Manager write. Engineer: assigned only, GPS only. Viewer read |
| Floors & slabs | Project overview | Wizard / building modal | Overview table + slab drawing | Building modal (estimate recalculated) | Removed only if nothing refers to them | Admin/Manager |
| Clients | `/clients` | Modal, or inline from wizard | `/clients/[id]` (projects, balances, documents) | Modal | Deactivate / activate (reason) | Admin/Manager write; money hidden from Engineer |
| Vendors / Contractors | `/vendors` (type filter) | Modal | `/vendors/[id]` (account by project, transactions, documents) | Modal | Deactivate / activate (reason) | Admin/Manager write; ledger hidden from Engineer |
| Transactions (8 types) | `/transactions` + project tab (type, phase, slab, date filters) | Two-step modal ("What happened?") or AI draft | `/transactions/[id]` (bills, history) | Modal (amount recomputed) | Void (reason) | Admin/Manager. Engineer: Labor only, at rate card, no money |
| Labor attendance | `/labor` | Modal (Engineer too) | Transaction view | Modal (Engineer too) | Void (reason) | Engineer on assigned projects; never sees cost |
| Labor payments & pending | `/labor?tab=payments` | "Record payment" modal | Transaction view | Modal | Void (reason) | Admin/Manager; Viewer read |
| Labor daily rates | `/labor?tab=rates` | Modal | Row in list | Modal | Deactivate / activate | Admin/Manager; Engineer sees types only |
| Material catalogue | `/materials?tab=catalogue` | Modal | `/materials/catalogue/[id]` | Modal | Deactivate / activate (reason) | Admin/Manager |
| Stock summary | `/materials` (per project) | — (derived) | Table: ordered → purchased → received → used → remaining | — | — | All; value column hidden from Engineer |
| Deliveries (received) | `/materials?tab=deliveries` | Modal, or AI challan draft | `/materials/deliveries/[id]` | Modal (cannot go below used) | Void (reason; blocked if used) | Engineer + Admin/Manager create/edit; void Admin/Manager |
| Material use | `/materials?tab=usage` | Modal (limited to stock) | `/materials/usage/[id]` | Modal (limited to stock) | Void (reason) | Engineer + Admin/Manager create/edit; void Admin/Manager |
| Purchase orders (optional) | `/materials?tab=orders` | Modal with lines | `/materials/orders/[id]` (received vs ordered) | Modal while open | Close / reopen / void (reason) | Admin/Manager; hidden from Engineer |
| Activities & progress | `/progress`, project tab | Modal | `/progress/activities/[id]` (updates, photos) | Modal; "Update" records progress | Archive / restore (reason) | Engineer + Admin/Manager; archive Admin/Manager |
| Progress updates | `/progress?tab=updates` | "Update" modal | Activity view | Append-only (correct with a new update) | — | Engineer + Admin/Manager |
| Documents & site photos | `/documents`, project tabs | Upload modal (any record) | `/documents/[id]` (preview, history) | Modal (title, caption, kind) | Archive / restore (reason) | Engineer: photos, challans, drawings; bills/agreements Admin/Manager only |
| AI drafts | `/upload` | Upload form | `/upload/[id]` (document, checks) | Review form | Reject (reason); Admin may delete unconfirmed drafts | Bills: Admin/Manager. Challans: Engineer too |
| Users | `/settings?tab=users` | Modal | `/settings/users/[id]` | Modal, reset password | Deactivate / activate (reason) | Admin only |
| Company settings | `/settings?tab=company` | — | Settings | Form | — | Admin/Manager |

Every list is paginated (20 per page; photos 24).

---

## Project layout

```
src/
  app/                 pages (thin) and api/ routes (thin, one route() wrapper)
  components/ui/       reusable design-system components, one per file
  components/…         feature components (projects, transactions, materials, upload, …)
  lib/                 pure, shared code: money, qty, area, estimate, dates, gstin, validation, domain
  server/
    services/          all business rules (zod → permission/scope → db.transaction → audit)
    ai/                DocumentReader interface, Anthropic + OpenRouter readers, normalize + checks
    db/                Drizzle schema and client
    auth/, http/       session, permissions, route wrapper
drizzle/               SQL migrations
scripts/               migrate, seed, create-user
tests/unit, tests/integration
```

See `ARCHITECTURE.md` for how to add a module or a field, `CLAUDE.md` for the rules in short, and
`UI-NOTES.md` for decisions made where the brief was open.
