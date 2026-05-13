import { useState, useEffect } from 'react'
import LayoutGerant from '../../components/LayoutGerant'
import { supabase, getProfilUtilisateur } from '../../lib/supabase'

export default function MonProfil() {
  const [profil, setProfil] = useState(null)
  const [loading, setLoading] = useState(true)

  // États du formulaire changement mot de passe
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmationMdp, setConfirmationMdp] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text: '...' }

  useEffect(() => {
    chargerProfil()
  }, [])

  async function chargerProfil() {
    const { profil } = await getProfilUtilisateur()
    setProfil(profil)
    setLoading(false)
  }

  async function changerMotDePasse(e) {
    e.preventDefault()
    setMessage(null)

    // Validations côté client
    if (nouveauMdp.length < 8) {
      setMessage({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' })
      return
    }
    if (nouveauMdp !== confirmationMdp) {
      setMessage({ type: 'error', text: 'Les deux mots de passe ne correspondent pas.' })
      return
    }

    setEnCours(true)
    const { error } = await supabase.auth.updateUser({ password: nouveauMdp })
    setEnCours(false)

    if (error) {
      setMessage({ type: 'error', text: 'Erreur : ' + error.message })
    } else {
      setMessage({ type: 'success', text: '✅ Mot de passe changé avec succès !' })
      setNouveauMdp('')
      setConfirmationMdp('')
    }
  }

  if (loading) {
    return (
      <LayoutGerant activePage="mon-profil">
        <div className="flex justify-center items-center h-64">
          <div className="text-amber-600 text-xl">Chargement...</div>
        </div>
      </LayoutGerant>
    )
  }

  return (
    <LayoutGerant activePage="mon-profil">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">👤 Mon Profil</h1>

      {/* Carte informations personnelles (lecture seule) */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Mes informations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Nom complet</p>
            <p className="text-lg font-semibold text-gray-800">{profil?.nom_complet || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Email (identifiant)</p>
            <p className="text-lg font-semibold text-gray-800">{profil?.email || '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Rôle</p>
            <p className="text-lg font-semibold text-amber-700">🧑‍💼 Gérant</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Statut</p>
            <p className="text-lg font-semibold text-emerald-700">
              {profil?.actif ? '✅ Actif' : '🔒 Désactivé'}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4 italic">
          Pour modifier votre nom ou votre email, contactez le bailleur.
        </p>
      </div>

      {/* Formulaire changement mot de passe */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
        <h2 className="text-xl font-bold text-gray-800 mb-2">🔐 Changer mon mot de passe</h2>
        <p className="text-sm text-gray-600 mb-4">
          Choisissez un mot de passe d'au moins 8 caractères que vous êtes le seul à connaître.
        </p>

        <form onSubmit={changerMotDePasse} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nouveau mot de passe
            </label>
            <input
              type="password"
              value={nouveauMdp}
              onChange={(e) => setNouveauMdp(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Au moins 8 caractères"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Confirmation du nouveau mot de passe
            </label>
            <input
              type="password"
              value={confirmationMdp}
              onChange={(e) => setConfirmationMdp(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="Retapez le mot de passe"
              required
              minLength={8}
            />
          </div>

          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={enCours}
            className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            {enCours ? 'Changement en cours...' : '🔐 Changer mon mot de passe'}
          </button>
        </form>
      </div>
    </LayoutGerant>
  )
}