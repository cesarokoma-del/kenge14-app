import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Depenses() {
  const [depenses, setDepenses] = useState([])
  const [appartements, setAppartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterMois, setFilterMois] = useState('')
  const [formData, setFormData] = useState({
    appartement_id: '',
    categorie: '',
    description: '',
    montant: '',
    date_depense: new Date().toISOString().split('T')[0],
    fournisseur: '',
    notes: ''
  })

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    const { data: depensesData } = await supabase
      .from('depenses')
      .select(`
        *,
        appartement:appartements(nom)
      `)
      .order('date_depense', { ascending: false })

    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    setDepenses(depensesData || [])
    setAppartements(apptsData || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      ...formData,
      montant: parseFloat(formData.montant),
      appartement_id: formData.appartement_id || null
    }

    const { error } = await supabase
      .from('depenses')
      .insert(dataToSave)

    if (error) {
      alert('Erreur lors de l\'ajout: ' + error.message)
      return
    }

    resetForm()
    chargerDonnees()
  }

  async function handleDelete(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) return

    const { error } = await supabase
      .from('depenses')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur lors de la suppression: ' + error.message)
      return
    }

    chargerDonnees()
  }

  function resetForm() {
    setFormData({
      appartement_id: '',
      categorie: '',
      description: '',
      montant: '',
      date_depense: new Date().toISOString().split('T')[0],
      fournisseur: '',
      notes: ''
    })
    setShowForm(false)
  }

  const depensesFiltrees = filterMois
    ? depenses.filter(d => d.date_depense?.startsWith(filterMois))
    : depenses

  const totalDepenses = depensesFiltrees.reduce((sum, d) => sum + parseFloat(d.montant || 0), 0)

  // Stats par catégorie
  const parCategorie = depensesFiltrees.reduce((acc, d) => {
    const cat = d.categorie || 'autre'
    acc[cat] = (acc[cat] || 0) + parseFloat(d.montant || 0)
    return acc
  }, {})

  if (loading) {
    return (
      <Layout activePage="depenses">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="depenses">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📊 Dépenses</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold"
        >
          {showForm ? '❌ Annuler' : '➕ Ajouter une Dépense'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-2xl shadow-lg p-6">
          <p className="text-sm text-gray-600">Total Dépenses</p>
          <p className="text-3xl font-bold text-red-700">{totalDepenses.toFixed(2)} USD</p>
          <p className="text-xs text-gray-500 mt-1">{depensesFiltrees.length} dépense(s)</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-2xl shadow-lg p-6">
          <p className="text-sm text-gray-600 mb-2">Par catégorie</p>
          <div className="space-y-1 text-sm">
            {Object.entries(parCategorie).slice(0, 3).map(([cat, montant]) => (
              <div key={cat} className="flex justify-between">
                <span className="text-gray-700">{cat.replace('_', ' ')}</span>
                <span className="font-semibold text-orange-700">{montant.toFixed(0)} USD</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl shadow-lg p-6">
          <p className="text-sm text-gray-600">Filtrer par mois</p>
          <input
            type="month"
            value={filterMois}
            onChange={(e) => setFilterMois(e.target.value)}
            className="w-full mt-2 px-3 py-2 border border-blue-300 rounded-lg"
          />
          {filterMois && (
            <button
              onClick={() => setFilterMois('')}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              Effacer le filtre
            </button>
          )}
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            ➕ Nouvelle Dépense
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏢 Appartement (optionnel)
              </label>
              <select
                value={formData.appartement_id}
                onChange={(e) => setFormData({ ...formData, appartement_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Dépense générale --</option>
                {appartements.map((appt) => (
                  <option key={appt.id} value={appt.id}>
                    {appt.nom}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📁 Catégorie *
              </label>
              <select
                required
                value={formData.categorie}
                onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Sélectionner --</option>
                <option value="reparation">🔧 Réparation</option>
                <option value="entretien">🧹 Entretien</option>
                <option value="electricite">⚡ Électricité</option>
                <option value="eau">💧 Eau</option>
                <option value="securite">🔒 Sécurité</option>
                <option value="taxes">📋 Taxes / Impôts</option>
                <option value="materiel">🛠️ Matériel</option>
                <option value="services">👷 Services (plombier, électricien...)</option>
                <option value="autre">📌 Autre</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Description *
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Réparation fuite robinet salle de bain"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💵 Montant (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.montant}
                onChange={(e) => setFormData({ ...formData, montant: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Date *
              </label>
              <input
                type="date"
                required
                value={formData.date_depense}
                onChange={(e) => setFormData({ ...formData, date_depense: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏪 Fournisseur / Prestataire
              </label>
              <input
                type="text"
                value={formData.fournisseur}
                onChange={(e) => setFormData({ ...formData, fournisseur: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold transition"
              >
                ✅ Enregistrer
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

      {/* Liste des dépenses */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Historique des Dépenses ({depensesFiltrees.length})
        </h2>

        {depensesFiltrees.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucune dépense enregistrée.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Catégorie</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Appartement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Fournisseur</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Montant</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {depensesFiltrees.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(d.date_depense).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                        {d.categorie?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{d.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {d.appartement?.nom || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {d.fournisseur || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-700">
                      -{d.montant} USD
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
