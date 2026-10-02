import { useState, useEffect } from 'react'
import Link from 'next/link'

// Memes ids / paths que l'ancien Navigation.js : aucune page a modifier
const GROUPES = [
  {
    titre: null,
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: '🏠', path: '/' },
      { id: 'appartements', label: 'Appartements', icon: '🏢', path: '/appartements' },
      { id: 'demandes', label: 'Demandes', icon: '📝', path: '/demandes' },
      { id: 'locataires', label: 'Locataires', icon: '👥', path: '/locataires' },
      { id: 'contrats', label: 'Contrats', icon: '📄', path: '/contrats' },
    ],
  },
  {
    titre: 'Finances',
    items: [
      { id: 'paiements', label: 'Paiements', icon: '💰', path: '/paiements' },
      { id: 'depenses', label: 'Dépenses', icon: '📊', path: '/depenses' },
    ],
  },
  {
    titre: 'Gérance',
    items: [
      { id: 'inventaire', label: 'Inventaire', icon: '📦', path: '/inventaire' },
      { id: 'renouvellements', label: 'Renouvellements', icon: '🔄', path: '/renouvellements' },
      { id: 'parametres', label: 'Paramètres', icon: '⚙️', path: '/parametres' },
    ],
  },
]

const CLE_STOCKAGE = 'kenge14-sidebar-repliee'

export default function Sidebar({ activePage, ouvertMobile, onFermerMobile }) {
    const [repliee, setRepliee] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem(CLE_STOCKAGE) === '1'
    } catch { return false }
  })

  function basculer() {
    const nouvelle = !repliee
    setRepliee(nouvelle)
    try {
      localStorage.setItem(CLE_STOCKAGE, nouvelle ? '1' : '0')
    } catch {}
  }

  const largeur = repliee ? 'w-[76px]' : 'w-60'

  return (
    <>
      {/* Voile sombre sur mobile quand le tiroir est ouvert */}
      {ouvertMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={onFermerMobile}
        />
      )}

      <aside
        className={`
          ${largeur} flex-shrink-0 bg-white border-r border-gray-200
          flex flex-col h-screen sticky top-0 z-40 transition-all duration-200
          fixed md:sticky
          ${ouvertMobile ? 'left-0' : '-left-64 md:left-0'}
        `}
      >
        {/* En-tete vert */}
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white px-4 py-4 flex items-center justify-between">
          {!repliee && (
            <div>
              <div className="text-xl font-bold leading-tight">KENGE14</div>
              <div className="text-emerald-100 text-xs">Gestion Locative - Congo</div>
            </div>
          )}
          {repliee && <div className="text-sm font-bold mx-auto">K14</div>}
          <button
            onClick={basculer}
            title={repliee ? 'Déplier le menu' : 'Replier le menu'}
            className="hidden md:flex w-7 h-7 items-center justify-center rounded bg-white/20 hover:bg-white/30 text-sm"
          >
            {repliee ? '›' : '‹'}
          </button>
        </div>

        {/* Liens */}
        <nav className="flex-1 overflow-y-auto py-2">
          {GROUPES.map((groupe, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="h-px bg-gray-200 mx-4 my-2" />}
              {groupe.titre && !repliee && (
                <div className="text-[11px] font-bold text-gray-400 px-5 pt-2 pb-1">
                  {groupe.titre}
                </div>
              )}
              {groupe.items.map((item) => {
                const actif = activePage === item.id
                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    title={repliee ? item.label : undefined}
                    onClick={onFermerMobile}
                    className={`
                      flex items-center gap-3 mx-2 my-0.5 rounded-lg text-sm font-medium transition
                      ${repliee ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
                      ${actif
                        ? 'bg-emerald-50 text-emerald-700 font-bold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-emerald-700'}
                    `}
                  >
                    <span className="text-lg leading-none">{item.icon}</span>
                    {!repliee && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}