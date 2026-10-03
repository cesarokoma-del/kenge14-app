import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import RouteGuard from '../components/RouteGuard'
import {
  getComptesEpargne,
  getMouvementsEpargne,
  enregistrerMouvementEpargne,
  fermerCompteEpargne,
  rouvrirCompteEpargne,
  calculerSoldeBancaire,
} from '../lib/supabase'
import { formatDateFR } from '../lib/dateUtils'

const LIBELLES_TYPE = {
  depot: 'Dépôt',
  retrait_retour: 'Retrait (retour en banque)',
  retrait_depense: 'Retrait (dépense)',
}

const aujourdhui = () => new Date().toISOString().slice(0, 10)

export default function Epargne() {
  const [loading, setLoading] = useState(true)
  const [comptes, setComptes] = useState([])
  const [soldeNet, setSoldeNet] = useState(0)
  const [totalEnEpargne, setTotalEnEpargne] = useState(0)

  // Historique ouvert par compte : { [compteId]: mouvements[] }
  const [historiques, setHistoriques] = useState({})
  const [histoOuvert, setHistoOuvert] = useState({})

  // Formulaire de mouvement (un seul à la fois)
  const [form, setForm] = useState(null) // { compteId, type, montant, date, motif }
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const [{ data: c }, treso] = await Promise.all([getComptesEpargne(), calculerSoldeBancaire()])
    setComptes(c || [])
    setSoldeNet(treso.soldeNet || 0)
    setTotalEnEpargne(treso.totalEnEpargne || 0)
    // Rafraîchir les historiques déjà ouverts
    const ouverts = Object.keys(histoOuvert).filter(id => histoOuvert[id])
    for (const id of ouverts) await chargerHistorique(id)
    setLoading(false)
  }

  async function chargerHistorique(compteId) {
    const { data } = await getMouvementsEpargne(compteId)
    setHistoriques(h => ({ ...h, [compteId]: data || [] }))
  }

  async function basculerHistorique(compteId) {
    const ouvert = !histoOuvert[compteId]
    setHistoOuvert(h => ({ ...h, [compteId]: ouvert }))
    if (ouvert && !historiques[compteId]) await chargerHistorique(compteId)
  }

  function ouvrirForm(compteId, type) {
    setErreur('')
    setForm({ compteId, type, montant: '', date: aujourdhui(), motif: '' })
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur('')
    setSaving(true)
    const { error } = await enregistrerMouvementEpargne({
      compteId: form.compteId,
      type: form.type,
      montant: form.montant,
      dateMouvement: form.date,
      motif: form.motif,
    })
    setSaving(false)
    if (error) { setErreur(error.message); return }
    setForm(null)
    await charger()
  }

  async function fermer(compte) {
    if (!confirm(`Fermer le compte de ${compte.nom} ? L'historique est conservé.`)) return
    const { error } = await fermerCompteEpargne(compte.id)
    if (error) { alert(error.message); return }
    await charger()
  }

  async function rouvrir(compte) {
    const { error } = await rouvrirCompteEpargne(compte.id)
    if (error) { alert(error.message); return }
    await charger()
  }

  const usd = (n) => `${parseFloat(n || 0).toFixed(0)} USD`

  if (loading) {
    return (
      <RouteGuard rolesAutorises={['bailleur']}>
        <Layout activePage="comptes">
          <div className="flex justify-center items-center h-64">
            <div className="text-emerald-600 text-xl">Chargement...</div>
          </div>
        </Layout>
      </RouteGuard>
    )
  }

  return (
    <RouteGuard rolesAutorises={['bailleur']}>
      <Layout activePage="comptes">
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-[28px] font-extrabold text-gray-800">Comptes</h1>
            <p className="text-sm text-gray-500">Comptes séparés, alimentés depuis le solde net. Disponible à tout moment.</p>
          </div>
        </div>

        {/* Bandeau trésorerie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="rounded-xl border bg-white border-gray-200 px-4 py-3">
            <div className="text-[13px] text-gray-600">Solde net disponible (banque principale)</div>
            <div className={`text-[26px] font-extrabold mt-0.5 ${soldeNet < 0 ? 'text-red-700' : 'text-blue-700'}`}>{usd(soldeNet)}</div>
          </div>
          <div className="rounded-xl border bg-white border-gray-200 px-4 py-3">
            <div className="text-[13px] text-gray-600">Total en épargne (les 2 comptes)</div>
            <div className="text-[26px] font-extrabold mt-0.5 text-emerald-700">{usd(totalEnEpargne)}</div>
          </div>
        </div>

        {/* Comptes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {comptes.map((c) => {
            const ferme = c.statut === 'ferme'
            const histo = historiques[c.id] || []
            return (
              <div key={c.id} className={`rounded-xl border bg-white ${ferme ? 'border-gray-300 opacity-80' : 'border-gray-200'}`}>
                {/* En-tête compte */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
                  <div>
                    <div className="text-xl font-extrabold text-gray-800">{c.nom}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {ferme
                        ? `Fermé le ${formatDateFR(c.date_fermeture)}`
                        : `Ouvert le ${formatDateFR(c.date_ouverture)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] text-gray-600">Solde</div>
                    <div className="text-[26px] font-extrabold text-emerald-700 leading-tight">{usd(c.solde)}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100">
                  {!ferme ? (
                    <>
                      <button onClick={() => ouvrirForm(c.id, 'depot')}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-3 py-1.5 rounded-lg">
                        + Déposer
                      </button>
                      <button onClick={() => ouvrirForm(c.id, 'retrait_retour')}
                        className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg">
                        Retirer → banque
                      </button>
                      <button onClick={() => ouvrirForm(c.id, 'retrait_depense')}
                        className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-3 py-1.5 rounded-lg">
                        Retirer → dépense
                      </button>
                      <button onClick={() => fermer(c)}
                        className="ml-auto text-sm text-red-700 hover:underline px-2 py-1.5">
                        Fermer le compte
                      </button>
                    </>
                  ) : (
                    <button onClick={() => rouvrir(c)}
                      className="text-sm text-emerald-700 hover:underline px-2 py-1.5">
                      Rouvrir le compte
                    </button>
                  )}
                </div>

                {/* Formulaire inline */}
                {form && form.compteId === c.id && (
                  <form onSubmit={soumettre} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="text-sm font-bold text-gray-800 mb-3">{LIBELLES_TYPE[form.type]} — {c.nom}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="text-xs text-gray-600">
                        Montant (USD)
                        <input type="number" min="0.01" step="0.01" required autoFocus
                          value={form.montant}
                          onChange={e => setForm({ ...form, montant: e.target.value })}
                          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-gray-600">
                        Date
                        <input type="date" required
                          value={form.date}
                          onChange={e => setForm({ ...form, date: e.target.value })}
                          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      </label>
                      <label className="text-xs text-gray-600">
                        Motif
                        <input type="text" placeholder={form.type === 'retrait_depense' ? 'Ex. : frais scolaires' : 'Facultatif'}
                          value={form.motif}
                          onChange={e => setForm({ ...form, motif: e.target.value })}
                          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                      </label>
                    </div>
                    {form.type === 'retrait_depense' && (
                      <p className="text-xs text-amber-700 mt-2">
                        Ce retrait sera aussi enregistré dans Dépenses (catégorie « Autre »), marqué comme payé depuis l'épargne de {c.nom}.
                      </p>
                    )}
                    {erreur && <p className="text-sm text-red-700 mt-2">{erreur}</p>}
                    <div className="flex gap-2 mt-3">
                      <button type="submit" disabled={saving}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                      <button type="button" onClick={() => setForm(null)}
                        className="text-sm text-gray-600 hover:underline px-2">
                        Annuler
                      </button>
                    </div>
                  </form>
                )}

                {/* Historique */}
                <div className="px-5 py-3">
                  <button onClick={() => basculerHistorique(c.id)} className="text-sm text-emerald-700 hover:underline">
                    {histoOuvert[c.id] ? 'Masquer l’historique' : 'Voir l’historique'}
                  </button>
                  {histoOuvert[c.id] && (
                    histo.length === 0 ? (
                      <p className="text-sm text-gray-500 mt-2">Aucun mouvement.</p>
                    ) : (
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs">
                              <th className="text-left font-semibold px-3 py-2">Date</th>
                              <th className="text-left font-semibold px-3 py-2">Type</th>
                              <th className="text-left font-semibold px-3 py-2">Motif</th>
                              <th className="text-right font-semibold px-3 py-2">Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {histo.map((m) => (
                              <tr key={m.id} className="border-t border-gray-100">
                                <td className="px-3 py-2 whitespace-nowrap">{formatDateFR(m.date_mouvement)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{LIBELLES_TYPE[m.type] || m.type}</td>
                                <td className="px-3 py-2 text-gray-600">{m.motif || '—'}</td>
                                <td className={`px-3 py-2 text-right font-bold whitespace-nowrap ${m.type === 'depot' ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {m.type === 'depot' ? '+' : '−'}{usd(m.montant)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Layout>
    </RouteGuard>
  )
}
