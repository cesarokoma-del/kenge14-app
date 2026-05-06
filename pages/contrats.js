import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Contrats() {
  const [contrats, setContrats] = useState([])
  const [appartements, setAppartements] = useState([])
  const [locataires, setLocataires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    appartement_id: '',
    locataire_id: '',
    date_debut: '',
    date_fin: '',
    loyer: '',
    caution: '',
    statut: 'actif',
    notes: ''
  })

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    const { data: contratsData } = await supabase
      .from('contrats')
      .select(`
        *,
        appartement:appartements(*),
        locataire:locataires(*)
      `)
      .order('date_debut', { ascending: false })

    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    const { data: locatairesData } = await supabase
      .from('locataires')
      .select('*')
      .order('noms_complet')

    setContrats(contratsData || [])
    setAppartements(apptsData || [])
    setLocataires(locatairesData || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      ...formData,
      loyer: parseFloat(formData.loyer),
      caution: formData.caution ? parseFloat(formData.caution) : null
    }

    if (editingId) {
      const { error } = await supabase
        .from('contrats')
        .update(dataToSave)
        .eq('id', editingId)

      if (error) {
        alert('Erreur lors de la mise à jour: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('contrats')
        .insert(dataToSave)

      if (error) {
        alert('Erreur lors de l\'ajout: ' + error.message)
        return
      }

      // Mettre à jour le statut de l'appartement à "loue"
      if (formData.statut === 'actif') {
        await supabase
          .from('appartements')
          .update({ statut: 'loue' })
          .eq('id', formData.appartement_id)
      }
    }

    resetForm()
    chargerDonnees()
  }

  function handleEdit(contrat) {
    setFormData({
      appartement_id: contrat.appartement_id || '',
      locataire_id: contrat.locataire_id || '',
      date_debut: contrat.date_debut || '',
      date_fin: contrat.date_fin || '',
      loyer: contrat.loyer || '',
      caution: contrat.caution || '',
      statut: contrat.statut || 'actif',
      notes: contrat.notes || ''
    })
    setEditingId(contrat.id)
    setShowForm(true)
  }

  async function handleDelete(id, appartementId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce contrat ?')) return

    const { error } = await supabase
      .from('contrats')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur lors de la suppression: ' + error.message)
      return
    }

    // Remettre l'appartement en vacant
    if (appartementId) {
      await supabase
        .from('appartements')
        .update({ statut: 'vacant' })
        .eq('id', appartementId)
    }

    chargerDonnees()
  }

  async function handleResilier(contratId, appartementId) {
    if (!confirm('Confirmer la résiliation de ce contrat ?')) return

    await supabase
      .from('contrats')
      .update({ statut: 'resilie' })
      .eq('id', contratId)

    if (appartementId) {
      await supabase
        .from('appartements')
        .update({ statut: 'vacant' })
        .eq('id', appartementId)
    }

    chargerDonnees()
  }

  function resetForm() {
    setFormData({
      appartement_id: '',
      locataire_id: '',
      date_debut: '',
      date_fin: '',
      loyer: '',
      caution: '',
      statut: 'actif',
      notes: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  function getJoursAvantFin(dateFin) {
    if (!dateFin) return null
    const aujourdhui = new Date()
    const fin = new Date(dateFin)
    const diff = Math.ceil((fin - aujourdhui) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) {
    return (
      <Layout activePage="contrats">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="contrats">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📄 Contrats</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold"
        >
          {showForm ? '❌ Annuler' : '➕ Nouveau Contrat'}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier le Contrat' : '➕ Nouveau Contrat'}
          </h2>

          {(appartements.length === 0 || locataires.length === 0) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-orange-800">
                ⚠️ Avant de créer un contrat, vous devez d'abord :
              </p>
              <ul className="list-disc list-inside text-sm text-orange-700 mt-2">
                {appartements.length === 0 && <li>Ajouter au moins un appartement</li>}
                {locataires.length === 0 && <li>Ajouter au moins un locataire</li>}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏢 Appartement *
              </label>
              <select
                required
                value={formData.appartement_id}
                onChange={(e) => setFormData({ ...formData, appartement_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Sélectionner --</option>
                {appartements.map((appt) => (
                  <option key={appt.id} value={appt.id}>
                    {appt.nom} ({appt.loyer_mensuel} USD)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                👤 Locataire *
              </label>
              <select
                required
                value={formData.locataire_id}
                onChange={(e) => setFormData({ ...formData, locataire_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Sélectionner --</option>
                {locataires.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.noms_complet}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Date de début *
              </label>
              <input
                type="date"
                required
                value={formData.date_debut}
                onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📅 Date de fin *
              </label>
              <input
                type="date"
                required
                value={formData.date_fin}
                onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💰 Loyer mensuel (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.loyer}
                onChange={(e) => setFormData({ ...formData, loyer: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏦 Caution (USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.caution}
                onChange={(e) => setFormData({ ...formData, caution: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📊 Statut
              </label>
              <select
                value={formData.statut}
                onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="actif">Actif</option>
                <option value="termine">Terminé</option>
                <option value="resilie">Résilié</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📝 Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={appartements.length === 0 || locataires.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Liste des contrats */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Liste des Contrats ({contrats.length})
        </h2>

        {contrats.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucun contrat enregistré.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contrats.map((contrat) => {
              const joursAvantFin = getJoursAvantFin(contrat.date_fin)
              const isExpiring = joursAvantFin !== null && joursAvantFin <= 90 && joursAvantFin >= 0 && contrat.statut === 'actif'
              const isExpired = joursAvantFin !== null && joursAvantFin < 0

              return (
                <div
                  key={contrat.id}
                  className={`border rounded-xl p-4 hover:shadow-md transition ${
                    isExpiring ? 'border-orange-300 bg-orange-50' :
                    isExpired ? 'border-red-300 bg-red-50' :
                    'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {contrat.locataire?.noms_complet || 'Locataire inconnu'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        🏢 {contrat.appartement?.nom || 'Appartement inconnu'}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        contrat.statut === 'actif' ? 'bg-emerald-100 text-emerald-800' :
                        contrat.statut === 'termine' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {contrat.statut}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-3 border-t pt-3">
                    <div>
                      <p className="text-gray-500">Début</p>
                      <p className="font-semibold">
                        {contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Fin</p>
                      <p className="font-semibold">
                        {contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Loyer</p>
                      <p className="font-bold text-emerald-700">{contrat.loyer} USD/mois</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Caution</p>
                      <p className="font-semibold">{contrat.caution || 0} USD</p>
                    </div>
                  </div>

                  {isExpiring && (
                    <div className="mt-3 p-2 bg-orange-100 rounded text-sm text-orange-800">
                      ⚠️ Expire dans {joursAvantFin} jour(s) — pensez au renouvellement
                    </div>
                  )}
                  {isExpired && contrat.statut === 'actif' && (
                    <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-800">
                      🚨 Contrat expiré depuis {Math.abs(joursAvantFin)} jour(s)
                    </div>
                  )}

                  {contrat.notes && (
                    <p className="text-sm text-gray-500 mt-2 italic">{contrat.notes}</p>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleEdit(contrat)}
                      className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      ✏️ Modifier
                    </button>
                    {contrat.statut === 'actif' && (
                      <button
                        onClick={() => handleResilier(contrat.id, contrat.appartement_id)}
                        className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        ⛔ Résilier
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(contrat.id, contrat.appartement_id)}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      🗑️
                    </button>
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
