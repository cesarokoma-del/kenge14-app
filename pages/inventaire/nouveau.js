import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../../components/Layout'
import RouteGuard from '../../components/RouteGuard'
import {
  creerItem,
  modifierItem,
  uploaderPhotoItem,
  CATEGORIES_INVENTAIRE,
  UNITES_INVENTAIRE,
} from '../../lib/inventaire'

export default function NouvelItemPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    nom: '',
    categorie: 'outil',
    unite: 'pièce',
    quantite_initiale: 0,
    description: '',
    prix_unitaire_usd: '',
    seuil_alerte: '',
  })
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)

  function majChamp(champ, valeur) {
    setForm(prev => ({ ...prev, [champ]: valeur }))
  }

  function gererPhoto(e) {
    const fichier = e.target.files?.[0]
    if (!fichier) { setPhoto(null); setPhotoPreview(null); return }
    if (!fichier.type.startsWith('image/')) {
      setErreur('Format invalide (image uniquement)'); return
    }
    if (fichier.size > 5 * 1024 * 1024) {
      setErreur('Fichier trop volumineux (max 5 MB)'); return
    }
    setErreur(null)
    setPhoto(fichier)
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(fichier)
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)

    if (!form.nom.trim()) {
      setErreur('Le nom est obligatoire'); return
    }

    setEnregistrement(true)

    const { data: item, error: errCreation } = await creerItem({
      nom: form.nom.trim(),
      categorie: form.categorie,
      unite: form.unite,
      quantite_initiale: form.quantite_initiale,
      description: form.description.trim() || null,
      prix_unitaire_usd: form.prix_unitaire_usd || null,
      seuil_alerte: form.seuil_alerte || null,
    })

    if (errCreation) {
      setErreur(errCreation.message || 'Erreur lors de la création')
      setEnregistrement(false)
      return
    }

    if (photo && item) {
      const { data: photoData, error: errPhoto } = await uploaderPhotoItem(photo, item.id)
      if (errPhoto) {
        setErreur(`Item créé mais photo non uploadée : ${errPhoto.message}`)
        setEnregistrement(false)
        // On redirige quand même vers la fiche pour qu'il puisse retenter
        setTimeout(() => router.push(`/inventaire/${item.id}`), 1500)
        return
      }
      await modifierItem(item.id, { photo_url: photoData.url })
    }

    router.push(`/inventaire/${item.id}`)
  }

  return (
    <RouteGuard rolesAutorises={['bailleur']}>
      <Layout>
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          <nav className="text-sm text-gray-500 mb-4">
            <Link href="/inventaire" className="hover:text-emerald-700">Inventaire</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-700">Nouvel item</span>
          </nav>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-7">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Nouvel item</h1>
            <p className="text-sm text-gray-600 mb-6">
              Ajoute un article au catalogue du dépôt. La quantité initiale définit le stock présent au moment de l'ajout.
            </p>

            {erreur && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                ⚠️ {erreur}
              </div>
            )}

            <form onSubmit={soumettre} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => majChamp('nom', e.target.value)}
                  placeholder="Ex : Perceuse Bosch, Sac de ciment, Ampoule LED..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.categorie}
                    onChange={(e) => majChamp('categorie', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    required
                  >
                    {CATEGORIES_INVENTAIRE.map(c => (
                      <option key={c.value} value={c.value}>{c.icone} {c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unité <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="unites-suggestions"
                    value={form.unite}
                    onChange={(e) => majChamp('unite', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <datalist id="unites-suggestions">
                    {UNITES_INVENTAIRE.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité initiale</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.quantite_initiale}
                    onChange={(e) => majChamp('quantite_initiale', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Stock présent au moment de l'ajout</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prix_unitaire_usd}
                    onChange={(e) => majChamp('prix_unitaire_usd', e.target.value)}
                    placeholder="Optionnel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte stock bas</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.seuil_alerte}
                  onChange={(e) => majChamp('seuil_alerte', e.target.value)}
                  placeholder="Optionnel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alerte si le stock tombe à ce niveau ou en dessous
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => majChamp('description', e.target.value)}
                  rows={2}
                  placeholder="Marque, modèle, n° de série, état..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Photo <span className="text-gray-400 text-xs">(optionnelle)</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={gererPhoto}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
                {photoPreview && (
                  <div className="mt-3">
                    <img src={photoPreview} alt="Aperçu" className="max-h-48 rounded-lg border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                      className="mt-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Retirer la photo
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={enregistrement}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  {enregistrement ? 'Enregistrement...' : 'Créer l\'item'}
                </button>
                <Link
                  href="/inventaire"
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-center transition-colors"
                >
                  Annuler
                </Link>
              </div>
            </form>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  )
}