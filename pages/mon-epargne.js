import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import RouteGuard, { viderCacheAcces } from '../components/RouteGuard'
import { getProfilUtilisateur, getComptesEpargne, getMouvementsEpargne, signOut } from '../lib/supabase'
import { formatDateFR } from '../lib/dateUtils'
import { genererReleveEpargnePDF } from '../lib/genererReleveEpargnePDF'

const LIBELLES = {
  depot: { texte: 'Dépôt', signe: '+', classe: 'text-emerald-700' },
  retrait_retour: { texte: 'Retrait (retour en banque)', signe: '−', classe: 'text-red-600' },
  retrait_depense: { texte: 'Retrait (dépense)', signe: '−', classe: 'text-red-600' },
}

export default function MonEpargnePage() {
  return (
    <RouteGuard rolesAutorises={['epargnant']}>
      <MonEpargne />
    </RouteGuard>
  )
}

function MonEpargne() {
  const router = useRouter()
  const [profil, setProfil] = useState(null)
  const [compte, setCompte] = useState(null)
  const [mouvements, setMouvements] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  useEffect(() => { charger() }, [])

  async function charger() {
    setChargement(true)
    const { profil: p } = await getProfilUtilisateur()
    setProfil(p)

    const { data: comptes, error } = await getComptesEpargne()
    if (error) { setErreur(error.message); setChargement(false); return }

    const monCompte = (comptes || [])[0] || null
    setCompte(monCompte)

    if (monCompte) {
      const { data: mvts } = await getMouvementsEpargne(monCompte.id)
      setMouvements(mvts || [])
    }
    setChargement(false)
  }

  async function telechargerReleve() {
    const res = await genererReleveEpargnePDF(compte.id)
    if (!res.success) alert('Erreur : ' + res.error)
  }

  async function deconnexion() {
    viderCacheAcces()
    await signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tete */}
      <header className="bg-emerald-700 text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center font-serif italic font-bold">
              K14
            </div>
            <div>
              <div className="font-bold leading-tight">Mon épargne</div>
              <div className="text-xs text-emerald-100">{profil?.nom_complet || ''}</div>
            </div>
          </div>
          <button
            onClick={deconnexion}
            className="text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {chargement && (
          <div className="text-center text-gray-500 py-12">Chargement...</div>
        )}

        {!chargement && erreur && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            ⚠️ {erreur}
          </div>
        )}

        {!chargement && !erreur && !compte && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Aucun compte d'épargne n'est encore rattaché à ton profil. Demande au bailleur.
          </div>
        )}

        {!chargement && compte && (
          <>
            {/* Solde */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
              <div className="text-sm text-gray-500">Compte de {compte.nom}</div>
              <div className={`text-4xl font-bold mt-1 ${compte.solde < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {Number(compte.solde).toFixed(0)} USD
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Ouvert le {formatDateFR(compte.date_ouverture)}
                {compte.statut !== 'ouvert' && ' · compte fermé'}
              </div>
              <button
                onClick={telechargerReleve}
                className="mt-4 text-sm px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition"
              >
                Relevé PDF
              </button>
            </section>

            {/* Historique */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-bold text-gray-900 mb-3">
                Historique
                <span className="ml-2 text-sm font-normal text-gray-500">({mouvements.length})</span>
              </h2>

              {mouvements.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun mouvement pour l'instant.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {mouvements.map(m => {
                    const lib = LIBELLES[m.type] || { texte: m.type, signe: '', classe: 'text-gray-700' }
                    return (
                      <div key={m.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">{lib.texte}</div>
                          {m.motif && <div className="text-xs text-gray-500 mt-0.5">{m.motif}</div>}
                          <div className="text-xs text-gray-400 mt-0.5">{formatDateFR(m.date_mouvement)}</div>
                        </div>
                        <div className={`text-sm font-bold shrink-0 ${lib.classe}`}>
                          {lib.signe}{Number(m.montant).toFixed(0)} USD
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">
        © 2026 KENGE14 · Consultation seule
      </footer>
    </div>
  )
}
