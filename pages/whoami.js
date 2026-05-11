import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getProfilUtilisateur, signOut } from '../lib/supabase'

export default function WhoAmI() {
  const router = useRouter()
  const [chargement, setChargement] = useState(true)
  const [resultat, setResultat] = useState(null)

  useEffect(() => {
    chargerProfil()
  }, [])

  const chargerProfil = async () => {
    setChargement(true)
    const data = await getProfilUtilisateur()
    setResultat(data)
    setChargement(false)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // ─── État 1 : Chargement ─────────────────────────────────
  if (chargement) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loading}>⏳ Chargement du profil...</p>
        </div>
      </div>
    )
  }

  // ─── État 2 : Pas connecté ───────────────────────────────
  if (!resultat?.user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>🔒 Non connecté</h1>
          <p style={styles.text}>
            Tu n'es pas connecté. Va sur la page de login pour te connecter.
          </p>
          <button 
            onClick={() => router.push('/login')} 
            style={styles.button}
          >
            Aller à la page de connexion
          </button>
        </div>
      </div>
    )
  }

  // ─── État 3 : Connecté mais erreur (profil manquant ou compte désactivé) ─
  if (resultat.error) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, borderTop: '4px solid #e74c3c' }}>
          <h1 style={styles.title}>⚠️ Problème détecté</h1>
          <p style={styles.text}>
            <strong>Email :</strong> {resultat.user.email}
          </p>
          <p style={styles.text}>
            <strong>Erreur :</strong> {resultat.error.message}
          </p>
          <button onClick={handleSignOut} style={styles.buttonDanger}>
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  // ─── État 4 : Tout est OK ✅ ─────────────────────────────
  const { user, profil, role } = resultat
  
  // Couleur selon le rôle
  const couleursRole = {
    bailleur:  { bg: '#3498db', emoji: '👑', label: 'Bailleur (Admin)' },
    gerant:    { bg: '#f39c12', emoji: '🧑‍💼', label: 'Gérant' },
    locataire: { bg: '#2ecc71', emoji: '🏠', label: 'Locataire' }
  }
  const styleRole = couleursRole[role] || { bg: '#95a5a6', emoji: '❓', label: 'Inconnu' }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🪪 Qui suis-je ?</h1>
        
        {/* Badge du rôle */}
        <div style={{ ...styles.badge, backgroundColor: styleRole.bg }}>
          {styleRole.emoji} {styleRole.label}
        </div>

        {/* Infos du profil */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📋 Profil</h2>
          <p style={styles.text}><strong>Nom complet :</strong> {profil.nom_complet}</p>
          <p style={styles.text}><strong>Email :</strong> {profil.email}</p>
          <p style={styles.text}><strong>Rôle :</strong> {profil.role}</p>
          <p style={styles.text}>
            <strong>Statut :</strong>{' '}
            <span style={{ color: profil.actif ? '#27ae60' : '#e74c3c' }}>
              {profil.actif ? '✅ Actif' : '❌ Désactivé'}
            </span>
          </p>
          <p style={styles.text}>
            <strong>Créé le :</strong> {new Date(profil.cree_le).toLocaleString('fr-FR')}
          </p>
        </div>

        {/* Infos techniques (pour debug) */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>🔧 Technique (debug)</h2>
          <p style={styles.code}><strong>UID :</strong> {user.id}</p>
        </div>

        {/* Bouton déconnexion */}
        <button onClick={handleSignOut} style={styles.buttonDanger}>
          🚪 Se déconnecter
        </button>
      </div>
    </div>
  )
}

// ─── Styles inline (pas de dépendance CSS) ─────────────────
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f4f6f8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'system-ui, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
  title: { fontSize: '24px', marginBottom: '20px', color: '#2c3e50' },
  badge: {
    display: 'inline-block',
    padding: '8px 16px',
    borderRadius: '20px',
    color: 'white',
    fontWeight: 'bold',
    marginBottom: '20px'
  },
  section: {
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px'
  },
  sectionTitle: { fontSize: '16px', marginBottom: '12px', color: '#34495e' },
  text: { margin: '6px 0', color: '#2c3e50', lineHeight: '1.5' },
  code: { 
    margin: '6px 0', 
    color: '#7f8c8d', 
    fontFamily: 'monospace', 
    fontSize: '12px',
    wordBreak: 'break-all'
  },
  loading: { fontSize: '18px', color: '#7f8c8d', textAlign: 'center' },
  button: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%'
  },
  buttonDanger: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
    marginTop: '12px'
  }
}