import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { genererContratRenouvellementPDF } from '../lib/genererContratPDF'
import { genererContratInitialPDF } from '../lib/genererContratInitialPDF'
import { signerContratCommeBailleur, creerLienSignatureBail } from '../lib/supabase'

export default function Contrats() {
  const router = useRouter()
  const [contrats, setContrats] = useState([])
  const [appartements, setAppartements] = useState([])
  const [locataires, setLocataires] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filterStatut, setFilterStatut] = useState('actif')
  const [showTerminerModal, setShowTerminerModal] = useState(null)
  const [terminerData, setTerminerData] = useState({
    date_fin_effective: new Date().toISOString().split('T')[0],
    raison_fin: 'fin_normale',
    notes_fin: ''
  })
  const [formData, setFormData] = useState({
    appartement_id: '',
    locataire_id: '',
    date_debut: '',
    date_fin: '',
    duree_mois: 12,
    loyer: '',
    garantie: '',
    occupants: 1,
    statut: 'actif',
    clauses_speciales: ''
  })

  useEffect(() => {
    chargerDonnees()
  }, [])

  // Pré-remplir si on arrive depuis Demandes
  useEffect(() => {
    if (router.isReady && router.query.appartement && router.query.locataire) {
      const appt = appartements.find(a => a.id === router.query.appartement)
      setFormData(prev => ({
        ...prev,
        appartement_id: router.query.appartement,
        locataire_id: router.query.locataire,
        date_debut: new Date().toISOString().split('T')[0],
        loyer: appt?.loyer_base || ''
      }))
      setShowForm(true)
    }
  }, [router.isReady, appartements])

  async function chargerDonnees() {
    setLoading(true)

    // Charger les contrats SANS jointure
    const { data: contratsData } = await supabase
      .from('contrats')
      .select('*')
      .order('date_debut', { ascending: false })

    const { data: apptsData } = await supabase
      .from('appartements')
      .select('*')
      .order('nom')

    const { data: locatairesData } = await supabase
      .from('locataires')
      .select('*')
      .order('noms_complet')

    // Jointure manuelle côté client
    const contratsAvecRelations = (contratsData || []).map(c => ({
      ...c,
      appartement: apptsData?.find(a => a.id === c.appartement_id) || null,
      locataire: locatairesData?.find(l => l.id === c.locataire_id) || null
    }))

    setContrats(contratsAvecRelations)
    setAppartements(apptsData || [])
    setLocataires(locatairesData || [])
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const dataToSave = {
      appartement_id: formData.appartement_id,
      locataire_id: formData.locataire_id,
      date_debut: formData.date_debut,
      date_fin: formData.date_fin,
      duree_mois: parseInt(formData.duree_mois) || 12,
      loyer: parseFloat(formData.loyer),
      garantie: formData.garantie ? parseFloat(formData.garantie) : null,
      occupants: parseInt(formData.occupants) || 1,
      statut: formData.statut,
      clauses_speciales: formData.clauses_speciales || null
    }

    if (editingId) {
      const { error } = await supabase
        .from('contrats')
        .update(dataToSave)
        .eq('id', editingId)

      if (error) {
        console.error('Erreur:', error)
        alert('Erreur: ' + error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('contrats')
        .insert(dataToSave)

      if (error) {
        console.error('Erreur:', error)
        alert('Erreur: ' + error.message)
        return
      }
    }

    resetForm()
    chargerDonnees()
    alert('✅ Contrat enregistré avec succès !')
  }

  function handleEdit(contrat) {
    setFormData({
      appartement_id: contrat.appartement_id || '',
      locataire_id: contrat.locataire_id || '',
      date_debut: contrat.date_debut || '',
      date_fin: contrat.date_fin || '',
      duree_mois: contrat.duree_mois || 12,
      loyer: contrat.loyer || '',
      garantie: contrat.garantie || '',
      occupants: contrat.occupants || 1,
      statut: contrat.statut || 'actif',
      clauses_speciales: contrat.clauses_speciales || ''
    })
    setEditingId(contrat.id)
    setShowForm(true)
  }

  function ouvrirTerminerModal(contrat) {
    setShowTerminerModal(contrat)
    setTerminerData({
      date_fin_effective: new Date().toISOString().split('T')[0],
      raison_fin: 'fin_normale',
      notes_fin: ''
    })
  }

  async function confirmerTerminer() {
    if (!showTerminerModal) return

    const { error } = await supabase
      .from('contrats')
      .update({
        statut: terminerData.raison_fin === 'resiliation' ? 'resilie' : 'termine',
        date_fin_effective: terminerData.date_fin_effective,
        raison_fin: terminerData.raison_fin
      })
      .eq('id', showTerminerModal.id)

    if (error) {
      alert('Erreur: ' + error.message)
      return
    }

    setShowTerminerModal(null)
    chargerDonnees()
    alert('✅ Contrat terminé. L\'appartement est maintenant disponible.')
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer définitivement ce contrat ?')) return

    const { error } = await supabase
      .from('contrats')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Erreur: ' + error.message)
      return
    }

    chargerDonnees()
  }

  async function telechargerAvenantPDF(contrat) {
    // Récupérer le dernier renouvellement signé pour ce contrat
    const { data: renouvellements, error } = await supabase
      .from('renouvellements')
      .select('*')
      .eq('contrat_id', contrat.id)
      .eq('statut', 'signe')
      .order('date_signature', { ascending: false })
      .limit(1)

    if (error || !renouvellements || renouvellements.length === 0) {
      alert('❌ Aucun avenant signé disponible pour ce contrat.\n\nIl faut d\'abord faire signer un renouvellement depuis la page "Renouvellements".')
      return
    }

    const renouvellement = renouvellements[0]

    // Préparer les données complètes pour le PDF
    const renouvellementComplet = {
      ...renouvellement,
      contrat: {
        ...contrat,
        appartement: contrat.appartement,
        locataire: contrat.locataire,
      }
    }

    const doc = genererContratRenouvellementPDF(renouvellementComplet)
    const nomFichier = `Avenant-${contrat.appartement?.nom || 'KENGE14'}-${contrat.locataire?.noms_complet || 'Signe'}.pdf`
    doc.save(nomFichier)
  }

  function telechargerContratInitialPDF(contrat) {
    const doc = genererContratInitialPDF(contrat)
    const nomFichier = `Contrat-Bail-${contrat.appartement?.nom || 'KENGE14'}-${contrat.locataire?.noms_complet || 'Vierge'}.pdf`
    doc.save(nomFichier)
  }
  async function lancerSignatureContrat(contrat) {
    // Vérifier l'état actuel
    const dejaSigneBailleur = !!contrat.signature_bailleur
    const dejaSigneLocataire = !!contrat.signature_locataire
    
    let messageConfirmation = ''
    
    if (!dejaSigneBailleur && !dejaSigneLocataire) {
      messageConfirmation = `📝 Démarrage du processus de signature\n\n` +
        `Cette action va :\n` +
        `1. Apposer VOTRE signature stockée sur ce contrat\n` +
        `2. Générer un lien à envoyer au locataire\n\n` +
        `Locataire : ${contrat.locataire?.noms_complet}\n` +
        `Appartement : ${contrat.appartement?.nom}\n` +
        `Loyer : ${contrat.loyer} USD\n\n` +
        `Continuer ?`
    } else if (dejaSigneBailleur && !dejaSigneLocataire) {
      messageConfirmation = `⏳ Vous avez déjà signé ce contrat\n\n` +
        `Voulez-vous regénérer un nouveau lien pour le locataire ?\n` +
        `(Utile si l'ancien lien est perdu)`
    } else if (dejaSigneBailleur && dejaSigneLocataire) {
      alert('✅ Ce contrat est déjà entièrement signé par les 2 parties !')
      return
    }
    
    if (!confirm(messageConfirmation)) return
    
    // 1. Signer comme bailleur (si pas déjà fait)
    if (!dejaSigneBailleur) {
      const { error: errSig } = await signerContratCommeBailleur(contrat.id)
      if (errSig) {
        alert('❌ Erreur lors de la signature bailleur :\n' + errSig.message)
        return
      }
    }
    
    // 2. Créer le lien pour le locataire
    const { lien, error: errLien } = await creerLienSignatureBail(contrat.id)
    if (errLien) {
      alert('❌ Erreur lors de la création du lien :\n' + errLien.message)
      return
    }
    
    // 3. Copier le lien dans le presse-papiers
    try {
      await navigator.clipboard.writeText(lien)
      alert(
        `✅ Contrat signé par le bailleur !\n\n` +
        `🔗 Lien copié dans le presse-papiers :\n${lien}\n\n` +
        `📲 Envoyez ce lien à ${contrat.locataire?.noms_complet} via WhatsApp.\n\n` +
        `Le locataire pourra signer directement depuis son téléphone.`
      )
    } catch (e) {
      prompt(
        `Copiez ce lien et envoyez-le à ${contrat.locataire?.noms_complet} sur WhatsApp :`,
        lien
      )
    }
    
    // 4. Recharger les données
    chargerDonnees()
  }

  function resetForm() {
    setFormData({
      appartement_id: '',
      locataire_id: '',
      date_debut: '',
      date_fin: '',
      duree_mois: 12,
      loyer: '',
      garantie: '',
      occupants: 1,
      statut: 'actif',
      clauses_speciales: ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  function getJoursAvantFin(dateFin) {
    if (!dateFin) return null
    const aujourdhui = new Date()
    const fin = new Date(dateFin)
    return Math.ceil((fin - aujourdhui) / (1000 * 60 * 60 * 24))
  }

  const apptsDisponibles = appartements.filter(a => {
    if (editingId) return true
    const apptOccupe = contrats.some(c => c.statut === 'actif' && c.appartement_id === a.id)
    return !apptOccupe && a.statut !== 'en_renovation'
  })

  const contratsFiltres = filterStatut === 'tous'
    ? contrats
    : contrats.filter(c => c.statut === filterStatut)

  if (loading) {
    return (
      <Layout activePage="contrats">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="contrats">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📄 Contrats</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg shadow-lg transition font-semibold"
        >
          {showForm ? '❌ Annuler' : '➕ Nouveau Contrat'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Logique automatique :</strong> Créer un contrat actif → l'appartement passe en "Loué".
          Terminer/Résilier le contrat → l'appartement redevient "Vacant" automatiquement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button onClick={() => setFilterStatut('actif')} className={`rounded-2xl shadow-lg p-4 text-left transition ${filterStatut === 'actif' ? 'bg-emerald-200 border-2 border-emerald-500' : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200'}`}>
          <p className="text-sm text-gray-600">✅ Actifs</p>
          <p className="text-3xl font-bold text-emerald-700">{contrats.filter(c => c.statut === 'actif').length}</p>
        </button>
        <button onClick={() => setFilterStatut('termine')} className={`rounded-2xl shadow-lg p-4 text-left transition ${filterStatut === 'termine' ? 'bg-gray-200 border-2 border-gray-500' : 'bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200'}`}>
          <p className="text-sm text-gray-600">📋 Terminés</p>
          <p className="text-3xl font-bold text-gray-700">{contrats.filter(c => c.statut === 'termine').length}</p>
        </button>
        <button onClick={() => setFilterStatut('resilie')} className={`rounded-2xl shadow-lg p-4 text-left transition ${filterStatut === 'resilie' ? 'bg-red-200 border-2 border-red-500' : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'}`}>
          <p className="text-sm text-gray-600">⛔ Résiliés</p>
          <p className="text-3xl font-bold text-red-700">{contrats.filter(c => c.statut === 'resilie').length}</p>
        </button>
        <button onClick={() => setFilterStatut('tous')} className={`rounded-2xl shadow-lg p-4 text-left transition ${filterStatut === 'tous' ? 'bg-blue-200 border-2 border-blue-500' : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'}`}>
          <p className="text-sm text-gray-600">📊 Tous</p>
          <p className="text-3xl font-bold text-blue-700">{contrats.length}</p>
        </button>
      </div>

      {showTerminerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">🔚 Terminer le contrat</h3>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{showTerminerModal.locataire?.noms_complet}</strong> - {showTerminerModal.appartement?.nom}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin effective *</label>
                <input type="date" required value={terminerData.date_fin_effective} onChange={(e) => setTerminerData({ ...terminerData, date_fin_effective: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison *</label>
                <select value={terminerData.raison_fin} onChange={(e) => setTerminerData({ ...terminerData, raison_fin: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                  <option value="fin_normale">Fin normale (date prévue atteinte)</option>
                  <option value="depart_anticipe">Départ anticipé du locataire</option>
                  <option value="resiliation">Résiliation par le bailleur</option>
                  <option value="impayes">Impayés</option>
                  <option value="vente">Vente du bien</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={confirmerTerminer} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold">✅ Confirmer</button>
              <button onClick={() => setShowTerminerModal(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {editingId ? '✏️ Modifier le Contrat' : '➕ Nouveau Contrat'}
          </h2>

          {(apptsDisponibles.length === 0 && !editingId) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-orange-800">⚠️ Aucun appartement disponible. Tous sont déjà loués ou en rénovation.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🏢 Appartement *</label>
              <select required value={formData.appartement_id} onChange={(e) => {
                const appt = appartements.find(a => a.id === e.target.value)
                setFormData({ ...formData, appartement_id: e.target.value, loyer: appt?.loyer_base || formData.loyer })
              }} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option value="">-- Sélectionner --</option>
                {(editingId ? appartements : apptsDisponibles).map((appt) => (
                  <option key={appt.id} value={appt.id}>{appt.nom} ({appt.loyer_base} USD)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">👤 Locataire *</label>
              <select required value={formData.locataire_id} onChange={(e) => setFormData({ ...formData, locataire_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option value="">-- Sélectionner --</option>
                {locataires.map((loc) => (<option key={loc.id} value={loc.id}>{loc.noms_complet}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date de début *</label>
              <input type="date" required value={formData.date_debut} onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">📅 Date de fin *</label>
              <input type="date" required value={formData.date_fin} onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">⏱️ Durée (mois)</label>
              <input type="number" min="1" value={formData.duree_mois} onChange={(e) => setFormData({ ...formData, duree_mois: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">👥 Nombre d'occupants</label>
              <input type="number" min="1" value={formData.occupants} onChange={(e) => setFormData({ ...formData, occupants: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">💰 Loyer mensuel (USD) *</label>
              <input type="number" step="0.01" required value={formData.loyer} onChange={(e) => setFormData({ ...formData, loyer: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">🏦 Garantie / Caution (USD)</label>
              <input type="number" step="0.01" value={formData.garantie} onChange={(e) => setFormData({ ...formData, garantie: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">📝 Clauses spéciales / Notes</label>
              <textarea value={formData.clauses_speciales} onChange={(e) => setFormData({ ...formData, clauses_speciales: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold transition">
                {editingId ? '💾 Mettre à jour' : '✅ Créer le contrat'}
              </button>
              <button type="button" onClick={resetForm} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold transition">Annuler</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          {filterStatut === 'tous' ? 'Tous les contrats' : filterStatut === 'actif' ? 'Contrats actifs' : filterStatut === 'termine' ? 'Contrats terminés' : 'Contrats résiliés'} ({contratsFiltres.length})
        </h2>

        {contratsFiltres.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Aucun contrat dans cette catégorie.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contratsFiltres.map((contrat) => {
              const joursAvantFin = getJoursAvantFin(contrat.date_fin)
              const isExpiring = joursAvantFin !== null && joursAvantFin <= 90 && joursAvantFin >= 0 && contrat.statut === 'actif'
              const isExpired = joursAvantFin !== null && joursAvantFin < 0 && contrat.statut === 'actif'

              return (
                <div key={contrat.id} className={`border rounded-xl p-4 hover:shadow-md transition ${isExpiring ? 'border-orange-300 bg-orange-50' : isExpired ? 'border-red-300 bg-red-50' : contrat.statut === 'termine' ? 'border-gray-300 bg-gray-50' : contrat.statut === 'resilie' ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">{contrat.locataire?.noms_complet || 'Locataire inconnu'}</h3>
                      <p className="text-sm text-gray-600">🏢 {contrat.appartement?.nom || 'Appartement inconnu'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${contrat.statut === 'actif' ? 'bg-emerald-100 text-emerald-800' : contrat.statut === 'termine' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
                      {contrat.statut === 'actif' ? '✅ Actif' : contrat.statut === 'termine' ? '📋 Terminé' : '⛔ Résilié'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-3 border-t pt-3">
                    <div><p className="text-gray-500">Début</p><p className="font-semibold">{contrat.date_debut ? new Date(contrat.date_debut).toLocaleDateString('fr-FR') : '—'}</p></div>
                    <div><p className="text-gray-500">Fin prévue</p><p className="font-semibold">{contrat.date_fin ? new Date(contrat.date_fin).toLocaleDateString('fr-FR') : '—'}</p></div>
                    <div><p className="text-gray-500">Loyer</p><p className="font-bold text-emerald-700">{contrat.loyer} USD</p></div>
                    <div><p className="text-gray-500">Garantie</p><p className="font-semibold">{contrat.garantie || 0} USD</p></div>
                  </div>

                  {contrat.date_fin_effective && (
                    <div className="mt-3 p-2 bg-gray-100 rounded text-sm">
                      <p>📅 <strong>Fin effective :</strong> {new Date(contrat.date_fin_effective).toLocaleDateString('fr-FR')}</p>
                      {contrat.raison_fin && <p>📌 <strong>Raison :</strong> {contrat.raison_fin.replace('_', ' ')}</p>}
                    </div>
                  )}

                  {isExpiring && <div className="mt-3 p-2 bg-orange-100 rounded text-sm text-orange-800">⚠️ Expire dans {joursAvantFin} jour(s)</div>}
                  {isExpired && <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-800">🚨 Contrat expiré depuis {Math.abs(joursAvantFin)} jour(s) — terminez-le</div>}

                  {contrat.clauses_speciales && (<p className="text-sm text-gray-500 mt-2 italic">{contrat.clauses_speciales}</p>)}

                  <div className="flex flex-wrap gap-2 mt-4">
                    {contrat.statut === 'actif' && (
                      <>
                        <button onClick={() => handleEdit(contrat)} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold transition">✏️ Modifier</button>
                        <button onClick={() => ouvrirTerminerModal(contrat)} className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm font-semibold transition">🔚 Terminer</button>
                      </>
                    )}
                    <button
                      onClick={() => telechargerAvenantPDF(contrat)}
                      title="Télécharger l'avenant signé"
                      className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      📥
                    </button>
                    <button
                      onClick={() => telechargerContratInitialPDF(contrat)}
                      title="Télécharger le contrat de bail initial"
                      className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      📜
                    </button>
                    {contrat.statut === 'actif' && (
                      <button
                        onClick={() => lancerSignatureContrat(contrat)}
                        title={
                          contrat.statut_signature === 'tous_signes' ? '✅ Entièrement signé' :
                          contrat.statut_signature === 'bailleur_signe' ? '⏳ En attente du locataire' :
                          '📝 Lancer la signature électronique'
                        }
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                          contrat.statut_signature === 'tous_signes' 
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' 
                            : contrat.statut_signature === 'bailleur_signe'
                            ? 'bg-orange-100 hover:bg-orange-200 text-orange-800'
                            : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
                        }`}
                      >
                        {contrat.statut_signature === 'tous_signes' ? '✅' :
                         contrat.statut_signature === 'bailleur_signe' ? '⏳' : '📝'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(contrat.id)} className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-lg text-sm font-semibold transition">🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}
