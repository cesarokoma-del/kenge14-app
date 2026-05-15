import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import RouteGuard from '../../components/RouteGuard'
import {
  chargerItemAvecStock,
  modifierItem,
  desactiverItem,
  reactiverItem,
  listerMouvements,
  uploaderPhotoItem,
  CATEGORIES_INVENTAIRE,
  UNITES_INVENTAIRE,
  getInfoCategorie,
} from '../../lib/inventaire'
import { formatDateFR } from '../../lib/dateUtils'

export default function ItemDetailPage() {
  const router = useRouter()
  const { id } = router.query

  const [item, setItem] = useState(null)
  const [mouvements, setMouvements] = useState([])
  const [chargement, setChargement] = useState(true)
  const [edition, setEdition] = useState(false)
  const [form, setForm] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [confirmDesactivation, setConfirmDesactivation] = useState(false)

  useEffect(() => {
    if (!id) return
    chargerDonnees()
  }, [id])

  async function chargerDonnees() {
    setChargement(true)
    const [resItem, resMouvements] = await Promise.all([
      chargerItemAvecStock(id),
      listerMouvements({ itemId: id, limite: 50 }),
    ])
    if (resItem.error) {
      setErreur(resItem.error.message || 'Item introuvable')
    } else {
      setItem(resItem.data)
      setForm({
        nom: resItem.data.nom,
        categorie: resItem.data.categorie,
        unite: resItem.data.unite,
        description: resItem.data.description || '',
        prix_unitaire_usd: resItem.data.prix_unitaire_usd ?? '',
        seuil_alerte: resItem.data.seuil_alerte ?? '',
      })
    }
    setMouvements(resMouvements.data)
    setChargement(false)
  }

  function majChamp(champ, valeur) {
    setForm(prev => ({ ...prev, [champ]: valeur }))
  }

  function gererPhoto(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) { setPhoto(null); setPhotoPreview(null); return }
    if (!fichier.type.startsWith('image/')) { setErreur('Format invalide'); return }
    if (fichier.size > 5 * 1024 * 1024) { setErreur('Max 5 MB'); return }
    setErreur(null)
    setPhoto(fichier)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(fichier)
  }

  async function enregistrerModif() {
    setErreur(null)
    setEnregistrement(true)

    let updates = {
      nom: form.nom.trim(),
      categorie: form.categorie,
      unite: form.unite,
      description: form.description.trim() || null,
      prix_unitaire_usd: form.prix_unitaire_usd,
      seuil_alerte: form.seuil_alerte,
    }

    if (photo) {
      const { data: photoData, error: errPhoto } = await uploaderPhotoItem(photo, item.id)
      if (errPhoto) {
        setErreur(errPhoto.message)
        setEnregistrement(false)
        return
      }
      updates.photo_url = photoData.url
    }

    const { error } = await modifierItem(item.id, updates)
    if (error) {
      setErreur(error.message)
      setEnregistrement(false)
      return
    }

    setEdition(false)
    setPhoto(null)
    setPhotoPreview(null)
    await chargerDonnees()
    setEnregistrement(false)
  }

  async function basculerActif() {
    setErreur(null)
    const action = item.actif ? desactiverItem : reactiverItem
    const { error } = await action(item.id)
    if (error) { setErreur(error.message); return }
    setConfirmDesactivation(false)
    await chargerDonnees()
  }

  if (chargement) {
    return (
      <RouteGuard rolesAutorises={['bailleur']}>
        <Layout>
          <div className="max-w-4xl mx-auto p-6 text-center text-gray-500">
            Chargement...
          </div>
        </Layout>
      </RouteGuard>
    )
  }

  if (!item) {
    return (
      <RouteGuard rolesAutorises={['bailleur']}>
        <Layout>
          <div className="max-w-4xl mx-auto p-6">
            <p className="text-red-600">Item introuvable</p>
            <Link href="/inventaire" className="text-emerald-700 hover:underline mt-2 inline-block">
              ← Retour à l'inventaire
            </Link>
          </div>
        </Layout>
      </RouteGuard>
    )
  }

  const cat = getInfoCategorie(item.categorie)
  const stockBas = item.seuil_alerte != null && Number(item.stock_actuel) <= Number(item.seuil_alerte)

  return (
    <RouteGuard rolesAutorises={['bailleur']}>
      <Layout>
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <nav className="text-sm text-gray-500 mb-4">
            <Link href="/inventaire" className="hover:text-emerald-700">Inventaire</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">{item.nom}</span>
          </nav>

          {erreur && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              ⚠️ {erreur}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5">
              <div className="flex-shrink-0">
                {item.photo_url ? (
                  <img
                    src={item.photo_url}
                    alt={item.nom}
                    className="w-full sm:w-40 h-40 object-cover rounded-xl border border-gray-200"
                  />
                ) : (
                  <div className="w-full sm:w-40 h-40 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-5xl">
                    {cat.icone}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900">{item.nom}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {cat.icone} {cat.label}
                  {!item.actif && (
                    <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                      Désactivé
                    </span>
                  )}
                </p>

                {item.description && (
                  <p className="text-sm text-gray-700 mt-3">{item.description}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  <div className={`p-3 rounded-lg ${stockBas ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200'}`}>
                    <div className="text-xs text-gray-600">Stock actuel</div>
                    <div className={`text-xl font-bold ${stockBas ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {item.stock_actuel} <span className="text-sm font-normal">{item.unite}</span>
                    </div>
                    {stockBas && <div className="text-xs text-amber-700 mt-0.5">⚠️ Stock bas</div>}
                  </div>

                  {item.prix_unitaire_usd && (
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="text-xs text-gray-600">Prix unitaire</div>
                      <div className="text-xl font-bold text-gray-900">
                        ${Number(item.prix_unitaire_usd).toFixed(2)}
                      </div>
                    </div>
                  )}

                  {item.seuil_alerte != null && (
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div className="text-xs text-gray-600">Seuil alerte</div>
                      <div className="text-xl font-bold text-gray-900">
                        {item.seuil_alerte} <span className="text-sm font-normal">{item.unite}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-2">
              {!edition ? (
                <>
                  <button
                    onClick={() => setEdition(true)}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg transition-colors"
                  >
                    ✏️ Modifier
                  </button>
                  <button
                    onClick={() => setConfirmDesactivation(true)}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg transition-colors"
                  >
                    {item.actif ? '🚫 Désactiver' : '✅ Réactiver'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={enregistrerModif}
                    disabled={enregistrement}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-sm font-medium text-white rounded-lg transition-colors"
                  >
                    {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={() => { setEdition(false); setPhoto(null); setPhotoPreview(null); chargerDonnees() }}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-sm font-medium text-gray-700 rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                </>
              )}
            </div>
          </div>

          {edition && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Modifier l'item</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={form.nom}
                    onChange={(e) => majChamp('nom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                    <select
                      value={form.categorie}
                      onChange={(e) => majChamp('categorie', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    >
                      {CATEGORIES_INVENTAIRE.map(c => (
                        <option key={c.value} value={c.value}>{c.icone} {c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
                    <input
                      type="text"
                      list="unites-edit"
                      value={form.unite}
                      onChange={(e) => majChamp('unite', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <datalist id="unites-edit">
                      {UNITES_INVENTAIRE.map(u => <option key={u} value={u} />)}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire (USD)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.prix_unitaire_usd}
                      onChange={(e) => majChamp('prix_unitaire_usd', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.seuil_alerte}
                      onChange={(e) => majChamp('seuil_alerte', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => majChamp('description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouvelle photo <span className="text-gray-400 text-xs">(optionnel — remplace l'existante)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={gererPhoto}
                    className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  {photoPreview && (
                    <img src={photoPreview} alt="Aperçu" className="mt-3 max-h-40 rounded-lg border border-gray-200" />
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Historique des mouvements
              <span className="ml-2 text-sm font-normal text-gray-500">({mouvements.length})</span>
            </h2>

            {mouvements.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun mouvement enregistré.</p>
            ) : (
              <div className="space-y-2">
                {mouvements.map(m => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-lg border ${m.type === 'entree' ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-bold ${m.type === 'entree' ? 'text-emerald-700' : 'text-orange-700'}`}>
                          {m.type === 'entree' ? '↗ Entrée' : '↘ Sortie'} : {m.type === 'entree' ? '+' : '−'}{m.quantite} {item.unite}
                        </div>
                        {m.motif && <div className="text-sm text-gray-700 mt-1">{m.motif}</div>}
                        {m.appartement && (
                          <div className="text-xs text-gray-600 mt-0.5">Appartement : {m.appartement.nom}</div>
                        )}
                        {m.notes && <div className="text-xs text-gray-500 mt-1 italic">{m.notes}</div>}
                      </div>
                      <div className="text-right text-xs text-gray-500 shrink-0">
                        <div>{formatDateFR(m.cree_le)}</div>
                        {m.effectue_par_profil && (
                          <div className="mt-0.5">
                            {m.effectue_par_profil.nom_complet}
                            <span className="ml-1 text-gray-400">({m.effectue_par_profil.role})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {confirmDesactivation && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {item.actif ? 'Désactiver cet item ?' : 'Réactiver cet item ?'}
              </h3>
              <p className="text-sm text-gray-600 mb-5">
                {item.actif
                  ? 'L\'item sera masqué de la liste principale mais l\'historique sera préservé. Tu pourras le réactiver à tout moment.'
                  : 'L\'item sera de nouveau visible dans la liste principale.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={basculerActif}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
                >
                  Confirmer
                </button>
                <button
                  onClick={() => setConfirmDesactivation(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </RouteGuard>
  )
}