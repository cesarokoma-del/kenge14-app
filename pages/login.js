import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { signIn, getSession } from '../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [verifSession, setVerifSession] = useState(true)

  // Si déjà connecté → redirection vers /
  useEffect(() => {
    async function verif() {
      const { session } = await getSession()
      if (session) {
        router.push('/')
      } else {
        setVerifSession(false)
      }
    }
    verif()
  }, [router])

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: authError } = await signIn(email, password)

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect'
          : authError.message
      )
      setLoading(false)
      return
    }

    if (data?.session) {
      router.push('/')
    }
  }

  // Pendant la vérif initiale → écran neutre
  if (verifSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-emerald-600 text-xl">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo / Titre */}
        <div className="text-center mb-8">
          <div className="inline-block bg-emerald-600 text-white rounded-2xl px-6 py-4 shadow-lg">
            <h1 className="text-3xl font-bold">KENGE 14</h1>
            <p className="text-emerald-100 text-sm mt-1">Espace Administrateur</p>
          </div>
        </div>

        {/* Carte login */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Connexion</h2>
          <p className="text-gray-600 text-sm mb-6">
            Connectez-vous pour accéder au tableau de bord
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none transition-colors"
                placeholder="cesarokoma@gmail.com"
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none transition-colors"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {/* Erreur */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 text-red-700 text-sm">
                ❌ {error}
              </div>
            )}

            {/* Bouton */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3 rounded-lg transition-colors shadow-md"
            >
              {loading ? '⏳ Connexion...' : '🔓 Se connecter'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          KENGE 14 • Gestion Locative Professionnelle
        </p>
      </div>
    </div>
  )
}