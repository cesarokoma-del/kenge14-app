// pages/gerant/appartements.js
// Page Appartements pour le gérant
// Liste des 5 appartements avec leur statut et un bouton d'accès aux états des lieux
// Bouton contextualisé : entrée si loué, sortie si vacant après location
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import LayoutGerant from '../../components/LayoutGerant'
import RouteGuard from '../../components/RouteGuard'
import { supabase } from '../../lib/supabase'
import { chargerEtatLieuxParContrat } from '../../lib/etatsLieux'
import { formatDateFR } from '../../lib/dateUtils'

export default function PageAppartementsGerant() {
  return (
    <RouteGuard rolesAutorises={['gerant']}>
      <Contenu />
    </RouteGuard>
  )
}

function Contenu() {
  const router = useRouter()
  const [appartements, setAppartements] = useState([])
  const [contratsParAppt, setContratsParAppt] = useState({})
  const [etatsLieux, setEtatsLieux] = useState({})
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    // 1. Charger tous les appartements
    const { data: appts, error: errA } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    if (errA) {
      setErreur('Erreur chargement appartements : ' + errA.message)
      setLoading(false)
      return
    }
    setAppartements(appts || [])

    // 2. Charger TOUS les contrats avec locataire
    const { data: contrats, error: errC } = await supabase
      .from('contrats')
      .select('*, locataire:locataires(*)')
      .order('date_debut', { ascending: false })

    if (errC) {
      setErreur('Erreur chargement contrats : ' + errC.message)
      setLoading(false)
      return
    }

    // 3. Indexer par appartement : pour chaque appt, on garde
    //    - le contrat actif (statut='actif')
    //    - sinon le dernier contrat termine
    const mapContrats = {}
    for (const c of contrats || []) {
      const apptId = c.appartement_id
      if (!mapContrats[apptId]) mapContrats[apptId] = { actif: null, dernierTermine: null }
      if (c.statut === 'actif' && !mapContrats[apptId].actif) {
        mapContrats[apptId].actif = c
      }
      if (c.statut === 'termine' && !mapContrats[apptId].dernierTermine) {
        mapContrats[apptId].dernierTermine = c
      }
    }
    setContratsParAppt(mapContrats)

    // 4. Charger les états des lieux liés à ces contrats
    //    Map { contratId: { entree, sortie } }
    const tousContrats = [
      ...Object.values(mapContrats).map(m => m.actif).filter(Boolean),
      ...Object.values(mapContrats).map(m => m.dernierTermine).filter(Boolean),
    ]
    if (tousContrats.length > 0) {
      const chargements = await Promise.all(
        tousContrats.flatMap(c => [
          chargerEtatLieuxParContrat(c.id, 'entree').then(r => ({ contratId: c.id, type: 'entree', data: r.data })),
          chargerEtatLieuxParContrat(c.id, 'sortie').then(r => ({ contratId: c.id, type: 'sortie', data: r.data })),
        ])
      )
      const mapEtats = {}
      for (const { contratId, type, data } of chargements) {
        if (!mapEtats[contratId]) mapEtats[contratId] = { entree: null, sortie: null }
        mapEtats[contratId][type] = data
      }
      setEtatsLieux(mapEtats)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <LayoutGerant>
        <div className="p-4 text-center"><p className="text-gray-500">Chargement...</p></div>
      </LayoutGerant>
    )
  }

  if (erreur) {
    return (
      <LayoutGerant>
        <div className="p-4">
          <div className="bg-red-100 border border-red-300 text-red-800 rounded-xl p-4">❌ {erreur}</div>
        </div>
      </LayoutGerant>
    )
  }

  return (
    <LayoutGerant>
      <div className="max-w-4xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🏢 Appartements</h1>
        <p className="text-gray-500 mb-6">{appartements.length} appartement{appartements.length > 1 ? 's' : ''} dans la résidence</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {appartements.map(appt => (
            <CarteAppartement
              key={appt.id}
              appartement={appt}
              contrats={contratsParAppt[appt.id]}
              etatsLieux={etatsLieux}
              onNaviguer={router.push}
            />
          ))}
        </div>
      </div>
    </LayoutGerant>
  )
}

// ============================================================
// Carte appartement avec contexte
// ============================================================

function CarteAppartement({ appartement, contrats, etatsLieux, onNaviguer }) {
  const contratActif = contrats?.actif
  const contratTermine = contrats?.dernierTermine
  const estLoue = !!contratActif
  const estVacantApresLocation = !contratActif && !!contratTermine

  // Trouver l'état des lieux pertinent (entrée si loué, sortie si vacant)
  const typeAFaire = estLoue ? 'entree' : (estVacantApresLocation ? 'sortie' : null)
  const contratPertinent = estLoue ? contratActif : contratTermine
  const etatPertinent = contratPertinent && typeAFaire
    ? etatsLieux[contratPertinent.id]?.[typeAFaire]
    : null

  // Couleurs selon contexte
  const statutBadge = estLoue
    ? { txt: '✓ LOUÉ', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
    : { txt: '⏳ VACANT', cls: 'bg-amber-100 text-amber-800 border-amber-300' }

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🏠 {appartement.nom}</h2>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statutBadge.cls}`}>
          {statutBadge.txt}
        </span>
      </div>

      {/* Infos selon contexte */}
      {estLoue ? (
        <div className="space-y-1 text-sm text-gray-700">
          <p><span className="text-gray-500">Locataire :</span> <strong>{contratActif.locataire?.noms_complet}</strong></p>
          <p><span className="text-gray-500">Loyer :</span> {contratActif.loyer} USD/mois</p>
          <p><span className="text-gray-500">Bail :</span> {formatDateFR(contratActif.date_debut)} → {formatDateFR(contratActif.date_fin)}</p>
        </div>
      ) : estVacantApresLocation ? (
        <div className="space-y-1 text-sm text-gray-700">
          <p><span className="text-gray-500">Dernier locataire :</span> <strong>{contratTermine.locataire?.noms_complet}</strong></p>
          <p><span className="text-gray-500">Contrat terminé le :</span> {formatDateFR(contratTermine.date_fin_effective || contratTermine.date_fin)}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">Aucune location à ce jour.</p>
      )}

      {/* Bouton État des lieux */}
      {typeAFaire && contratPertinent && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <BoutonEtatLieux
            type={typeAFaire}
            etat={etatPertinent}
            onClick={() => {
              const statut = etatPertinent?.statut
              const cible = (statut === 'signe_locataire' || statut === 'valide_bailleur')
                ? `/etats-lieux/${contratPertinent.id}/${typeAFaire}/apercu`
                : `/etats-lieux/${contratPertinent.id}/${typeAFaire}`
              onNaviguer(cible)
            }}
          />
        </div>
      )}
    </div>
  )
}

function BoutonEtatLieux({ type, etat, onClick }) {
  const emoji = type === 'entree' ? '📥' : '📤'
  const libelleType = type === 'entree' ? "d'entrée" : 'de sortie'

  // Texte et couleur selon statut
  let libelle, couleurClasses
  if (!etat) {
    libelle = `📋 Faire l'état des lieux ${libelleType}`
    couleurClasses = 'bg-indigo-600 hover:bg-indigo-700 text-white'
  } else if (etat.statut === 'brouillon') {
    libelle = `📋 Continuer l'état des lieux ${libelleType}`
    couleurClasses = 'bg-gray-200 hover:bg-gray-300 text-gray-800'
  } else if (etat.statut === 'signe_locataire') {
    libelle = `📋 État ${libelleType} — en attente bailleur`
    couleurClasses = 'bg-amber-200 hover:bg-amber-300 text-amber-900'
  } else if (etat.statut === 'valide_bailleur') {
    libelle = `${emoji} État ${libelleType} — validé ✓`
    couleurClasses = 'bg-emerald-200 hover:bg-emerald-300 text-emerald-900'
  }

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition shadow-sm ${couleurClasses}`}
    >
      {libelle}
    </button>
  )
}