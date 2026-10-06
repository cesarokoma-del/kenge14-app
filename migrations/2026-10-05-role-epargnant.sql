-- Role 'epargnant' : un enfant peut consulter son propre compte d'epargne (lecture seule)
-- 1. Elargir les roles autorises
-- 2. Lier un compte d'epargne a un profil (un enfant = un compte)
-- 3. Policies SELECT limitees au compte de l'utilisateur ; aucune ecriture

begin;

-- 1. Roles autorises
alter table public.profils drop constraint if exists profils_role_check;
alter table public.profils
  add constraint profils_role_check
  check (role = any (array['bailleur'::text, 'gerant'::text, 'locataire'::text, 'epargnant'::text]));

-- 2. Lien compte -> profil
alter table public.comptes_epargne
  add column if not exists profil_id uuid references public.profils(id) on delete set null;
create unique index if not exists comptes_epargne_profil_id_key
  on public.comptes_epargne(profil_id) where profil_id is not null;

-- 3. Lecture seule pour l'epargnant, sur son compte uniquement
drop policy if exists "Epargnant lit son compte epargne" on public.comptes_epargne;
create policy "Epargnant lit son compte epargne"
on public.comptes_epargne
for select
using (
  profil_id = auth.uid()
  and exists (
    select 1 from public.profils p
    where p.id = auth.uid() and p.actif = true and p.role = 'epargnant'
  )
);

drop policy if exists "Epargnant lit ses mouvements epargne" on public.mouvements_epargne;
create policy "Epargnant lit ses mouvements epargne"
on public.mouvements_epargne
for select
using (
  exists (
    select 1
    from public.comptes_epargne c
    join public.profils p on p.id = auth.uid()
    where c.id = mouvements_epargne.compte_id
      and c.profil_id = auth.uid()
      and p.actif = true
      and p.role = 'epargnant'
  )
);

commit;
