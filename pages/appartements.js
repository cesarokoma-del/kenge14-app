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
    adresse: '',
    type: '',
    superficie: '',
    loyer_mensuel: '',
    statut: 'vacant',
    description: ''
  })

  useEffect(() => {
    chargerAppartements()
  }, [])

  async function chargerAppartements() {
    setLoading(true)

    // Récupérer les appartements avec leurs contrats actifs et demandes en attente
    const { data: apptsData } = await supabase
      .from('appartements')
      .select(`
        *,
        contrats(id, statut, locataire:locataires(noms_complet)),
        demandes_location(id, statut, noms_complet)
      `)
      .order('nom')

    // Calculer le statut "réel" de chaque appartement
    const apptsAvecStatut = (apptsData || []).map(appt => {
      const contratActif = appt.contrats?.find(c => c.statut === 'actif')
      const demandeApprouvee = appt.demandes_location?.find(d => d.statut === 'approuvee')

      let statutCalcule = appt.statut

      // Si "en_renovation", on garde ce statut (manuel)
      if (appt.statut !== 'en_renovation') {
        if (contratActif) {
          statutCalcule = 'loue'
        } else if (demandeApprouvee) {
          statutCalcule = 'reserve'
        } else {
          statutCalcule = 'vacant'
        }
      }

      return {
        ...appt,
        statutCalcule,
        locataireActuel: contratActif?.locataire?.noms_complet || null,
        demandeReservee: demandeApprouvee?.noms_complet || null
      }
    })

    setAppartements(apptsAvecStatut)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      ...formData,
      superficie: formData.superficie ? parseFloat(formData.superficie) : null,
      loyer_mensuel: parseFloat(formData.loyer_mensuel)
    }

    // Si on ajoute un nouvel appartement, statut par défaut "vacant"
    if (!editingId) {
      dataToSave.statut = 'vacant'
    }

    if (editingId) {
      const { error } = await supabase
        .from('appartements')
        .update(dataToSave)
        .eq('id', editingId)

      if (error) {
        alert('Erreur lors de la mise à jour: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('appartements')
        .insert(dataToSave)

      if (error) {
        alert('Erreur lors de l\'ajout: ' + error.message)
        return
      }
    }

    resetForm()
    chargerAppartements()
  }

  function handleEdit(appartement) {
    setFormData({
      nom: appartement.nom || '',
      adresse: appartement.adresse || '',
      type: appartement.type || '',
      superficie: appartement.superficie || '',
      loyer_mensuel: appartement.loyer_mensuel || '',
      statut: appartement.statut || 'vacant',
      description: appartement.description || ''
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
      alert('Erreur lors de la suppression: ' + error.message)
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
      adresse: '',
      type: '',
      superficie: '',
      loyer_mensuel: '',
      statut: 'vacant',
      description: ''
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

      {/* Info logique */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Logique automatique :</strong> Le statut d'un appartement est calculé automatiquement :
          🟡 Vacant (par défaut) → 🔵 Réservé (demande approuvée) → 🟢 Loué (contrat actif).
          Vous pouvez toggle manuellement 🟠 En rénovation.
        </p>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier l\'Appartement' : '➕ Nouvel Appartement'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom * (ex: Appt-A, RDC Gauche)
              </label>
              <input
                type="text"
                required
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <input
                type="text"
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                placeholder="KENGE 14, Kinshasa"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Sélectionner --</option>
                <option value="studio">Studio</option>
                <option value="1_chambre">1 Chambre</option>
                <option value="2_chambres">2 Chambres</option>
                <option value="3_chambres">3 Chambres</option>
                <option value="4_chambres">4 Chambres+</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Superficie (m²)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.superficie}
                onChange={(e) => setFormData({ ...formData, superficie: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Loyer Mensuel (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.loyer_mensuel}
                onChange={(e) => setFormData({ ...formData, loyer_mensuel: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description / Notes
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold transition"
              >
                {editingId ? '💾 Mettre à jour' : '✅ Enregistrer'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold transition"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des appartements */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Liste des Appartements ({appartements.length})
        </h2>

        {appartements.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucun appartement enregistré.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appartements.map((appt) => {
              const badge = getStatutBadge(appt.statutCalcule)
              return (
                <div
                  key={appt.id}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
                >
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

                  {appt.adresse && <p className="text-sm text-gray-600 mb-1">📍 {appt.adresse}</p>}
                  {appt.type && <p className="text-sm text-gray-600 mb-1">🏠 {appt.type.replace('_', ' ')}</p>}
                  {appt.superficie && <p className="text-sm text-gray-600 mb-1">📐 {appt.superficie} m²</p>}
                  <p className="text-lg font-bold text-emerald-700 mt-2">
                    💰 {appt.loyer_mensuel} USD/mois
                  </p>

                  {appt.description && (
                    <p className="text-sm text-gray-500 mt-2 italic">{appt.description}</p>
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
