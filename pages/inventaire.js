// pages/inventaire.js
// Page principale du module Inventaire (côté bailleur)
// Liste tous les items du catalogue avec leur stock actuel,
// filtres par catégorie et recherche, et accès aux fiches détaillées.
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import RouteGuard from '../components/RouteGuard'
import { listerStockActuel, CATEGORIES_INVENTAIRE, getInfoCategorie } from '../lib/inventaire'

export default function PageInventaire() {
  return (
    <RouteGuard rolesAutorises={['bailleur']}>
      <Contenu />
    </RouteGuard>
  )
}

function Contenu() {
  const router = useRouter()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')

  // Filtres
  const [recherche, setRecherche] = useState('')
  const [categorieFiltre, setCategorieFiltre] = useState('')
  const [stockBasUniquement, setStockBasUniquement] = useState(false)
  const [inclureInactifs, setInclureInactifs] = useState(false)

  useEffect(() => {
    chargerItems()
  }, [recherche, categorieFiltre, inclureInactifs])

  async function chargerItems() {
    setLoading(true)
    const { data, error } = await listerStockActuel({
      inclureInactifs,
      categorie: categorieFiltre || null,
      recherche: recherche || null,
    })
    if (error) {
      setErreur(error.message || 'Erreur de chargement')
    } else {
      setErreur('')
      setItems(data || [])
    }
    setLoading(false)
  }

  // Filtrer en local pour "stock bas" (la vue ne le fait pas directement)
  const itemsFiltres = useMemo(() => {
    if (!stockBasUniquement) return items
    return items.filter(item =>
      item.seuil_alerte !== null
      && Number(item.stock_actuel) <= Number(item.seuil_alerte)
    )
  }, [items, stockBasUniquement])

  const nbStockBas = useMemo(() => {
    return items.filter(item =>
      item.actif
      && item.seuil_alerte !== null
      && Number(item.stock_actuel) <= Number(item.seuil_alerte)
    ).length
  }, [items])

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📦 Inventaire du dépôt</h1>
            <p className="text-gray-500 text-sm mt-1">
              {items.length} item{items.length > 1 ? 's' : ''} au catalogue
              {nbStockBas > 0 && (
                <> · <span className="text-amber-700 font-semibold">{nbStockBas} en stock bas ⚠️</span></>
              )}
            </p>
          </div>
          <button
            onClick={() => router.push('/inventaire/nouveau')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm"
          >
            + Nouvel item
          </button>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              placeholder="🔍 Rechercher un item..."
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={categorieFiltre}
              onChange={e => setCategorieFiltre(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Toutes les catégories</option>
              {CATEGORIES_INVENTAIRE.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.icone} {cat.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stockBasUniquement}
                  onChange={e => setStockBasUniquement(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Stock bas uniquement
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inclureInactifs}
                  onChange={e => setInclureInactifs(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Inclure inactifs
              </label>
            </div>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement...</div>
        ) : erreur ? (
          <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-xl">
            ❌ {erreur}
          </div>
        ) : itemsFiltres.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <p className="text-gray-500 text-lg mb-2">
              {items.length === 0
                ? '📭 Aucun item dans l\'inventaire'
                : '🔍 Aucun résultat avec ces filtres'
              }
            </p>
            {items.length === 0 && (
              <button
                onClick={() => router.push('/inventaire/nouveau')}
                className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Créer le premier item
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {itemsFiltres.map(item => (
              <CarteItem
                key={item.id}
                item={item}
                onClick={() => router.push(`/inventaire/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

// ============================================================
// Carte item
// ============================================================
function CarteItem({ item, onClick }) {
  const info = getInfoCategorie(item.categorie)
  const stock = Number(item.stock_actuel)
  const seuil = item.seuil_alerte !== null ? Number(item.seuil_alerte) : null

  // État du stock
  let badgeCls = 'bg-emerald-100 text-emerald-800 border-emerald-300'
  let badgeIcon = '✓'
  if (seuil !== null && stock <= seuil) {
    badgeCls = 'bg-amber-100 text-amber-800 border-amber-300'
    badgeIcon = '⚠️'
  }
  if (stock <= 0) {
    badgeCls = 'bg-red-100 text-red-800 border-red-300'
    badgeIcon = '⛔'
  }

  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl shadow-sm border ${item.actif ? 'border-gray-200 hover:border-emerald-400' : 'border-gray-300 opacity-60'} p-4 hover:shadow-md transition-all`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 truncate">{info.icone} {item.nom}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{info.label}</p>
        </div>
        {!item.actif && (
          <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full ml-2">Inactif</span>
        )}
      </div>

      {item.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeCls}`}>
          {badgeIcon} {stock} {item.unite}{stock > 1 ? 's' : ''}
        </span>
        {item.prix_unitaire_usd && (
          <span className="text-xs text-gray-500">{Number(item.prix_unitaire_usd).toFixed(2)} USD/u</span>
        )}
      </div>

      {seuil !== null && (
        <p className="text-xs text-gray-400 mt-2">Seuil d'alerte : {seuil} {item.unite}{seuil > 1 ? 's' : ''}</p>
      )}
    </button>
  )
}