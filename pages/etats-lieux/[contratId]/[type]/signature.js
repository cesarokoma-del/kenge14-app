// pages/etats-lieux/[contratId]/[type]/signature.js
// Page de signature séquentielle d'un état des lieux
// 1. Réalisateur (bailleur ou gérant) signe
// 2. Réalisateur passe le téléphone au locataire
// 3. Locataire signe -> statut passe à 'signe_locataire'
// 4. Page de confirmation
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../../../components/Layout'
import LayoutGerant from '../../../../components/LayoutGerant'
import RouteGuard from '../../../../components/RouteGuard'
import { supabase, getProfilUtilisateur } from '../../../../lib/supabase'
import {
  chargerEtatLieuxParContrat,
  signerEtatLieuxRealisateur,
  signerEtatLieuxLocataire,
} from '../../../../lib/etatsLieux'
import { formatDateFR } from '../../../../lib/dateUtils'

export default function PageSignatureEtatLieux() {
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
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState('')

  // État de la page : qui doit signer maintenant ?
  // 'realisateur' | 'locataire' | 'termine'
  const [etape, setEtape] = useState('realisateur')

  // Canvas refs et état du dessin
  const canvasRef = useRef(null)
  const [enTrainDeDessiner, setEnTrainDeDessiner] = useState(false)
  const [signatureVide, setSignatureVide] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)

  const typeValide = type === 'entree' || type === 'sortie'

  useEffect(() => {
    if (!router.isReady) return
    if (!contratId || !typeValide) {
      setErreur('URL invalide')
      setLoading(false)
      return
    }
    chargerDonnees()
  }, [router.isReady, contratId, type])

  async function chargerDonnees() {
    setLoading(true)

    // 1. Profil
    const { profil: p, error: errP } = await getProfilUtilisateur()
    if (errP || !p) {
      setErreur('Impossible de charger votre profil')
      setLoading(false)
      return
    }
    setProfil(p)

    // 2. Contrat
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

    // 3. État des lieux existant
    const { data: el, error: errE } = await chargerEtatLieuxParContrat(contratId, type)
    if (errE || !el) {
      setErreur('Aucun état des lieux brouillon trouvé pour ce contrat. Veuillez en créer un d\'abord.')
      setLoading(false)
      return
    }
    setEtatLieux(el)

    // Si déjà signé par les deux, on passe directement à confirmé
    if (el.statut === 'signe_locataire' || el.statut === 'valide_bailleur') {
      setEtape('termine')
    } else if (el.signature_realisateur) {
      // Réalisateur a déjà signé, le locataire doit signer
      setEtape('locataire')
    } else {
      setEtape('realisateur')
    }

    setLoading(false)
  }

  // ============================================================
  // Canvas tactile pour la signature
  // ============================================================

  function getCoords(e) {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  function debutDessin(e) {
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setEnTrainDeDessiner(true)
  }

  function continuerDessin(e) {
    if (!enTrainDeDessiner) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getCoords(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setSignatureVide(false)
  }

  function finirDessin(e) {
    e?.preventDefault()
    setEnTrainDeDessiner(false)
  }

  function effacerCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureVide(true)
  }

  // Initialise le canvas quand l'étape change
  useEffect(() => {
    if (etape === 'realisateur' || etape === 'locataire') {
      // Petit délai pour que le canvas soit monté
      const timer = setTimeout(() => {
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          setSignatureVide(true)
        }
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [etape])

  // ============================================================
  // Validation des signatures
  // ============================================================

  async function validerSignatureRealisateur() {
    if (signatureVide) {
      alert('Veuillez signer dans la zone avant de valider.')
      return
    }
    setEnregistrement(true)
    const canvas = canvasRef.current
    const dataURL = canvas.toDataURL('image/png')

    const { error } = await signerEtatLieuxRealisateur(etatLieux.id, dataURL)
    if (error) {
      alert('Erreur lors de l\'enregistrement : ' + error.message)
      setEnregistrement(false)
      return
    }

    // Passer à l'étape locataire
    setEtatLieux(prev => ({ ...prev, signature_realisateur: dataURL }))
    setEtape('locataire')
    setEnregistrement(false)
  }

  async function validerSignatureLocataire() {
    if (signatureVide) {
      alert('Veuillez signer dans la zone avant de valider.')
      return
    }
    setEnregistrement(true)
    const canvas = canvasRef.current
    const dataURL = canvas.toDataURL('image/png')

    const { error } = await signerEtatLieuxLocataire(etatLieux.id, dataURL)
    if (error) {
      alert('Erreur lors de l\'enregistrement : ' + error.message)
      setEnregistrement(false)
      return
    }

    // Terminé
    setEtatLieux(prev => ({
      ...prev,
      signature_locataire: dataURL,
      statut: 'signe_locataire',
    }))
    setEtape('termine')
    setEnregistrement(false)
  }

  // ============================================================
  // RENDER
  // ============================================================

  const LayoutComponent = profil?.role === 'gerant' ? LayoutGerant : Layout

  if (loading) {
    return (
      <LayoutComponent>
        <div className="p-4 text-center"><p className="text-gray-500">Chargement...</p></div>
      </LayoutComponent>
    )
  }

  if (erreur) {
    return (
      <LayoutComponent>
        <div className="p-4">
          <div className="bg-red-100 border border-red-300 text-red-800 rounded-xl p-4">❌ {erreur}</div>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">← Retour</button>
        </div>
      </LayoutComponent>
    )
  }

  const titreEmoji = type === 'entree' ? '📥' : '📤'
  const titreType = type === 'entree' ? "État des lieux d'entrée" : 'État des lieux de sortie'
  const couleurAccent = type === 'entree' ? 'emerald' : 'orange'

  return (
    <LayoutComponent>
      <div className="max-w-3xl mx-auto p-4">
        {/* Header */}
        <div className={`bg-${couleurAccent}-50 border border-${couleurAccent}-200 rounded-2xl p-4 mb-4`}>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
            ✍️ Signatures — {titreEmoji} {titreType}
          </h1>
          {contrat && (
            <p className="text-sm text-gray-600 mt-1">
              🏢 <strong>{contrat.appartement?.nom}</strong> — {contrat.locataire?.noms_complet}
            </p>
          )}
          {etatLieux && (
            <p className="text-xs text-gray-500 mt-1">
              📅 Date de réalisation : <strong>{formatDateFR(etatLieux.date_realisation)}</strong>
            </p>
          )}
        </div>

        {/* Indicateur d'étape */}
        <IndicateurEtape etape={etape} couleurAccent={couleurAccent} />

        {/* Contenu selon l'étape */}
        {etape === 'realisateur' && (
          <ZoneSignature
            titre={`Signature du réalisateur`}
            soustitre={profil?.nom_complet ? `${profil.nom_complet} (${profil.role})` : ''}
            mention="Je certifie avoir constaté l'état des lieux ci-dessus et en avoir discuté avec le locataire."
            canvasRef={canvasRef}
            onDebutDessin={debutDessin}
            onContinuerDessin={continuerDessin}
            onFinirDessin={finirDessin}
            onEffacer={effacerCanvas}
            onValider={validerSignatureRealisateur}
            enregistrement={enregistrement}
            couleurAccent={couleurAccent}
            labelBouton="Valider et passer au locataire →"
            signatureVide={signatureVide}
          />
        )}

        {etape === 'locataire' && (
          <ZoneSignature
            titre={`Signature du locataire`}
            soustitre={contrat?.locataire?.noms_complet}
            mention="Je reconnais avoir pris connaissance de l'état des lieux ci-dessus et l'accepte tel quel."
            canvasRef={canvasRef}
            onDebutDessin={debutDessin}
            onContinuerDessin={continuerDessin}
            onFinirDessin={finirDessin}
            onEffacer={effacerCanvas}
            onValider={validerSignatureLocataire}
            enregistrement={enregistrement}
            couleurAccent={couleurAccent}
            labelBouton="✅ Valider et terminer"
            signatureVide={signatureVide}
          />
        )}

        {etape === 'termine' && (
          <ConfirmationFinale
            couleurAccent={couleurAccent}
            onRetour={() => {
              if (profil?.role === 'gerant') {
                router.push('/gerant/dashboard')
              } else {
                router.push('/contrats')
              }
            }}
          />
        )}
      </div>
    </LayoutComponent>
  )
}

// ============================================================
// Sous-composants
// ============================================================

function IndicateurEtape({ etape, couleurAccent }) {
  const etapes = [
    { key: 'realisateur', label: 'Réalisateur' },
    { key: 'locataire', label: 'Locataire' },
    { key: 'termine', label: 'Terminé' },
  ]

  const indexActuel = etapes.findIndex(e => e.key === etape)

  return (
    <div className="bg-white rounded-xl shadow p-3 mb-4 flex items-center gap-2">
      {etapes.map((e, idx) => (
        <div key={e.key} className="flex-1 flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            idx < indexActuel ? `bg-${couleurAccent}-500 text-white` :
            idx === indexActuel ? `bg-${couleurAccent}-600 text-white ring-4 ring-${couleurAccent}-200` :
            'bg-gray-200 text-gray-500'
          }`}>
            {idx < indexActuel ? '✓' : idx + 1}
          </div>
          <span className={`text-sm font-medium ${
            idx <= indexActuel ? 'text-gray-800' : 'text-gray-400'
          }`}>{e.label}</span>
          {idx < etapes.length - 1 && (
            <div className={`flex-1 h-0.5 ${
              idx < indexActuel ? `bg-${couleurAccent}-500` : 'bg-gray-200'
            }`}></div>
          )}
        </div>
      ))}
    </div>
  )
}

function ZoneSignature({
  titre, soustitre, mention,
  canvasRef,
  onDebutDessin, onContinuerDessin, onFinirDessin,
  onEffacer, onValider,
  enregistrement, couleurAccent, labelBouton, signatureVide,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 mb-4">
      <h2 className="text-lg font-bold text-gray-800">{titre}</h2>
      {soustitre && <p className="text-sm text-gray-600 mb-2">{soustitre}</p>}

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-amber-900 italic">"{mention}"</p>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-1 bg-gray-50 mb-3">
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          onMouseDown={onDebutDessin}
          onMouseMove={onContinuerDessin}
          onMouseUp={onFinirDessin}
          onMouseLeave={onFinirDessin}
          onTouchStart={onDebutDessin}
          onTouchMove={onContinuerDessin}
          onTouchEnd={onFinirDessin}
          className="w-full bg-white rounded touch-none cursor-crosshair"
          style={{ height: '200px' }}
        />
      </div>

      <p className="text-xs text-gray-500 text-center mb-4">
        ✍️ Signez avec le doigt (mobile) ou la souris (ordinateur)
      </p>

      <div className="flex gap-2">
        <button
          onClick={onEffacer}
          disabled={enregistrement || signatureVide}
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold disabled:opacity-50"
        >
          🔄 Effacer
        </button>
        <button
          onClick={onValider}
          disabled={enregistrement || signatureVide}
          className={`flex-1 px-4 py-3 bg-${couleurAccent}-600 hover:bg-${couleurAccent}-700 text-white rounded-xl font-semibold shadow-md disabled:opacity-50`}
        >
          {enregistrement ? '⏳ Enregistrement...' : labelBouton}
        </button>
      </div>
    </div>
  )
}

function ConfirmationFinale({ couleurAccent, onRetour }) {
  return (
    <div className="bg-white rounded-xl shadow p-8 text-center">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">État des lieux signé !</h2>
      <p className="text-gray-600 mb-6">
        Le réalisateur et le locataire ont signé. Le bailleur recevra une notification pour
        valider l'état des lieux.
      </p>
      <button
        onClick={onRetour}
        className={`px-6 py-3 bg-${couleurAccent}-600 hover:bg-${couleurAccent}-700 text-white rounded-xl font-semibold`}
      >
        Retour au tableau de bord
      </button>
    </div>
  )
}