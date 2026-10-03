import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Sidebar from './Sidebar'
import { signOut, getSession, getProfilUtilisateur, getLocatairesEnRetard, getDemandesEnAttente, getComptesEpargne } from '../lib/supabase'
import LayoutGerant from './LayoutGerant'
import { viderCacheAcces } from './RouteGuard'

// Cache du role en memoire : survit aux navigations, pas au rechargement complet.
// Evite l'ecran vide a chaque changement de page.
let roleEnCache = null
let compteursEnCache = {}
let comptesEnCache = []

export default function Layout({ children, activePage }) {
  const router = useRouter()

  // 🎯 TOUS les hooks doivent être déclarés AVANT tout return (règle React)
    const [roleVerifie, setRoleVerifie] = useState(
    () => typeof window !== 'undefined' && roleEnCache !== null
  )
  const [estGerant, setEstGerant] = useState(
    () => typeof window !== 'undefined' && roleEnCache === 'gerant'
  )
  const [emailUtilisateur, setEmailUtilisateur] = useState('')
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false)
  const [menuMobileOuvert, setMenuMobileOuvert] = useState(false)
  const [compteurs, setCompteurs] = useState(
    () => (typeof window !== 'undefined' ? compteursEnCache : {})
  )
  const [comptesEpargne, setComptesEpargne] = useState(
    () => (typeof window !== 'undefined' ? comptesEnCache : [])
  )

      // useEffect 1 : détecter le rôle (reverifie en arriere-plan a chaque fois)
  useEffect(() => {
    async function detecterRole() {
      const { role } = await getProfilUtilisateur()
      roleEnCache = role || 'bailleur'
      setEstGerant(role === 'gerant')
      setRoleVerifie(true)
    }
    detecterRole()
  }, [])

  // useEffect 2 : charger l'email
  useEffect(() => {
    async function chargerEmail() {
      const { session } = await getSession()
      if (session?.user?.email) {
        setEmailUtilisateur(session.user.email)
      }
    }
    chargerEmail()
  }, [])

    // useEffect 3 : compteurs pour les pastilles de la sidebar
  useEffect(() => {
    async function chargerCompteurs() {
      const [{ data: retards }, { count: nbDemandes }] = await Promise.all([
        getLocatairesEnRetard(),
        getDemandesEnAttente(),
      ])
      compteursEnCache = { paiements: (retards || []).length, demandes: nbDemandes || 0 }
      setCompteurs(compteursEnCache)
      const { data: comptes } = await getComptesEpargne()
      comptesEnCache = comptes || []
      setComptesEpargne(comptesEnCache)
    }
    chargerCompteurs()
  }, [])

  async function handleDeconnexion() {
    if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return
    
    setDeconnexionEnCours(true)
    roleEnCache = null
    compteursEnCache = {}
    viderCacheAcces()
    await signOut()
    router.push('/login')
  }

  // 🎯 Returns APRÈS tous les hooks
  // Pendant la vérif → écran vide neutre
  if (!roleVerifie) {
    return <div className="min-h-screen bg-gray-50" />
  }

  // Si gérant → déléguer à LayoutGerant
  if (estGerant) {
    return <LayoutGerant activePage={activePage}>{children}</LayoutGerant>
  }
    const sousMenus = {
    comptes: [
      { id: 'compte-general', label: 'Compte général', path: '/comptes' },
      ...comptesEpargne.map(c => ({ id: `compte-${c.id}`, label: c.nom, path: `/comptes?compte=${c.id}` })),
    ],
  }

    return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        activePage={activePage}
        ouvertMobile={menuMobileOuvert}
        onFermerMobile={() => setMenuMobileOuvert(false)}
        compteurs={compteurs}
        sousMenus={sousMenus}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barre haute */}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          {/* Bouton menu (mobile seulement) */}
          <button
            onClick={() => setMenuMobileOuvert(true)}
            className="md:hidden text-2xl text-gray-700"
            aria-label="Ouvrir le menu"
          >
            ☰
          </button>
          <div className="hidden md:block" />

          <div className="flex items-center gap-3">
            <select className="bg-white text-gray-700 px-3 py-1.5 rounded-lg border border-gray-300 text-sm">
              <option>USD $</option>
              <option>CDF Fc</option>
            </select>

            <div className="relative group">
              <button
                onClick={handleDeconnexion}
                disabled={deconnexionEnCours}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                title={emailUtilisateur || 'Se déconnecter'}
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
              {emailUtilisateur && (
                <div className="absolute right-0 top-full mt-2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  Connecté : {emailUtilisateur}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          <p className="text-center text-gray-500 text-sm py-4">
            © 2026 KENGE14 - Gestion Locative Professionnelle
          </p>
        </footer>
      </div>
    </div>
  )
}