import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Navigation from './Navigation'
import { signOut, getSession } from '../lib/supabase'

export default function Layout({ children, activePage }) {
  const router = useRouter()
  const [emailUtilisateur, setEmailUtilisateur] = useState('')
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false)

  useEffect(() => {
    async function chargerEmail() {
      const { session } = await getSession()
      if (session?.user?.email) {
        setEmailUtilisateur(session.user.email)
      }
    }
    chargerEmail()
  }, [])

  async function handleDeconnexion() {
    if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return
    
    setDeconnexionEnCours(true)
    await signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">KENGE14</h1>
              <p className="text-emerald-100 text-sm">Gestion Locative - Congo</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Sélecteur de devise */}
              <select className="bg-emerald-800 text-white px-4 py-2 rounded-lg border border-emerald-600 text-sm">
                <option>USD $</option>
                <option>CDF Fc</option>
              </select>

              {/* Bouton déconnexion */}
              <div className="relative group">
                <button
                  onClick={handleDeconnexion}
                  disabled={deconnexionEnCours}
                  className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-900 px-4 py-2 rounded-lg border border-emerald-600 transition-colors disabled:opacity-50"
                  title={emailUtilisateur || 'Se déconnecter'}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">
                    {deconnexionEnCours ? 'Déconnexion...' : 'Déconnexion'}
                  </span>
                </button>
                
                {/* Tooltip avec email au survol */}
                {emailUtilisateur && (
                  <div className="absolute right-0 top-full mt-2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    Connecté : {emailUtilisateur}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <Navigation activePage={activePage} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            © 2026 KENGE14 - Gestion Locative Professionnelle
          </p>
        </div>
      </footer>
    </div>
  )
}