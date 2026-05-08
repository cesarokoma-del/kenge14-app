import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Appartements() {
  const [appartements, setAppartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    nom: '',
    chambres: 1,
    salons: 1,
    salles_bain: 1,
    autres_elements: '',
    description_complete: '',
    loyer_base: '',
    statut: 'vacant'
  })

  useEffect(() => {
    chargerAppartements()
  }, [])

  async function chargerAppartements() {
    setLoading(true)

    // Charger sans jointure pour éviter les erreurs
    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    const { data: contratsData } = await supabase
      .from('contrats')
      .select('id, appartement_id, statut, locataire_id')

    const { data: locatairesData } = await supabase
      .from('locataires')
      .select('id, noms_complet')

    const { data: demandesData } = await supabase
      .from('demandes_location')
      .select('id, appartement_id, statut, noms_complet')

    // Calculer le statut "réel" de chaque appartement
    const apptsAvecStatut = (apptsData || []).map(appt => {
      const contratActif = contratsData?.find(c =>
        c.appartement_id === appt.id && c.statut === 'actif'
      )
      const demandeApprouvee = demandesData?.find(d =>
        d.appartement_id === appt.id && d.statut === 'approuvee'
      )

      let statutCalcule = appt.statut

      if (appt.statut !== 'en_renovation') {
        if (contratActif) {
          statutCalcule = 'loue'
        } else if (demandeApprouvee) {
          statutCalcule = 'reserve'
        } else {
          statutCalcule = 'vacant'
        }
      }

      const locataire = contratActif
        ? locatairesData?.find(l => l.id === contratActif.locataire_id)
        : null

      return {
        ...appt,
        statutCalcule,
        locataireActuel: locataire?.noms_complet || null,
        demandeReservee: demandeApprouvee?.noms_complet || null
      }
    })

    setAppartements(apptsAvecStatut)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      nom: formData.nom,
      chambres: parseInt(formData.chambres) || 0,
      salons: parseInt(formData.salons) || 0,
      salles_bain: parseInt(formData.salles_bain) || 0,
      autres_elements: formData.autres_elements || null,
      description_complete: formData.description_complete || null,
      loyer_base: parseFloat(formData.loyer_base),
      statut: formData.statut
    }

    if (!editingId) {
      dataToSave.statut = 'vacant'
    }

    if (editingId) {
      const { error } = await supabase
        .from('appartements')
        .update(dataToSave)
        .eq('id', editingId)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('appartements')
        .insert(dataToSave)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    }

    resetForm()
    chargerAppartements()
  }

  function handleEdit(appartement) {
    setFormData({
      nom: appartement.nom || '',
      chambres: appartement.chambres || 1,
      salons: appartement.salons || 1,
      salles_bain: appartement.salles_bain || 1,
      autres_elements: appartement.autres_elements || '',
      description_complete: appartement.description_complete || '',
      loyer_base: appartement.loyer_base || '',
      statut: appartement.statut || 'vacant'
    })
    setEditingId(appartement.id)
    setShowForm(true)
  }

  async function handleDelete(id, statut) {
    if (statut === 'loue') {
      alert('❌ Impossible de supprimer un appartement loué. Terminez d\'abord le contrat.')
      return
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cet appartement ?')) return

    const { error } = await supabase
      .from('appartements')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur: ' + error.message)
      return
    }

    chargerAppartements()
  }

  async function toggleRenovation(appartement) {
    const nouveauStatut = appartement.statut === 'en_renovation' ? 'vacant' : 'en_renovation'

    if (appartement.statutCalcule === 'loue') {
      alert('❌ Impossible de mettre en rénovation un appartement loué.')
      return
    }

    const { error } = await supabase
      .from('appartements')
      .update({ statut: nouveauStatut })
      .eq('id', appartement.id)

    if (error) {
      alert('Erreur: ' + error.message)
      return
    }

    chargerAppartements()
  }

  function resetForm() {
    setFormData({
      nom: '',
      chambres: 1,
      salons: 1,
      salles_bain: 1,
      autres_elements: '',
      description_complete: '',
      loyer_base: '',
      statut: 'vacant'
    })
    setEditingId(null)
    setShowForm(false)
  }

  function getStatutBadge(statut) {
    const config = {
      vacant: { label: '🟡 Vacant', class: 'bg-yellow-100 text-yellow-800' },
      reserve: { label: '🔵 Réservé', class: 'bg-blue-100 text-blue-800' },
      loue: { label: '🟢 Loué', class: 'bg-emerald-100 text-emerald-800' },
      en_renovation: { label: '🟠 En rénovation', class: 'bg-orange-100 text-orange-800' }
    }
    return config[statut] || config.vacant
  }

  if (loading) {
    return (
      <Layout activePage="appartements">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="appartements">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">🏢 Appartements</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold"
        >
          {showForm ? '❌ Annuler' : '➕ Ajouter un Appartement'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Logique automatique :</strong> Le statut d'un appartement est calculé automatiquement :
          🟡 Vacant (par défaut) → 🔵 Réservé (demande approuvée) → 🟢 Loué (contrat actif).
          Vous pouvez toggle manuellement 🟠 En rénovation.
        </p>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier l\'Appartement' : '➕ Nouvel Appartement'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom * (ex: APT-1ER, APT-2A)
              </label>
              <input
                type="text" required
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🛏️ Chambres
              </label>
              <input
                type="number" min="0"
                value={formData.chambres}
                onChange={(e) => setFormData({ ...formData, chambres: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🛋️ Salons
              </label>
              <input
                type="number" min="0"
                value={formData.salons}
                onChange={(e) => setFormData({ ...formData, salons: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🚿 Salles de bain
              </label>
              <input
                type="number" min="0"
                value={formData.salles_bain}
                onChange={(e) => setFormData({ ...formData, salles_bain: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💰 Loyer Mensuel (USD) *
              </label>
              <input
                type="number" step="0.01" required
                value={formData.loyer_base}
                onChange={(e) => setFormData({ ...formData, loyer_base: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📜 Description complète pour le contrat de bail
              </label>
              <textarea
                value={formData.description_complete}
                onChange={(e) => setFormData({ ...formData, description_complete: e.target.value })}
                rows={3}
                placeholder="Ex: studio comprenant une pièce principale faisant office de chambre/salon, un coin cuisine et une douche externe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Ce texte sera utilisé dans l'article 1 du contrat de bail. Soyez précis !
              </p>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold transition">
                {editingId ? '💾 Mettre à jour' : '✅ Enregistrer'}
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold transition">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Liste des Appartements ({appartements.length})
        </h2>

        {appartements.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun appartement enregistré.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appartements.map((appt) => {
              const badge = getStatutBadge(appt.statutCalcule)
              return (
                <div key={appt.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-gray-800">{appt.nom}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>

                  {appt.locataireActuel && (
                    <p className="text-sm bg-emerald-50 text-emerald-800 px-2 py-1 rounded mb-2">
                      👤 {appt.locataireActuel}
                    </p>
                  )}
                  {appt.demandeReservee && !appt.locataireActuel && (
                    <p className="text-sm bg-blue-50 text-blue-800 px-2 py-1 rounded mb-2">
                      📝 Réservé pour {appt.demandeReservee}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 text-sm text-gray-600 mb-2">
                    {appt.chambres > 0 && <span>🛏️ {appt.chambres} ch.</span>}
                    {appt.salons > 0 && <span>🛋️ {appt.salons} sal.</span>}
                    {appt.salles_bain > 0 && <span>🚿 {appt.salles_bain} sdb.</span>}
                  </div>

                  <p className="text-lg font-bold text-emerald-700 mt-2">
                    💰 {appt.loyer_base || 0} USD/mois
                  </p>

                  {appt.autres_elements && (
                    <p className="text-sm text-gray-500 mt-2 italic">{appt.autres_elements}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => handleEdit(appt)}
                      className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      ✏️ Modifier
                    </button>
                    {appt.statutCalcule !== 'loue' && appt.statutCalcule !== 'reserve' && (
                      <button
                        onClick={() => toggleRenovation(appt)}
                        className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        {appt.statut === 'en_renovation' ? '✅ Fin rénov' : '🔧 Rénov'}
                      </button>
                    )}
                    {appt.statutCalcule === 'vacant' && (
                      <button
                        onClick={() => handleDelete(appt.id, appt.statutCalcule)}
                        className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
