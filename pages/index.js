import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getStockBas } from '../lib/inventaire'
import Layout from '../components/Layout'
import RouteGuard from '../components/RouteGuard'
import { supabase, calculerSoldeBancaire, getLocatairesEnRetard } from '../lib/supabase'
import { formatDateFR, parseDateLocale } from '../lib/dateUtils'

export default function TableauDeBord() {
  const [stats, setStats] = useState({
    totalAppartements: 0,
    loues: 0,
    vacants: 0,
    reserves: 0,
    enRenovation: 0,
    revenuMensuelAttendu: 0,
    revenuMensuelRecu: 0,
    loyersEnRetard: 0,
    demandesEnAttente: 0,
    contratsExpirant: 0
  })
  const [itemsStockBas, setItemsStockBas] = useState([])

useEffect(() => {
  chargerStockBas()
}, [])

async function chargerStockBas() {
  const { data } = await getStockBas()
  setItemsStockBas(data || [])
}
  const [paiementsRecents, setPaiementsRecents] = useState([])
  const [demandesRecentes, setDemandesRecentes] = useState([])
  const [loading, setLoading] = useState(true)
  const [tresorerie, setTresorerie] = useState(null)

  useEffect(() => {
    chargerDonnees()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    // Bascule automatique des contrats 'futur' devenus 'actif'
    // await basculerContratsFuturs()

    // Charger toutes les données séparément (plus robuste)
    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')

    const { data: contratsData } = await supabase
      .from('contrats')
      .select('*')

    const { data: locatairesData } = await supabase
      .from('locataires')
      .select('id, noms_complet')

    const debutMois = new Date()
    debutMois.setDate(1)
    debutMois.setHours(0, 0, 0, 0)

    const { data: paiementsData } = await supabase
      .from('paiements')
      .select('*')
      .gte('date_paiement', debutMois.toISOString())
      .order('date_paiement', { ascending: false })
      .limit(5)

      // Détection des retards via la fonction centralisée (gère les renouvellements)
    const { data: retardsData } = await getLocatairesEnRetard()

    const { data: demandesData } = await supabase
      .from('demandes_location')
      .select('*')
      .eq('statut', 'en_attente')
      .order('date_demande', { ascending: false })
      .limit(5)

    // Enrichir les paiements avec les infos de contrat/locataire/appartement
    const paiementsEnrichis = (paiementsData || []).map(p => {
      const contrat = contratsData?.find(c => c.id === p.contrat_id)
      const locataire = contrat ? locatairesData?.find(l => l.id === contrat.locataire_id) : null
      const appartement = contrat ? apptsData?.find(a => a.id === contrat.appartement_id) : null
      return {
        ...p,
        contrat: contrat ? { ...contrat, locataire, appartement } : null
      }
    })

    // Enrichir les demandes avec les appartements
    const demandesEnrichies = (demandesData || []).map(d => ({
      ...d,
      appartement: apptsData?.find(a => a.id === d.appartement_id) || null
    }))

    let loues = 0, vacants = 0, reserves = 0, enRenovation = 0
    let revenuMensuelAttendu = 0
    let contratsExpirant = 0

    const aujourdhui = new Date()
    const dans90Jours = new Date()
    dans90Jours.setDate(aujourdhui.getDate() + 90)

    ;(apptsData || []).forEach(appt => {
      const contratActif = contratsData?.find(c => c.appartement_id === appt.id && c.statut === 'actif')
      const demandeApprouvee = demandesData?.find(d => d.appartement_id === appt.id && d.statut === 'approuvee')

      if (appt.statut === 'en_renovation') {
        enRenovation++
      } else if (contratActif) {
        loues++
        revenuMensuelAttendu += parseFloat(contratActif.loyer || 0)

        if (contratActif.date_fin) {
      const dateFin = parseDateLocale(contratActif.date_fin)
      if (dateFin && dateFin >= aujourdhui && dateFin <= dans90Jours) {

        // Ne pas compter comme "expirant" si un contrat futur prend déjà le relais
        const aDejaUnSuccesseur = contratsData?.some(c => 
          c.appartement_id === appt.id && c.statut === 'futur'
        )
        if (!aDejaUnSuccesseur) {
          contratsExpirant++
        }
      }
    }
      } else if (demandeApprouvee) {
        reserves++
      } else {
        vacants++
      }
    })

    const revenuMensuelRecu = (paiementsData || [])
      .reduce((sum, p) => sum + parseFloat(p.montant || 0), 0)


    setStats({
      totalAppartements: apptsData?.length || 0,
      loues, vacants, reserves, enRenovation,
      revenuMensuelAttendu, revenuMensuelRecu,
      loyersEnRetard: (retardsData || []).length,
      demandesEnAttente: demandesData?.length || 0,
      contratsExpirant
    })

    setPaiementsRecents(paiementsEnrichis)
    setDemandesRecentes(demandesEnrichies)

    // Charger les données de trésorerie
    const soldeData = await calculerSoldeBancaire()
    setTresorerie(soldeData)

    setLoading(false)
  }

    // ─── Petits composants de presentation (plats, sans emoji) ───
    const Tuile = ({ label, valeur, sous, couleur = 'vert', teinte }) => {
    const fonds = {
      vert:  'bg-emerald-50 border-emerald-200',
      bleu:  'bg-blue-50 border-blue-200',
      jaune: 'bg-amber-50 border-amber-200',
      rouge: 'bg-red-50 border-red-200',
      blanc: 'bg-white border-gray-200',
    }[couleur]
    const textes = {
      vert: 'text-emerald-700', bleu: 'text-blue-700', jaune: 'text-amber-700',
      rouge: 'text-red-700', gris: 'text-gray-800',
    }[teinte || (couleur === 'blanc' ? 'gris' : couleur)]
    return (
      <div className={`rounded-xl border px-4 py-3 ${fonds}`}>
        <div className="text-[13px] text-gray-600">{label}</div>
        <div className={`text-[26px] font-extrabold leading-tight mt-0.5 ${textes}`}>{valeur}</div>
        {sous && <div className="text-xs text-gray-500 mt-0.5">{sous}</div>}
      </div>
    )
  }

  const Alerte = ({ href, nombre, titre, sous, couleur }) => {
    const c = {
      rouge: ['bg-red-50 border-red-200', 'bg-red-600', 'text-red-800', 'text-red-600'],
      jaune: ['bg-amber-50 border-amber-200', 'bg-amber-500', 'text-amber-800', 'text-amber-600'],
      orange: ['bg-orange-50 border-orange-200', 'bg-orange-500', 'text-orange-800', 'text-orange-600'],
      bleu: ['bg-blue-50 border-blue-200', 'bg-blue-600', 'text-blue-800', 'text-blue-600'],
    }[couleur]
    return (
      <Link href={href} className={`flex items-center gap-4 rounded-xl border p-4 hover:opacity-90 transition ${c[0]}`}>
        <div className={`w-11 h-11 rounded-lg ${c[1]} text-white flex items-center justify-center text-xl font-extrabold flex-shrink-0`}>
          {nombre}
        </div>
        <div>
          <div className={`text-[15px] font-bold ${c[2]}`}>{titre}</div>
          <div className={`text-xs ${c[3]}`}>{sous}</div>
        </div>
      </Link>
    )
  }

  const nbAlertes =
    (stats.loyersEnRetard > 0) + (stats.demandesEnAttente > 0) +
    (stats.contratsExpirant > 0) + (itemsStockBas.length > 0)

  if (loading) {
    return (
      <RouteGuard rolesAutorises={['bailleur']}>
        <Layout activePage="dashboard">
          <div className="flex justify-center items-center h-64">
            <div className="text-emerald-600 text-xl">Chargement...</div>
          </div>
        </Layout>
      </RouteGuard>
    )
  }

  return (
    <RouteGuard rolesAutorises={['bailleur']}>
      <Layout activePage="dashboard">
        <h1 className="text-[28px] font-extrabold text-gray-800 mb-5">Tableau de bord</h1>

                {/* ── Ligne 1 : alerte(s) + trésorerie ── */}
        {(() => {
          const alertes = [
            stats.loyersEnRetard > 0 && <Alerte key="r" href="/paiements" nombre={stats.loyersEnRetard} titre="Loyers en retard" sous="Cliquez pour relancer" couleur="rouge" />,
            stats.demandesEnAttente > 0 && <Alerte key="d" href="/demandes" nombre={stats.demandesEnAttente} titre="Demandes en attente" sous="Cliquez pour traiter" couleur="bleu" />,
            stats.contratsExpirant > 0 && <Alerte key="c" href="/contrats" nombre={stats.contratsExpirant} titre="Contrats expirant (90 j)" sous="Cliquez pour renouveler" couleur="orange" />,
            itemsStockBas.length > 0 && <Alerte key="s" href="/inventaire?stockBas=1" nombre={itemsStockBas.length} titre="Stock bas" sous={itemsStockBas.length === 1 ? '1 item à réapprovisionner' : `${itemsStockBas.length} items à réapprovisionner`} couleur="jaune" />,
          ].filter(Boolean)

          const tuilesTreso = tresorerie ? [
            <Tuile key="b" label="Solde brut" valeur={`${tresorerie.soldeBrut.toFixed(0)} USD`} couleur="blanc" teinte={tresorerie.soldeBrut < 0 ? 'rouge' : 'vert'} />,
            <Tuile key="g" label="Garanties" valeur={`${tresorerie.totalGaranties.toFixed(0)} USD`} couleur="blanc" teinte="jaune" />,
            <Tuile key="n" label="Solde net" valeur={`${tresorerie.soldeNet.toFixed(0)} USD`} couleur="blanc" teinte={tresorerie.soldeNet < 0 ? 'rouge' : 'bleu'}
              sous={tresorerie.soldeNet < 0 ? `Garanties touchées de ${Math.abs(tresorerie.soldeNet).toFixed(0)} USD` : null} />,
          ] : []

          // 0 ou 1 alerte → tout sur une ligne ; sinon les alertes ont leur propre ligne
          if (alertes.length <= 1) {
            return (
              <div className="mb-4">
                {tresorerie && !tresorerie.hasSoldeInitial && (
                  <Link href="/parametres" className="inline-block text-xs text-amber-700 underline mb-2">Configurer le solde initial</Link>
                )}
                <div className={`grid gap-3 grid-cols-1 ${alertes.length === 1 ? 'md:grid-cols-[1.4fr_1fr_1fr_1fr]' : 'md:grid-cols-3'}`}>
                  {alertes}
                  {tuilesTreso}
                </div>
              </div>
            )
          }
          return (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">{alertes}</div>
              {tresorerie && (
                <div className="mb-4">
                  {!tresorerie.hasSoldeInitial && (
                    <Link href="/parametres" className="inline-block text-xs text-amber-700 underline mb-2">Configurer le solde initial</Link>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{tuilesTreso}</div>
                </div>
              )}
            </>
          )
        })()}

        {/* ── Indicateurs ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
          <Tuile label="Total appartements" valeur={stats.totalAppartements} couleur="bleu" />
          <Tuile label="Loués" valeur={stats.loues} sous={`${stats.vacants} vacant(s)`} couleur="vert" />
          <Tuile label="Vacants" valeur={stats.vacants} sous={stats.reserves > 0 ? `+ ${stats.reserves} réservé(s)` : null} couleur="jaune" />
          <Tuile label="Revenu attendu" valeur={`${stats.revenuMensuelAttendu.toFixed(0)} USD`} sous="par mois" couleur="vert" />
          <Tuile label="Reçu ce mois" valeur={`${stats.revenuMensuelRecu.toFixed(0)} USD`} sous="paiements reçus" couleur="vert" />
        </div>

        {/* ── Demandes récentes ── */}
        {demandesRecentes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 mb-5">
            <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
              <h2 className="text-[17px] font-bold text-gray-800">Demandes en attente</h2>
              <Link href="/demandes" className="text-sm text-emerald-700 hover:underline">Voir tout →</Link>
            </div>
            {demandesRecentes.map((d) => (
              <div key={d.id} className="flex justify-between items-center px-4 py-3 border-b border-gray-100 last:border-b-0 text-sm">
                <div>
                  <span className="font-semibold">{d.noms_complet}</span>
                  <span className="text-gray-500"> · {d.appartement?.nom || '?'} · {d.telephone}</span>
                </div>
                <span className="text-xs text-gray-500">{formatDateFR(d.date_demande)}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Paiements récents ── */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200">
            <h2 className="text-[17px] font-bold text-gray-800">Paiements récents</h2>
            <Link href="/paiements" className="text-sm text-emerald-700 hover:underline">Voir tout →</Link>
          </div>
          {paiementsRecents.length === 0 ? (
            <p className="text-gray-500 text-center py-8 text-sm">Aucun paiement reçu ce mois.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs">
                    <th className="text-left font-semibold px-4 py-2.5">Date</th>
                    <th className="text-left font-semibold px-4 py-2.5">Locataire</th>
                    <th className="text-left font-semibold px-4 py-2.5">Apt</th>
                    <th className="text-left font-semibold px-4 py-2.5">Mois</th>
                    <th className="text-right font-semibold px-4 py-2.5">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {paiementsRecents.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateFR(p.date_paiement)}</td>
                      <td className="px-4 py-3 font-semibold">{p.contrat?.locataire?.noms_complet || 'Locataire inconnu'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{p.contrat?.appartement?.nom || '?'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{p.mois_concerne || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">{parseFloat(p.montant).toFixed(0)} USD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  )
}
