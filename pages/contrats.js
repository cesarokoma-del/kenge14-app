import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import RouteGuard from '../components/RouteGuard'
import { supabase } from '../lib/supabase'
import {
  calculerDecompteComplet,
  formatMoisConcerne,
} from '../lib/decompteFinContrat'
import { genererDecompteFinPDF } from '../lib/genererDecompteFinPDF'
import { genererAccordResiliationPDF } from '../lib/genererAccordResiliationPDF'
import { genererContratRenouvellementPDF } from '../lib/genererContratPDF'
import { genererContratInitialPDF } from '../lib/genererContratInitialPDF'
import { signerContratCommeBailleur, creerLienSignatureBail, creerLienSignatureDecompte, getSignatureBailleur, creerLienSignatureResiliation, signerResiliationCommeLocataire } from '../lib/supabase'
import { formatDateFR, parseDateLocale } from '../lib/dateUtils'
import { chargerEtatLieuxParContrat } from '../lib/etatsLieux'

export default function Contrats() {
  const router = useRouter()
  const [contrats, setContrats] = useState([])
  const [appartements, setAppartements] = useState([])
  const [locataires, setLocataires] = useState([])
  const [loading, setLoading] = useState(true)
  // Map { contratId: { entree: <etat ou null>, sortie: <etat ou null> } }
  const [etatsLieuxParContrat, setEtatsLieuxParContrat] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [filterStatut, setFilterStatut] = useState('actif')
  const [showTerminerModal, setShowTerminerModal] = useState(null)
  const [terminerData, setTerminerData] = useState({
  date_fin_effective: new Date().toISOString().split('T')[0],
  raison_fin: 'fin_normale',
  degats_constates: 0,
  notes_fin: '',
})

// État pour le décompte calculé en live
const [decompteCalcule, setDecompteCalcule] = useState(null)
const [chargementDecompte, setChargementDecompte] = useState(false)

// Workflow modale Terminer : 'formulaire' → 'signature' → 'succes'
  const [etapeTerminer, setEtapeTerminer] = useState('formulaire')
  const [lienGenere, setLienGenere] = useState(null)
  const [contratTermineId, setContratTermineId] = useState(null)
  
  const [signatureBailleurEnregistree, setSignatureBailleurEnregistree] = useState(null)
  const [confirmationSignature, setConfirmationSignature] = useState(false)

  // États accord de résiliation amiable
  const [dateEtatLieux, setDateEtatLieux] = useState('')
  const [heureEtatLieux, setHeureEtatLieux] = useState('')
  const [lienResiliation, setLienResiliation] = useState(null)

  // Charger la signature bailleur depuis les paramètres (une seule fois au montage)
  useEffect(() => {
    const chargerSignatureBailleur = async () => {
      const { signature } = await getSignatureBailleur()
      setSignatureBailleurEnregistree(signature)
    }
    chargerSignatureBailleur()
  }, [])

// Recalcule le décompte automatiquement quand date/dégâts/contrat changent
useEffect(() => {
  if (!showTerminerModal) {
    setDecompteCalcule(null)
    return
  }

  const timer = setTimeout(async () => {
    setChargementDecompte(true)
    const resultat = await calculerDecompteComplet(
      showTerminerModal,
      terminerData.date_fin_effective,
      terminerData.degats_constates
    )
    setDecompteCalcule(resultat)
    setChargementDecompte(false)
  }, 300) // Debounce 300ms

  return () => clearTimeout(timer)
}, [
  showTerminerModal,
  terminerData.date_fin_effective,
  terminerData.degats_constates,
])
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

    // Charger les états des lieux pour tous les contrats en parallèle
    // Map { contratId: { entree, sortie } } — null si pas encore créé
    if (contratsAvecRelations.length > 0) {
      const chargements = await Promise.all(
        contratsAvecRelations.flatMap(c => [
          chargerEtatLieuxParContrat(c.id, 'entree').then(r => ({ contratId: c.id, type: 'entree', data: r.data })),
          chargerEtatLieuxParContrat(c.id, 'sortie').then(r => ({ contratId: c.id, type: 'sortie', data: r.data })),
        ])
      )
      const map = {}
      for (const { contratId, type, data } of chargements) {
        if (!map[contratId]) map[contratId] = { entree: null, sortie: null }
        map[contratId][type] = data
      }
      setEtatsLieuxParContrat(map)
    }

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
    setEtapeTerminer('formulaire')
    setLienGenere(null)
    setContratTermineId(null)
    setConfirmationSignature(false)
    setDateEtatLieux('')
    setHeureEtatLieux('')
    setLienResiliation(null)
    setTerminerData({
      date_fin_effective: new Date().toISOString().split('T')[0],
      raison_fin: 'fin_normale',
      degats_constates: 0,
      notes_fin: ''
    })
  }

  function fermerModaleTerminer() {
    setShowTerminerModal(null)
    setEtapeTerminer('formulaire')
    setLienGenere(null)
    setContratTermineId(null)
    setConfirmationSignature(false)
    setDateEtatLieux('')
    setHeureEtatLieux('')
    setLienResiliation(null)
    setTerminerData({
      date_fin_effective: new Date().toISOString().split('T')[0],
      raison_fin: 'fin_normale',
      degats_constates: 0,
      notes_fin: '',
    })
  }

  function passerEtapeSignature() {
    if (!decompteCalcule || decompteCalcule.erreur) {
      alert('Erreur de calcul du décompte. Veuillez vérifier la date de fin.')
      return
    }
    setEtapeTerminer('signature')
  }

  async function confirmerTerminer() {
    if (!showTerminerModal) return
    if (!decompteCalcule || decompteCalcule.erreur) {
      alert('Erreur de calcul du décompte.')
      return
    }

    // Utiliser la signature bailleur enregistrée dans les paramètres
    if (!signatureBailleurEnregistree) {
      alert('Aucune signature enregistrée. Veuillez la configurer dans Paramètres.')
      return
    }
    const signatureBailleurPNG = signatureBailleurEnregistree

    // Validation des champs état des lieux (pour l'accord de résiliation)
    if (!dateEtatLieux || !heureEtatLieux) {
      alert('Veuillez renseigner la date et l\'heure de l\'état des lieux de sortie.')
      return
    }

    // 1. UPDATE des champs métier du contrat
    const { error: errorUpdate } = await supabase
      .from('contrats')
      .update({
        statut: terminerData.raison_fin === 'resiliation' ? 'resilie' : 'termine',
        date_fin_effective: terminerData.date_fin_effective,
        raison_fin: terminerData.raison_fin,
        notes_fin: terminerData.notes_fin || null,
        degats_constates: parseFloat(terminerData.degats_constates) || 0,
        loyers_impayes_calcule: decompteCalcule.loyersImpayes.totalImpaye,
        surplus_credit_calcule: decompteCalcule.loyersImpayes.surplus,
        reliquat_garantie: decompteCalcule.reliquat.reliquat,
      })
      .eq('id', showTerminerModal.id)

    if (errorUpdate) {
      alert('Erreur lors de la clôture du contrat: ' + errorUpdate.message)
      return
    }

    // 2. Enregistrer la signature bailleur + générer le lien public
    const { error: errorSign, lien } = await creerLienSignatureDecompte(
      showTerminerModal.id,
      signatureBailleurPNG
    )

    if (errorSign) {
      alert('Erreur lors de la génération du lien: ' + errorSign.message)
      return
    }

    // 3bis. Créer le lien de signature pour l'accord de résiliation amiable
    const { error: errorResil, lien: lienResil } = await creerLienSignatureResiliation(
      showTerminerModal.id,
      dateEtatLieux,
      heureEtatLieux
    )

    if (errorResil) {
      alert('Erreur lors de la génération du lien de résiliation : ' + errorResil.message)
      return
    }

    setLienResiliation(lienResil)

    // 3. Passer à l'écran de succès
    setLienGenere(lien)
    setContratTermineId(showTerminerModal.id)
    setEtapeTerminer('succes')
    chargerDonnees()
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
      .eq('statut', 'traite')
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

  async function telechargerDecompteSigne(contrat) {
    if (contrat.statut !== 'termine') {
      alert('Ce contrat n\'a pas encore été terminé.')
      return
    }
    if (!contrat.statut_signature_decompte) {
      alert('Aucun décompte de fin n\'a été initié pour ce contrat.')
      return
    }

    // Charger les paramètres bailleur
    const { data: paramsBailleur } = await supabase
      .from('parametres')
      .select('*')
      .limit(1)
      .single()

    // Recalculer le décompte (signature : (contrat, dateFinISO, degats))
    const dateFinISO = contrat.date_fin_effective || new Date().toISOString().split('T')[0]
    const degats = parseFloat(contrat.degats_constates) || 0
    const decompte = await calculerDecompteComplet(contrat, dateFinISO, degats)

    const doc = genererDecompteFinPDF({
      contrat,
      decompte,
      parametres: paramsBailleur || {},
      signatureBailleur: contrat.signature_decompte_bailleur || null,
      signatureLocataire: contrat.signature_decompte_locataire || null,
      etatLieuxSortie: etatsLieuxParContrat[contrat.id]?.sortie?.statut === 'valide_bailleur'
        ? etatsLieuxParContrat[contrat.id].sortie
        : null,
    })

    const nomLocataire = (contrat.locataire?.noms_complet || 'locataire').replace(/\s+/g, '-')
    const dateFin = contrat.date_fin_effective || new Date().toISOString().split('T')[0]
    const suffix = contrat.statut_signature_decompte === 'signe_complet' ? 'SIGNE' : 'EN-ATTENTE'
    doc.save(`Decompte-Fin-${nomLocataire}-${dateFin}-${suffix}.pdf`)
  }

  async function telechargerAccordResiliationSigne(contrat) {
    if (contrat.statut !== 'termine') {
      alert('Ce contrat n\'a pas encore été terminé.')
      return
    }
    if (!contrat.statut_signature_resiliation) {
      alert('Aucun accord de résiliation n\'a été initié pour ce contrat.')
      return
    }

    // Charger les paramètres bailleur
    const { data: paramsBailleur } = await supabase
      .from('parametres')
      .select('*')
      .limit(1)
      .single()

    const doc = genererAccordResiliationPDF({
      contrat,
      parametres: paramsBailleur || {},
      signatureBailleur: signatureBailleurEnregistree || null,
      signatureLocataire: contrat.signature_resiliation_locataire || null,
    })

    const nomLocataire = (contrat.locataire?.noms_complet || 'locataire').replace(/\s+/g, '-')
    const dateFin = contrat.date_fin_effective || new Date().toISOString().split('T')[0]
    const suffix = contrat.statut_signature_resiliation === 'signe_complet' ? 'SIGNE' : 'EN-ATTENTE'
    doc.save(`Accord-Resiliation-${nomLocataire}-${dateFin}-${suffix}.pdf`)
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
    const fin = parseDateLocale(dateFin)
    if (!fin) return null
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
      <RouteGuard rolesAutorises={['bailleur']}>
        <Layout activePage="...">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
         </Layout>
      </RouteGuard>
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
  {etapeTerminer === 'formulaire' ? (
    <>
  <h3 className="text-2xl font-bold mb-2">🔚 Terminer le contrat</h3>
  <p className="text-sm text-gray-600 mb-4">
    {showTerminerModal.locataire?.noms_complet || '—'} — {showTerminerModal.appartement?.nom || '—'}
  </p>

  {/* Date de fin effective */}
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Date de fin effective <span className="text-red-600">*</span>
    </label>
    <input
      type="date"
      required
      value={terminerData.date_fin_effective}
      onChange={(e) => setTerminerData({ ...terminerData, date_fin_effective: e.target.value })}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
    />
    <p className="text-xs text-gray-500 mt-1">
      Le jour de fin n'est pas compté dans les loyers (locataire libère le matin).
    </p>
  </div>

  {/* État des lieux de sortie (pour l'accord de résiliation) */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-semibold text-amber-900 mb-2">
              📅 Rendez-vous état des lieux de sortie
            </p>
            <p className="text-xs text-amber-800 mb-3">
              Ces informations seront mentionnées dans l'accord de résiliation amiable (Article 4).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dateEtatLieux}
                  onChange={(e) => setDateEtatLieux(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Heure <span className="text-red-600">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={heureEtatLieux}
                  onChange={(e) => setHeureEtatLieux(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

  {/* Raison */}
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      Raison <span className="text-red-600">*</span>
    </label>
    <select
      value={terminerData.raison_fin}
      onChange={(e) => setTerminerData({ ...terminerData, raison_fin: e.target.value })}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
    >
      <option value="fin_normale">Fin normale</option>
      <option value="resiliation">Résiliation par le bailleur</option>
      <option value="depart_locataire">Départ du locataire</option>
      <option value="autre">Autre</option>
    </select>
  </div>

  {/* Dégâts constatés */}
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      💥 Dégâts constatés (USD)
    </label>
    <input
      type="number"
      step="0.01"
      min="0"
      value={terminerData.degats_constates}
      onChange={(e) => setTerminerData({ ...terminerData, degats_constates: e.target.value })}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      placeholder="0.00"
    />
    <p className="text-xs text-gray-500 mt-1">
      Montant à déduire de la garantie (état des lieux de sortie).
    </p>
  </div>

  {/* Notes libres */}
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      📝 Notes (optionnel)
    </label>
    <textarea
      rows="2"
      value={terminerData.notes_fin}
      onChange={(e) => setTerminerData({ ...terminerData, notes_fin: e.target.value })}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      placeholder="Observations sur la fin de contrat..."
    />
  </div>

  {/* ─── Bloc Décompte en live ─── */}
  <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl">
    <h4 className="text-base font-bold text-gray-800 mb-3">💰 Décompte de garantie</h4>

    {chargementDecompte ? (
      <p className="text-sm text-gray-500 italic">Calcul en cours...</p>
    ) : decompteCalcule?.erreur ? (
      <p className="text-sm text-red-600">Erreur: {decompteCalcule.erreur}</p>
    ) : decompteCalcule ? (
      <>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Garantie versée</span>
            <span className="font-semibold text-gray-800">
              +{(parseFloat(showTerminerModal.garantie) || 0).toFixed(2)} USD
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">
              Loyers impayés{' '}
              {decompteCalcule.loyersImpayes.prorataJours > 0 && (
                <span className="text-xs text-gray-400">
                  (dont prorata {decompteCalcule.loyersImpayes.prorataJours}j)
                </span>
              )}
            </span>
            <span className="font-semibold text-red-700">
              -{decompteCalcule.loyersImpayes.totalImpaye.toFixed(2)} USD
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Dégâts constatés</span>
            <span className="font-semibold text-red-700">
              -{(parseFloat(terminerData.degats_constates) || 0).toFixed(2)} USD
            </span>
          </div>
          {decompteCalcule.loyersImpayes.surplus > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Surplus payé d'avance</span>
              <span className="font-semibold text-green-700">
                +{decompteCalcule.loyersImpayes.surplus.toFixed(2)} USD
              </span>
            </div>
          )}
        </div>

        <hr className="my-3 border-blue-300" />

        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-gray-800">
            {decompteCalcule.reliquat.sens === 'restituer' && '💰 À restituer au locataire'}
            {decompteCalcule.reliquat.sens === 'recouvrer' && '⚠️ À recouvrer du locataire'}
            {decompteCalcule.reliquat.sens === 'neutre' && '⚖️ Balance neutre'}
          </span>
          <span
            className={`text-2xl font-bold ${
              decompteCalcule.reliquat.sens === 'restituer'
                ? 'text-green-700'
                : decompteCalcule.reliquat.sens === 'recouvrer'
                ? 'text-red-700'
                : 'text-gray-700'
            }`}
          >
            {decompteCalcule.reliquat.montantAbsolu.toFixed(2)} USD
          </span>
        </div>

        {/* Détail des mois impayés (collapsible) */}
        {decompteCalcule.loyersImpayes.moisDus.some((m) => m.statut !== 'paye') && (
          <details className="mt-3">
            <summary className="text-xs text-blue-700 cursor-pointer hover:underline">
              Voir le détail des loyers
            </summary>
            <div className="mt-2 space-y-1 text-xs">
              {decompteCalcule.loyersImpayes.moisDus.map((m) => (
                <div key={m.absolu} className="flex justify-between">
                  <span className="text-gray-700">{m.libelle}</span>
                  <span
                    className={
                      m.statut === 'paye'
                        ? 'text-green-700'
                        : m.statut === 'partiel'
                        ? 'text-orange-700'
                        : 'text-red-700'
                    }
                  >
                    {m.montantPaye.toFixed(2)} / {m.montantDu.toFixed(2)} USD
                    {m.statut === 'paye' && ' ✓'}
                    {m.statut === 'partiel' && ' ⚠'}
                    {m.statut === 'impaye' && ' ✗'}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </>
    ) : (
      <p className="text-sm text-gray-500 italic">Saisis une date de fin pour voir le décompte.</p>
    )}
  </div>

  {/* Boutons étape formulaire */}
  <div className="flex gap-3 mt-6">
    <button
      onClick={passerEtapeSignature}
      disabled={chargementDecompte || !decompteCalcule || decompteCalcule?.erreur}
      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-semibold"
    >
      Continuer →
    </button>
    <button
      onClick={fermerModaleTerminer}
      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold"
    >
      Annuler
    </button>
  </div>

    </>
  ) : etapeTerminer === 'signature' ? (
    <>
      <h3 className="text-2xl font-bold mb-2">✍️ Signature du bailleur</h3>
      <p className="text-sm text-gray-600 mb-4">
        {showTerminerModal.locataire?.noms_complet || '—'} — {showTerminerModal.appartement?.nom || '—'}
      </p>

      <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-sm text-amber-900">
          🖊️ Signez dans la zone ci-dessous. Une fois validé, un lien sera généré pour
          que le locataire puisse signer à son tour via WhatsApp.
        </p>
      </div>

      {decompteCalcule && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Reliquat de garantie</span>
            <span
              className={`font-bold ${
                decompteCalcule.reliquat.sens === 'restituer'
                  ? 'text-green-700'
                  : decompteCalcule.reliquat.sens === 'recouvrer'
                  ? 'text-red-700'
                  : 'text-gray-700'
              }`}
            >
              {decompteCalcule.reliquat.montantAbsolu.toFixed(2)} USD{' '}
              {decompteCalcule.reliquat.sens === 'restituer' && '(à restituer)'}
              {decompteCalcule.reliquat.sens === 'recouvrer' && '(à recouvrer)'}
            </span>
          </div>
        </div>
      )}

      <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Votre signature (enregistrée dans vos paramètres)
          </label>
          {signatureBailleurEnregistree ? (
            <div className="border-2 border-gray-200 rounded-lg p-4 bg-white flex items-center justify-center">
              <img
                src={signatureBailleurEnregistree}
                alt="Votre signature"
                style={{ maxWidth: 300, maxHeight: 120 }}
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-amber-50">
              <p className="text-sm text-amber-900 mb-2">
                ⚠️ Aucune signature enregistrée dans vos paramètres.
              </p>
              <button
                onClick={() => router.push('/parametres')}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
              >
                ⚙️ Configurer ma signature
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmationSignature}
              onChange={(e) => setConfirmationSignature(e.target.checked)}
              disabled={!signatureBailleurEnregistree}
            />
            <span className="text-sm text-gray-700">
              Je confirme apposer ma signature sur ce décompte de fin de contrat
            </span>
          </label>
        </div>

      <div className="flex gap-3">
        <button
          onClick={() => setEtapeTerminer('formulaire')}
          className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold"
        >
          ← Retour
        </button>
        <button
          onClick={confirmerTerminer}
          disabled={!confirmationSignature}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-semibold"
        >
          ✅ Confirmer et générer le lien
        </button>
      </div>
    </>
  ) : (
    <>
      <h3 className="text-2xl font-bold mb-2 text-green-700">
        ✅ Décompte signé par vous !
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Envoyez maintenant le lien au locataire pour qu'il signe à son tour.
      </p>

      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <label className="block text-xs font-medium text-gray-500 mb-2">
          🔗 LIEN DE SIGNATURE DU LOCATAIRE
        </label>
        <div className="bg-white border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs break-all">
          {lienGenere}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <button
          onClick={() => {
            navigator.clipboard.writeText(lienGenere)
            alert('✅ Lien copié dans le presse-papier')
          }}
          className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-semibold border border-gray-300"
        >
          📋 Copier le lien
        </button>

        <button
          onClick={() => {
            const telLocataire = showTerminerModal.locataire?.telephone || ''
            const telFormate = telLocataire.replace(/[^\d+]/g, '').replace(/^\+/, '')
            const message = encodeURIComponent(
              `Bonjour ${showTerminerModal.locataire?.noms_complet || ''},\n\n` +
              `Voici votre décompte de fin de contrat à signer :\n${lienGenere}\n\n` +
              `Merci de bien vouloir le consulter et le signer.\n\n` +
              `Cordialement, KENGE 14`
            )
            const url = telFormate
              ? `https://wa.me/${telFormate}?text=${message}`
              : `https://wa.me/?text=${message}`
            window.open(url, '_blank')
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold"
        >
          💬 Ouvrir WhatsApp
        </button>
      </div>

      <button
        onClick={async () => {
          const { data: contratAJour } = await supabase
            .from('contrats')
            .select('*, locataire:locataires(*), appartement:appartements(*)')
            .eq('id', contratTermineId)
            .single()
          const { data: paramsBailleur } = await supabase
            .from('parametres')
            .select('*')
            .limit(1)
            .single()
          if (contratAJour && decompteCalcule) {
            const doc = genererDecompteFinPDF({
              contrat: contratAJour,
              decompte: decompteCalcule,
              parametres: paramsBailleur || {},
              signatureBailleur: contratAJour.signature_decompte_bailleur || null,
              signatureLocataire: contratAJour.signature_decompte_locataire || null,
              etatLieuxSortie: etatsLieuxParContrat[contratAJour.id]?.sortie?.statut === 'valide_bailleur'
                ? etatsLieuxParContrat[contratAJour.id].sortie
                : null,
            })
            const nomLocataire = (contratAJour.locataire?.noms_complet || 'locataire').replace(/\s+/g, '-')
            const dateFin = contratAJour.date_fin_effective || new Date().toISOString().split('T')[0]
            const suffix = contratAJour.statut_signature_decompte === 'signe_complet' ? 'SIGNE' : 'BROUILLON'
            doc.save(`Decompte-Fin-${nomLocataire}-${dateFin}-${suffix}.pdf`)
          }
        }}
        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-semibold text-sm border border-blue-200 mb-4"
      >
        📥 Télécharger PDF brouillon (sans signature locataire)
      </button>

      {/* ═══════════════════════════════════════════════════════ */}
        {/* SECTION ACCORD DE RÉSILIATION AMIABLE                   */}
        {/* ═══════════════════════════════════════════════════════ */}
        {lienResiliation && (
          <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <label className="block text-xs font-medium text-purple-700 mb-2">
              📜 ACCORD DE RÉSILIATION AMIABLE — Lien de signature locataire
            </label>
            <div className="bg-white border border-purple-300 rounded-lg px-3 py-2 font-mono text-xs break-all mb-3">
              {`${typeof window !== 'undefined' ? window.location.origin : ''}/signature-resiliation/${lienResiliation}`}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/signature-resiliation/${lienResiliation}`
                  navigator.clipboard.writeText(url)
                  alert('✅ Lien résiliation copié dans le presse-papier')
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-semibold border border-gray-300"
              >
                📋 Copier le lien
              </button>

              <button
                onClick={() => {
                  const telLocataire = showTerminerModal.locataire?.telephone || ''
                  const telFormate = telLocataire.replace(/[^\d+]/g, '').replace(/^\+/, '')
                  const url = `${window.location.origin}/signature-resiliation/${lienResiliation}`

                  const message = encodeURIComponent(
                    `Bonjour ${showTerminerModal.locataire?.noms_complet || ''},\n\n` +
                    `Voici l'accord de résiliation amiable à signer :\n${url}\n\n` +
                    `Merci de bien vouloir le consulter et le signer.\n\n` +
                    `Cordialement, KENGE 14`
                  )
                  const waUrl = telFormate
                    ? `https://wa.me/${telFormate}?text=${message}`
                    : `https://wa.me/?text=${message}`
                  window.open(waUrl, '_blank')
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold"
              >
                💬 Ouvrir WhatsApp
              </button>
            </div>

            <button
              onClick={async () => {
                const { data: contratAJour } = await supabase
                  .from('contrats')
                  .select('*, locataire:locataires(*), appartement:appartements(*)')
                  .eq('id', contratTermineId)
                  .single()
                const { data: paramsBailleur } = await supabase
                  .from('parametres')
                  .select('*')
                  .limit(1)
                  .single()
                if (contratAJour) {
                  const doc = genererAccordResiliationPDF({
                    contrat: contratAJour,
                    parametres: paramsBailleur || {},
                    signatureBailleur: signatureBailleurEnregistree || null,
                    signatureLocataire: contratAJour.signature_resiliation_locataire || null,
                  })
                  const nomLocataire = (contratAJour.locataire?.noms_complet || 'locataire').replace(/\s+/g, '-')
                  const dateFin = contratAJour.date_fin_effective || new Date().toISOString().split('T')[0]
                  const suffix = contratAJour.statut_signature_resiliation === 'signe_complet' ? 'SIGNE' : 'BROUILLON'
                  doc.save(`Accord-Resiliation-${nomLocataire}-${dateFin}-${suffix}.pdf`)
                }
              }}
              className="w-full bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-lg font-semibold text-sm border border-purple-200"
            >
              📥 Télécharger PDF brouillon (sans signature locataire)
            </button>
          </div>
        )}

      <button
        onClick={fermerModaleTerminer}
        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold"
      >
        Fermer
      </button>
    </>
  )}
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
                    
                    <div className="flex flex-col gap-1 items-end">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${contrat.statut === 'actif' ? 'bg-emerald-100 text-emerald-800' : contrat.statut === 'termine' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'}`}>
            {contrat.statut === 'actif' ? '✅ Actif' : contrat.statut === 'termine' ? '📋 Terminé' : '⛔ Résilié'}
          </span>
          {contrat.statut === 'termine' && contrat.statut_signature_decompte && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${contrat.statut_signature_decompte === 'signe_complet' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {contrat.statut_signature_decompte === 'signe_complet' ? '✍️ Décompte signé' : '⏳ En attente locataire'}
            </span>
          )}

          {contrat.statut === 'termine' && contrat.statut_signature_resiliation && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${contrat.statut_signature_resiliation === 'signe_complet' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'}`}>
              {contrat.statut_signature_resiliation === 'signe_complet' ? '📜 Accord résilié' : '⏳ Accord en attente'}
            </span>
          )}
        </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mt-3 border-t pt-3">
                    <div><p className="text-gray-500">Début</p><p className="font-semibold">{formatDateFR(contrat.date_debut)}</p></div>
                    <div><p className="text-gray-500">Fin prévue</p><p className="font-semibold">{formatDateFR(contrat.date_fin)}</p></div>
                    <div><p className="text-gray-500">Loyer</p><p className="font-bold text-emerald-700">{contrat.loyer} USD</p></div>
                    <div><p className="text-gray-500">Garantie</p><p className="font-semibold">{contrat.garantie || 0} USD</p></div>
                  </div>

                  {contrat.date_fin_effective && (
                    <div className="mt-3 p-2 bg-gray-100 rounded text-sm">
                      <p>📅 <strong>Fin effective :</strong> {formatDateFR(contrat.date_fin_effective)}</p>
                      {contrat.raison_fin && <p>📌 <strong>Raison :</strong> {contrat.raison_fin.replace('_', ' ')}</p>}
                    </div>
                  )}

                  {isExpiring && <div className="mt-3 p-2 bg-orange-100 rounded text-sm text-orange-800">⚠️ Expire dans {joursAvantFin} jour(s)</div>}
                  {isExpired && <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-800">🚨 Contrat expiré depuis {Math.abs(joursAvantFin)} jour(s) — terminez-le</div>}

                  
                  {/* Badges états des lieux */}
                  {(etatsLieuxParContrat[contrat.id]?.entree || etatsLieuxParContrat[contrat.id]?.sortie) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <BadgeEtatLieux etat={etatsLieuxParContrat[contrat.id]?.entree} type="entree" />
                      <BadgeEtatLieux etat={etatsLieuxParContrat[contrat.id]?.sortie} type="sortie" />
                    </div>
                  )}

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

                    {contrat.statut === 'termine' && contrat.statut_signature_decompte && (
                      <button
                      onClick={() => telechargerDecompteSigne(contrat)}
                      title={contrat.statut_signature_decompte === 'signe_complet' ? 'Télécharger le décompte signé' : 'Télécharger le décompte (en attente locataire)'}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${contrat.statut_signature_decompte === 'signe_complet' ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' : 'bg-amber-100 hover:bg-amber-200 text-amber-800'}`}
                      >
                        📄
                        </button>
                      )}

                      {contrat.statut === 'termine' && contrat.statut_signature_resiliation && (
                      <button
                        onClick={() => telechargerAccordResiliationSigne(contrat)}
                        title={contrat.statut_signature_resiliation === 'signe_complet' ? 'Télécharger l\'accord de résiliation signé' : 'Télécharger l\'accord (en attente locataire)'}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${contrat.statut_signature_resiliation === 'signe_complet' ? 'bg-purple-100 hover:bg-purple-200 text-purple-800' : 'bg-amber-100 hover:bg-amber-200 text-amber-800'}`}
                      >
                        📜
                      </button>
                    )}
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

                    {/* Boutons États des Lieux (entrée toujours, sortie si contrat terminé) */}
                    <button
                      onClick={() => {
                        const statut = etatsLieuxParContrat[contrat.id]?.entree?.statut
                        const cible = (statut === 'signe_locataire' || statut === 'valide_bailleur')
                          ? `/etats-lieux/${contrat.id}/entree/apercu`
                          : `/etats-lieux/${contrat.id}/entree`
                        router.push(cible)
                      }}
                      title={
                        etatsLieuxParContrat[contrat.id]?.entree?.statut === 'valide_bailleur' ? 'État des lieux d\'entrée — validé' :
                        etatsLieuxParContrat[contrat.id]?.entree?.statut === 'signe_locataire' ? 'État des lieux d\'entrée — signé locataire, à valider' :
                        etatsLieuxParContrat[contrat.id]?.entree?.statut === 'brouillon' ? 'État des lieux d\'entrée — brouillon en cours' :
                        'Créer l\'état des lieux d\'entrée'
                      }
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                        etatsLieuxParContrat[contrat.id]?.entree?.statut === 'valide_bailleur'
                          ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                          : etatsLieuxParContrat[contrat.id]?.entree?.statut === 'signe_locataire'
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                          : etatsLieuxParContrat[contrat.id]?.entree?.statut === 'brouillon'
                          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      📋
                    </button>
                    {contrat.statut === 'termine' && (
                      <button
                        onClick={() => {
                          const statut = etatsLieuxParContrat[contrat.id]?.sortie?.statut
                          const cible = (statut === 'signe_locataire' || statut === 'valide_bailleur')
                            ? `/etats-lieux/${contrat.id}/sortie/apercu`
                            : `/etats-lieux/${contrat.id}/sortie`
                          router.push(cible)
                        }}
                        title={
                          etatsLieuxParContrat[contrat.id]?.sortie?.statut === 'valide_bailleur' ? 'État des lieux de sortie — validé' :
                          etatsLieuxParContrat[contrat.id]?.sortie?.statut === 'signe_locataire' ? 'État des lieux de sortie — signé locataire, à valider' :
                          etatsLieuxParContrat[contrat.id]?.sortie?.statut === 'brouillon' ? 'État des lieux de sortie — brouillon en cours' :
                          'Créer l\'état des lieux de sortie'
                        }
                        className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                          etatsLieuxParContrat[contrat.id]?.sortie?.statut === 'valide_bailleur'
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                            : etatsLieuxParContrat[contrat.id]?.sortie?.statut === 'signe_locataire'
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                            : etatsLieuxParContrat[contrat.id]?.sortie?.statut === 'brouillon'
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        📤
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

// ============================================================
// Sous-composant : Badge d'état des lieux (entrée ou sortie)
// ============================================================
function BadgeEtatLieux({ etat, type }) {
  if (!etat) return null

  const config = {
    'brouillon': {
      txt: 'brouillon',
      cls: 'bg-gray-100 text-gray-700 border-gray-300',
    },
    'signe_locataire': {
      txt: 'signé locataire',
      cls: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    'valide_bailleur': {
      txt: 'validé ✓',
      cls: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
  }[etat.statut] || { txt: etat.statut, cls: 'bg-gray-100 text-gray-700' }

  const labelType = type === 'entree' ? '📥 Entrée' : '📤 Sortie'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${config.cls}`}>
      {labelType} : {config.txt}
    </span>
  )
}