-- Lien entre un contrat issu d'un renouvellement et son predecesseur.
-- Permet : badge "Renouvele" sur l'ancien contrat, et acces a l'avenant depuis le nouveau.

begin;

alter table public.contrats
  add column if not exists contrat_precedent_id uuid references public.contrats(id) on delete set null;

create index if not exists contrats_contrat_precedent_id_idx
  on public.contrats(contrat_precedent_id);

-- Remplissage pour les renouvellements deja traites :
-- meme appartement, meme locataire, nouveau contrat demarrant autour de la fin de l'ancien.
update public.contrats nouv
set contrat_precedent_id = anc.id
from public.renouvellements r
join public.contrats anc on anc.id = r.contrat_id
where r.statut = 'traite'
  and nouv.appartement_id = anc.appartement_id
  and nouv.locataire_id = anc.locataire_id
  and nouv.id <> anc.id
  and nouv.date_debut >= anc.date_fin - interval '7 days'
  and nouv.contrat_precedent_id is null;

commit;
