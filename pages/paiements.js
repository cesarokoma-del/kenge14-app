import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Paiements() {
  const [paiements, setPaiements] = useState([])
  const [contrats, setContrats] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterMois, setFilterMois] = useState('')
  const [formData, setFormData] = useState({
    contrat_id: '',
    montant: '',
    date_paiement: new Date().toISOString().split('T')[0],
    mois_concerne: '',
    mode_paiement: 'depot_bancaire',
    reference_paiement: '',
    notes: ''
  })

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    const { data: paiementsData } = await supabase
      .from('paiements')
      .select(`
        *,
        contrat:contrats(
          locataire:locataires(noms_complet, telephone),
          appartement:appartements(nom)
        )
      `)
      .order('date_paiement', { ascending: false })

    const { data: contratsData } = await supabase
      .from('contrats')
      .select(`
        *,
        locataire:locataires(noms_complet),
        appartement:appartements(nom)
      `)
      .eq('statut', 'actif')

    setPaiements(paiementsData || [])
    setContrats(contratsData || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      ...formData,
      montant: parseFloat(formData.montant)
    }

    const { error } = await supabase
      .from('paiements')
      .insert(dataToSave)

    if (error) {
      alert('Erreur lors de l\'ajout: ' + error.message)
      return
    }

    resetForm()
    chargerDonnees()
  }

  async function handleDelete(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) return

    const { error } = await supabase
      .from('paiements')
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
      contrat_id: '',
      montant: '',
      date_paiement: new Date().toISOString().split('T')[0],
      mois_concerne: '',
      mode_paiement: 'depot_bancaire',
      reference_paiement: '',
      notes: ''
    })
    setShowForm(false)
  }

  const paiementsFiltres = filterMois
    ? paiements.filter(p => p.mois_concerne === filterMois)
    : paiements

  const totalRecu = paiementsFiltres.reduce((sum, p) => sum + parseFloat(p.montant || 0), 0)

  if (loading) {
    return (
      <Layout activePage="paiements">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="paiements">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">💰 Paiements</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold"
        >
          {showForm ? '❌ Annuler' : '➕ Enregistrer un Paiement'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl shadow-lg p-6">
          <p className="text-sm text-gray-600">Total Paiements</p>
          <p className="text-3xl font-bold text-emerald-700">{paiementsFiltres.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-2xl shadow-lg p-6">
          <p className="text-sm text-gray-600">Total Encaissé</p>
          <p className="text-3xl font-bold text-green-700">{totalRecu.toFixed(2)} USD</p>
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
            ➕ Nouveau Paiement
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contrat * (Locataire - Appartement)
              </label>
              <select
                required
                value={formData.contrat_id}
                onChange={(e) => setFormData({ ...formData, contrat_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Sélectionner un contrat --</option>
                {contrats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.locataire?.noms_complet} - {c.appartement?.nom} ({c.loyer} USD)
                  </option>
                ))}
              </select>
              {contrats.length === 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Aucun contrat actif. Créez d'abord un contrat dans l'onglet Contrats.
                </p>
              )}
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
                📅 Date du paiement *
              </label>
              <input
                type="date"
                required
                value={formData.date_paiement}
                onChange={(e) => setFormData({ ...formData, date_paiement: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📆 Mois concerné *
              </label>
              <input
                type="month"
                required
                value={formData.mois_concerne}
                onChange={(e) => setFormData({ ...formData, mois_concerne: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💳 Mode de paiement
              </label>
              <select
                value={formData.mode_paiement}
                onChange={(e) => setFormData({ ...formData, mode_paiement: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="depot_bancaire">Dépôt bancaire</option>
                <option value="virement">Virement</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="especes">Espèces</option>
                <option value="cheque">Chèque</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🔖 Référence du paiement (numéro de bordereau, transaction...)
              </label>
              <input
                type="text"
                value={formData.reference_paiement}
                onChange={(e) => setFormData({ ...formData, reference_paiement: e.target.value })}
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
                ✅ Enregistrer le paiement
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

      {/* Liste des paiements */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Historique des Paiements ({paiementsFiltres.length})
        </h2>

        {paiementsFiltres.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucun paiement enregistré.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-emerald-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Locataire</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Appartement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mois</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mode</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paiementsFiltres.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(p.date_paiement).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {p.contrat?.locataire?.noms_complet || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.contrat?.appartement?.nom || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.mois_concerne}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">
                      {p.montant} USD
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.mode_paiement?.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(p.id)}
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
