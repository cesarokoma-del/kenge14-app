import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Navigation({ activePage }) {
  const router = useRouter()
  
  const navItems = [
    { name: 'Tableau de bord', icon: '🏠', href: '/' },
    { name: 'Appartements', icon: '🏢', href: '/appartements' },
    { name: 'Suivi Locataires', icon: '👥', href: '/locataires' },
    { name: 'Paiements', icon: '💰', href: '/paiements' },
    { name: 'Dépenses', icon: '📊', href: '/depenses' },
    { name: 'Contrats', icon: '📄', href: '/contrats' },
    { name: 'Renouvellements', icon: '🔄', href: '/renouvellements' },
  ]
  
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex space-x-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = router.pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  px-6 py-4 font-medium border-b-4 transition-all whitespace-nowrap
                  ${isActive
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-transparent text-gray-600 hover:text-emerald-600'
                  }
                `}
              >
                <span className="mr-2">{item.icon}</span>
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
