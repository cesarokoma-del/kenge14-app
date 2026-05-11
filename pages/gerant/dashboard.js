import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import LayoutGerant from '../../components/LayoutGerant'
import { 
  getProfilUtilisateur,
  getLocatairesEnRetard,
  getDemandesEnAttente,
  getAppartementsVacants
} from '../../lib/supabase'

export default function DashboardGerant() {
  const router = useRouter()
  const [chargement, setChargement] = useState(true)
  const [profil, setProfil] = useState(null)
  const [retards, setRetards] = useState([])
  const [nbDemandes, setNbDemandes] = useState(0)
  const [nbVacants, setNbVacants] = useState(0)

  useEffect(() => {
    chargerToutesLesDonnees()
  }, [])

  async function chargerToutesLesDonnees() {
    setChargement(true)

    // Tout charger en parallèle (plus rapide)
    const [
      { profil: p },
      { data: r },
      { count: nbD },
      { count: nbV }
    ] = await Promise.all([
      getProfilUtilisateur(),
      getLocatairesEnRetard(),
      getDemandesEnAttente(),
      getAppartementsVacants()
    ])

    setProfil(p)
    setRetards(r || [])
    setNbDemandes(nbD)
    setNbVacants(nbV)
    setChargement(false)
  }

  // Nettoie un numéro de téléphone pour WhatsApp/Tel
  // Ex: "+243 822 842 682" → "243822842682"
  function nettoyerNumero(tel) {
    return (tel || '').replace(/[^\d]/g, '')
  }

  // Ouvre WhatsApp Web/App avec un message pré-rempli
  function ouvrirWhatsApp(loc) {
  const numero = nettoyerNumero(loc.telephone)
  if (!numero) {
    alert('⚠️ Pas de numéro de téléphone enregistré pour ce locataire.')
    return
  }
  const message = encodeURIComponent(
    `Bonjour ${loc.noms_complet},

J'espère que vous allez bien.

Je me permets de vous écrire concernant le paiement du loyer de ${loc.appartement}. Votre dernier paiement enregistré concerne le mois de ${loc.dernier_mois_paye}.

À ce jour, vous avez ${loc.mois_de_retard} mois de loyer en retard. Pourriez-vous me confirmer le paiement dans les meilleurs délais ?

Merci de votre attention.

Cordialement,
La gérance KENGE 14`
  )
  window.open(`https://wa.me/${numero}?text=${message}`, '_blank')
}

  // Ouvre l'appli Téléphone du device
  function appeler(telephone) {
    const numero = nettoyerNumero(telephone)
    if (!numero) {
      alert('⚠️ Pas de numéro de téléphone enregistré pour ce locataire.')
      return
    }
    window.location.href = `tel:+${numero}`
  }

  // ─── État Chargement ─────────────────────────────────────
  if (chargement) {
    return (
      <LayoutGerant activePage="dashboard">
        <div className="flex justify-center items-center h-64">
          <p className="text-amber-600 text-lg">Chargement...</p>
        </div>
      </LayoutGerant>
    )
  }

  // ─── Page principale ─────────────────────────────────────
  return (
    <LayoutGerant activePage="dashboard">
      
      {/* Salutation */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">
          Bonjour {profil?.nom_complet || 'Gérant'} 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Voici ce qui demande votre attention aujourd'hui
        </p>
      </div>

      {/* ═══ CARTES D'ALERTE (3 chiffres clés) ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        
        {/* Carte 1 : Loyers en retard */}
        <div className={`
          rounded-2xl shadow-md p-6 border-2 transition-transform hover:scale-105
          ${retards.length > 0 
            ? 'bg-red-50 border-red-300' 
            : 'bg-emerald-50 border-emerald-300'}
        `}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-semibold ${retards.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {retards.length > 0 ? '🚨 Loyers en retard' : '✅ Loyers à jour'}
            </p>
            <span className="text-2xl">
              {retards.length > 0 ? '⏰' : '🎯'}
            </span>
          </div>
          <p className={`text-4xl font-bold ${retards.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {retards.length}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {retards.length > 0 ? 'À relancer' : 'Aucun retard ce mois'}
          </p>
        </div>

        {/* Carte 2 : Demandes en attente */}
        <div className={`
          rounded-2xl shadow-md p-6 border-2 transition-transform hover:scale-105
          ${nbDemandes > 0 
            ? 'bg-blue-50 border-blue-300' 
            : 'bg-gray-50 border-gray-200'}
        `}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-semibold ${nbDemandes > 0 ? 'text-blue-700' : 'text-gray-600'}`}>
              📨 Demandes
            </p>
            <span className="text-2xl">📋</span>
          </div>
          <p className={`text-4xl font-bold ${nbDemandes > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
            {nbDemandes}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {nbDemandes > 0 ? 'À traiter' : 'Aucune demande en attente'}
          </p>
        </div>

        {/* Carte 3 : Appartements vacants */}
        <div className={`
          rounded-2xl shadow-md p-6 border-2 transition-transform hover:scale-105
          ${nbVacants > 0 
            ? 'bg-amber-50 border-amber-300' 
            : 'bg-emerald-50 border-emerald-300'}
        `}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-sm font-semibold ${nbVacants > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              🏠 Appts vacants
            </p>
            <span className="text-2xl">🔑</span>
          </div>
          <p className={`text-4xl font-bold ${nbVacants > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {nbVacants}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {nbVacants > 0 ? 'À louer' : 'Tous occupés'}
          </p>
        </div>
      </div>

      {/* ═══ LISTE DES LOCATAIRES EN RETARD ═══ */}
      {retards.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-red-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            🚨 Locataires à relancer
          </h2>
          <div className="space-y-3">
            {retards.map((loc) => (
              <div 
                key={loc.contrat_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-red-50 rounded-xl border border-red-200"
              >
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg">
                    {loc.noms_complet}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    🏠 {loc.appartement} · 📅 Dernier paiement : <strong>{loc.dernier_mois_paye}</strong>
                  </p>
                  <p className="text-sm text-red-700 font-semibold mt-1">
                    ⏰ {loc.mois_de_retard} mois de retard
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => appeler(loc.telephone)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2"
                  >
                    📞 Appeler
                  </button>
                  <button
                    onClick={() => ouvrirWhatsApp(loc)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2"
                  >
                    💬 WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ RACCOURCIS RAPIDES ═══ */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          📋 Raccourcis rapides
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          
          <button
            onClick={() => router.push('/locataires')}
            className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-300 rounded-xl transition text-left"
          >
            <span className="text-3xl">👥</span>
            <div>
              <p className="font-semibold text-gray-800">Voir tous les locataires</p>
              <p className="text-xs text-gray-600">Coordonnées et contrats actifs</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/gerant/paiement-cash')}
            className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-300 rounded-xl transition text-left"
          >
            <span className="text-3xl">💵</span>
            <div>
              <p className="font-semibold text-gray-800">Enregistrer paiement cash</p>
              <p className="text-xs text-gray-600">Si un locataire vous remet de l'argent</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/depenses')}
            className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-300 rounded-xl transition text-left"
          >
            <span className="text-3xl">📝</span>
            <div>
              <p className="font-semibold text-gray-800">Enregistrer dépense</p>
              <p className="text-xs text-gray-600">Réparation, achat, etc.</p>
            </div>
          </button>

          <button
            onClick={() => router.push('/demandes')}
            className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-amber-50 border border-gray-200 hover:border-amber-300 rounded-xl transition text-left"
          >
            <span className="text-3xl">📨</span>
            <div>
              <p className="font-semibold text-gray-800">Voir demandes candidats</p>
              <p className="text-xs text-gray-600">Personnes intéressées par un appartement</p>
            </div>
          </button>

        </div>
      </div>

    </LayoutGerant>
  )
}