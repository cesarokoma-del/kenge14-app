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
    const { data, error } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    if (error) {
      console.error('Erreur chargement appartements:', error)
    } else {
      setAppartements(data || [])
    }
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      ...formData,
      superficie: formData.superficie ? parseFloat(formData.superficie) : null,
      loyer_mensuel: parseFloat(formData.loyer_mensuel)
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

  async function handleDelete(id) {
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={formData.statut}
                onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="vacant">Vacant</option>
                <option value="loue">Loué</option>
                <option value="en_renovation">En rénovation</option>
              </select>
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
            Aucun appartement enregistré. Cliquez sur "Ajouter un Appartement" pour commencer.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appartements.map((appt) => (
              <div
                key={appt.id}
                className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-800">{appt.nom}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      appt.statut === 'loue'
                        ? 'bg-emerald-100 text-emerald-800'
                        : appt.statut === 'vacant'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {appt.statut === 'loue' ? 'Loué' : appt.statut === 'vacant' ? 'Vacant' : 'Rénovation'}
                  </span>
                </div>

                {appt.adresse && (
                  <p className="text-sm text-gray-600 mb-1">📍 {appt.adresse}</p>
                )}
                {appt.type && (
                  <p className="text-sm text-gray-600 mb-1">🏠 {appt.type.replace('_', ' ')}</p>
                )}
                {appt.superficie && (
                  <p className="text-sm text-gray-600 mb-1">📐 {appt.superficie} m²</p>
                )}
                <p className="text-lg font-bold text-emerald-700 mt-2">
                  💰 {appt.loyer_mensuel} USD/mois
                </p>

                {appt.description && (
                  <p className="text-sm text-gray-500 mt-2 italic">{appt.description}</p>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(appt)}
                    className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(appt.id)}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
