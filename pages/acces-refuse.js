import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getProfilUtilisateur, signOut } from '../lib/supabase'

export default function AccesRefuse() {
  const router = useRouter()
  const [profil, setProfil] = useState(null)
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    chargerProfil()
  }, [])

  async function chargerProfil() {
    const { profil } = await getProfilUtilisateur()
    setProfil(profil)
    setChargement(false)
  }

  // Redirige l'utilisateur vers SA page d'accueil selon son rôle
  function retournerEspace() {
    if (!profil) {
      router.push('/login')
      return
    }
    
    switch (profil.role) {
      case 'bailleur':
        router.push('/')
        break
      case 'gerant':
        router.push('/gerant/dashboard')
        break
      case 'locataire':
        router.push('/login') // ou /locataire si tu as une route générique
        break
      default:
        router.push('/login')
    }
  }

  async function handleDeconnexion() {
    await signOut()
    router.push('/login')
  }

  if (chargement) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Chargement...</p>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Icône */}
        <div style={styles.icon}>🚫</div>
        
        {/* Titre */}
        <h1 style={styles.title}>Accès refusé</h1>
        
        {/* Message principal */}
        <p style={styles.message}>
          Cette page est réservée aux administrateurs. Votre compte ne dispose
          pas des autorisations nécessaires pour y accéder.
        </p>

        {/* Info utilisateur (si profil chargé) */}
        {profil && (
          <div style={styles.userInfo}>
            <p style={styles.userInfoLine}>
              <strong>Connecté en tant que :</strong> {profil.nom_complet}
            </p>
            <p style={styles.userInfoLine}>
              <strong>Rôle :</strong>{' '}
              <span style={styles.roleBadge}>{profil.role}</span>
            </p>
          </div>
        )}

        {/* Boutons d'action */}
        <div style={styles.actions}>
          <button onClick={retournerEspace} style={styles.buttonPrimary}>
            ← Retour à mon espace
          </button>
          <button onClick={handleDeconnexion} style={styles.buttonSecondary}>
            🚪 Se déconnecter
          </button>
        </div>

        {/* Note discrète */}
        <p style={styles.note}>
          Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur.
        </p>
      </div>
    </div>
  )
}

// ─── Styles inline ──────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: '20px',
    fontFamily: 'system-ui, sans-serif'
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '480px',
    width: '100%',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    textAlign: 'center',
    borderTop: '5px solid #ef4444'
  },
  icon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: '12px'
  },
  message: {
    color: '#6b7280',
    fontSize: '15px',
    lineHeight: '1.6',
    marginBottom: '24px'
  },
  userInfo: {
    backgroundColor: '#f3f4f6',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '24px',
    textAlign: 'left'
  },
  userInfoLine: {
    margin: '6px 0',
    color: '#374151',
    fontSize: '14px'
  },
  roleBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '12px',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontWeight: '600',
    fontSize: '12px',
    textTransform: 'capitalize'
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px'
  },
  buttonPrimary: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    padding: '14px 24px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.2s'
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    color: '#6b7280',
    border: '1px solid #d1d5db',
    padding: '12px 24px',
    borderRadius: '10px',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.2s'
  },
  note: {
    fontSize: '12px',
    color: '#9ca3af',
    fontStyle: 'italic',
    margin: 0
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '14px'
  }
}