import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import {
  getContratParLienDecompte,
  signerDecompteCommeLocataire
} from '../../lib/supabase'

export default function SignatureDecomptePage() {
  const router = useRouter()
  const { lienId } = router.query

  const [contrat, setContrat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState(null)

  const canvasRef = useRef(null)
  const isDrawing = useRef(false)

  // Charger le contrat depuis le lien
  useEffect(() => {
    if (!lienId) return

    const charger = async () => {
      const { data, error } = await getContratParLienDecompte(lienId)
      if (error || !data) {
        setError("Lien invalide ou décompte introuvable.")
      } else {
        setContrat(data)
        // Si déjà signé par le locataire (workflow complet)
        if (data.statut_signature_decompte === 'signe_complet') {
          setSigned(true)
        }
      }
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
    const { error } = await signerDecompteCommeLocataire(contrat.id, signatureData)
    setSigning(false)

    if (error) {
      alert("Erreur lors de la signature : " + error.message)
    } else {
      setSigned(true)
    }
  }

  // États d'affichage
  if (loading) {
    return (
      <div style={styles.center}>
        <p>Chargement du décompte...</p>
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
        <p>Le décompte est désormais clôturé.</p>
      </div>
    )
  }

  // Valeurs du décompte (avec parseFloat de sécurité)
  const garantie = parseFloat(contrat.garantie) || 0
  const loyersImpayes = parseFloat(contrat.loyers_impayes_calcule) || 0
  const degats = parseFloat(contrat.degats_constates) || 0
  const surplus = parseFloat(contrat.surplus_credit_calcule) || 0
  const reliquat = parseFloat(contrat.reliquat_garantie) || 0

  // Sens du reliquat du point de vue du locataire
  // > 0 : à rembourser au locataire / < 0 : locataire doit / = 0 : équilibre
  let reliquatLabel = ''
  let reliquatColor = '#374151'
  if (reliquat > 0) {
    reliquatLabel = `Le bailleur vous rembourse ${reliquat.toFixed(2)} $`
    reliquatColor = '#059669' // vert
  } else if (reliquat < 0) {
    reliquatLabel = `Vous restez à devoir ${Math.abs(reliquat).toFixed(2)} $`
    reliquatColor = '#dc2626' // rouge
  } else {
    reliquatLabel = `Compte équilibré (0 $)`
    reliquatColor = '#374151' // gris
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>📋 Décompte de Fin de Contrat</h1>
        <p>KENGE 14 — Kinshasa</p>
      </header>

      <section style={styles.section}>
        <h2>Informations</h2>
        <div style={styles.info}>
          <p><strong>Locataire :</strong> {contrat.locataire?.noms_complet}</p>
          <p><strong>Appartement :</strong> {contrat.appartement?.nom}</p>
          <p><strong>Date de fin du contrat :</strong> {contrat.date_fin}</p>
        </div>
      </section>

      <section style={styles.section}>
        <h2>Détail du décompte</h2>
        <div style={styles.info}>
          <p><strong>Garantie initiale :</strong> {garantie.toFixed(2)} $</p>
          <p><strong>Loyers impayés :</strong> − {loyersImpayes.toFixed(2)} $</p>
          <p><strong>Dégâts constatés :</strong> − {degats.toFixed(2)} $</p>
          <p><strong>Surplus / crédit :</strong> + {surplus.toFixed(2)} $</p>
          <hr style={styles.hr} />
          <p style={{ ...styles.reliquat, color: reliquatColor }}>
            <strong>Reliquat : {reliquatLabel}</strong>
          </p>
        </div>
      </section>

      {contrat.signature_decompte_bailleur && (
        <section style={styles.section}>
          <h2>Signature du bailleur ✅</h2>
          <img
            src={contrat.signature_decompte_bailleur}
            alt="Signature bailleur"
            style={styles.sigImg}
          />
        </section>
      )}

      <section style={styles.section}>
        <h2>Votre signature</h2>
        <p style={styles.help}>
          En signant, vous reconnaissez avoir pris connaissance du décompte
          ci-dessus et l'acceptez. Signez avec votre doigt (sur téléphone) ou
          avec la souris.
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
  hr: {
    border: 0,
    borderTop: '1px solid #ddd',
    margin: '10px 0'
  },
  reliquat: {
    fontSize: 18,
    marginTop: 8
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
    background: '#28a745',
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