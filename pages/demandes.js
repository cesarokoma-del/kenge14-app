import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { supabase, getProfilUtilisateur } from '../lib/supabase'

export default function Demandes() {
  const [demandes, setDemandes] = useState([])
  const [appartements, setAppartements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('en_attente')
  const [showLienModal, setShowLienModal] = useState(false)
  const [roleUtilisateur, setRoleUtilisateur] = useState(null)
  const [lienGenere, setLienGenere] = useState('')

  useEffect(() => {
    chargerDonnees()
    async function detecterRole() {
      const { role } = await getProfilUtilisateur()
      setRoleUtilisateur(role)
      if (role === 'gerant') setFilterStatut('toutes')
    }
    detecterRole()
  }, [])

  async function chargerDonnees() {
    setLoading(true)

    const { data: demandesData, error: errDemandes } = await supabase
      .from('demandes_location')
      .select('*')
      .order('date_demande', { ascending: false })

    if (errDemandes) {
      console.error('Erreur:', errDemandes)
    }

    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    const demandesAvecAppt = (demandesData || []).map(d => ({
      ...d,
      appartement: apptsData?.find(a => a.id === d.appartement_id) || null
    }))

    setDemandes(demandesAvecAppt)
    setAppartements(apptsData || [])
    setLoading(false)
  }

  function genererLienPublic(appartementId = null) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const lienId = `demande-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const lien = `${baseUrl}/demande/${lienId}${appartementId ? `?apt=${appartementId}` : ''}`
    setLienGenere(lien)
    setShowLienModal(true)
  }

  function copierLien() {
    navigator.clipboard.writeText(lienGenere)
    alert('✅ Lien copié dans le presse-papier !')
  }

  async function approuverDemande(demande) {
    if (!demande.appartement_id) {
      alert('❌ Cette demande n\'est associée à aucun appartement.')
      return
    }

    if (!confirm(`Approuver la demande de ${demande.noms_complet} pour ${demande.appartement?.nom || 'l\'appartement'} ?`)) return

    const { data: locataire, error: errLoc } = await supabase
      .from('locataires')
      .insert({
        noms_complet: demande.noms_complet,
        telephone: demande.telephone,
        email: demande.email,
        profession: demande.profession,
        adresse_precedente: demande.adresse_actuelle,
        notes: `Créé depuis demande du ${new Date(demande.date_demande).toLocaleDateString('fr-FR')}. Occupants: ${demande.nombre_occupants}.`
      })
      .select()
      .single()

    if (errLoc) {
      alert('Erreur création locataire: ' + errLoc.message)
      return
    }

    const { error: errUpdate } = await supabase
      .from('demandes_location')
      .update({
        statut: 'approuvee',
        date_traitement: new Date().toISOString()
      })
      .eq('id', demande.id)

    if (errUpdate) {
      alert('Erreur mise à jour: ' + errUpdate.message)
      return
    }

    alert(`✅ Demande approuvée ! Locataire "${demande.noms_complet}" créé.`)

    if (typeof window !== 'undefined') {
      window.location.href = `/contrats?demande=${demande.id}&locataire=${locataire.id}&appartement=${demande.appartement_id}`
    }
  }

  async function refuserDemande(demande) {
    const motif = prompt('Motif du refus :')
    if (!motif) return

    const { error } = await supabase
      .from('demandes_location')
      .update({
        statut: 'refusee',
        motif_refus: motif,
        date_traitement: new Date().toISOString()
      })
      .eq('id', demande.id)

    if (error) {
      alert('Erreur: ' + error.message)
      return
    }

    chargerDonnees()
  }

  async function supprimerDemande(id) {
    if (!confirm('Supprimer définitivement cette demande ?')) return

    const { error } = await supabase
      .from('demandes_location')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur: ' + error.message)
      return
    }

    chargerDonnees()
  }

  const demandesFiltrees = filterStatut === 'toutes'
    ? demandes
    : demandes.filter(d => d.statut === filterStatut)

  const stats = {
    en_attente: demandes.filter(d => d.statut === 'en_attente').length,
    approuvee: demandes.filter(d => d.statut === 'approuvee').length,
    refusee: demandes.filter(d => d.statut === 'refusee').length
  }

  if (loading) {
    return (
      <Layout activePage="demandes">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="demandes">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📝 Demandes de Location</h1>
        <button onClick={() => genererLienPublic()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold">
          🔗 Générer un lien public
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Comment ça marche ?</strong> Cliquez "Générer un lien" → envoyez-le au candidat sur WhatsApp →
          il remplit le formulaire en ligne → vous voyez sa demande ici → vous approuvez ou refusez.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button onClick={() => roleUtilisateur !== 'gerant' && setFilterStatut('en_attente')} className={`rounded-2xl shadow-lg p-6 text-left transition ${filterStatut === 'en_attente' ? 'bg-yellow-200 border-2 border-yellow-500' : 'bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200'} ${roleUtilisateur === 'gerant' ? 'cursor-default' : 'cursor-pointer'}`}>
          <p className="text-sm text-gray-600">⏳ En attente</p>
          <p className="text-3xl font-bold text-yellow-700">{stats.en_attente}</p>
        </button>
        <button onClick={() => roleUtilisateur !== 'gerant' && setFilterStatut('approuvee')} className={`rounded-2xl shadow-lg p-6 text-left transition ${filterStatut === 'approuvee' ? 'bg-emerald-200 border-2 border-emerald-500' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200'} ${roleUtilisateur === 'gerant' ? 'cursor-default' : 'cursor-pointer'}`}>
          <p className="text-sm text-gray-600">✅ Approuvées</p>
          <p className="text-3xl font-bold text-emerald-700">{stats.approuvee}</p>
        </button>
        <button onClick={() => roleUtilisateur !== 'gerant' && setFilterStatut('refusee')} className={`rounded-2xl shadow-lg p-6 text-left transition ${filterStatut === 'refusee' ? 'bg-red-200 border-2 border-red-500' : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'} ${roleUtilisateur === 'gerant' ? 'cursor-default' : 'cursor-pointer'}`}>
          <p className="text-sm text-gray-600">❌ Refusées</p>
          <p className="text-3xl font-bold text-red-700">{stats.refusee}</p>
        </button>
        <button onClick={() => roleUtilisateur !== 'gerant' && setFilterStatut('toutes')} className={`rounded-2xl shadow-lg p-6 text-left transition ${filterStatut === 'toutes' ? 'bg-gray-200 border-2 border-gray-500' : 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200'} ${roleUtilisateur === 'gerant' ? 'cursor-default' : 'cursor-pointer'}`}>
          <p className="text-sm text-gray-600">📋 Toutes</p>
          <p className="text-3xl font-bold text-gray-700">{demandes.length}</p>
        </button>
      </div>

      {showLienModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full">
            <h3 className="text-2xl font-bold mb-4">🔗 Lien public généré</h3>
            <p className="text-sm text-gray-600 mb-4">Envoyez ce lien au candidat (WhatsApp, SMS, email).</p>
            <div className="bg-gray-100 p-3 rounded-lg break-all text-sm font-mono mb-4">{lienGenere}</div>
            <div className="flex gap-3">
              <button onClick={copierLien} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold">📋 Copier</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Bonjour, voici le lien pour votre demande de location KENGE14: ${lienGenere}`)}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold text-center">💬 WhatsApp</a>
              <button onClick={() => setShowLienModal(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold">Fermer</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {filterStatut === 'toutes' ? 'Toutes les demandes' : filterStatut === 'en_attente' ? 'Demandes en attente' : filterStatut === 'approuvee' ? 'Demandes approuvées' : 'Demandes refusées'} ({demandesFiltrees.length})
        </h2>

        {demandesFiltrees.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucune demande dans cette catégorie.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {demandesFiltrees.map((d) => (
              <div key={d.id} className={`border rounded-xl p-4 ${d.statut === 'en_attente' ? 'border-yellow-300 bg-yellow-50' : d.statut === 'approuvee' ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-800">👤 {d.noms_complet}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${d.statut === 'en_attente' ? 'bg-yellow-200 text-yellow-900' : d.statut === 'approuvee' ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'}`}>
                    {d.statut === 'en_attente' ? '⏳ En attente' : d.statut === 'approuvee' ? '✅ Approuvée' : '❌ Refusée'}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-gray-700">
                  {d.appartement && <p>🏢 <strong>{d.appartement.nom}</strong>{roleUtilisateur !== 'gerant' && <span> ({d.appartement.loyer_base} USD/mois)</span>}</p>}
                  {d.telephone && <p>📱 <a href={`tel:${d.telephone}`} className="text-emerald-700 hover:underline">{d.telephone}</a></p>}
                  {d.email && <p>✉️ {d.email}</p>}
                  {d.profession && <p>💼 {d.profession}</p>}
                  {d.nombre_occupants && <p>👨‍👩‍👧 {d.nombre_occupants} occupant(s)</p>}
                  {d.adresse_actuelle && <p>📍 {d.adresse_actuelle}</p>}
                  {d.date_debut_souhaitee && <p>📅 Souhaite emménager le {new Date(d.date_debut_souhaitee).toLocaleDateString('fr-FR')}</p>}
                  {d.duree_souhaitee_mois && <p>⏱️ Durée souhaitée : {d.duree_souhaitee_mois} mois</p>}
                </div>

                {d.message && <p className="text-sm text-gray-600 mt-2 italic border-t pt-2">💬 "{d.message}"</p>}
                {d.motif_refus && <p className="text-sm text-red-700 mt-2 border-t pt-2">❌ Motif du refus : {d.motif_refus}</p>}

                <p className="text-xs text-gray-500 mt-2">Reçu le {new Date(d.date_demande).toLocaleDateString('fr-FR')}</p>

                <div className="flex flex-wrap gap-2 mt-4">
                  {d.statut === 'en_attente' && (
                    <>
                      <button onClick={() => approuverDemande(d)} disabled={roleUtilisateur === 'gerant'} title={roleUtilisateur === 'gerant' ? 'Action réservée au bailleur' : ''} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">✅ Approuver</button>
                      <button onClick={() => refuserDemande(d)} disabled={roleUtilisateur === 'gerant'} title={roleUtilisateur === 'gerant' ? 'Action réservée au bailleur' : ''} className="flex-1 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">❌ Refuser</button>
                    </>
                  )}
                  {d.telephone && (
                    <a href={`https://wa.me/${d.telephone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-semibold transition text-center">💬 Contact</a>
                  )}
                  <button onClick={() => supprimerDemande(d.id)} disabled={roleUtilisateur === 'gerant'} title={roleUtilisateur === 'gerant' ? 'Action réservée au bailleur' : ''} className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
