import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

export default function FormulaireDemande() {
  const router = useRouter()
  const { id, apt } = router.query

  const [appartement, setAppartement] = useState(null)
  const [appartements, setAppartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    appartement_id: '',
    noms_complet: '',
    telephone: '',
    email: '',
    profession: '',
    adresse_actuelle: '',
    nombre_occupants: 1,
    date_debut_souhaitee: '',
    duree_souhaitee_mois: 12,
    message: ''
  })

  useEffect(() => {
    if (router.isReady) {
      chargerAppartements()
    }
  }, [router.isReady, apt])

  async function chargerAppartements() {
    setLoading(true)

    const { data: appts } = await supabase
      .from('appartements')
      .select('*')
      .neq('statut', 'en_renovation')
      .order('nom')

    setAppartements(appts || [])

    // Pré-sélectionner l'appartement si l'URL contient ?apt=ID
    if (apt) {
      const appartSelectionne = appts?.find(a => a.id === apt)
      if (appartSelectionne) {
        setAppartement(appartSelectionne)
        setFormData(prev => ({ ...prev, appartement_id: apt }))
      }
    }

    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const lienPublic = `${baseUrl}/demande/${id}`

    const dataToSave = {
      ...formData,
      appartement_id: formData.appartement_id || null,
      nombre_occupants: parseInt(formData.nombre_occupants) || 1,
      duree_souhaitee_mois: formData.duree_souhaitee_mois ? parseInt(formData.duree_souhaitee_mois) : null,
      lien_public: lienPublic,
      statut: 'en_attente'
    }

    const { error } = await supabase
      .from('demandes_location')
      .insert(dataToSave)

    if (error) {
      alert('Erreur : ' + error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (loading && !submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex justify-center items-center">
        <div className="text-emerald-600 text-xl">Chargement...</div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex justify-center items-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Demande envoyée !</h1>
          <p className="text-gray-600 mb-6">
            Merci pour votre demande de location. Nous vous contacterons rapidement par téléphone ou WhatsApp.
          </p>
          <p className="text-sm text-gray-500">KENGE14 - Gestion Locative</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-t-2xl p-6 shadow-lg">
          <h1 className="text-3xl font-bold">KENGE14</h1>
          <p className="text-emerald-100">Formulaire de demande de location</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-b-2xl shadow-2xl p-6">
          <p className="text-gray-600 mb-6">
            👋 Bienvenue ! Remplissez ce formulaire pour postuler à un de nos appartements à Kinshasa.
            Tous les champs marqués * sont obligatoires.
          </p>

          {appartement && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-emerald-800">
                🏢 Vous postulez pour : <strong>{appartement.nom}</strong>
                {' '}({appartement.loyer_mensuel} USD/mois)
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                🏢 Appartement souhaité *
              </label>
              <select
                required
                value={formData.appartement_id}
                onChange={(e) => setFormData({ ...formData, appartement_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Sélectionner un appartement --</option>
                {appartements.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom} - {a.loyer_mensuel} USD/mois ({a.type?.replace('_', ' ') || 'Type non spécifié'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Noms complets *
              </label>
              <input
                type="text"
                required
                value={formData.noms_complet}
                onChange={(e) => setFormData({ ...formData, noms_complet: e.target.value })}
                placeholder="Prénom et nom de famille"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📱 Téléphone (WhatsApp) *
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💼 Profession / Activité *
              </label>
              <input
                type="text"
                required
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                placeholder="Ex: Enseignant, Commerçant, Fonctionnaire..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                📍 Adresse actuelle *
              </label>
              <input
                type="text"
                required
                value={formData.adresse_actuelle}
                onChange={(e) => setFormData({ ...formData, adresse_actuelle: e.target.value })}
                placeholder="Ex: Avenue X, Commune Y, Kinshasa"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  👨‍👩‍👧 Nombre d'occupants *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.nombre_occupants}
                  onChange={(e) => setFormData({ ...formData, nombre_occupants: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  📅 Date d'emménagement
                </label>
                <input
                  type="date"
                  value={formData.date_debut_souhaitee}
                  onChange={(e) => setFormData({ ...formData, date_debut_souhaitee: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ⏱️ Durée (mois)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.duree_souhaitee_mois}
                  onChange={(e) => setFormData({ ...formData, duree_souhaitee_mois: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                💬 Message / Informations complémentaires
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                placeholder="Présentez-vous, expliquez votre situation, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-bold text-lg transition disabled:opacity-50"
            >
              {loading ? 'Envoi en cours...' : '✅ Envoyer ma demande'}
            </button>

            <p className="text-xs text-center text-gray-500">
              En soumettant ce formulaire, vous acceptez d'être contacté par WhatsApp ou téléphone.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
