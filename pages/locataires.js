import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function Locataires() {
  const [locataires, setLocataires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
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
    chargerLocataires()
  }, [])

  async function chargerLocataires() {
    setLoading(true)
    const { data, error } = await supabase
      .from('locataires')
      .select('*')
      .order('noms_complet')

    if (error) {
      console.error('Erreur chargement locataires:', error)
    } else {
      setLocataires(data || [])
    }
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
        alert('Erreur lors de la mise à jour: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('locataires')
        .insert(formData)

      if (error) {
        alert('Erreur lors de l\'ajout: ' + error.message)
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

  async function handleDelete(id) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce locataire ?')) return

    const { error } = await supabase
      .from('locataires')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur lors de la suppression: ' + error.message)
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
        <h1 className="text-3xl font-bold text-gray-800">👥 Suivi Locataires</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold"
        >
          {showForm ? '❌ Annuler' : '➕ Ajouter un Locataire'}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier le Locataire' : '➕ Nouveau Locataire'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Noms complets *
              </label>
              <input
                type="text"
                required
                value={formData.noms_complet}
                onChange={(e) => setFormData({ ...formData, noms_complet: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📱 Téléphone *
              </label>
              <input
                type="tel"
                required
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="+243 XXX XXX XXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ✉️ Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💼 Profession
              </label>
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🆔 Type de pièce d'identité
              </label>
              <select
                value={formData.piece_identite}
                onChange={(e) => setFormData({ ...formData, piece_identite: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Sélectionner --</option>
                <option value="carte_identite">Carte d'identité</option>
                <option value="passeport">Passeport</option>
                <option value="permis_conduire">Permis de conduire</option>
                <option value="carte_electeur">Carte d'électeur</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numéro de pièce
              </label>
              <input
                type="text"
                value={formData.numero_piece}
                onChange={(e) => setFormData({ ...formData, numero_piece: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📍 Adresse précédente
              </label>
              <input
                type="text"
                value={formData.adresse_precedente}
                onChange={(e) => setFormData({ ...formData, adresse_precedente: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🆘 Contact d'urgence (Nom)
              </label>
              <input
                type="text"
                value={formData.contact_urgence_nom}
                onChange={(e) => setFormData({ ...formData, contact_urgence_nom: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact d'urgence (Tél)
              </label>
              <input
                type="tel"
                value={formData.contact_urgence_tel}
                onChange={(e) => setFormData({ ...formData, contact_urgence_tel: e.target.value })}
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

      {/* Liste des locataires */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Liste des Locataires ({locataires.length})
        </h2>

        {locataires.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucun locataire enregistré. Cliquez sur "Ajouter un Locataire" pour commencer.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locataires.map((locataire) => (
              <div
                key={locataire.id}
                className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition"
              >
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  👤 {locataire.noms_complet}
                </h3>

                <div className="space-y-1 text-sm text-gray-600">
                  {locataire.telephone && (
                    <p>📱 <a href={`tel:${locataire.telephone}`} className="text-emerald-700 hover:underline">{locataire.telephone}</a></p>
                  )}
                  {locataire.email && (
                    <p>✉️ <a href={`mailto:${locataire.email}`} className="text-emerald-700 hover:underline">{locataire.email}</a></p>
                  )}
                  {locataire.profession && (
                    <p>💼 {locataire.profession}</p>
                  )}
                  {locataire.piece_identite && (
                    <p>🆔 {locataire.piece_identite.replace('_', ' ')} {locataire.numero_piece && `- ${locataire.numero_piece}`}</p>
                  )}
                  {locataire.contact_urgence_nom && (
                    <p>🆘 {locataire.contact_urgence_nom} {locataire.contact_urgence_tel && `- ${locataire.contact_urgence_tel}`}</p>
                  )}
                </div>

                {locataire.notes && (
                  <p className="text-sm text-gray-500 mt-2 italic border-t pt-2">{locataire.notes}</p>
                )}

                <div className="flex gap-2 mt-4">
                  {locataire.telephone && (
                    <a
                      href={`https://wa.me/${locataire.telephone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-semibold transition text-center"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(locataire)}
                    className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(locataire.id)}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                  >
                    🗑️
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
