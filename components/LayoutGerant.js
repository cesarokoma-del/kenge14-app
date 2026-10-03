import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { signOut, getProfilUtilisateur } from '../lib/supabase'
import RouteGuard from './RouteGuard'
import Sidebar from './Sidebar'
import { viderCacheAcces } from './RouteGuard'

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
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false)

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
    viderCacheAcces()
    await signOut()
    router.push('/login')
  }

    // ─── Menu gérant, groupé pour la sidebar ────────────────
  const groupesGerant = [
    {
      titre: null,
      items: [
        { id: 'dashboard',    label: 'Mon Espace',   icon: 'home',      path: '/gerant/dashboard' },
        { id: 'appartements', label: 'Appartements', icon: 'building',  path: '/gerant/appartements' },
        { id: 'locataires',   label: 'Locataires',   icon: 'users',     path: '/locataires' },
        { id: 'demandes',     label: 'Demandes',     icon: 'clipboard', path: '/demandes' },
      ],
    },
    {
      titre: 'Finances',
      items: [
        { id: 'depenses',      label: 'Mes Dépenses',  icon: 'chart',  path: '/gerant/depense' },
        { id: 'mon-solde',     label: 'Mon Solde',     icon: 'wallet', path: '/gerant/mon-solde' },
        { id: 'paiement-cash', label: 'Paiement Cash', icon: 'cash',   path: '/gerant/paiement-cash' },
      ],
    },
    {
      titre: 'Stock',
      items: [
        { id: 'inventaire-sortie', label: 'Sortie Stock', icon: 'send', path: '/gerant/inventaire-sortie' },
      ],
    },
    {
      titre: null,
      items: [
        { id: 'mon-profil', label: 'Mon Profil', icon: 'user', path: '/gerant/mon-profil' },
      ],
    },
  ]

    return (
    <RouteGuard rolesAutorises={['gerant']}>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar
          activePage={activePage}
          ouvertMobile={menuMobileOuvert}
          onFermerMobile={() => setMenuMobileOuvert(false)}
          groupes={groupesGerant}
          theme="ambre"
          sousTitre="Gestion quotidienne - Kinshasa"
          badge="🧑‍💼 ESPACE GÉRANT"
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
            <button
              onClick={() => setMenuMobileOuvert(true)}
              className="md:hidden text-2xl text-gray-700"
              aria-label="Ouvrir le menu"
            >
              ☰
            </button>
            <div className="hidden md:block" />

            <div className="flex items-center gap-3">
              {profil && (
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-gray-800">{profil.nom_complet}</p>
                  <p className="text-xs text-gray-500">{profil.email}</p>
                </div>
              )}
              <button
                onClick={handleDeconnexion}
                disabled={deconnexionEnCours}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="text-sm font-medium hidden sm:inline">
                  {deconnexionEnCours ? 'Déconnexion...' : 'Déconnexion'}
                </span>
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>

          <footer className="bg-white border-t border-gray-200">
            <p className="text-center text-gray-500 text-sm py-4">
              © 2026 KENGE14 - Espace Gérant
            </p>
          </footer>
        </div>
      </div>
    </RouteGuard>
  )
}