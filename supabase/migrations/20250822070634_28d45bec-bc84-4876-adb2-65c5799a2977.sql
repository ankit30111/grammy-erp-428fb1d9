
-- 1) Per-receipt IQC confirmation table for CAPA implementation
create table if not exists public.capa_implementation_checks (
  id uuid primary key default gen_random_uuid(),
  -- Which CAPA this check is for
  capa_category text not null,                  -- e.g. 'vendor' | 'part_analysis' | 'production' | 'line_rejection'
  reference_id uuid not null,                   -- id of the CAPA record in its source table (e.g. iqc_vendor_capa.id)
  -- Link to the inspection context
  grn_item_id uuid references public.grn_items(id) on delete set null,
  raw_material_id uuid references public.raw_materials(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  -- The verification captured during IQC
  implemented boolean not null,
  remarks text,
  verified_by uuid,                             -- filled by trigger if null
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.update_capa_implementation_checks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_update_capa_implementation_checks_updated_at on public.capa_implementation_checks;
create trigger trg_update_capa_implementation_checks_updated_at
before update on public.capa_implementation_checks
for each row
execute function public.update_capa_implementation_checks_updated_at();

-- Auto-fill verified_by with auth.uid() on insert when missing
create or replace function public.set_verified_by_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified_by is null then
    new.verified_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_verified_by_on_insert on public.capa_implementation_checks;
create trigger trg_set_verified_by_on_insert
before insert on public.capa_implementation_checks
for each row
execute function public.set_verified_by_on_insert();

-- RLS
alter table public.capa_implementation_checks enable row level security;

-- Read policy: any authenticated user can read (consistent with other quality tables)
drop policy if exists "Authenticated users can read capa checks" on public.capa_implementation_checks;
create policy "Authenticated users can read capa checks"
on public.capa_implementation_checks
for select
to authenticated
using (true);

-- Insert policy: any authenticated user can insert
drop policy if exists "Authenticated users can insert capa checks" on public.capa_implementation_checks;
create policy "Authenticated users can insert capa checks"
on public.capa_implementation_checks
for insert
to authenticated
with check (auth.uid() is not null);

-- Update/Delete policy: record owner or admin
drop policy if exists "Owners or admins can update capa checks" on public.capa_implementation_checks;
create policy "Owners or admins can update capa checks"
on public.capa_implementation_checks
for update
to authenticated
using (
  verified_by = auth.uid()
  or exists (
    select 1 from public.user_accounts ua
    where ua.id = auth.uid() and ua.role = 'admin'
  )
);

drop policy if exists "Owners or admins can delete capa checks" on public.capa_implementation_checks;
create policy "Owners or admins can delete capa checks"
on public.capa_implementation_checks
for delete
to authenticated
using (
  verified_by = auth.uid()
  or exists (
    select 1 from public.user_accounts ua
    where ua.id = auth.uid() and ua.role = 'admin'
  )
);

-- 2) Helper view to link approved CAPAs with material/vendor for easy lookup in IQC
-- We enrich capa_approvals_view with raw_material_id and vendor_id when available.

create or replace view public.capa_tracking_with_links as
select
  cav.*,
  coalesce(gi.raw_material_id, ccp.raw_material_id) as raw_material_id,
  ivc.vendor_id as vendor_id
from public.capa_approvals_view cav
left join public.iqc_vendor_capa ivc
  on cav.capa_category = 'vendor' and cav.reference_id = ivc.id
left join public.grn_items gi
  on ivc.grn_item_id = gi.id
left join public.customer_complaint_parts ccp
  on cav.capa_category = 'part_analysis' and cav.reference_id = ccp.id;
