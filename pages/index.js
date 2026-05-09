import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase, calculerSoldeBancaire } from '../lib/supabase'

export default function TableauDeBord() {
  const [stats, setStats] = useState({
    totalAppartements: 0,
    loues: 0,
    vacants: 0,
    reserves: 0,
    enRenovation: 0,
    revenuMensuelAttendu: 0,
    revenuMensuelRecu: 0,
    loyersEnRetard: 0,
    demandesEnAttente: 0,
    contratsExpirant: 0
  })
  const [paiementsRecents, setPaiementsRecents] = useState([])
  const [demandesRecentes, setDemandesRecentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tresorerie, setTresorerie] = useState(null)

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    // Charger toutes les données séparément (plus robuste)
    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')

    const { data: contratsData } = await supabase
      .from('contrats')
      .select('*')

    const { data: locatairesData } = await supabase
      .from('locataires')
      .select('id, noms_complet')

    const debutMois = new Date()
    debutMois.setDate(1)
    debutMois.setHours(0, 0, 0, 0)

    const { data: paiementsData } = await supabase
      .from('paiements')
      .select('*')
      .gte('date_paiement', debutMois.toISOString())
      .order('date_paiement', { ascending: false })
      .limit(5)

      // Tous les paiements (sans limite) pour la détection des retards
    const { data: allPaiementsData } = await supabase
      .from('paiements')
      .select('contrat_id, mois_concerne')

    const { data: demandesData } = await supabase
      .from('demandes_location')
      .select('*')
      .eq('statut', 'en_attente')
      .order('date_demande', { ascending: false })
      .limit(5)

    // Enrichir les paiements avec les infos de contrat/locataire/appartement
    const paiementsEnrichis = (paiementsData || []).map(p => {
      const contrat = contratsData?.find(c => c.id === p.contrat_id)
      const locataire = contrat ? locatairesData?.find(l => l.id === contrat.locataire_id) : null
      const appartement = contrat ? apptsData?.find(a => a.id === contrat.appartement_id) : null
      return {
        ...p,
        contrat: contrat ? { ...contrat, locataire, appartement } : null
      }
    })

    // Enrichir les demandes avec les appartements
    const demandesEnrichies = (demandesData || []).map(d => ({
      ...d,
      appartement: apptsData?.find(a => a.id === d.appartement_id) || null
    }))

    let loues = 0, vacants = 0, reserves = 0, enRenovation = 0
    let revenuMensuelAttendu = 0
    let contratsExpirant = 0

    const aujourdhui = new Date()
    const dans90Jours = new Date()
    dans90Jours.setDate(aujourdhui.getDate() + 90)

    ;(apptsData || []).forEach(appt => {
      const contratActif = contratsData?.find(c => c.appartement_id === appt.id && c.statut === 'actif')
      const demandeApprouvee = demandesData?.find(d => d.appartement_id === appt.id && d.statut === 'approuvee')

      if (appt.statut === 'en_renovation') {
        enRenovation++
      } else if (contratActif) {
        loues++
        revenuMensuelAttendu += parseFloat(contratActif.loyer || 0)

        if (contratActif.date_fin) {
          const dateFin = new Date(contratActif.date_fin)
          if (dateFin >= aujourdhui && dateFin <= dans90Jours) {
            contratsExpirant++
          }
        }
      } else if (demandeApprouvee) {
        reserves++
      } else {
        vacants++
      }
    })

    const revenuMensuelRecu = (paiementsData || [])
      .reduce((sum, p) => sum + parseFloat(p.montant || 0), 0)

    // Détection des retards basée sur le "mois concerné" du dernier paiement
    const moisFrToNumber = (moisStr) => {
      if (!moisStr) return null
      const moisMap = {
        'Janvier': 0, 'Février': 1, 'Mars': 2, 'Avril': 3,
        'Mai': 4, 'Juin': 5, 'Juillet': 6, 'Août': 7,
        'Septembre': 8, 'Octobre': 9, 'Novembre': 10, 'Décembre': 11
      }
      const parts = moisStr.trim().split(' ')
      if (parts.length !== 2) return null
      const mois = moisMap[parts[0]]
      const annee = parseInt(parts[1])
      if (mois === undefined || isNaN(annee)) return null
      return annee * 12 + mois
    }

    const moisCourant = aujourdhui.getFullYear() * 12 + aujourdhui.getMonth()

    let loyersEnRetard = 0
    ;(contratsData || []).filter(c => c.statut === 'actif').forEach(contrat => {
      const paiementsContrat = (allPaiementsData || []).filter(p => p.contrat_id === contrat.id)
      if (paiementsContrat.length === 0) return // Nouveau contrat sans paiement : on ne compte pas

      const moisPayes = paiementsContrat
        .map(p => moisFrToNumber(p.mois_concerne))
        .filter(m => m !== null)
      if (moisPayes.length === 0) return

      const dernierMoisPaye = Math.max(...moisPayes)
      const difference = moisCourant - dernierMoisPaye

      // Différence ≤ 1 = en ordre, ≥ 2 = en retard
      if (difference > 1) {
        loyersEnRetard++
      }
    })

    setStats({
      totalAppartements: apptsData?.length || 0,
      loues, vacants, reserves, enRenovation,
      revenuMensuelAttendu, revenuMensuelRecu, loyersEnRetard,
      demandesEnAttente: demandesData?.length || 0,
      contratsExpirant
    })

    setPaiementsRecents(paiementsEnrichis)
    setDemandesRecentes(demandesEnrichies)

    // Charger les données de trésorerie
    const soldeData = await calculerSoldeBancaire()
    setTresorerie(soldeData)

    setLoading(false)
  }

  if (loading) {
    return (
      <Layout activePage="dashboard">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="dashboard">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Tableau de Bord</h1>

      {(stats.demandesEnAttente > 0 || stats.contratsExpirant > 0 || stats.loyersEnRetard > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {stats.demandesEnAttente > 0 && (
            <Link href="/demandes" className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded hover:bg-yellow-100 transition">
              <p className="text-sm text-yellow-700">📝 Demandes en attente</p>
              <p className="text-2xl font-bold text-yellow-800">{stats.demandesEnAttente}</p>
              <p className="text-xs text-yellow-600 mt-1">Cliquez pour traiter</p>
            </Link>
          )}
          {stats.contratsExpirant > 0 && (
            <Link href="/contrats" className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded hover:bg-orange-100 transition">
              <p className="text-sm text-orange-700">⏰ Contrats expirant (90j)</p>
              <p className="text-2xl font-bold text-orange-800">{stats.contratsExpirant}</p>
              <p className="text-xs text-orange-600 mt-1">Cliquez pour renouveler</p>
            </Link>
          )}
          {stats.loyersEnRetard > 0 && (
            <Link href="/paiements" className="bg-red-50 border-l-4 border-red-500 p-4 rounded hover:bg-red-100 transition">
              <p className="text-sm text-red-700">⚠️ Loyers en retard</p>
              <p className="text-2xl font-bold text-red-800">{stats.loyersEnRetard}</p>
              <p className="text-xs text-red-600 mt-1">Cliquez pour relancer</p>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-6 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Appartements</p>
            <span className="text-2xl">🏢</span>
          </div>
          <p className="text-3xl font-bold text-blue-700">{stats.totalAppartements}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg p-6 border border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">🟢 Loués</p>
            <span className="text-2xl">🏠</span>
          </div>
          <p className="text-3xl font-bold text-emerald-700">{stats.loues}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.vacants} vacant(s)</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-lg p-6 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">🟡 Vacants</p>
            <span className="text-2xl">🔍</span>
          </div>
          <p className="text-3xl font-bold text-yellow-700">{stats.vacants}</p>
          {stats.reserves > 0 && (
            <p className="text-xs text-blue-600 mt-1">+ {stats.reserves} réservé(s)</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg p-6 border border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Revenu Attendu</p>
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{stats.revenuMensuelAttendu.toFixed(0)} USD</p>
          <p className="text-xs text-gray-500 mt-1">Par mois</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg p-6 border border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Reçu ce mois</p>
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{stats.revenuMensuelRecu.toFixed(0)} USD</p>
          <p className="text-xs text-gray-500 mt-1">Paiements reçus</p>
        </div>
      </div>
      {/* Section Trésorerie */}
        {tresorerie && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">🏦 Trésorerie</h2>
              {!tresorerie.hasSoldeInitial && (
                <Link href="/parametres" className="text-sm text-amber-700 underline">
                  ⚠️ Configurer le solde initial
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg p-6 border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">💰 Solde Brut</p>
                  <span className="text-2xl">💰</span>
                </div>
                <p className={`text-3xl font-bold ${tresorerie.soldeBrut < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{tresorerie.soldeBrut.toFixed(0)} USD</p>
                <p className="text-xs text-gray-500 mt-1">Total en banque</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl shadow-lg p-6 border border-yellow-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-600">🛡️ Garanties</p>
                  <span className="text-2xl">🛡️</span>
                </div>
                <p className="text-3xl font-bold text-yellow-700">{tresorerie.totalGaranties.toFixed(0)} USD</p>
                <p className="text-xs text-gray-500 mt-1">À restituer aux locataires</p>
              </div>

              <div className={`rounded-2xl shadow-lg p-6 border ${
              tresorerie.soldeNet < 0
                ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
                : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">{tresorerie.soldeNet < 0 ? '🚨' : '✅'} Solde Net</p>
                <span className="text-2xl">{tresorerie.soldeNet < 0 ? '🚨' : '✅'}</span>
              </div>
              <p className={`text-3xl font-bold ${tresorerie.soldeNet < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                {tresorerie.soldeNet.toFixed(0)} USD
              </p>
              {tresorerie.soldeNet < 0 ? (
                <p className="text-xs text-red-700 mt-1 font-semibold">
                  ⚠️ Garanties touchées de {Math.abs(tresorerie.soldeNet).toFixed(0)} USD
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Réellement disponible</p>
              )}
            </div>
            </div>
          </div>
        )}

      {demandesRecentes.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-yellow-200 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">📝 Demandes en attente</h2>
            <Link href="/demandes" className="text-sm text-emerald-600 hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-2">
            {demandesRecentes.map((d) => (
              <div key={d.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                <div>
                  <p className="font-semibold">{d.noms_complet}</p>
                  <p className="text-sm text-gray-600">{d.appartement?.nom || '?'} • {d.telephone}</p>
                </div>
                <p className="text-xs text-gray-500">{new Date(d.date_demande).toLocaleDateString('fr-FR')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">📅 Paiements Récents</h2>
          <Link href="/paiements" className="text-sm text-emerald-600 hover:underline">Voir tout →</Link>
        </div>
        {paiementsRecents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun paiement reçu ce mois.</p>
        ) : (
          <div className="space-y-2">
            {paiementsRecents.map((p) => (
              <div key={p.id} className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                <div>
                  <p className="font-semibold">{p.contrat?.locataire?.noms_complet || 'Locataire inconnu'}</p>
                  <p className="text-sm text-gray-600">
                    🏢 {p.contrat?.appartement?.nom || '?'} • {new Date(p.date_paiement).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <p className="text-xl font-bold text-emerald-700">{parseFloat(p.montant).toFixed(0)} USD</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
