import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { signOut, getProfilUtilisateur } from '../lib/supabase'
import RouteGuard from './RouteGuard'

/**
 * Layout dédié à l'Espace Gérant.
 * 
 * Identité visuelle : palette ambre (différente du vert bailleur)
 * pour que le gérant identifie immédiatement son interface.
 * 
 * Sécurité : enveloppe automatiquement le contenu dans un RouteGuard
 * qui n'autorise QUE le rôle 'gerant'.
 * 
 * Usage dans une page gérant :
 *   <LayoutGerant activePage="dashboard">
 *     <p>Contenu de la page</p>
 *   </LayoutGerant>
 */
export default function LayoutGerant({ children, activePage }) {
  const router = useRouter()
  const [profil, setProfil] = useState(null)
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false)

  useEffect(() => {
    chargerProfil()
  }, [])

  async function chargerProfil() {
    const { profil } = await getProfilUtilisateur()
    setProfil(profil)
  }

  async function handleDeconnexion() {
    if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return
    
    setDeconnexionEnCours(true)
    await signOut()
    router.push('/login')
  }

  // ─── Liste des onglets du menu gérant ────────────────────
  const onglets = [
    { id: 'dashboard',     label: 'Mon Espace',      href: '/gerant/dashboard',     icone: '🏠' },
    { id: 'locataires',    label: 'Locataires',      href: '/locataires',           icone: '👥' },
    { id: 'demandes',      label: 'Demandes',        href: '/demandes',             icone: '📨' },
    { id: 'depenses',     label: 'Mes Dépenses', href: '/gerant/depense', icone: '📝' },
    { id: 'mon-solde',     label: 'Mon Solde',      href: '/gerant/mon-solde',     icone: '💰' },
    { id: 'paiement-cash', label: 'Paiement Cash',   href: '/gerant/paiement-cash', icone: '💵' },
    { id: 'mon-profil',    label: 'Mon Profil',      href: '/gerant/mon-profil',    icone: '👤' },
  ]

  return (
    <RouteGuard rolesAutorises={['gerant']}>
      <div className="min-h-screen bg-gray-50">
        
        {/* ═══ HEADER (palette ambre/orange) ═══ */}
        <header className="bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  KENGE14
                  <span className="text-sm bg-white text-amber-700 px-2 py-1 rounded-full font-semibold">
                    🧑‍💼 ESPACE GÉRANT
                  </span>
                </h1>
                <p className="text-amber-100 text-sm mt-1">
                  Gestion locative quotidienne - Kinshasa
                </p>
              </div>

              {/* Profil + déconnexion */}
              <div className="flex items-center gap-3">
                {profil && (
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold">{profil.nom_complet}</p>
                    <p className="text-xs text-amber-100">{profil.email}</p>
                  </div>
                )}

                <button
                  onClick={handleDeconnexion}
                  disabled={deconnexionEnCours}
                  className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 px-4 py-2 rounded-lg border border-amber-400 transition-colors disabled:opacity-50"
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
              </div>
            </div>
          </div>
        </header>

        {/* ═══ NAVIGATION (menu dédié 5 onglets) ═══ */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto">
              {onglets.map((onglet) => {
                const actif = activePage === onglet.id
                return (
                  <Link
                    key={onglet.id}
                    href={onglet.href}
                    className={`
                      flex items-center gap-2 px-4 py-4 whitespace-nowrap text-sm font-medium border-b-2 transition-colors
                      ${actif 
                        ? 'border-amber-500 text-amber-700 bg-amber-50' 
                        : 'border-transparent text-gray-600 hover:text-amber-700 hover:bg-amber-50'}
                    `}
                  >
                    <span>{onglet.icone}</span>
                    <span>{onglet.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </nav>

        {/* ═══ CONTENU PRINCIPAL ═══ */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* ═══ FOOTER ═══ */}
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-gray-500 text-sm">
              © 2026 KENGE14 - Espace Gérant
            </p>
          </div>
        </footer>
      </div>
    </RouteGuard>
  )
}