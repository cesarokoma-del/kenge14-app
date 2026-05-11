import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { verifierAcces } from '../lib/supabase'

/**
 * Composant de garde des routes protégées par rôle.
 * 
 * Usage dans une page :
 *   <RouteGuard rolesAutorises={['bailleur']}>
 *     <div>Contenu visible uniquement aux bailleurs</div>
 *   </RouteGuard>
 * 
 * Comportement :
 *  - Pendant la vérif → spinner
 *  - Pas connecté → redirige vers /login
 *  - Pas autorisé → redirige vers /acces-refuse
 *  - Autorisé → affiche les enfants
 */
export default function RouteGuard({ rolesAutorises = [], children }) {
  const router = useRouter()
  const [etat, setEtat] = useState('verification') // 'verification' | 'autorise' | 'redirection'

  useEffect(() => {
    let actif = true // évite setState sur composant démonté

    async function verifier() {
      const acces = await verifierAcces(rolesAutorises)

      // Composant démonté entre temps → on arrête tout
      if (!actif) return

      if (acces.autorise) {
        setEtat('autorise')
        return
      }

      // Pas autorisé → on redirige
      setEtat('redirection')
      
      // Petit log pour debug (visible dans la console F12 du navigateur)
      console.log('[RouteGuard] Accès refusé :', {
        raison: acces.raison,
        role: acces.role,
        rolesAutorises,
        redirection: acces.redirection
      })

      router.replace(acces.redirection)
    }

    verifier()

    // Cleanup : si on quitte la page avant la fin de la vérif
    return () => { actif = false }
  }, [router.pathname]) // re-vérifie si on change de page

  // ─── État 1 : Vérification en cours ─────────────────────
  if (etat === 'verification') {
    return (
      <div style={styles.containerLoader}>
        <div style={styles.loader}>
          <div style={styles.spinner}></div>
          <p style={styles.loaderText}>Vérification de l'accès...</p>
        </div>
      </div>
    )
  }

  // ─── État 2 : Redirection en cours ──────────────────────
  if (etat === 'redirection') {
    return (
      <div style={styles.containerLoader}>
        <div style={styles.loader}>
          <p style={styles.loaderText}>Redirection...</p>
        </div>
      </div>
    )
  }

  // ─── État 3 : Autorisé → afficher le contenu de la page ─
  return <>{children}</>
}

// ─── Styles inline (pas de dépendance CSS) ────────────────
const styles = {
  containerLoader: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    fontFamily: 'system-ui, sans-serif'
  },
  loader: {
    textAlign: 'center'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#10b981',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite'
  },
  loaderText: {
    color: '#6b7280',
    fontSize: '14px'
  }
}

// Injecter l'animation du spinner (CSS keyframes)
// Une seule fois au chargement du module
if (typeof window !== 'undefined' && !document.getElementById('routeguard-styles')) {
  const style = document.createElement('style')
  style.id = 'routeguard-styles'
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}