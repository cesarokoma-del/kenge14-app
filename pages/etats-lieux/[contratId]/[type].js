// pages/etats-lieux/[contratId]/[type].js
// Page de saisie d'un état des lieux (entrée ou sortie)
// Mobile-first, auto-save, photos optionnelles via Supabase Storage
// Accessible aux bailleurs ET aux gérants
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import LayoutGerant from '../../../components/LayoutGerant'
import RouteGuard from '../../../components/RouteGuard'
import { supabase, getProfilUtilisateur } from '../../../lib/supabase'
import {
  creerBrouillonEtatLieux,
  chargerEtatLieuxParContrat,
  mettreAJourPiece,
  mettreAJourRemarquesGenerales,
  uploadPhotoPiece,
} from '../../../lib/etatsLieux'
import { formatDateFR } from '../../../lib/dateUtils'

export default function PageEtatDesLieux() {
  return (
    <RouteGuard rolesAutorises={['bailleur', 'gerant']}>
      <Contenu />
    </RouteGuard>
  )
}

function Contenu() {
  const router = useRouter()
  const { contratId, type } = router.query

  const [profil, setProfil] = useState(null)
  const [contrat, setContrat] = useState(null)
  const [etatLieux, setEtatLieux] = useState(null)
  const [pieces, setPieces] = useState([])
  const [remarquesGenerales, setRemarquesGenerales] = useState('')
  const [dateRealisation, setDateRealisation] = useState('')
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')
  const [statutSave, setStatutSave] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [uploadingPiece, setUploadingPiece] = useState(null)
  const fileInputRefs = useRef({})
  const [messageErreurTemp, setMessageErreurTemp] = useState('')

  // Validation du paramètre `type`
  const typeValide = type === 'entree' || type === 'sortie'

  useEffect(() => {
    if (!router.isReady) return
    if (!contratId || !typeValide) {
      setErreur('URL invalide')
      setLoading(false)
      return
    }
    chargerOuCreer()
  }, [router.isReady, contratId, type])

  async function chargerOuCreer() {
    setLoading(true)
    setErreur('')

    // 1. Charger le profil utilisateur
    const { profil: p, error: errP } = await getProfilUtilisateur()
    if (errP || !p) {
      setErreur('Impossible de charger votre profil')
      setLoading(false)
      return
    }
    setProfil(p)

    // 2. Charger le contrat avec locataire + appartement
    const { data: ctr, error: errC } = await supabase
      .from('contrats')
      .select('*, locataire:locataires(*), appartement:appartements(*)')
      .eq('id', contratId)
      .single()

    if (errC || !ctr) {
      setErreur('Contrat introuvable')
      setLoading(false)
      return
    }
    setContrat(ctr)

    // 3. Chercher l'état des lieux existant pour ce contrat+type
    const { data: existant, error: errE } = await chargerEtatLieuxParContrat(contratId, type)
    if (errE) {
      setErreur('Erreur de chargement : ' + errE.message)
      setLoading(false)
      return
    }

    if (existant) {
      // Reprend où on en était
      setEtatLieux(existant)
      setPieces(existant.pieces || [])
      setRemarquesGenerales(existant.remarques_generales || '')
      setDateRealisation(existant.date_realisation)
    } else {
      // Crée un nouveau brouillon avec date du jour
      const aujourdhuiISO = new Date().toISOString().slice(0, 10)
      const { data: nouveau, error: errN } = await creerBrouillonEtatLieux(contratId, type, aujourdhuiISO)
      if (errN || !nouveau) {
        setErreur('Impossible de créer le brouillon : ' + (errN?.message || 'inconnue'))
        setLoading(false)
        return
      }
      // Recharger pour avoir les pièces
      const { data: complet } = await chargerEtatLieuxParContrat(contratId, type)
      setEtatLieux(complet)
      setPieces(complet?.pieces || [])
      setDateRealisation(aujourdhuiISO)
    }

    setLoading(false)
  }

  // Auto-save : met à jour une pièce
  async function handleChangerEtatPiece(pieceId, nouvelEtat) {
    setStatutSave('saving')
    setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, etat: nouvelEtat } : p))
    const { error } = await mettreAJourPiece(pieceId, { etat: nouvelEtat })
    setStatutSave(error ? 'error' : 'saved')
    setTimeout(() => setStatutSave('idle'), 1500)
  }

  async function handleChangerRemarquePiece(pieceId, nouvelleRemarque) {
    setStatutSave('saving')
    const { error } = await mettreAJourPiece(pieceId, { remarque: nouvelleRemarque })
    setStatutSave(error ? 'error' : 'saved')
    setTimeout(() => setStatutSave('idle'), 1500)
  }

  async function handleChangerRemarquesGenerales() {
    setStatutSave('saving')
    const { error } = await mettreAJourRemarquesGenerales(etatLieux.id, remarquesGenerales)
    setStatutSave(error ? 'error' : 'saved')
    setTimeout(() => setStatutSave('idle'), 1500)
  }

  async function handleUploadPhoto(piece, fichier) {
    if (!fichier) return
    setUploadingPiece(piece.id)
    setStatutSave('saving')
    const { url, error } = await uploadPhotoPiece(piece.id, fichier)
    if (error || !url) {
      // Erreur affichée en bannière temporaire, pas en page entière
      setMessageErreurTemp('Erreur upload photo : ' + (error?.message || 'inconnue'))
      setTimeout(() => setMessageErreurTemp(''), 5000)
      setUploadingPiece(null)
      setStatutSave('error')
      setTimeout(() => setStatutSave('idle'), 1500)
      return
    }
    // Mettre à jour la pièce avec l'URL
    await mettreAJourPiece(piece.id, { photo_url: url })
    setPieces(prev => prev.map(p => p.id === piece.id ? { ...p, photo_url: url } : p))
    setUploadingPiece(null)
    setStatutSave('saved')
    setTimeout(() => setStatutSave('idle'), 1500)
  }

  async function handleSupprimerPhoto(piece) {
    if (!confirm('Supprimer cette photo ?')) return
    setStatutSave('saving')
    await mettreAJourPiece(piece.id, { photo_url: null })
    setPieces(prev => prev.map(p => p.id === piece.id ? { ...p, photo_url: null } : p))
    setStatutSave('saved')
    setTimeout(() => setStatutSave('idle'), 1500)
  }

  async function handleChangerDateRealisation(nouvelleDate) {
    setDateRealisation(nouvelleDate)
    setStatutSave('saving')
    const { error } = await supabase
      .from('etats_lieux')
      .update({ date_realisation: nouvelleDate })
      .eq('id', etatLieux.id)
    setStatutSave(error ? 'error' : 'saved')
    setTimeout(() => setStatutSave('idle'), 1500)
  }

  function handlePasserSignature() {
    // Bloc D : page de signature (à venir)
    router.push(`/etats-lieux/${contratId}/${type}/signature`)
  }

  // ========== RENDER ==========

  // Choix du layout selon rôle
  const LayoutComponent = profil?.role === 'gerant' ? LayoutGerant : Layout

  if (loading) {
    return (
      <LayoutComponent>
        <div className="p-4 text-center">
          <p className="text-gray-500">Chargement...</p>
        </div>
      </LayoutComponent>
    )
  }

  if (erreur) {
    return (
      <LayoutComponent>
        <div className="p-4">
          <div className="bg-red-100 border border-red-300 text-red-800 rounded-xl p-4">
            ❌ {erreur}
          </div>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-200 rounded-lg"
          >
            ← Retour
          </button>
        </div>
      </LayoutComponent>
    )
  }

  // Couleurs selon type d'état
  const titreEmoji = type === 'entree' ? '📥' : '📤'
  const titreType = type === 'entree' ? "État des lieux d'entrée" : 'État des lieux de sortie'
  const couleurAccent = type === 'entree' ? 'emerald' : 'orange'

  return (
    <LayoutComponent>
      <div className="max-w-3xl mx-auto p-4 pb-32">
        {/* Bannière d'erreur temporaire (auto-disparition) */}
        {messageErreurTemp && (
          <div className="fixed top-4 left-4 right-4 z-50 bg-red-100 border border-red-300 text-red-800 rounded-xl p-3 shadow-lg animate-pulse">
            ❌ {messageErreurTemp}
          </div>
        )}
        {/* Header */}
        <div className={`bg-${couleurAccent}-50 border border-${couleurAccent}-200 rounded-2xl p-4 mb-4`}>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            {titreEmoji} {titreType}
          </h1>
          {contrat && (
            <p className="text-sm text-gray-600 mt-1">
              🏢 <strong>{contrat.appartement?.nom}</strong> — {contrat.locataire?.noms_complet}
            </p>
          )}
          <StatutSaveBadge statut={statutSave} />
        </div>

        {/* Date de réalisation */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📅 Date de réalisation
          </label>
          <input
            type="date"
            value={dateRealisation}
            onChange={e => handleChangerDateRealisation(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
          />
          <p className="text-xs text-gray-500 mt-1">
            Affichage : <strong>{formatDateFR(dateRealisation)}</strong>
          </p>
        </div>

        {/* Pièces */}
        {pieces.map((piece, idx) => (
          <CartePiece
            key={piece.id}
            piece={piece}
            indexAffichage={idx + 1}
            onChangerEtat={handleChangerEtatPiece}
            onChangerRemarque={handleChangerRemarquePiece}
            onUploadPhoto={handleUploadPhoto}
            onSupprimerPhoto={handleSupprimerPhoto}
            uploadEnCours={uploadingPiece === piece.id}
            fileInputRef={el => { if (el) fileInputRefs.current[piece.id] = el }}
          />
        ))}

        {/* Remarques générales */}
        <div className="bg-white rounded-xl shadow p-4 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            📝 Remarques générales (optionnel)
          </label>
          <textarea
            value={remarquesGenerales}
            onChange={e => setRemarquesGenerales(e.target.value)}
            onBlur={handleChangerRemarquesGenerales}
            rows={4}
            placeholder="Notes globales sur l'état général, points particuliers à signaler..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base resize-none"
          />
        </div>

        {/* Boutons de navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 flex gap-2 z-10">
          <button
            onClick={() => router.back()}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold"
          >
            ← Retour
          </button>
          <button
            onClick={handlePasserSignature}
            className={`flex-1 px-4 py-3 bg-${couleurAccent}-600 hover:bg-${couleurAccent}-700 text-white rounded-xl font-semibold shadow-md`}
          >
            ✍️ Passer à la signature
          </button>
        </div>
      </div>
    </LayoutComponent>
  )
}

// ============================================================
// Sous-composants
// ============================================================

function StatutSaveBadge({ statut }) {
  if (statut === 'idle') return null

  const config = {
    saving: { txt: '💾 Enregistrement...', cls: 'bg-blue-100 text-blue-700' },
    saved: { txt: '✅ Enregistré', cls: 'bg-green-100 text-green-700' },
    error: { txt: '❌ Erreur de sauvegarde', cls: 'bg-red-100 text-red-700' },
  }[statut]

  return (
    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${config.cls}`}>
      {config.txt}
    </span>
  )
}

function CartePiece({
  piece,
  indexAffichage,
  onChangerEtat,
  onChangerRemarque,
  onUploadPhoto,
  onSupprimerPhoto,
  uploadEnCours,
  fileInputRef,
}) {
  const [remarqueLocale, setRemarqueLocale] = useState(piece.remarque || '')

  const emojis = {
    'Salon': '🛋️',
    'Chambre': '🛏️',
    'Cuisine': '🍳',
    'Salle de bain': '🚿',
    'Toilettes': '🚽',
  }

  const couleursEtat = {
    bon: { actif: 'bg-green-500 text-white', inactif: 'bg-gray-100 text-gray-600' },
    moyen: { actif: 'bg-amber-500 text-white', inactif: 'bg-gray-100 text-gray-600' },
    mauvais: { actif: 'bg-red-500 text-white', inactif: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <h3 className="text-lg font-bold text-gray-800 mb-3">
        {emojis[piece.nom_piece] || '📦'} {indexAffichage}. {piece.nom_piece}
      </h3>

      {/* Boutons radio Bon / Moyen / Mauvais */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {['bon', 'moyen', 'mauvais'].map(etat => (
          <button
            key={etat}
            type="button"
            onClick={() => onChangerEtat(piece.id, etat)}
            className={`py-3 rounded-lg font-semibold text-sm transition-colors ${
              piece.etat === etat ? couleursEtat[etat].actif : couleursEtat[etat].inactif
            }`}
          >
            {etat === 'bon' && '🟢 Bon'}
            {etat === 'moyen' && '🟡 Moyen'}
            {etat === 'mauvais' && '🔴 Mauvais'}
          </button>
        ))}
      </div>

      {/* Remarque */}
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        Remarque (optionnel)
      </label>
      <textarea
        value={remarqueLocale}
        onChange={e => setRemarqueLocale(e.target.value)}
        onBlur={() => onChangerRemarque(piece.id, remarqueLocale)}
        rows={2}
        placeholder={piece.etat === 'bon' ? 'Aucune remarque nécessaire' : 'Décrivez ce qui ne va pas...'}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none mb-3"
      />

      {/* Photo */}
      <div>
        {piece.photo_url ? (
          <div className="space-y-2">
            <img
              src={piece.photo_url}
              alt={`Photo ${piece.nom_piece}`}
              className="w-full max-h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => onSupprimerPhoto(piece)}
              className="text-sm text-red-600 hover:text-red-800 underline"
            >
              🗑️ Supprimer la photo
            </button>
          </div>
        ) : (
          <div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={e => onUploadPhoto(piece, e.target.files?.[0])}
              className="hidden"
              id={`photo-${piece.id}`}
            />
            <label
              htmlFor={`photo-${piece.id}`}
              className={`inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 cursor-pointer hover:bg-gray-50 ${
                uploadEnCours ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {uploadEnCours ? '⏳ Upload...' : '📷 Ajouter une photo'}
            </label>
          </div>
        )}
      </div>
    </div>
  )
}