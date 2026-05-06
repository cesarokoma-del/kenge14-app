import Link from 'next/link'

export default function Navigation({ activePage }) {
  const items = [
    { id: 'dashboard', label: 'Tableau de bord', icon: '🏠', path: '/' },
    { id: 'appartements', label: 'Appartements', icon: '🏢', path: '/appartements' },
    { id: 'demandes', label: 'Demandes', icon: '📝', path: '/demandes' },
    { id: 'locataires', label: 'Locataires', icon: '👥', path: '/locataires' },
    { id: 'contrats', label: 'Contrats', icon: '📄', path: '/contrats' },
    { id: 'paiements', label: 'Paiements', icon: '💰', path: '/paiements' },
    { id: 'depenses', label: 'Dépenses', icon: '📊', path: '/depenses' },
    { id: 'renouvellements', label: 'Renouvellements', icon: '🔄', path: '/renouvellements' },
  ]

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex overflow-x-auto">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                activePage === item.id
                  ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                  : 'border-transparent text-gray-600 hover:text-emerald-700 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
