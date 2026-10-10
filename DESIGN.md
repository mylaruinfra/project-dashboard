---
name: SiteBook
colors:
  surface: '#f8f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f8f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e7e8eb'
  surface-container-highest: '#e1e2e5'
  on-surface: '#191c1e'
  on-surface-variant: '#5a4139'
  inverse-surface: '#2e3133'
  inverse-on-surface: '#eff1f3'
  outline: '#8e7067'
  outline-variant: '#e2bfb4'
  surface-tint: '#ad3300'
  primary: '#a93200'
  on-primary: '#ffffff'
  primary-container: '#d0440b'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb59e'
  secondary: '#505e7e'
  on-secondary: '#ffffff'
  secondary-container: '#cbdaff'
  on-secondary-container: '#505f7f'
  tertiary: '#575d63'
  on-tertiary: '#ffffff'
  tertiary-container: '#6f757c'
  on-tertiary-container: '#fcfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbd0'
  primary-fixed-dim: '#ffb59e'
  on-primary-fixed: '#390b00'
  on-primary-fixed-variant: '#842500'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#b8c6eb'
  on-secondary-fixed: '#0b1b37'
  on-secondary-fixed-variant: '#384765'
  tertiary-fixed: '#dde3ea'
  tertiary-fixed-dim: '#c1c7ce'
  on-tertiary-fixed: '#161c22'
  on-tertiary-fixed-variant: '#41474d'
  background: '#f8f9fc'
  on-background: '#191c1e'
  surface-variant: '#e1e2e5'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: 3.25rem
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 2rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.375rem
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: 0.01em
  label-numeric:
    fontFamily: Space Grotesk
    fontSize: 1.25rem
    fontWeight: '700'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  label-technical:
    fontFamily: Space Grotesk
    fontSize: 0.6875rem
    fontWeight: '600'
    lineHeight: 0.875rem
    letterSpacing: 0.12em
  label-code:
    fontFamily: Space Grotesk
    fontSize: 0.625rem
    fontWeight: '500'
    lineHeight: 0.75rem
    letterSpacing: 0.16em
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system combines the rigorous discipline of Swiss International Typographic Style with the utilitarian functionalism of structural engineering blueprints and architectural construction drawings. Designed for the harsh operating environments of Indian job sites—characterized by high glare, dusty mobile screens, and rapid on-site decision-making—the interface prioritizes legibility, absolute dimensional structure, and rapid situational assessment over decorative trends.

The visual tone is uncompromisingly technical, authoritative, and precise. It rejects generic SaaS tropes: there are no rounded pastel pills, soft diffuse blurs, floating elevations, or conversational emojis. Instead, structural hairline rules, technical coordinate crosshairs, architectural title blocks, and dense tabular schedules organize complex project data. Every element is anchored to a visible or implied drafting grid, communicating industrial-grade reliability, structural integrity, and uncompromising discipline for site engineers, contractors, and project owners.

## Colors

The palette is engineered for high daylight contrast, paper-like readability, and decisive industrial hierarchy:

- **Drafting Canvas Ground (`#F4F3EF`):** A warm technical drafting stone-gray that eliminates screen glare under direct sunlight while retaining the physical presence of heavyweight engineering bond paper.
- **Surface Crisp White (`#FFFFFF`):** High-density paper white reserved strictly for tabular schedule cells, critical data viewports, and primary input fields.
- **Charcoal Slate-Black (`#121517`):** The primary neutral for all primary technical headings, structural boundaries, and dimensional data. High contrast against both canvas and white surfaces.
- **Structural Hairline Gray (`#D5D2CA`):** A rigid, unyielding border and rule color used for structural 1px grid lines, column dividers, dimension tickers, and coordinate marks.
- **Industrial Safety Cadmium (`#F05A24`):** The primary action and hazard alert color. Derived from heavy equipment safety coatings, it highlights critical path delays, structural warnings, pending approvals, and primary field entries.
- **Drafting Cadet Indigo (`#1B2A47`):** The secondary system tone, drawn from traditional blueprint ink. Used for secondary status indicators, structural drawing metadata, project coordinate headers, and milestone checkpoints.
- **Muted Steel Gray (`#686E74`):** For tertiary drafting captions, unit labels, inactive grid lines, and dimensional context tags.

## Typography

The typography system operates on two distinct functional planes:
1. **Structural & Quantified Data (`Space Grotesk`):** Used for headlines, numerical aggregates, currency markers, schedule codes, and all architectural labels. Its geometric, proportional figures ensure rapid scanning of bill-of-quantities (BOQ) figures and site schedule codes.
2. **Operational Text (`Inter`):** Deployed for narrative project notes, quality inspection remarks, daily work logs, and vendor communications. Its neutral, high-x-height form ensures legibility on low-resolution smartphones under direct sun.

### Numeric & Currency Formatting Rules
All financial figures must strictly observe the Indian numbering grouping system using the Rupee symbol (`₹`):
- Values below 1 Lakh format conventionally: `₹84,500`
- Lakh values format with compact technical notation: `₹14.80 L` (e.g., `₹14,80,000` becomes `₹14.80 L`)
- Crore values format with two decimal places: `₹1.42 Cr` (e.g., `₹1,42,00,000` becomes `₹1.42 Cr`)
- Quantities and units (bags, MT, brass, sq.ft, running meters) use monospaced tabular alignments.

### Architectural Tracking Rules
All micro-labels, coordinate stamps, and section headers must use `label-technical` or `label-code` in pure uppercase with wide tracking (`letter-spacing: 0.12em` to `0.16em`).

## Layout & Spacing

The layout is anchored to a visible, modular architectural blueprint grid. Whitespace is deliberate and controlled through physical 1px hairline rules rather than empty expanse. 

### Grid Philosophy
- **Modular Drafting System:** Surfaces are bounded by 1px rules in `#D5D2CA`. Screens emulate an engineering worksheet split into coordinate zones (Zone A, B, C).
- **Asymmetric Composition:** Large technical figures and drawing title blocks occupy left-aligned visual anchors, counterbalanced by dense multi-column tabular schedules on the right.
- **Crosshair Anchor Marks:** Structural card and table boundaries feature subtle hairline corner crosses (`+` marks at 4px offset) referencing construction layout control points.

### Breakpoints & Adaptations
- **Field Mobile (< 768px):** Single-column stacked technical sheets. Grid margin is locked to `1rem` (`16px`). Tabular data utilizes fixed horizontal freeze-columns with side-scrollable measurement matrices. Touch targets retain a minimum 44px height while retaining razor-thin 1px visual borders.
- **Site Tablet / Field Lap (768px - 1024px):** 6-column modular grid with `1.5rem` gutters. Splits between daily activity logging and real-time material receipt schedules.
- **Office Desktop (> 1024px):** 12-column asymmetric layout with `2rem` outer margins. Features an integrated blueprint-style "Title Block" header on the right or top boundary containing project code, rev date, engineer in charge, and structural status.

## Elevation & Depth

This system avoids soft, atmospheric drop shadows and artificial z-plane layering. Depth is strictly architectural and structural:

- **Zero Diffusion:** Soft blur shadows are strictly prohibited (`box-shadow: none`). No element floats over the page.
- **Tonal Inset & Border Boundaries:** Depth is conveyed solely through hard mechanical borders (`1px solid #D5D2CA`) and surface color shifting (`#F4F3EF` for base background, `#FFFFFF` for data cells, `#121517` for inverted title blocks).
- **Hard Technical Occlusion:** When an element requires popover or modal behavior (e.g., concrete pour checklist, drawing revision overlay), it uses a 1px solid `#121517` border accompanied by an unblurred, hard offset shadow: `box-shadow: 4px 4px 0px 0px #121517`.
- **Title Block Recessing:** Visual prominence is achieved via reverse video: crucial KPI cells and approval blocks adopt a solid `#121517` charcoal slate background with crisp white typography and `#F05A24` hazard orange accents.

## Shapes

The shape system is strictly **Sharp (0px)** across all viewports and elements. 

- **No Radii:** Every button, card, input, dropdown, table, tag, and modal features strict 90-degree right angles (`border-radius: 0px`).
- **Drafting Corner Accents:** Select primary containers feature cropped or ticked architectural corners (diagonal 4px corner notches or 4px exterior crosshair tick marks).
- **Structural Integrity:** The zero-radius mandate evokes concrete formwork, steel I-beams, precision stone masonry, and calibrated engineering rulers. Any curved contour is an anomaly reserved solely for circular progress gauges and status dot pins.

## Components

### Title-Block Headers
Every major view or project section must begin with an architectural title block modeled after standard engineering drawing headers:
- Bounded by a `1px solid #121517` border.
- Split into technical sub-cells containing: Project Name, Site Code (e.g., `BLR-PH2-BLK-B`), Revision Number (`REV 03`), Date/Time Stamp, and Site Engineer Name.
- Rendered using uppercase `label-technical` tracking with high-contrast slate borders.

### Buttons & Action Bars
- **Primary Industrial Action:** Sharp 0px box, background `#F05A24`, text `#FFFFFF`, font `Space Grotesk` 14px bold, uppercase with `0.08em` tracking. Hover state shifts to `#121517`. Active state indents by `1px 1px`.
- **Secondary Action:** Sharp 0px box, background `#FFFFFF`, border `1px solid #121517`, text `#121517`.
- **Destructive / Stop-Work:** Sharp 0px box, background `#FFFFFF`, border `2px solid #F05A24`, text `#F05A24`.

### Tabular Schedules (Replacing Cards)
Card components are replaced by tabular schedules reminiscent of reinforcement schedules and BOQ sheets:
- Container uses `background: #FFFFFF; border: 1px solid #D5D2CA; border-radius: 0px`.
- Headers feature a subtle `#F4F3EF` background, bottom border `1px solid #121517`, text in uppercase `label-technical`.
- Alternating horizontal rules (`1px solid #D5D2CA`) separate line items (e.g., steel bar diameter, cement bags dispatched, batching plant trips).
- Data values are aligned strictly to the right for numeric figures (with Indian formatting: `₹12.4 L`, `450 MT`), left for task descriptions.

### Status Indicators & Hazard Chips
- **Chips:** Rectangular badges with 0px radius, 1px solid outline, and monospace uppercase text.
  - *Critical Path / Delay:* `#F05A24` text, `#F05A24` 1px border, background `#FFFFFF`.
  - *Engineering Verified:* `#1B2A47` text, `#1B2A47` 1px border, background `#FFFFFF`.
  - *Closed / Poured:* `#686E74` text, `#D5D2CA` 1px border, background `#F4F3EF`.
- No pill shapes.

### Input Fields & Selectors
- Background: `#FFFFFF`.
- Border: `1px solid #D5D2CA`.
- Focus state: Border transitions immediately to `2px solid #121517` or `2px solid #F05A24`.
- Labels sit above the field in pure uppercase `label-technical`, accompanied by structural dimension ticks (`|-- LABEL --|`).

### Checkboxes & Inspection Switches
- Checkboxes are 18px x 18px sharp right-angled squares with `1px solid #121517`.
- Checked state: Solid `#121517` charcoal slate fill with a crisp white diagonal cross (`✕`) or mechanical tick mark.
- Radio buttons remain square with an inset sharp solid black square indicator to maintain the drafting language.

### Milestone & Daily Progress Trackers
- Linear horizontal measurement rules calibrated like an engineer's scale rule with alternating millimeter-height tick marks.
- Completed progress is represented by a solid `#F05A24` hazard block fill bounded by vertical hairline indicators.