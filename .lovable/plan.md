
# Phase 2 — Sky Blue palette + Operations chrome

## 1. Repalette to Sky Blue

Update `src/index.css` tokens (light + dark). Functionality and components untouched.

**Light:**
- `--background: 210 33% 99%` (`#fafbfc`)
- `--card: 0 0% 100%`
- `--foreground: 222 22% 14%`
- `--muted: 210 38% 96%` (`#eef4fb`)
- `--muted-foreground: 215 14% 45%`
- `--border: 214 32% 91%`
- `--primary: 213 94% 68%` (sky `#60a5fa`)
- `--primary-foreground: 222 22% 12%` (deep slate — sky is too light for white text)
- `--accent: 213 100% 96%` (very light sky tint for active states)
- `--accent-foreground: 213 80% 38%`
- `--ring: 213 94% 68%`
- Sidebar mirrors these (white bg, sky-tint active pill)

**Dark:** keep current charcoal but swap primary to `213 94% 72%` so it stays readable.

**DASH workspace** keeps its purple accent (no change).

## 2. Apply Operations chrome (presentation only)

I will only touch JSX className/layout. Hooks, queries, and props are untouched.

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Replace inline header with `PageHeader`, wrap each section in a `page-card` with a tighter `text-sm font-semibold text-muted-foreground uppercase tracking-wide` subheader, drop emoji headings, keep all widgets as-is. |
| `src/pages/Production.tsx` | Use `PageHeader`, wrap content in `page-card`, swap `TabsList` styling to the `pill-tabs` look (`bg-muted p-1 rounded-xl`, active pill = primary). Keep all 5 tabs and their content unchanged. |
| `src/pages/PPC.tsx` | Same: `PageHeader` + `page-card` wrapper + pill tabs, preserve every Tab/Card child. |
| `src/pages/FinishedGoods.tsx` | Wrap the KPI row + charts + tables in `page-card`, give the page a `PageHeader`. No data/logic changes. |
| `src/pages/Store.tsx` & `src/pages/Inventory.tsx` | Both currently just render `<StoreDashboard />` inside `DashboardLayout`. Add a `PageHeader` ("Store" / "Inventory") above it and wrap the inner dashboard in a `page-card`. `StoreDashboard` itself is left untouched. |

## 3. Reusable pill-tab style

I'll add a small `<TabsList>` className recipe used inline on each page:
`"inline-flex h-10 items-center gap-1 rounded-xl bg-muted p-1 text-sm"` with each `<TabsTrigger>` getting `"px-3 py-1.5 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground"`. No changes to the underlying primitive.

## Guardrails

- Zero changes to data hooks, queries, navigation, or routing.
- Only `src/index.css` + the six Operations page files are touched.
- Subcomponents (widgets, ProductionLinesOverview, StoreDashboard, etc.) stay as-is — they already inherit the new tokens automatically.
- No new dependencies.

Approve to ship Phase 2.
