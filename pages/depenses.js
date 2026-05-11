import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Depenses() {
  const [depenses, setDepenses] = useState([])
  const [appartements, setAppartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filterCategorie, setFilterCategorie] = useState('toutes')
  const [formData, setFormData] = useState({
    appartement_id: '',
    categorie: 'maintenance',
    montant: '',
    date_depense: new Date().toISOString().split('T')[0],
    description: '',
    facture_url: ''
  })

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    const { data: depensesRaw } = await supabase
      .from('depenses')
      .select('*')
      .order('date_depense', { ascending: false })

    // 🔒 Charger les IDs des gérants pour exclure leurs dépenses
    const { data: gerantsData } = await supabase
      .from('profils')
      .select('id')
      .eq('role', 'gerant')

    const idsGerants = (gerantsData || []).map(g => g.id)  

    // 🔒 Exclure les dépenses saisies par un gérant (visibles uniquement via /gerant/mon-solde)
    const depensesData = (depensesRaw || []).filter(d => !idsGerants.includes(d.enregistre_par))

    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    const depensesEnrichies = (depensesData || []).map(d => ({
      ...d,
      appartement: apptsData?.find(a => a.id === d.appartement_id) || null
    }))

    setDepenses(depensesEnrichies)
    setAppartements(apptsData || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      appartement_id: formData.appartement_id || null,
      categorie: formData.categorie,
      montant: parseFloat(formData.montant),
      date_depense: formData.date_depense,
      description: formData.description || null,
      facture_url: formData.facture_url || null
    }

    if (editingId) {
      const { error } = await supabase
        .from('depenses')
        .update(dataToSave)
        .eq('id', editingId)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('depenses')
        .insert(dataToSave)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    }

    resetForm()
    chargerDonnees()
  }

  function handleEdit(depense) {
    setFormData({
      appartement_id: depense.appartement_id || '',
      categorie: depense.categorie || 'maintenance',
      montant: depense.montant || '',
      date_depense: depense.date_depense || '',
      description: depense.description || '',
      facture_url: depense.facture_url || ''
    })
    setEditingId(depense.id)
    setShowForm(true)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette dépense ?')) return

    const { error } = await supabase
      .from('depenses')
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
      appartement_id: '',
      categorie: 'maintenance',
      montant: '',
      date_depense: new Date().toISOString().split('T')[0],
      description: '',
      facture_url: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  // 💰 Ouvre le formulaire pré-rempli pour un approvisionnement gérant
  function openApprovisionnement() {
    const aujourdhui = new Date()
    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ]
    const moisCourant = moisNoms[aujourdhui.getMonth()]
    const anneeCourante = aujourdhui.getFullYear()

    setFormData({
      appartement_id: '',
      categorie: 'approvisionnement_gerant',
      montant: '',
      date_depense: aujourdhui.toISOString().split('T')[0],
      description: `Approvisionnement ${moisCourant} ${anneeCourante}`,
      facture_url: ''
    })
    setEditingId(null)
    setShowForm(true)
  }

  // Stats
  const aujourdhui = new Date()
  const debutMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)
  const totalCeMois = depenses
    .filter(d => new Date(d.date_depense) >= debutMois)
    .reduce((sum, d) => sum + parseFloat(d.montant || 0), 0)

  const totalAnnee = depenses
    .filter(d => new Date(d.date_depense).getFullYear() === aujourdhui.getFullYear())
    .reduce((sum, d) => sum + parseFloat(d.montant || 0), 0)

  const depensesFiltrees = filterCategorie === 'toutes'
    ? depenses
    : depenses.filter(d => d.categorie === filterCategorie)

  const categories = [
    { value: 'maintenance', label: '🔧 Maintenance', color: 'orange' },
    { value: 'reparation', label: '🛠️ Réparation', color: 'red' },
    { value: 'amelioration', label: '✨ Amélioration', color: 'purple' },
    { value: 'taxes', label: '📋 Taxes / Impôts', color: 'gray' },
    { value: 'assurance', label: '🛡️ Assurance', color: 'blue' },
    { value: 'utilites', label: '💡 Utilités (eau/élec)', color: 'yellow' },
    { value: 'gestion', label: '🏪 Frais de gestion', color: 'emerald' },
    { value: 'approvisionnement_gerant', label: '💰 Approvisionnement Gérant', color: 'amber' },
    { value: 'autre', label: '📦 Autre', color: 'gray' }
  ]

  function getCategorieLabel(value) {
    return categories.find(c => c.value === value)?.label || value
  }

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
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-bold text-gray-800">📊 Dépenses</h1>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={openApprovisionnement}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold shadow-md transition"
            >
              💰 Approvisionner Gérant
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold shadow-md transition"
            >
              {showForm ? '❌ Annuler' : '➕ Nouvelle Dépense'}
            </button>
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl shadow-lg p-6 border border-red-200">
          <p className="text-sm text-gray-600">Dépenses ce mois</p>
          <p className="text-3xl font-bold text-red-700">{totalCeMois.toFixed(0)} USD</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl shadow-lg p-6 border border-orange-200">
          <p className="text-sm text-gray-600">Total {aujourdhui.getFullYear()}</p>
          <p className="text-3xl font-bold text-orange-700">{totalAnnee.toFixed(0)} USD</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl shadow-lg p-6 border border-purple-200">
          <p className="text-sm text-gray-600">Total dépenses</p>
          <p className="text-3xl font-bold text-purple-700">{depenses.length}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier la Dépense' : '➕ Nouvelle Dépense'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.categorie !== 'approvisionnement_gerant' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Appartement</label>
              <select value={formData.appartement_id} onChange={(e) => setFormData({ ...formData, appartement_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option value="">-- Aucun (dépense générale) --</option>
                {appartements.map((appt) => (<option key={appt.id} value={appt.id}>{appt.nom}</option>))}
              </select>
            </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📂 Catégorie *</label>
              <select required value={formData.categorie} onChange={(e) => setFormData({ ...formData, categorie: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                {categories.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💰 Montant (USD) *</label>
              <input type="number" step="0.01" required value={formData.montant} onChange={(e) => setFormData({ ...formData, montant: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date *</label>
              <input type="date" required value={formData.date_depense} onChange={(e) => setFormData({ ...formData, date_depense: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Ex: Réparation toiture APT-2A par M. Kabongo" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">🧾 Référence facture / Photo</label>
              <input type="text" value={formData.facture_url} onChange={(e) => setFormData({ ...formData, facture_url: e.target.value })} placeholder="N° facture ou lien vers photo" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
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

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilterCategorie('toutes')} className={`px-3 py-1 rounded-full text-sm font-semibold transition ${filterCategorie === 'toutes' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
          Toutes ({depenses.length})
        </button>
        {categories.map(c => {
          const count = depenses.filter(d => d.categorie === c.value).length
          if (count === 0) return null
          return (
            <button key={c.value} onClick={() => setFilterCategorie(c.value)} className={`px-3 py-1 rounded-full text-sm font-semibold transition ${filterCategorie === c.value ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
              {c.label} ({count})
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Historique ({depensesFiltrees.length})
        </h2>

        {depensesFiltrees.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucune dépense dans cette catégorie.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left py-3 px-2">Date</th>
                  <th className="text-left py-3 px-2">Catégorie</th>
                  <th className="text-left py-3 px-2">Apt</th>
                  <th className="text-left py-3 px-2">Description</th>
                  <th className="text-right py-3 px-2">Montant</th>
                  <th className="text-right py-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {depensesFiltrees.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</td>
                    <td className="py-3 px-2">{getCategorieLabel(d.categorie)}</td>
                    <td className="py-3 px-2">{d.appartement?.nom || '—'}</td>
                    <td className="py-3 px-2 text-gray-600 max-w-xs truncate">{d.description || '—'}</td>
                    <td className="py-3 px-2 text-right font-bold text-red-700">-{parseFloat(d.montant).toFixed(0)} USD</td>
                    <td className="py-3 px-2 text-right">
                      <button onClick={() => handleEdit(d)} className="text-blue-600 hover:underline text-sm mr-2">✏️</button>
                      <button onClick={() => handleDelete(d.id)} className="text-red-600 hover:underline text-sm">🗑️</button>
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
