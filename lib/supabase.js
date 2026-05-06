import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions pour les opérations courantes

// Appartements
export const getAppartements = async () => {
  const { data, error } = await supabase
    .from('appartements')
    .select('*')
    .order('nom')
  return { data, error }
}

// Contrats avec relations
export const getContratsAvecDetails = async () => {
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      appartement:appartements(*),
      locataire:locataires(*)
    `)
    .order('date_fin', { ascending: true })
  return { data, error }
}

// Renouvellements à venir (90 jours)
export const getRenouvellements = async () => {
  const dateLimit = new Date()
  dateLimit.setDate(dateLimit.getDate() + 90)
  
  const { data, error } = await supabase
    .from('contrats')
    .select(`
      *,
      appartement:appartements(*),
      locataire:locataires(*),
      renouvellements(*)
    `)
    .gte('date_fin', new Date().toISOString().split('T')[0])
    .lte('date_fin', dateLimit.toISOString().split('T')[0])
    .eq('statut', 'actif')
    .order('date_fin', { ascending: true })
  
  return { data, error }
}

// Créer un renouvellement
export const creerRenouvellement = async (contratId) => {
  const lienId = `renouvellement-${Date.now()}`
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const lienSignature = `${baseUrl}/signature/${lienId}`
  
  const { data, error } = await supabase
    .from('renouvellements')
    .insert({
      contrat_id: contratId,
      lien_signature: lienSignature,
      statut: 'en_attente'
    })
    .select()
    .single()
  
  return { data, error, lien: lienSignature }
}

// Récupérer un renouvellement par lien
export const getRenouvellementParLien = async (lienId) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const lienComplet = `${baseUrl}/signature/${lienId}`
  
  const { data, error } = await supabase
    .from('renouvellements')
    .select(`
      *,
      contrat:contrats(
        *,
        appartement:appartements(*),
        locataire:locataires(*)
      )
    `)
    .eq('lien_signature', lienComplet)
    .single()
  
  return { data, error }
}

// Sauvegarder une signature
export const sauvegarderSignature = async (renouvellementId, nomSignataire, signatureData) => {
  const { data, error } = await supabase
    .from('renouvellements')
    .update({
      statut: 'signe',
      date_signature: new Date().toISOString(),
      nom_signataire: nomSignataire,
      signature_data: signatureData
    })
    .eq('id', renouvellementId)
    .select()
    .single()
  
  return { data, error }
}

// Statistiques Dashboard
export const getStatistiquesDashboard = async () => {
  // Appartements totaux et loués
  const { data: appts } = await supabase
    .from('appartements')
    .select('statut')
  
  const totalAppts = appts?.length || 0
  const apptsLoues = appts?.filter(a => a.statut === 'loue').length || 0
  
  // Revenu mensuel
  const { data: contratsActifs } = await supabase
    .from('contrats')
    .select('loyer')
    .eq('statut', 'actif')
  
  const revenuMensuel = contratsActifs?.reduce((sum, c) => sum + parseFloat(c.loyer), 0) || 0
  
  // Paiements du mois
  const debutMois = new Date()
  debutMois.setDate(1)
  
  const { data: paiementsMois } = await supabase
    .from('paiements')
    .select('montant')
    .gte('date_paiement', debutMois.toISOString().split('T')[0])
  
  const revenuActuel = paiementsMois?.reduce((sum, p) => sum + parseFloat(p.montant), 0) || 0
  
  // Loyers en retard
  const aujourdhui = new Date()
  const jour = aujourdhui.getDate()
  const loyersRetard = jour > 5 ? apptsLoues - (paiementsMois?.length || 0) : 0
  
  return {
    totalAppartements: totalAppts,
    appartementsLoues: apptsLoues,
    revenuMensuel,
    revenuActuel,
    loyersEnRetard: Math.max(0, loyersRetard)
  }
}
