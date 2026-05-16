import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { getSoldeGerant, getPremierGerantId } from '../lib/comptesGerants'
import { formatDateFR, parseDateLocale } from '../lib/dateUtils'

export default function Depenses() {
  const [depenses, setDepenses] = useState([])
  const [appartements, setAppartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filterCategorie, setFilterCategorie] = useState('toutes')
  const [depensesGerant, setDepensesGerant] = useState([])
  const [showDepensesGerant, setShowDepensesGerant] = useState(false)
  const [soldeGerant, setSoldeGerant] = useState({
    totalApprovisionne: 0,
    totalDepense: 0,
    soldeNet: 0,
    nombreApprovisionnements: 0,
    nombreDepenses: 0
  })
  const [formData, setFormData] = useState({
    appartement_id: '',
    categorie: 'maintenance',
    montant: '',
    date_depense: new Date().toISOString().split('T')[0],
    description: '',
    facture_url: '',
    devise: 'USD',
    montant_devise_origine: '',
    taux_change: ''
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

    // 👤 Charger séparément les dépenses du gérant (pour la section collapsible)
    const depensesGerantData = (depensesRaw || []).filter(d => idsGerants.includes(d.enregistre_par))

    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    const depensesEnrichies = (depensesData || []).map(d => ({
      ...d,
      appartement: apptsData?.find(a => a.id === d.appartement_id) || null
    }))

    const depensesGerantEnrichies = (depensesGerantData || []).map(d => ({
      ...d,
      appartement: apptsData?.find(a => a.id === d.appartement_id) || null
    }))

    setDepenses(depensesEnrichies)
    setDepensesGerant(depensesGerantEnrichies)
    setAppartements(apptsData || [])

    // 💰 Solde Compte Gérant via le helper getSoldeGerant()
    const gerantId = await getPremierGerantId()
    
    if (gerantId) {
      const solde = await getSoldeGerant(gerantId)      
      setSoldeGerant(solde)
    } 

    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Calcul montant USD selon devise (approvisionnement_gerant force USD)
    const forceUSD = formData.categorie === 'approvisionnement_gerant'
    const deviseEffective = forceUSD ? 'USD' : formData.devise

    const montantUsd = deviseEffective === 'USD'
      ? parseFloat(formData.montant)
      : parseFloat(formData.montant_devise_origine) / parseFloat(formData.taux_change)

    const dataToSave = {
      appartement_id: formData.appartement_id || null,
      categorie: formData.categorie,
      montant: montantUsd,
      date_depense: formData.date_depense,
      description: formData.description || null,
      facture_url: formData.facture_url || null,
      devise: deviseEffective,
      montant_devise_origine: deviseEffective === 'CDF' ? parseFloat(formData.montant_devise_origine) : null,
      taux_change: deviseEffective === 'CDF' ? parseFloat(formData.taux_change) : null
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
      facture_url: depense.facture_url || '',
      devise: depense.devise || 'USD',
      montant_devise_origine: depense.montant_devise_origine || '',
      taux_change: depense.taux_change || ''
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
      facture_url: '',
      devise: 'USD',
      montant_devise_origine: '',
      taux_change: ''
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
      facture_url: '',
      devise: 'USD',
      montant_devise_origine: '',
      taux_change: ''
    })
    setEditingId(null)
    setShowForm(true)
  }

  // Stats
  const aujourdhui = new Date()
  const debutMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)
  const totalCeMois = depenses
    .filter(d => {
      const date = parseDateLocale(d.date_depense)
      return date && date >= debutMois
    })
    .reduce((sum, d) => sum + parseFloat(d.montant || 0), 0)
  const totalAnnee = depenses
    .filter(d => {
      const date = parseDateLocale(d.date_depense)
      return date && date.getFullYear() === aujourdhui.getFullYear()
    })
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

      {/* 💰 2e ligne — Compte Gérant : 2 cartes (approvisionné / solde restant) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Carte 1 — Approvisionné cumulé (toujours verte) */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl shadow-lg p-6 border-2 border-emerald-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">💰 Compte Gérant — Approvisionné</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {(soldeGerant.totalApprovisionne || 0).toFixed(0)} USD
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Cumul des versements depuis le début
                </p>
              </div>
              <div className="text-5xl opacity-60">📥</div>
            </div>
          </div>

          {/* Carte 2 — Solde restant (couleur dynamique selon valeur) */}
          {(() => {
            const solde = soldeGerant.soldeNet || 0
            const couleurs = solde < 0
              ? { from: 'from-red-50', to: 'to-red-100', border: 'border-red-200', text: 'text-red-700' }
              : solde === 0
              ? { from: 'from-gray-50', to: 'to-gray-100', border: 'border-gray-200', text: 'text-gray-700' }
              : { from: 'from-amber-50', to: 'to-amber-100', border: 'border-amber-200', text: 'text-amber-700' }
            return (
              <div className={`bg-gradient-to-br ${couleurs.from} ${couleurs.to} rounded-2xl shadow-lg p-6 border-2 ${couleurs.border}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">🧾 Compte Gérant — Solde restant</p>
                    <p className={`text-3xl font-bold ${couleurs.text}`}>
                      {solde.toFixed(0)} USD
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      À disposition du gérant maintenant
                    </p>
                  </div>
                  <div className="text-5xl opacity-60">🧾</div>
                </div>
              </div>
            )
          })()}
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

            {/* Devise (cachée si approvisionnement_gerant — toujours USD) */}
            {formData.categorie !== 'approvisionnement_gerant' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">💱 Devise</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, devise: 'USD' })}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold transition ${
                      formData.devise === 'USD'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    💵 USD
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, devise: 'CDF' })}
                    className={`flex-1 py-2 rounded-lg border-2 font-semibold transition ${
                      formData.devise === 'CDF'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-300'
                    }`}
                  >
                    🇨🇩 CDF
                  </button>
                </div>
              </div>
            )}

            {formData.categorie === 'approvisionnement_gerant' || formData.devise === 'USD' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">💰 Montant (USD) *</label>
                <input type="number" step="0.01" required value={formData.montant} onChange={(e) => setFormData({ ...formData, montant: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">🇨🇩 Montant (CDF) *</label>
                  <input
                    type="number" step="1" min="1" inputMode="numeric" required
                    value={formData.montant_devise_origine}
                    onChange={(e) => setFormData({ ...formData, montant_devise_origine: e.target.value })}
                    placeholder="Ex: 8000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">💱 Taux (CDF / 1 USD) *</label>
                  <input
                    type="number" step="1" min="1" inputMode="numeric" required
                    value={formData.taux_change}
                    onChange={(e) => setFormData({ ...formData, taux_change: e.target.value })}
                    placeholder="Ex: 2850"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                {formData.montant_devise_origine && formData.taux_change && parseFloat(formData.taux_change) > 0 && (
                  <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center text-sm">
                    <span className="text-gray-700">Équivalent USD : </span>
                    <span className="font-bold text-amber-700">
                      ≈ {(parseFloat(formData.montant_devise_origine) / parseFloat(formData.taux_change)).toFixed(2)} USD
                    </span>
                  </div>
                )}
              </>
            )}

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
                {depensesFiltrees.map((d) => {
                  const estApprovisionnement = d.categorie === 'approvisionnement_gerant'
                  return (
                  <tr key={d.id} className={`border-b hover:bg-gray-50 ${estApprovisionnement ? 'bg-amber-50' : ''}`}>
                    <td className="py-3 px-2">{formatDateFR(d.date_depense)}</td>
                    <td className="py-3 px-2">{getCategorieLabel(d.categorie)}</td>
                    <td className="py-3 px-2">{d.appartement?.nom || '—'}</td>
                    <td className="py-3 px-2 text-gray-600 max-w-xs truncate">
                      {d.description || '—'}
                      {estApprovisionnement && (
                        <span className="ml-2 inline-block px-2 py-0.5 bg-amber-200 text-amber-800 text-xs font-semibold rounded-full">
                          → Gérant
                        </span>
                      )}
                    </td>
                    <td className={`py-3 px-2 text-right font-bold ${estApprovisionnement ? 'text-amber-700' : 'text-red-700'}`}>
                      {d.devise === 'CDF' && d.montant_devise_origine ? (
                        <>
                          <div>-{parseInt(d.montant_devise_origine).toLocaleString('fr-FR')} CDF</div>
                          <div className="text-xs text-gray-500 font-normal">
                            ≈ {parseFloat(d.montant).toFixed(2)} USD
                          </div>
                        </>
                      ) : (
                        `-${parseFloat(d.montant).toFixed(0)} USD`
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button onClick={() => handleEdit(d)} className="text-blue-600 hover:underline text-sm mr-2">✏️</button>
                      <button onClick={() => handleDelete(d.id)} className="text-red-600 hover:underline text-sm">🗑️</button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 👤 Section collapsible : Dépenses du Gérant */}
      {depensesGerant.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-orange-200 mt-6 overflow-hidden">
          <button
            onClick={() => setShowDepensesGerant(!showDepensesGerant)}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-orange-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👤</span>
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-800">
                  Dépenses du Gérant ({depensesGerant.length})
                </h2>
                <p className="text-sm text-orange-700 font-semibold">
                  Total : {depensesGerant.reduce((sum, d) => sum + parseFloat(d.montant || 0), 0).toFixed(2)} USD
                </p>
              </div>
            </div>
            <span className={`text-2xl text-gray-400 transition-transform ${showDepensesGerant ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {showDepensesGerant && (
            <div className="px-6 pb-6 border-t border-orange-100">
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-orange-50 border-b border-orange-200">
                    <tr>
                      <th className="text-left py-3 px-2">Date</th>
                      <th className="text-left py-3 px-2">Catégorie</th>
                      <th className="text-left py-3 px-2">Apt</th>
                      <th className="text-left py-3 px-2">Description</th>
                      <th className="text-right py-3 px-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depensesGerant.map((d) => (
                      <tr key={d.id} className="border-b hover:bg-orange-50">
                        <td className="py-3 px-2">{formatDateFR(d.date_depense)}</td>
                        <td className="py-3 px-2">{getCategorieLabel(d.categorie)}</td>
                        <td className="py-3 px-2">{d.appartement?.nom || '—'}</td>
                        <td className="py-3 px-2 text-gray-600 max-w-xs truncate">{d.description || '—'}</td>
                        <td className="py-3 px-2 text-right font-bold text-orange-700">
                          {d.devise === 'CDF' && d.montant_devise_origine ? (
                            <>
                              <div>-{parseInt(d.montant_devise_origine).toLocaleString('fr-FR')} CDF</div>
                              <div className="text-xs text-gray-500 font-normal">
                                ≈ {parseFloat(d.montant).toFixed(2)} USD
                              </div>
                            </>
                          ) : (
                            `-${parseFloat(d.montant).toFixed(0)} USD`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </Layout>
  )
}
