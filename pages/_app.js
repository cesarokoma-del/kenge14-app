import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, onAuthChange } from '../lib/supabase'
import '../styles/globals.css'

// Routes publiques (pas besoin de login)
const ROUTES_PUBLIQUES = [
  '/login',
  '/locataire',       // /locataire/[token]
  '/signature',       // /signature/[id]
  '/signature-bail',  // /signature-bail/[lienId]
  '/demande',         // /demande/[id]
]

function estRoutePublique(pathname) {
  return ROUTES_PUBLIQUES.some(route => pathname.startsWith(route))
}

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [verifAuth, setVerifAuth] = useState(true)

  useEffect(() => {
    // Vérification initiale de la session
    async function checkSession() {
      const { session: currentSession } = await getSession()
      setSession(currentSession)
      setVerifAuth(false)
    }
    checkSession()

    // Écouter les changements d'auth (login/logout en temps réel)
    const { data: subscription } = onAuthChange((newSession) => {
      setSession(newSession)
    })

    return () => {
      subscription?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Si vérif terminée et pas de session et page non publique → redirection
    if (!verifAuth && !session && !estRoutePublique(router.pathname)) {
      router.push('/login')
    }
  }, [verifAuth, session, router.pathname, router])

  // Pendant la vérif initiale, écran neutre
  if (verifAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-emerald-600 text-xl">Chargement...</div>
      </div>
    )
  }

  // Si page admin et pas de session → écran d'attente (la redirection est en cours)
  if (!session && !estRoutePublique(router.pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-emerald-600 text-xl">Redirection...</div>
      </div>
    )
  }

  return <Component {...pageProps} />
}