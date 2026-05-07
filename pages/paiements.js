import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Paiements() {
  const [paiements, setPaiements] = useState([])
  const [contrats, setContrats] = useState([])
  const [appartements, setAppartements] = useState([])
  const [locataires, setLocataires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    contrat_id: '',
    montant: '',
    date_paiement: new Date().toISOString().split('T')[0],
    mois_concerne: '',
    methode: 'depot_bancaire',
    bordereau_url: '',
    statut: 'recu'
  })

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    const { data: paiementsData } = await supabase
      .from('paiements')
      .select('*')
      .order('date_paiement', { ascending: false })

    const { data: contratsData } = await supabase
      .from('contrats')
      .select('*')

    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')

    const { data: locatairesData } = await supabase
      .from('locataires')
      .select('*')

    // Enrichir
    const paiementsEnrichis = (paiementsData || []).map(p => {
      const contrat = contratsData?.find(c => c.id === p.contrat_id)
      const appartement = contrat ? apptsData?.find(a => a.id === contrat.appartement_id) : null
      const locataire = contrat ? locatairesData?.find(l => l.id === contrat.locataire_id) : null
      return {
        ...p,
        contrat: contrat ? { ...contrat, appartement, locataire } : null
      }
    })

    const contratsEnrichis = (contratsData || []).map(c => ({
      ...c,
      appartement: apptsData?.find(a => a.id === c.appartement_id) || null,
      locataire: locatairesData?.find(l => l.id === c.locataire_id) || null
    }))

    setPaiements(paiementsEnrichis)
    setContrats(contratsEnrichis)
    setAppartements(apptsData || [])
    setLocataires(locatairesData || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      contrat_id: formData.contrat_id,
      montant: parseFloat(formData.montant),
      date_paiement: formData.date_paiement,
      mois_concerne: formData.mois_concerne || null,
      methode: formData.methode,
      bordereau_url: formData.bordereau_url || null,
      statut: formData.statut
    }

    if (editingId) {
      const { error } = await supabase
        .from('paiements')
        .update(dataToSave)
        .eq('id', editingId)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('paiements')
        .insert(dataToSave)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    }

    resetForm()
    chargerDonnees()
  }

  function handleEdit(paiement) {
    setFormData({
      contrat_id: paiement.contrat_id || '',
      montant: paiement.montant || '',
      date_paiement: paiement.date_paiement || '',
      mois_concerne: paiement.mois_concerne || '',
      methode: paiement.methode || 'depot_bancaire',
      bordereau_url: paiement.bordereau_url || '',
      statut: paiement.statut || 'recu'
    })
    setEditingId(paiement.id)
    setShowForm(true)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce paiement ?')) return

    const { error } = await supabase
      .from('paiements')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur: ' + error.message)
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
      methode: 'depot_bancaire',
      bordereau_url: '',
      statut: 'recu'
    })
    setEditingId(null)
    setShowForm(false)
  }

  // Stats
  const aujourdhui = new Date()
  const debutMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)
  const totalCeMois = paiements
    .filter(p => new Date(p.date_paiement) >= debutMois)
    .reduce((sum, p) => sum + parseFloat(p.montant || 0), 0)

  const totalAnnee = paiements
    .filter(p => new Date(p.date_paiement).getFullYear() === aujourdhui.getFullYear())
    .reduce((sum, p) => sum + parseFloat(p.montant || 0), 0)

  const contratsActifs = contrats.filter(c => c.statut === 'actif')

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
        <button onClick={() => setShowForm(!showForm)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold">
          {showForm ? '❌ Annuler' : '➕ Enregistrer un Paiement'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          💡 <strong>Workflow :</strong> Le locataire dépose à la banque → vous envoie photo du bordereau via WhatsApp →
          vous vérifiez sur votre online banking → vous enregistrez ici le paiement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg p-6 border border-emerald-200">
          <p className="text-sm text-gray-600">Reçu ce mois</p>
          <p className="text-3xl font-bold text-emerald-700">{totalCeMois.toFixed(0)} USD</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl shadow-lg p-6 border border-blue-200">
          <p className="text-sm text-gray-600">Total {aujourdhui.getFullYear()}</p>
          <p className="text-3xl font-bold text-blue-700">{totalAnnee.toFixed(0)} USD</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl shadow-lg p-6 border border-purple-200">
          <p className="text-sm text-gray-600">Total paiements</p>
          <p className="text-3xl font-bold text-purple-700">{paiements.length}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier le Paiement' : '➕ Nouveau Paiement'}
          </h2>

          {contratsActifs.length === 0 && !editingId && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-orange-800">⚠️ Aucun contrat actif. Créez d'abord un contrat avant d'enregistrer un paiement.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">📄 Contrat *</label>
              <select required value={formData.contrat_id} onChange={(e) => {
                const contrat = contratsActifs.find(c => c.id === e.target.value)
                setFormData({ ...formData, contrat_id: e.target.value, montant: contrat?.loyer || formData.montant })
              }} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option value="">-- Sélectionner --</option>
                {(editingId ? contrats : contratsActifs).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.locataire?.noms_complet} - {c.appartement?.nom} ({c.loyer} USD)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💰 Montant (USD) *</label>
              <input type="number" step="0.01" required value={formData.montant} onChange={(e) => setFormData({ ...formData, montant: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date de paiement *</label>
              <input type="date" required value={formData.date_paiement} onChange={(e) => setFormData({ ...formData, date_paiement: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📆 Mois concerné</label>
              <input type="text" value={formData.mois_concerne} onChange={(e) => setFormData({ ...formData, mois_concerne: e.target.value })} placeholder="Ex: Mai 2026" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💳 Méthode</label>
              <select value={formData.methode} onChange={(e) => setFormData({ ...formData, methode: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option value="depot_bancaire">Dépôt bancaire</option>
                <option value="virement">Virement</option>
                <option value="cash">Cash / Espèces</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">🧾 Référence bordereau / N° transaction</label>
              <input type="text" value={formData.bordereau_url} onChange={(e) => setFormData({ ...formData, bordereau_url: e.target.value })} placeholder="N° de référence du dépôt bancaire" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select value={formData.statut} onChange={(e) => setFormData({ ...formData, statut: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option value="recu">✅ Reçu</option>
                <option value="en_attente">⏳ En attente vérification</option>
                <option value="annule">❌ Annulé</option>
              </select>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold">
                {editingId ? '💾 Mettre à jour' : '✅ Enregistrer'}
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold">Annuler</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Historique des Paiements ({paiements.length})</h2>

        {paiements.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun paiement enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Locataire</th>
                  <th className="text-left py-3 px-2">Apt</th>
                  <th className="text-left py-3 px-2">Mois</th>
                  <th className="text-right py-3 px-2">Montant</th>
                  <th className="text-left py-3 px-2">Méthode</th>
                  <th className="text-left py-3 px-2">Statut</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paiements.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3 px-2 font-semibold">{p.contrat?.locataire?.noms_complet || '?'}</td>
                    <td className="py-3 px-2">{p.contrat?.appartement?.nom || '?'}</td>
                    <td className="py-3 px-2 text-gray-600">{p.mois_concerne || '—'}</td>
                    <td className="py-3 px-2 text-right font-bold text-emerald-700">{parseFloat(p.montant).toFixed(0)} USD</td>
                    <td className="py-3 px-2 text-gray-600">{p.methode?.replace('_', ' ') || '—'}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs ${p.statut === 'recu' ? 'bg-emerald-100 text-emerald-800' : p.statut === 'en_attente' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {p.statut === 'recu' ? '✅' : p.statut === 'en_attente' ? '⏳' : '❌'} {p.statut?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button onClick={() => handleEdit(p)} className="text-blue-600 hover:underline text-sm mr-2">✏️</button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-sm">🗑️</button>
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
