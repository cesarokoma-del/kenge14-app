-- Bloc N : le gerant peut faire un retour en stock (entree avec motif 'retour')
-- Le bailleur garde tous les droits ; le gerant : sorties + entrees 'retour' uniquement.
-- Deja execute dans le SQL Editor Supabase le 2026-10-03.

begin;

drop policy if exists inventaire_mouvements_insert on public.inventaire_mouvements;

create policy inventaire_mouvements_insert
on public.inventaire_mouvements
for insert
with check (
  exists (
    select 1 from public.profils p
    where p.id = auth.uid()
      and p.actif = true
      and (
        p.role = 'bailleur'
        or (
          p.role = 'gerant'
          and (
            inventaire_mouvements.type = 'sortie'
            or (inventaire_mouvements.type = 'entree'
                and inventaire_mouvements.motif = 'retour')
          )
        )
      )
  )
);

commit;
