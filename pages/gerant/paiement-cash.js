import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import LayoutGerant from '../../components/LayoutGerant'
import { supabase, getProfilUtilisateur } from '../../lib/supabase'

export default function PaiementCash() {
  const router = useRouter()
  const [chargement, setChargement] = useState(true)
  const [profil, setProfil] = useState(null)
  const [contratsActifs, setContratsActifs] = useState([])
  const [enregistrement, setEnregistrement] = useState(false)
  const [succes, setSucces] = useState(false)

  // Données du formulaire
  const [formData, setFormData] = useState({
    contrat_id: '',
    mois_concerne: '',
    montant: '',
    date_paiement: new Date().toISOString().split('T')[0],
    notes: ''
  })

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setChargement(true)

    // 1. Récupérer le profil du gérant connecté
    const { profil: p } = await getProfilUtilisateur()
    setProfil(p)

    // 2. Charger les contrats actifs (avec locataires + appartements)
    const { data: contrats } = await supabase
      .from('contrats')
      .select(`
        id,
        locataire:locataires(noms_complet),
        appartement:appartements(nom)
      `)
      .eq('statut', 'actif')

    // Trier par nom d'appartement pour faciliter la sélection
    const tries = (contrats || []).sort((a, b) => 
      (a.appartement?.nom || '').localeCompare(b.appartement?.nom || '')
    )

    setContratsActifs(tries)
    setChargement(false)
  }

  // Liste des mois disponibles (3 mois passés + mois en cours + 1 futur)
  function getMoisDisponibles() {
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const aujourdhui = new Date()
    const liste = []
    
    // De -3 mois à +1 mois (par rapport à aujourd'hui)
    for (let offset = -3; offset <= 1; offset++) {
      const date = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + offset, 1)
      const label = `${moisNoms[date.getMonth()]} ${date.getFullYear()}`
      liste.push(label)
    }
    
    return liste.reverse() // Le plus récent en premier
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Validation côté client
    if (!formData.contrat_id) {
      alert('⚠️ Veuillez sélectionner un locataire.')
      return
    }
    if (!formData.mois_concerne) {
      alert('⚠️ Veuillez sélectionner le mois concerné.')
      return
    }
    const montant = parseFloat(formData.montant)
    if (!montant || isNaN(montant) || montant <= 0) {
      alert('⚠️ Veuillez saisir un montant valide.')
      return
    }

    // Confirmation avant enregistrement
    const confirmation = confirm(
      `Confirmer l'enregistrement ?\n\n` +
      `Mois : ${formData.mois_concerne}\n` +
      `Montant : ${montant} USD\n` +
      `Date : ${formData.date_paiement}\n\n` +
      `⚠️ M. Cesar sera notifié de ce paiement saisi.\n` +
      `Cette action est tracée et ne peut être annulée que par lui.`
    )

    if (!confirmation) return

    setEnregistrement(true)

    // Enregistrer dans Supabase
    const { error } = await supabase
      .from('paiements')
      .insert({
        contrat_id: formData.contrat_id,
        montant: montant,
        date_paiement: formData.date_paiement,
        mois_concerne: formData.mois_concerne,
        methode: 'cash',
        bordereau_url: formData.notes 
          ? `[Cash via gérant] ${formData.notes}` 
          : '[Cash via gérant - Reçu en main propre]',
        statut: 'recu',
        enregistre_par: profil?.id  // 🎯 Traçabilité Phase 3
      })

    setEnregistrement(false)

    if (error) {
      alert('❌ Erreur lors de l\'enregistrement :\n' + error.message)
      return
    }

    // Succès !
    setSucces(true)
    
    // Réinitialiser le formulaire
    setFormData({
      contrat_id: '',
      mois_concerne: '',
      montant: '',
      date_paiement: new Date().toISOString().split('T')[0],
      notes: ''
    })

    // Cacher le message de succès après 5 secondes
    setTimeout(() => setSucces(false), 5000)
  }

  if (chargement) {
    return (
      <LayoutGerant activePage="paiement-cash">
        <div className="flex justify-center items-center h-64">
          <p className="text-amber-600 text-lg">Chargement...</p>
        </div>
      </LayoutGerant>
    )
  }

  return (
    <LayoutGerant activePage="paiement-cash">
      
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          💵 Enregistrer un paiement cash
        </h1>
        <p className="text-gray-600 mt-2">
          À utiliser uniquement quand un locataire vous remet de l'argent en main propre.
        </p>
      </div>

      {/* Avertissement traçabilité */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
        <div className="flex gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-900 mb-1">Action tracée</p>
            <p className="text-sm text-amber-800">
              Ce paiement sera enregistré sous votre nom (<strong>{profil?.nom_complet}</strong>) et 
              visible par M. Cesar dans l'historique. Veillez à saisir le montant exact que vous avez reçu.
            </p>
          </div>
        </div>
      </div>

      {/* Message de succès */}
      {succes && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-6 rounded-r-lg">
          <div className="flex gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold text-emerald-900 mb-1">Paiement enregistré avec succès !</p>
              <p className="text-sm text-emerald-800">
                Le paiement a été ajouté à l'historique. Vous pouvez en saisir un autre si nécessaire.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        
        {/* Locataire */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            👤 Locataire concerné <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.contrat_id}
            onChange={(e) => setFormData({ ...formData, contrat_id: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            required
          >
            <option value="">— Sélectionner un locataire —</option>
            {contratsActifs.map(c => (
              <option key={c.id} value={c.id}>
                {c.locataire?.noms_complet} ({c.appartement?.nom})
              </option>
            ))}
          </select>
        </div>

        {/* Mois concerné */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📅 Mois concerné par le paiement <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.mois_concerne}
            onChange={(e) => setFormData({ ...formData, mois_concerne: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            required
          >
            <option value="">— Sélectionner un mois —</option>
            {getMoisDisponibles().map(mois => (
              <option key={mois} value={mois}>{mois}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            💡 Le mois pour lequel le locataire vous a remis l'argent
          </p>
        </div>

        {/* Montant */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            💰 Montant reçu en USD <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.montant}
            onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
            placeholder="Ex : 300"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            ⚠️ Saisissez le montant EXACT que le locataire vous a remis
          </p>
        </div>

        {/* Date */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📆 Date de réception <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.date_paiement}
            onChange={(e) => setFormData({ ...formData, date_paiement: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            required
          />
        </div>

        {/* Notes optionnelles */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📝 Notes (optionnel)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows="3"
            placeholder="Ex : Locataire a remis le cash en main propre devant l'immeuble"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 resize-none"
          />
        </div>

        {/* Boutons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={enregistrement}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enregistrement ? '⏳ Enregistrement...' : '💾 Enregistrer le paiement cash'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/gerant/dashboard')}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold transition"
          >
            Annuler
          </button>
        </div>
      </form>

      {/* Pied de page d'aide */}
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          💡 Tous les paiements cash sont visibles dans l'historique général de l'application.<br />
          M. Cesar peut consulter et modifier les paiements à tout moment.
        </p>
      </div>

    </LayoutGerant>
  )
}