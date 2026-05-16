import { useEffect, useState } from 'react'
import LayoutGerant from '../../components/LayoutGerant'
import { supabase } from '../../lib/supabase'
import { getSoldeGerant } from '../../lib/comptesGerants'
import { formatDateFR } from '../../lib/dateUtils'

export default function MonSolde() {
  const [loading, setLoading] = useState(true)
  const [solde, setSolde] = useState(null)
  const [approvisionnements, setApprovisionnements] = useState([])
  const [depensesGerant, setDepensesGerant] = useState([])

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    // 1. Récupérer l'utilisateur connecté
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // 2. Calculer le solde via le helper
    const soldeData = await getSoldeGerant(user.id)
    setSolde(soldeData)

    // 3. Récupérer la liste des approvisionnements (catégorie spéciale)
    const { data: appData } = await supabase
      .from('depenses')
      .select('*')
      .eq('categorie', 'approvisionnement_gerant')
      .order('date_depense', { ascending: false })

    setApprovisionnements(appData || [])

    // 4. Récupérer la liste des dépenses du gérant
    const { data: depData } = await supabase
      .from('depenses')
      .select('*')
      .eq('enregistre_par', user.id)
      .order('date_depense', { ascending: false })

    setDepensesGerant(depData || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <LayoutGerant activePage="mon-solde">
        <div className="flex justify-center items-center h-64">
          <div className="text-amber-600 text-xl">Chargement...</div>
        </div>
      </LayoutGerant>
    )
  }

  const soldeNet = solde?.soldeNet || 0
  // Map littérale (Tailwind purge les classes non écrites en clair)
  const couleurs = soldeNet < 0
    ? { from: 'from-red-50', to: 'to-red-100', border: 'border-red-200', text: 'text-red-700' }
    : soldeNet === 0
    ? { from: 'from-gray-50', to: 'to-gray-100', border: 'border-gray-200', text: 'text-gray-700' }
    : { from: 'from-amber-50', to: 'to-amber-100', border: 'border-amber-200', text: 'text-amber-700' }
  return (
    <LayoutGerant activePage="mon-solde">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">💰 Mon Solde</h1>

      {/* Carte principale du solde */}
      <div className={`bg-gradient-to-br ${couleurs.from} ${couleurs.to} rounded-2xl shadow-lg p-8 border-2 ${couleurs.border} mb-6`}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600 mb-1">Solde disponible</p>
            <p className={`text-5xl font-bold ${couleurs.text}`}>
              {soldeNet.toFixed(0)} USD
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {solde?.derniereOperation
                ? `Dernière opération : ${formatDateFR(solde.derniereOperation)}`
                : 'Aucune opération enregistrée'}
            </p>
          </div>
          <div className="text-7xl opacity-60">💰</div>
        </div>
      </div>

      {/* Résumé en 2 cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-lg p-6 border border-green-200">
          <p className="text-sm text-gray-600 mb-1">📥 Reçu du bailleur</p>
          <p className="text-3xl font-bold text-green-700">
            +{(solde?.totalApprovisionne || 0).toFixed(0)} USD
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {solde?.nombreApprovisionnements || 0} approvisionnement(s)
          </p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl shadow-lg p-6 border border-orange-200">
          <p className="text-sm text-gray-600 mb-1">📤 Dépenses engagées</p>
          <p className="text-3xl font-bold text-orange-700">
            -{(solde?.totalDepense || 0).toFixed(0)} USD
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {solde?.nombreDepenses || 0} dépense(s)
          </p>
        </div>
      </div>

      {/* Historique des approvisionnements reçus */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          📥 Approvisionnements reçus ({approvisionnements.length})
        </h2>
        {approvisionnements.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Aucun approvisionnement reçu</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-2">Date</th>
                <th className="text-left py-3 px-2">Description</th>
                <th className="text-right py-3 px-2">Montant</th>
              </tr>
            </thead>
            <tbody>
              {approvisionnements.map(a => (
                <tr key={a.id} className="border-b hover:bg-amber-50">
                  <td className="py-3 px-2">{formatDateFR(a.date_depense)}</td>
                  <td className="py-3 px-2">{a.description || '—'}</td>
                  <td className="py-3 px-2 text-right font-bold text-green-700">
                    +{parseFloat(a.montant).toFixed(0)} USD
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historique des dépenses engagées */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-orange-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          📤 Mes dépenses engagées ({depensesGerant.length})
        </h2>
        {depensesGerant.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Aucune dépense enregistrée</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-2">Date</th>
                <th className="text-left py-3 px-2">Catégorie</th>
                <th className="text-left py-3 px-2">Description</th>
                <th className="text-right py-3 px-2">Montant</th>
              </tr>
            </thead>
            <tbody>
              {depensesGerant.map(d => (
                <tr key={d.id} className="border-b hover:bg-orange-50">
                  <td className="py-3 px-2">{formatDateFR(d.date_depense)}</td>
                  <td className="py-3 px-2">{d.categorie}</td>
                  <td className="py-3 px-2">{d.description || '—'}</td>
                  <td className="py-3 px-2 text-right font-bold text-orange-700">
                  {d.devise === 'CDF' && d.montant_devise_origine ? (
                    <>
                      <div>-{parseInt(d.montant_devise_origine).toLocaleString('fr-FR')} CDF</div>
                      <div className="text-xs text-gray-500 font-normal">
                        ≈ {parseFloat(d.montant).toFixed(2)} USD
                      </div>
                    </>
                  ) : (
                    `-${parseFloat(d.montant).toFixed(0)} USD`
                  )}
                </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </LayoutGerant>
  )
}