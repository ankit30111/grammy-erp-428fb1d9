
# Makoro-Style ERP Redesign — Phased Rollout

You picked **Full app, page by page** + **Light with dark mode toggle** + **Warm Sand + Emerald** palette. Functionality stays 100% identical — only visuals, spacing, layout chrome, and shared components change.

## Design system (locked across all phases)

**Light theme tokens** (HSL):
- `--background: 40 33% 97%` (warm sand `#faf8f5`)
- `--card: 0 0% 100%`
- `--foreground: 220 14% 14%`
- `--muted: 38 25% 92%` (`#f0ebe3`)
- `--muted-foreground: 220 9% 42%`
- `--border: 38 18% 88%`
- `--primary: 162 80% 26%` (emerald `#0d7a5f`)
- `--primary-foreground: 0 0% 100%`
- `--accent: 162 40% 94%` (mint tint for active states)
- `--ring: 162 80% 26%`
- `--sidebar-background: 0 0% 100%`
- `--sidebar-foreground: 220 14% 25%`
- `--sidebar-accent: 162 40% 94%`
- `--sidebar-accent-foreground: 162 80% 22%`
- `--radius: 0.75rem`

**Dark theme**: same emerald primary on warm-charcoal `220 13% 9%` background, card `220 13% 12%`, border `220 8% 20%`. Toggle via `next-themes`-style class on `<html>`.

**Typography**: Keep current font stack but tighten — `text-sm` default in tables, `font-medium` row text, `text-xs uppercase tracking-wider` for column headers and sidebar group labels.

**Reusable patterns from the reference**:
- Sidebar: white bg, grouped sections (`OPERATIONS`, `PARTNERS`, `INSIGHTS`, `MANAGEMENT`) with uppercase muted labels, active item = soft mint pill + emerald icon + emerald text, hover = mint tint.
- Header: white, thin border-b, page title left, contextual selector + bell + avatar right.
- Page chrome: rounded-2xl card containing a header row (count/filters left, pill tabs + search + actions right) and the table.
- Pill tab group: muted background container, active pill = emerald bg / white text.
- Status badges: soft tinted pills (mint, amber, rose) — never solid saturated.
- Tables: no zebra; thin row dividers; `text-xs uppercase tracking-wide text-muted-foreground` headers; row hover = muted/40.
- Action buttons in rows: ghost icon buttons, emerald on hover.

## Phased rollout

I'll execute **Phase 1 in this pass** (the foundation everything else inherits). Subsequent phases land as separate approved batches so each is reviewable and low-risk.

### Phase 1 — Foundation (this pass)
1. Rewrite `src/index.css` with the new token palette (light + dark) and updated component utility classes.
2. Add `ThemeProvider` + light/dark toggle:
   - `src/contexts/ThemeContext.tsx` (persists to localStorage, sets `class="dark"` on `<html>`)
   - `src/components/Layout/ThemeToggle.tsx`
3. Redesign `src/components/Navigation/Sidebar.tsx` + `NavItem.tsx` + `SidebarHeader.tsx` + `SidebarFooter.tsx`:
   - White sidebar, grouped sections with uppercase labels (regroup `navigationConfig` into `OPERATIONS`, `PLANNING`, `QUALITY`, `PARTNERS`, `INSIGHTS`).
   - Active = soft mint pill + emerald accent bar.
4. Redesign `src/components/Layout/DashboardLayout.tsx` header (clean white, theme toggle, slimmer search).
5. Touch up shared `ui` primitives via tokens only (no API changes): `button`, `card`, `badge`, `input`, `tabs`, `table` to inherit the new radii/colors automatically.
6. Add a tiny `PageHeader` component (`src/components/Layout/PageHeader.tsx`) for consistent title + actions on every page (opt-in — not forced).

After Phase 1, every page already looks visibly cleaner because they all consume the tokens.

### Phase 2 — Operations modules
Wrap content in the Makoro card chrome, swap raw `Tabs` for pill-tab variant, restyle filter rows.
- `src/pages/Index.tsx` (dashboard)
- `src/pages/Inventory.tsx`, `src/pages/Store.tsx`, `src/pages/FinishedGoods.tsx`
- `src/pages/Production.tsx`, `src/pages/PPC.tsx`

### Phase 3 — Sales, Planning, Quality
- `src/pages/Sales.tsx`, `src/pages/sales/*`
- `src/pages/Planning*.tsx`, `src/pages/Projection.tsx`, `src/pages/Approvals.tsx`
- `src/pages/Quality.tsx`, `src/pages/quality/*`

### Phase 4 — DASH workspace
- `src/components/Layout/DashLayout.tsx` + `DashSidebar.tsx` (same Makoro chrome, keep DASH purple identity as the workspace accent only)
- All `src/pages/dash/*`

### Phase 5 — Management, HR, R&D, remaining
- `src/pages/Management.tsx`, `src/pages/management/*`
- `src/pages/UserManagement.tsx`, `src/pages/Settings.tsx`, `src/pages/Vendors.tsx`
- `src/pages/RnD.tsx`, `src/pages/rnd/*`, `src/pages/CustomerComplaints.tsx`, `src/pages/ContainerTracking.tsx`

## Guardrails

- Zero logic, hook, query, route, or DB changes — purely presentation.
- No new dependencies (theme toggle uses a tiny custom context, not `next-themes`).
- All colors via semantic HSL tokens; no hex/`text-white` in components.
- DASH workspace keeps its purple accent (`.dash-workspace` override) so the brand split remains clear.
- After each phase I'll show you what changed and wait for go-ahead before the next.

## Files modified in Phase 1

| File | Change |
|------|--------|
| `src/index.css` | Rewrite tokens + dark mode + utility classes |
| `src/contexts/ThemeContext.tsx` | Create — light/dark provider |
| `src/components/Layout/ThemeToggle.tsx` | Create — sun/moon toggle |
| `src/App.tsx` | Wrap with `ThemeProvider` |
| `src/components/Navigation/Sidebar.tsx` | Restyle, regroup sections |
| `src/components/Navigation/NavItem.tsx` | Mint-pill active state |
| `src/components/Navigation/SidebarHeader.tsx` | Cleaner brand row |
| `src/components/Navigation/SidebarFooter.tsx` | Lighter footer |
| `src/components/Navigation/navigationConfig.tsx` | Add group field to items |
| `src/components/Layout/DashboardLayout.tsx` | New header w/ theme toggle |
| `src/components/Layout/PageHeader.tsx` | Create — shared page header |

Approve to start Phase 1.
