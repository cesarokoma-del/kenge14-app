import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { getStatistiquesDashboard, supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalAppartements: 0,
    appartementsLoues: 0,
    revenuMensuel: 0,
    revenuActuel: 0,
    loyersEnRetard: 0
  })
  const [paiementsRecents, setPaiementsRecents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)
    
    // Statistiques
    const statsData = await getStatistiquesDashboard()
    setStats(statsData)
    
    // Paiements récents
    const { data: paiements } = await supabase
      .from('paiements')
      .select(`
        *,
        contrat:contrats(
          locataire:locataires(noms_complet),
          appartement:appartements(nom)
        )
      `)
      .order('date_paiement', { ascending: false })
      .limit(5)
    
    setPaiementsRecents(paiements || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <Layout activePage="dashboard">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="dashboard">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Tableau de Bord</h1>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <StatCard
          title="Total Appartements"
          value={stats.totalAppartements}
          icon="🏢"
          color="blue"
        />
        <StatCard
          title="Appartements Loués"
          value={stats.appartementsLoues}
          subtitle={`${stats.totalAppartements - stats.appartementsLoues} vacant(s)`}
          icon="🏠"
          color="emerald"
        />
        <StatCard
          title="Revenu Mensuel"
          value={`${stats.revenuMensuel} USD`}
          icon="💰"
          color="emerald"
        />
        <StatCard
          title="Revenue Actuelle"
          value={`${stats.revenuActuel} USD`}
          subtitle="Paiements reçus"
          icon="✅"
          color="green"
        />
        <StatCard
          title="Loyers en Retard"
          value={stats.loyersEnRetard}
          subtitle="Après le 5 du mois"
          icon="⚠️"
          color="red"
        />
      </div>

      {/* Paiements Récents */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          📅 Paiements Récents
        </h2>
        
        {paiementsRecents.length === 0 ? (
          <p className="text-center text-gray-500 py-4">Aucun paiement récent</p>
        ) : (
          <div className="space-y-3">
            {paiementsRecents.map((paiement) => (
              <div
                key={paiement.id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {paiement.contrat?.locataire?.noms_complet || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {paiement.contrat?.appartement?.nom || 'N/A'} - {paiement.mois_concerne}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-700">{paiement.montant} USD</p>
                  <p className="text-sm text-gray-500">
                    {new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

function StatCard({ title, value, subtitle, icon, color }) {
  const colorClasses = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
    green: 'from-green-50 to-green-100 border-green-200',
    red: 'from-red-50 to-red-100 border-red-200',
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl shadow-lg p-6 border`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
  )
}
