# UI-NOTES — decisions where the brief was open

Each item is the simplest option that fits; change them in one place if the firm prefers otherwise.

## Access
1. **Who sees which projects.** Engineers see only projects they are assigned to (Team tab).
   Admin, Manager and Viewer see every project, so only engineers can be assigned.
2. **Engineers and money.** Services strip every money value (amount, rate, budgets, KPIs, vendor
   ledgers, purchase orders, bill and agreement documents) for engineers. The Budget tab, Reports
   and purchase orders are hidden and blocked on the server.
3. **Engineer attendance rate.** Engineers record labor type, workers and days; the daily rate comes
   from the rate card (Labor → Daily rates), so they never type or see money. Managers can override
   the rate on an entry. Changing a rate does not change past entries.
4. **Engineer documents.** Engineers can upload photos, delivery challans, drawings and "other";
   bills and agreements are Admin/Manager only. Engineers can upload challans to the AI reader and
   confirm deliveries, but not bills.
5. **Engineer site edits.** Engineers can set a project's GPS (for the "add it later" reminder) but
   not other site details.

## Money rules
6. **Labor transactions are attendance.** Choosing "Labor" in "What happened?" records attendance
   (labor type × workers × days × rate). Its cost is part of actual cost. Paying a labor party is a
   "Contractor payment".
7. **Pending payments.** Per vendor per project: costs not marked "Paid on the spot" minus
   contractor payments to that vendor. A negative balance is shown as an **advance** and is not
   netted against other vendors. Costs with no vendor, and all site expenses, count as paid on the spot.
8. **Machinery** is a transaction type (qty = hours/days/trips × rate) and counts in actual cost.
9. **Client payment** is always against the project's client.
10. **Multi-line bills** become one transaction per line, all with the same bill number
    (unique per vendor + bill number + line, ignoring void rows). GST on a bill is a separate
    "Other" line so totals match the bill.

## Projects and estimate
11. **"Floors above ground" excludes the ground floor** (G+2 → 2), matching the reference image's
    "3 floors (G+2)". The ground floor always exists; basements are below it; the optional terrace
    sits on top.
12. **Reference image inconsistency.** Its floor rows (1,500 + 1,800 + 1,500 SFT) do not add up to
    its 5,300 SFT total. The seed uses a 2,000 SFT second floor so the demo really is
    5,300 × ₹2,000 = ₹1,06,00,000.
13. **Plot shapes.** Rectangle (length × width), Trapezoid ((front + back) / 2 × depth),
    L (overall rectangle minus a corner cut-out), T (top bar + stem). Irregular: area typed in.
    The sketch is indicative, not to scale.
14. **Estimate** is recalculated on the server whenever slabs or cost/SFT change; contract value is
    optional and falls back to the estimate for client balance.
15. **Slabs with records** (transactions, material use, activities) cannot be removed in the edit
    modal; empty floors/slabs can.
16. **Project numbers** are `MYL-0001`, transactions `TXN-000001`, purchase orders `PO-00001`
    (or a number you type).

## Progress
17. Phase progress = plain average of its activities (archived ones excluded); a phase with no
    activities is 0%. Overall progress = average of the three phases.
18. Progress updates are append-only; a mistake is corrected by recording a new update.
19. Activity status follows progress: 0% not started, 1–99% in progress, 100% completed.

## Materials
20. **Purchased** = quantity on Material transactions; **ordered** = open/closed POs (optional);
    **received** = deliveries; **used** = material use; **remaining** = received − used;
    **not yet delivered** = purchased − received. Stock is per project.
21. A delivery cannot be voided or reduced below what is already used; void the usage first.

## AI
22. Reading happens during the upload request (typically 5–30 s), which is fine for 5–15 users.
    No background queue.
23. The model returns numbers as printed text; conversion to paise happens in `normalize.ts`.
    Checks allow ₹1 rounding difference.
24. A failed or disabled read still creates a draft for manual entry. "Read again" re-runs it.
25. Vendors are matched by GSTIN first, then by name; materials by name words. Matches are
    suggestions the reviewer can change.

## Design
26. DESIGN.md contains two palettes: the YAML front matter (Material-style roles, primary `#a93200`)
    and the prose "drafting" palette used by every component spec (canvas `#F4F3EF`, ink `#121517`,
    hairline `#D5D2CA`, hazard `#F05A24`, indigo `#1B2A47`, steel `#686E74`). The component specs
    win; the front matter supplies the error and tint roles. The reference image and `code.html`
    colours are not used.
27. The DESIGN.md spacing tokens are named `space-xs … space-xl` in Tailwind (`p-space-md`), because
    `--spacing-md` would silently redefine `max-w-md`.
28. Title blocks show project name, site code (project code), dates and site engineer. There is no
    drawing revision in this app, so "REV" is omitted.
29. Uppercase micro-labels are done with CSS (`label-technical`); the source text stays in sentence case.
30. Cards use compact money (₹42.50 L); tables use full Indian grouping (₹42,50,000).
31. The sidebar adds "Upload bill / challan" (with a waiting count) after Settings; on phones it is
    the Upload tab in the bottom bar.
32. Small buttons are 36px tall on desktop only; on phones every target is at least 44px.
33. `bcryptjs` (pure-JS bcrypt) is used so the Docker image needs no native build tools.
34. Date inputs use the native picker, which shows the phone's own date format (DD/MM/YYYY on
    Indian-locale phones). Everywhere else dates are displayed as DD MMM YYYY.
