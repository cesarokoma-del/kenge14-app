import { useEffect, useState } from 'react'
import LayoutGerant from '../../components/LayoutGerant'
import { supabase } from '../../lib/supabase'
import { getSoldeGerant } from '../../lib/comptesGerants'

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
  const couleurSolde = soldeNet > 0 ? 'amber' : soldeNet < 0 ? 'red' : 'gray'

  return (
    <LayoutGerant activePage="mon-solde">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">💰 Mon Solde</h1>

      {/* Carte principale du solde */}
      <div className={`bg-gradient-to-br from-${couleurSolde}-50 to-${couleurSolde}-100 rounded-2xl shadow-lg p-8 border-2 border-${couleurSolde}-200 mb-6`}>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600 mb-1">Solde disponible</p>
            <p className={`text-5xl font-bold text-${couleurSolde}-700`}>
              {soldeNet.toFixed(0)} USD
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {solde?.derniereOperation
                ? `Dernière opération : ${new Date(solde.derniereOperation).toLocaleDateString('fr-FR')}`
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
                  <td className="py-3 px-2">{new Date(a.date_depense).toLocaleDateString('fr-FR')}</td>
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
                  <td className="py-3 px-2">{new Date(d.date_depense).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-2">{d.categorie}</td>
                  <td className="py-3 px-2">{d.description || '—'}</td>
                  <td className="py-3 px-2 text-right font-bold text-orange-700">
                    -{parseFloat(d.montant).toFixed(0)} USD
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