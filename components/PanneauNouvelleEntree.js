import { useState, useEffect } from 'react'
import { listerStockActuel, enregistrerEntree } from '../lib/inventaire'

export default function PanneauNouvelleEntree({ onEntreeEnregistree }) {
  const [ouvert, setOuvert] = useState(false)
  const [items, setItems] = useState([])
  const [chargementItems, setChargementItems] = useState(false)
  const [form, setForm] = useState({ itemId: '', quantite: '', motif: '', notes: '' })
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [succes, setSucces] = useState(false)

  useEffect(() => {
    if (ouvert && items.length === 0) chargerItems()
  }, [ouvert])

  async function chargerItems() {
    setChargementItems(true)
    const { data } = await listerStockActuel({ inclureInactifs: false })
    setItems(data)
    setChargementItems(false)
  }

  function majChamp(champ, valeur) {
    setForm(prev => ({ ...prev, [champ]: valeur }))
    if (erreur) setErreur(null)
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    setSucces(false)

    if (!form.itemId) { setErreur('Sélectionne un item'); return }
    if (!form.quantite || Number(form.quantite) <= 0) {
      setErreur('Quantité doit être > 0'); return
    }

    setEnregistrement(true)
    const { error } = await enregistrerEntree({
      itemId: form.itemId,
      quantite: form.quantite,
      motif: form.motif.trim() || null,
      notes: form.notes.trim() || null,
    })

    if (error) {
      setErreur(error.message || 'Erreur lors de l\'enregistrement')
      setEnregistrement(false)
      return
    }

    setForm({ itemId: '', quantite: '', motif: '', notes: '' })
    setSucces(true)
    setEnregistrement(false)
    if (onEntreeEnregistree) onEntreeEnregistree()
    setTimeout(() => setSucces(false), 3000)
  }

  const itemSelectionne = items.find(i => i.id === form.itemId)

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <span className="text-lg leading-none">{ouvert ? '−' : '+'}</span>
        Nouvelle entrée
      </button>

      {succes && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          ✅ Entrée enregistrée. Stock mis à jour.
        </div>
      )}

      <div
        className={`grid transition-all duration-300 ease-out ${
          ouvert ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3">
              Enregistrer une entrée de stock
            </h3>

            {erreur && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                ⚠️ {erreur}
              </div>
            )}

            <form onSubmit={soumettre} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.itemId}
                  onChange={(e) => majChamp('itemId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  required
                  disabled={chargementItems}
                >
                  <option value="">
                    {chargementItems ? 'Chargement...' : '— Choisir un item —'}
                  </option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.nom} (stock : {i.stock_actuel} {i.unite})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité <span className="text-red-500">*</span>
                    {itemSelectionne && (
                      <span className="ml-1 text-xs text-gray-500 font-normal">
                        (en {itemSelectionne.unite})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.quantite}
                    onChange={(e) => majChamp('quantite', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motif</label>
                  <input
                    type="text"
                    value={form.motif}
                    onChange={(e) => majChamp('motif', e.target.value)}
                    placeholder="Ex : Achat Marché Gambela, Don..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => majChamp('notes', e.target.value)}
                  placeholder="Optionnel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={enregistrement}
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
                >
                  {enregistrement ? 'Enregistrement...' : 'Enregistrer l\'entrée'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOuvert(false); setErreur(null) }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                >
                  Fermer
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}