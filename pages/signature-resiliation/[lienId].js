import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import {
  getContratParLienResiliation,
  signerResiliationCommeLocataire,
  getSignatureBailleur
} from '../../lib/supabase'

export default function SignatureResiliationPage() {
  const router = useRouter()
  const { lienId } = router.query

  const [contrat, setContrat] = useState(null)
  const [signatureBailleur, setSignatureBailleur] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState(null)

  const canvasRef = useRef(null)
  const isDrawing = useRef(false)

  // Charger le contrat depuis le lien + signature bailleur depuis paramètres
  useEffect(() => {
    if (!lienId) return

    const charger = async () => {
      const { data, error } = await getContratParLienResiliation(lienId)
      if (error || !data) {
        setError("Lien invalide ou accord de résiliation introuvable.")
        setLoading(false)
        return
      }

      setContrat(data)
      if (data.statut_signature_resiliation === 'signe_complet') {
        setSigned(true)
      }

      // Charger la signature bailleur depuis les paramètres
      const { signature } = await getSignatureBailleur()
      setSignatureBailleur(signature)

      setLoading(false)
    }
    charger()
  }, [lienId])

  // Initialiser le canvas
  useEffect(() => {
    if (!canvasRef.current || signed) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
  }, [signed, contrat])

  // Gestion du dessin (souris + tactile)
  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  const startDraw = (e) => {
    e.preventDefault()
    isDrawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDraw = () => {
    isDrawing.current = false
  }

  const effacer = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const signer = async () => {
    if (!contrat) return
    const canvas = canvasRef.current
    const blank = document.createElement('canvas')
    blank.width = canvas.width
    blank.height = canvas.height
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert("Veuillez signer avant de valider.")
      return
    }

    setSigning(true)
    const signatureData = canvas.toDataURL('image/png')
    const { error } = await signerResiliationCommeLocataire(contrat.id, signatureData)
    setSigning(false)

    if (error) {
      alert("Erreur lors de la signature : " + error.message)
    } else {
      setSigned(true)
    }
  }

  // Formatage date FR
  const formatDateFR = (iso) => {
    if (!iso) return 'N/A'
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  // États d'affichage
  if (loading) {
    return (
      <div style={styles.center}>
        <p>Chargement de l'accord de résiliation...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.center}>
        <h2>❌ {error}</h2>
        <p>Veuillez contacter le bailleur.</p>
      </div>
    )
  }

  if (signed) {
    return (
      <div style={styles.center}>
        <h1>✅ Merci !</h1>
        <p>Votre signature a bien été enregistrée.</p>
        <p>L'accord de résiliation amiable est désormais conclu entre les deux parties.</p>
      </div>
    )
  }

  // Valeurs extraites
  const garantie = parseFloat(contrat.garantie) || 0
  const nomLocataire = contrat.locataire?.noms_complet || 'N/A'
  const nomAppartement = contrat.appartement?.nom || 'N/A'
  const dateDebut = formatDateFR(contrat.date_debut)
  const dateFin = formatDateFR(contrat.date_fin_effective || contrat.date_fin)
  const dateEtatLieux = formatDateFR(contrat.date_etat_lieux_sortie)
  const heureEtatLieux = contrat.heure_etat_lieux_sortie || 'N/A'

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>📜 Accord de Résiliation Amiable</h1>
        <p>KENGE 14 — Kinshasa, RDC</p>
      </header>

      <section style={styles.section}>
        <h2>Parties à l'accord</h2>
        <div style={styles.info}>
          <p><strong>Bailleur :</strong> M. Cesar OKOMA, propriétaire de la résidence KENGE 14</p>
          <p><strong>Locataire :</strong> {nomLocataire}</p>
          <p><strong>Appartement concerné :</strong> {nomAppartement}</p>
        </div>
      </section>

      <section style={styles.section}>
        <h2>Articles de l'accord</h2>
        <div style={styles.info}>
          <p><strong>Article 1 — Objet</strong></p>
          <p style={styles.article}>
            Les parties conviennent d'un commun accord de mettre fin au contrat de bail
            signé le <strong>{dateDebut}</strong>, portant sur l'appartement {nomAppartement}.
          </p>

          <p><strong>Article 2 — Date d'effet</strong></p>
          <p style={styles.article}>
            La résiliation prend effet le <strong>{dateFin}</strong>. À cette date,
            le Locataire libère l'appartement et restitue les clés au Bailleur.
          </p>

          <p><strong>Article 3 — Dispense de préavis</strong></p>
          <p style={styles.article}>
            Les parties se dispensent mutuellement de tout préavis légal ou contractuel.
            Aucune indemnité ne sera due à ce titre.
          </p>

          <p><strong>Article 4 — État des lieux de sortie</strong></p>
          <p style={styles.article}>
            Un état des lieux contradictoire sera dressé le <strong>{dateEtatLieux} à {heureEtatLieux}</strong>,
            en présence des deux parties. Le Locataire procèdera à la remise des clés
            lors de cette rencontre.
          </p>

          <p><strong>Article 5 — Dépôt de garantie</strong></p>
          <p style={styles.article}>
            Le dépôt de garantie de <strong>{garantie.toFixed(2)} USD</strong> sera traité
            conformément au décompte de fin de contrat annexé et signé séparément par les
            deux parties.
          </p>

          <p><strong>Article 6 — Quitus mutuel</strong></p>
          <p style={styles.article}>
            Sous réserve du règlement intégral des sommes dues au titre du décompte de fin,
            les parties se donnent mutuellement quitus de toute somme, créance ou réclamation
            découlant du contrat de bail.
          </p>
        </div>
      </section>

      {signatureBailleur && (
        <section style={styles.section}>
          <h2>Signature du bailleur ✅</h2>
          <img
            src={signatureBailleur}
            alt="Signature bailleur"
            style={styles.sigImg}
          />
        </section>
      )}

      <section style={styles.section}>
        <h2>Votre signature</h2>
        <p style={styles.help}>
          En signant, vous reconnaissez avoir pris connaissance des 6 articles de l'accord
          ci-dessus et les acceptez sans réserve. Signez avec votre doigt (sur téléphone)
          ou avec la souris.
        </p>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          style={styles.canvas}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        <div style={styles.buttons}>
          <button onClick={effacer} style={styles.btnSecondary}>
            🗑️ Effacer
          </button>
          <button
            onClick={signer}
            disabled={signing}
            style={styles.btnPrimary}
          >
            {signing ? 'Signature en cours...' : '✅ Valider ma signature'}
          </button>
        </div>
      </section>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: 700,
    margin: '0 auto',
    padding: 20,
    fontFamily: 'system-ui, sans-serif'
  },
  center: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    textAlign: 'center'
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: '2px solid #eee'
  },
  section: {
    marginBottom: 30,
    padding: 15,
    background: '#f9f9f9',
    borderRadius: 8
  },
  info: {
    lineHeight: 1.8
  },
  article: {
    background: '#fff',
    padding: 12,
    borderRadius: 6,
    border: '1px solid #e5e7eb',
    marginBottom: 12,
    lineHeight: 1.6
  },
  help: {
    color: '#666',
    fontSize: 14,
    marginBottom: 10
  },
  canvas: {
    width: '100%',
    maxWidth: 600,
    height: 200,
    border: '2px dashed #999',
    borderRadius: 8,
    background: '#fff',
    touchAction: 'none',
    cursor: 'crosshair'
  },
  sigImg: {
    maxWidth: 300,
    border: '1px solid #ddd',
    borderRadius: 4,
    background: '#fff'
  },
  buttons: {
    display: 'flex',
    gap: 10,
    marginTop: 15,
    flexWrap: 'wrap'
  },
  btnPrimary: {
    flex: 1,
    minWidth: 200,
    padding: '12px 20px',
    background: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 16,
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '12px 20px',
    background: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 16,
    cursor: 'pointer'
  }
}