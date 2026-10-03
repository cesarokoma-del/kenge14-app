import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import LayoutGerant from '../../components/LayoutGerant'
import { supabase } from '../../lib/supabase'
import {
  listerStockActuel,
  enregistrerSortie,
  enregistrerEntree,
  listerMouvements,
  getInfoCategorie,
} from '../../lib/inventaire'
import { formatDateFR } from '../../lib/dateUtils'

export default function InventaireSortiePage() {
  const router = useRouter()

  const [items, setItems] = useState([])
  const [appartements, setAppartements] = useState([])
  const [sortiesRecentes, setSortiesRecentes] = useState([])
  const [chargement, setChargement] = useState(true)

  const [form, setForm] = useState({
    itemId: '',
    quantite: '',
    motif: '',
    appartementId: '',
    notes: '',
  })
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [succes, setSucces] = useState(null)
  const [mode, setMode] = useState('sortie') // 'sortie' | 'retour'

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setChargement(true)

    const { data: { user } } = await supabase.auth.getUser()

    const [resItems, resAppts, resSorties] = await Promise.all([
      listerStockActuel({ inclureInactifs: false }),
      supabase
        .from('appartements')
        .select('id, nom')
        .order('nom', { ascending: true }),
      listerMouvements({
        effectuePar: user?.id,
        limite: 10,
      }),
    ])

    // Tous les items actifs ; le filtre stock > 0 s'applique seulement en mode Sortie
    setItems(resItems.data || [])
    setAppartements(resAppts.data || [])
    setSortiesRecentes(resSorties.data || [])
    setChargement(false)
  }

  function majChamp(champ, valeur) {
    setForm(prev => ({ ...prev, [champ]: valeur }))
    if (erreur) setErreur(null)
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    setSucces(null)

    if (!form.itemId) { setErreur('Sélectionne un item'); return }
    if (!form.quantite || Number(form.quantite) <= 0) {
      setErreur('Quantité doit être supérieure à 0'); return
    }
    if (mode === 'sortie' && !form.motif.trim()) {
      setErreur('Le motif est obligatoire'); return
    }
    if (mode === 'retour' && !form.notes.trim()) {
      setErreur('Indique la raison du retour'); return
    }

    setEnregistrement(true)
    const { error } = mode === 'retour'
      ? await enregistrerEntree({
          itemId: form.itemId,
          quantite: form.quantite,
          motif: 'retour',
          notes: form.notes.trim(),
        })
      : await enregistrerSortie({
          itemId: form.itemId,
          quantite: form.quantite,
          motif: form.motif.trim(),
          appartementId: form.appartementId || null,
          notes: form.notes.trim() || null,
        })

    if (error) {
      setErreur(error.message || 'Erreur lors de l\'enregistrement')
      setEnregistrement(false)
      return
    }

    const itemNom = items.find(i => i.id === form.itemId)?.nom || ''
    setSucces(mode === 'retour'
      ? `✅ Retour de ${form.quantite} × ${itemNom} remis en stock`
      : `✅ Sortie de ${form.quantite} × ${itemNom} enregistrée`)
    setForm({ itemId: '', quantite: '', motif: '', appartementId: '', notes: '' })
    await chargerDonnees()
    setEnregistrement(false)
    setTimeout(() => setSucces(null), 4000)
  }

  const itemSelectionne = items.find(i => i.id === form.itemId)
  const itemsProposes = mode === 'sortie'
    ? items.filter(i => Number(i.stock_actuel) > 0)
    : items

  return (
    <LayoutGerant>
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">📤 Sortie de stock</h1>
          <p className="text-sm text-gray-600 mt-1">
            Enregistre une sortie du dépôt (matériel utilisé, consommable distribué...)
          </p>
        </div>

        {succes && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            {succes}
          </div>
        )}

        {erreur && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            ⚠️ {erreur}
          </div>
        )}

        {/* FORMULAIRE DE SORTIE */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 mb-6">
          <form onSubmit={soumettre} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              {[
                { val: 'sortie', label: '📤 Sortie' },
                { val: 'retour', label: '📥 Retour en stock' },
              ].map(o => (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => { setMode(o.val); setErreur(null); setForm(f => ({ ...f, itemId: '' })) }}
                  className={`py-2 rounded-lg text-sm font-medium transition ${
                    mode === o.val
                      ? 'bg-white shadow-sm text-amber-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div>
              
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item <span className="text-red-500">*</span>
              </label>
              <select
                value={form.itemId}
                onChange={(e) => majChamp('itemId', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-white text-base"
                required
                disabled={chargement}
              >
                <option value="">
                  {chargement
                    ? 'Chargement...'
                    : itemsProposes.length === 0
                      ? '— Aucun item disponible —'
                      : '— Choisir un item —'}
                </option>
                {itemsProposes.map(i => {
                  const cat = getInfoCategorie(i.categorie)
                  return (
                    <option key={i.id} value={i.id}>
                      {cat.icone} {i.nom} — stock : {i.stock_actuel} {i.unite}
                    </option>
                  )
                })}
              </select>
              {!chargement && itemsProposes.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Aucun item en stock. Contacte le bailleur pour réapprovisionner.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité <span className="text-red-500">*</span>
                {itemSelectionne && mode === 'sortie' && (
                  <span className="ml-1 text-xs text-gray-500 font-normal">
                    (en {itemSelectionne.unite}, max {itemSelectionne.stock_actuel})
                  </span>
                )}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                max={mode === 'sortie' ? (itemSelectionne?.stock_actuel || undefined) : undefined}
                value={form.quantite}
                onChange={(e) => majChamp('quantite', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-base"
                required
                inputMode="decimal"
              />
            </div>

            {mode === 'sortie' && (<>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.motif}
                onChange={(e) => majChamp('motif', e.target.value)}
                placeholder="Ex : Réparation fuite robinet, Remplacement ampoule..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appartement concerné <span className="text-gray-400 text-xs">(optionnel)</span>
              </label>
              <select
                value={form.appartementId}
                onChange={(e) => majChamp('appartementId', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white text-base"
              >
                <option value="">— Aucun appartement spécifique —</option>
                {appartements.map(a => (
                  <option key={a.id} value={a.id}>{a.nom}</option>
                ))}
              </select>
            </div>
            </>)}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'retour'
                  ? <>Raison du retour <span className="text-red-500">*</span></>
                  : <>Notes <span className="text-gray-400 text-xs">(optionnel)</span></>}
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => majChamp('notes', e.target.value)}
                rows={2}
                placeholder={mode === 'retour' ? 'Ex : non utilisé, en trop après réparation...' : 'Détails supplémentaires...'}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none text-base"
              />
            </div>

            <button
              type="submit"
              disabled={enregistrement || chargement || itemsProposes.length === 0}
              className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold rounded-lg transition-colors text-base"
            >
              {enregistrement
                ? 'Enregistrement...'
                : mode === 'retour' ? '📥 Remettre en stock' : '📤 Enregistrer la sortie'}
            </button>
          </form>
        </div>

        {/* HISTORIQUE DES 10 DERNIÈRES SORTIES */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Mes derniers mouvements
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({sortiesRecentes.length})
            </span>
          </h2>

          {sortiesRecentes.length === 0 ? (
            <p className="text-sm text-gray-500">
              Aucun mouvement enregistré pour l'instant.
            </p>
          ) : (
            <div className="space-y-2">
              {sortiesRecentes.map(s => (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg border ${
                    s.type === 'entree'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${s.type === 'entree' ? 'text-emerald-700' : 'text-orange-700'}`}>
                        {s.type === 'entree' ? '↗ +' : '↘ −'}{s.quantite} {s.item?.unite || ''} · {s.item?.nom || 'Item inconnu'}
                      </div>
                      <div className="text-sm text-gray-700 mt-1">
                        {s.type === 'entree' ? 'Retour en stock' : s.motif}
                      </div>
                      {s.appartement && (
                        <div className="text-xs text-gray-600 mt-0.5">
                          🏠 {s.appartement.nom}
                        </div>
                      )}
                      {s.notes && (
                        <div className="text-xs text-gray-500 mt-1 italic">{s.notes}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      {formatDateFR(s.cree_le)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </LayoutGerant>
  )
}