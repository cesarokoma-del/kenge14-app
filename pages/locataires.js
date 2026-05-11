import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase, getProfilUtilisateur } from '../lib/supabase'

export default function Locataires() {
  const [locataires, setLocataires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [roleUtilisateur, setRoleUtilisateur] = useState(null)
  const [formData, setFormData] = useState({
    
    noms_complet: '',
    telephone: '',
    email: '',
    profession: '',
    piece_identite: '',
    numero_piece: '',
    adresse_precedente: '',
    contact_urgence_nom: '',
    contact_urgence_tel: '',
    notes: ''
  })

  useEffect(() => {
    async function detecterRole() {
      const { role } = await getProfilUtilisateur()
      setRoleUtilisateur(role)
    }
    detecterRole()
    chargerLocataires()
  }, [])

  async function chargerLocataires() {
    setLoading(true)

    const { data: locatairesData } = await supabase
      .from('locataires')
      .select(`
        *,
        contrats(
          id, date_debut, date_fin, date_fin_effective, raison_fin, statut, loyer,
          appartement:appartements(nom)
        )
      `)
      .order('noms_complet')

    // Calculer le statut de chaque locataire
    const enrichis = (locatairesData || []).map(loc => {
      const contratActif = loc.contrats?.find(c => c.statut === 'actif')
      return {
        ...loc,
        contratActif,
        nombreContrats: loc.contrats?.length || 0,
        statut: contratActif ? 'actif' : 'inactif'
      }
    })

    setLocataires(enrichis)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (editingId) {
      const { error } = await supabase
        .from('locataires')
        .update(formData)
        .eq('id', editingId)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('locataires')
        .insert(formData)

      if (error) {
        alert('Erreur: ' + error.message)
        return
      }
    }

    resetForm()
    chargerLocataires()
  }

  function handleEdit(locataire) {
    setFormData({
      noms_complet: locataire.noms_complet || '',
      telephone: locataire.telephone || '',
      email: locataire.email || '',
      profession: locataire.profession || '',
      piece_identite: locataire.piece_identite || '',
      numero_piece: locataire.numero_piece || '',
      adresse_precedente: locataire.adresse_precedente || '',
      contact_urgence_nom: locataire.contact_urgence_nom || '',
      contact_urgence_tel: locataire.contact_urgence_tel || '',
      notes: locataire.notes || ''
    })
    setEditingId(locataire.id)
    setShowForm(true)
  }

  async function handleDelete(id, statut) {
    if (statut === 'actif') {
      alert('❌ Impossible de supprimer un locataire actif. Terminez d\'abord son contrat.')
      return
    }

    if (!confirm('Supprimer ce locataire ? (Son historique de contrats sera aussi supprimé)')) return

    const { error } = await supabase
      .from('locataires')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur: ' + error.message)
      return
    }

    chargerLocataires()
  }

  function resetForm() {
    setFormData({
      noms_complet: '',
      telephone: '',
      email: '',
      profession: '',
      piece_identite: '',
      numero_piece: '',
      adresse_precedente: '',
      contact_urgence_nom: '',
      contact_urgence_tel: '',
      notes: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) {
    return (
      <Layout activePage="locataires">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="locataires">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">👥 Locataires</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold"
        >
          {showForm ? '❌ Annuler' : '➕ Ajouter un Locataire'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Astuce :</strong> Les locataires sont créés automatiquement quand vous approuvez une demande.
          Vous pouvez aussi les ajouter manuellement ici. Cliquez sur un locataire pour voir son historique de contrats.
        </p>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier le Locataire' : '➕ Nouveau Locataire'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Noms complets *</label>
              <input
                type="text" required
                value={formData.noms_complet}
                onChange={(e) => setFormData({ ...formData, noms_complet: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📱 Téléphone *</label>
              <input
                type="tel" required
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="+243 XXX XXX XXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">✉️ Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💼 Profession</label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🆔 Type de pièce</label>
              <select
                value={formData.piece_identite}
                onChange={(e) => setFormData({ ...formData, piece_identite: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">-- Sélectionner --</option>
                <option value="carte_identite">Carte d'identité</option>
                <option value="passeport">Passeport</option>
                <option value="permis_conduire">Permis de conduire</option>
                <option value="carte_electeur">Carte d'électeur</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de pièce</label>
              <input
                type="text"
                value={formData.numero_piece}
                onChange={(e) => setFormData({ ...formData, numero_piece: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">📍 Adresse précédente</label>
              <input
                type="text"
                value={formData.adresse_precedente}
                onChange={(e) => setFormData({ ...formData, adresse_precedente: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🆘 Contact urgence (Nom)</label>
              <input
                type="text"
                value={formData.contact_urgence_nom}
                onChange={(e) => setFormData({ ...formData, contact_urgence_nom: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact urgence (Tél)</label>
              <input
                type="tel"
                value={formData.contact_urgence_tel}
                onChange={(e) => setFormData({ ...formData, contact_urgence_tel: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold">
                {editingId ? '💾 Mettre à jour' : '✅ Enregistrer'}
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Liste des Locataires ({locataires.length})
        </h2>

        {locataires.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun locataire enregistré.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locataires.map((loc) => (
              <div key={loc.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-800">
                    👤 {loc.noms_complet}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    loc.statut === 'actif' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {loc.statut === 'actif' ? '🟢 Locataire actif' : '⚪ Inactif'}
                  </span>
                </div>

                {loc.contratActif && (
                  <p className="text-sm bg-emerald-50 text-emerald-800 px-2 py-1 rounded mb-2">
                    🏢 Loue : <strong>{loc.contratActif.appartement?.nom}</strong>{roleUtilisateur !== 'gerant' && <span> ({loc.contratActif.loyer} USD)</span>}
                  </p>
                )}

                <div className="space-y-1 text-sm text-gray-600">
                  {loc.telephone && (
                    <p>📱 <a href={`tel:${loc.telephone}`} className="text-emerald-700 hover:underline">{loc.telephone}</a></p>
                  )}
                  {loc.email && <p>✉️ {loc.email}</p>}
                  {loc.profession && <p>💼 {loc.profession}</p>}
                  {loc.piece_identite && (
                    <p>🆔 {loc.piece_identite.replace('_', ' ')} {loc.numero_piece && `- ${loc.numero_piece}`}</p>
                  )}
                  {loc.contact_urgence_nom && (
                    <p>🆘 {loc.contact_urgence_nom} {loc.contact_urgence_tel && `- ${loc.contact_urgence_tel}`}</p>
                  )}
                </div>

                {loc.notes && (
                  <p className="text-sm text-gray-500 mt-2 italic border-t pt-2">{loc.notes}</p>
                )}

                {/* Bouton historique */}
                <button
                  onClick={() => setExpandedId(expandedId === loc.id ? null : loc.id)}
                  className="text-sm text-blue-600 hover:underline mt-2"
                >
                  📜 Historique ({loc.nombreContrats} contrat{loc.nombreContrats > 1 ? 's' : ''})
                  {expandedId === loc.id ? ' ▲' : ' ▼'}
                </button>

                {/* Historique des contrats */}
                {expandedId === loc.id && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    {loc.contrats?.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">Aucun contrat</p>
                    ) : (
                      loc.contrats?.map(c => (
                        <div key={c.id} className="text-xs bg-gray-50 p-2 rounded">
                          <p className="font-semibold">
                            {c.appartement?.nom} - {c.loyer} USD
                            <span className={`ml-2 px-2 py-0.5 rounded ${
                              c.statut === 'actif' ? 'bg-emerald-100 text-emerald-800' :
                              c.statut === 'termine' ? 'bg-gray-200 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {c.statut}
                            </span>
                          </p>
                          <p className="text-gray-600">
                            {c.date_debut ? new Date(c.date_debut).toLocaleDateString('fr-FR') : '?'}
                            {' → '}
                            {c.date_fin_effective
                              ? new Date(c.date_fin_effective).toLocaleDateString('fr-FR')
                              : c.date_fin ? new Date(c.date_fin).toLocaleDateString('fr-FR') : '?'}
                          </p>
                          {c.raison_fin && <p className="text-gray-500 italic">Raison: {c.raison_fin.replace('_', ' ')}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {loc.telephone && (
                    <a
                      href={`https://wa.me/${loc.telephone.replace(/[^0-9]/g, '')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-1 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-semibold transition text-center"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(loc)}
                    className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    ✏️ Modifier
                  </button>
                  {loc.statut !== 'actif' && (
                    <button
                      onClick={() => handleDelete(loc.id, loc.statut)}
                      className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
