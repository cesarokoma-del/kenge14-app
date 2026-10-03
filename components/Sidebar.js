import { useState } from 'react'
import Link from 'next/link'

// Icones au trait (SVG inline). Cle = nom utilisable dans `icon`.
const ICONES = {
  home: <path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z" />,
  building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2" /></>,
  file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c3 0 5 2 5 5" /></>,
  document: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  coins: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  box: <><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.7" /><path d="M20 4v4h-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  bank: <path d="M3 10l9-6 9 6M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18" />,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" /></>,
  wallet: <><path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><path d="M16 3H6a2 2 0 0 0-2 2v2" /><circle cx="16" cy="14" r="1.5" /></>,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="1" /><path d="M9 4V2h6v2M9 10h6M9 14h6" /></>,
}

function Icone({ nom }) {
  const trace = ICONES[nom]
  if (!trace) return <span className="text-lg leading-none">{nom}</span>
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      {trace}
    </svg>
  )
}

// Groupes par defaut = menu bailleur (memes ids / paths que l'ancien Navigation.js)
const GROUPES_BAILLEUR = [
  {
    titre: null,
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: 'home', path: '/' },
      { id: 'appartements', label: 'Appartements', icon: 'building', path: '/appartements' },
      { id: 'demandes', label: 'Demandes', icon: 'file', path: '/demandes' },
      { id: 'locataires', label: 'Locataires', icon: 'users', path: '/locataires' },
      { id: 'contrats', label: 'Contrats', icon: 'document', path: '/contrats' },
    ],
  },
  {
    titre: 'Finances',
    items: [
      { id: 'paiements', label: 'Paiements', icon: 'coins', path: '/paiements' },
      { id: 'depenses', label: 'Dépenses', icon: 'chart', path: '/depenses' },
    ],
  },
  {
    titre: 'Gérance',
    items: [
      { id: 'inventaire', label: 'Inventaire', icon: 'box', path: '/inventaire' },
      { id: 'renouvellements', label: 'Renouvellements', icon: 'refresh', path: '/renouvellements' },
      { id: 'parametres', label: 'Paramètres', icon: 'settings', path: '/parametres' },
    ],
  },
]

const THEMES = {
  vert: {
    entete: 'bg-gradient-to-r from-emerald-700 to-emerald-600',
    sousTitre: 'text-emerald-100',
    actif: 'bg-emerald-50 text-emerald-700',
    hover: 'hover:bg-gray-50 hover:text-emerald-700',
  },
  ambre: {
    entete: 'bg-gradient-to-r from-amber-600 to-amber-500',
    sousTitre: 'text-amber-100',
    actif: 'bg-amber-50 text-amber-700',
    hover: 'hover:bg-amber-50 hover:text-amber-700',
  },
}

const CLE_STOCKAGE = 'kenge14-sidebar-repliee'

export default function Sidebar({
  activePage,
  ouvertMobile,
  onFermerMobile,
  groupes = GROUPES_BAILLEUR,
  theme = 'vert',
  sousTitre = 'Gestion Locative - Congo',
  badge = null,
  compteurs = {},
}) {
  const t = THEMES[theme] || THEMES.vert

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
      {ouvertMobile && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={onFermerMobile} />
      )}

      <aside
        className={`
          ${largeur} flex-shrink-0 bg-white border-r border-gray-200
          flex flex-col h-screen sticky top-0 z-40 transition-all duration-200
          fixed md:sticky
          ${ouvertMobile ? 'left-0' : '-left-64 md:left-0'}
        `}
      >
        <div className={`${t.entete} text-white px-4 py-4 flex items-center justify-between`}>
          {!repliee && (
            <div>
              <div className="text-xl font-bold leading-tight">KENGE14</div>
              {badge && (
                <span className="inline-block mt-1 text-[10px] bg-white/90 text-gray-800 px-2 py-0.5 rounded-full font-semibold">
                  {badge}
                </span>
              )}
              <div className={`${t.sousTitre} text-xs mt-1`}>{sousTitre}</div>
            </div>
          )}
          {repliee && <div className="text-sm font-bold mx-auto">K14</div>}
          <button
            onClick={basculer}
            title={repliee ? 'Déplier le menu' : 'Replier le menu'}
            className="hidden md:flex w-7 h-7 items-center justify-center rounded bg-white/20 hover:bg-white/30 text-sm flex-shrink-0"
          >
            {repliee ? '›' : '‹'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {groupes.map((groupe, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="h-px bg-gray-200 mx-4 my-2" />}
              {groupe.titre && !repliee && (
                <div className="text-[11px] font-bold text-gray-400 px-5 pt-2 pb-1">{groupe.titre}</div>
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
                      relative flex items-center gap-3 mx-2 my-0.5 rounded-lg text-sm font-medium transition
                      ${repliee ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
                      ${actif ? `${t.actif} font-bold` : `text-gray-600 ${t.hover}`}
                    `}
                  >
                    <Icone nom={item.icon} />
                    {!repliee && <span className="flex-1">{item.label}</span>}
                    {compteurs[item.id] > 0 && (
                      <span className={`
                        text-[11px] font-bold text-white rounded-full px-2 py-0.5 min-w-[20px] text-center
                        ${item.id === 'demandes' ? 'bg-blue-600' : 'bg-red-600'}
                        ${repliee ? 'absolute top-1 right-1' : ''}
                      `}>
                        {compteurs[item.id]}
                      </span>
                    )}
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