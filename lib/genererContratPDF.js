import { jsPDF } from 'jspdf'

/**
 * Génère un PDF professionnel d'un avenant de renouvellement de bail
 */
export function genererContratRenouvellementPDF(renouvellement) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const contrat = renouvellement.contrat || {}
  const locataire = contrat.locataire || {}
  const appartement = contrat.appartement || {}

  const nomLocataire = renouvellement.nom_signataire || locataire.noms_complet || 'N/A'
  const telephoneLocataire = locataire.telephone || 'N/A'
  const nomAppartement = appartement.nom || 'N/A'
  const loyer = contrat.loyer_base || contrat.loyer || 0
  const numeroContrat = `KENGE14-RNV-${renouvellement.id?.toString().slice(-8) || 'XXXX'}`

  const dateDebut = contrat.date_fin ? new Date(contrat.date_fin) : new Date()
  const dateFin = new Date(dateDebut)
  dateFin.setFullYear(dateFin.getFullYear() + 1)

  const formatDate = (date) =>
    date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

  const dateSignature = renouvellement.date_signature
    ? new Date(renouvellement.date_signature)
    : new Date()

  // PAGE 1 : EN-TETE ET ARTICLES PRINCIPAUX
  doc.setFillColor(5, 122, 85)
  doc.rect(0, 0, 210, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('KENGE 14 GESTION LOCATIVE', 105, 15, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Kinshasa, Republique Democratique du Congo', 105, 24, { align: 'center' })

  doc.setTextColor(0, 0, 0)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('AVENANT DE RENOUVELLEMENT DE BAIL', 105, 50, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`N degre ${numeroContrat}`, 105, 57, { align: 'center' })
  doc.text(`Emis le ${formatDate(dateSignature)}`, 105, 63, { align: 'center' })

  doc.setDrawColor(5, 122, 85)
  doc.setLineWidth(0.5)
  doc.line(20, 70, 190, 70)

  let y = 80
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ENTRE LES SOUSSIGNES :', 20, y)

  y += 8
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('LE BAILLEUR', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text('KENGE 14 Gestion Locative', 20, y)

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text('LE LOCATAIRE', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${nomLocataire}`, 20, y)
  y += 6
  doc.text(`Telephone : ${telephoneLocataire}`, 20, y)

  y += 8
  doc.setDrawColor(200, 200, 200)
  doc.line(20, y, 190, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('ARTICLE 1 - OBJET', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article1 = `Le present avenant a pour objet le renouvellement du bail relatif a l'appartement ${nomAppartement} situe dans l'immeuble KENGE 14 a Kinshasa.`
  const article1Lines = doc.splitTextToSize(article1, 170)
  doc.text(article1Lines, 20, y)
  y += article1Lines.length * 5 + 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('ARTICLE 2 - DUREE', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`12 mois, du ${formatDate(dateDebut)} au ${formatDate(dateFin)}`, 20, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('ARTICLE 3 - LOYER', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`${loyer} USD/mois`, 20, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('ARTICLE 4 - CONDITIONS', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('- Loyer inchange par rapport au contrat precedent', 20, y)
  y += 5
  doc.text('- Memes conditions que le contrat actuel', 20, y)
  y += 5
  doc.text("- Tacite reconduction a l'echeance", 20, y)
  y += 5
  doc.text('- Preavis de 90 jours pour toute resiliation', 20, y)
  y += 8

  // PAGE 2
  doc.addPage()

  doc.setFillColor(5, 122, 85)
  doc.rect(0, 0, 210, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('KENGE 14 GESTION LOCATIVE - Avenant de Renouvellement', 105, 13, {
    align: 'center',
  })

  doc.setTextColor(0, 0, 0)
  y = 35

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('ARTICLE 5 - PAIEMENT', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article5 = `Le loyer est payable mensuellement par virement bancaire avec mention obligatoire de la reference de l'appartement (${nomAppartement}). Une preuve de paiement doit etre envoyee au bailleur dans les 5 jours suivant chaque versement.`
  const article5Lines = doc.splitTextToSize(article5, 170)
  doc.text(article5Lines, 20, y)
  y += article5Lines.length * 5 + 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('ARTICLE 6 - RESILIATION', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article6 =
    'En cas de resiliation, un preavis ecrit de 90 jours doit etre respecte par les deux parties. Les sommes dues a la date de la resiliation restent exigibles.'
  const article6Lines = doc.splitTextToSize(article6, 170)
  doc.text(article6Lines, 20, y)
  y += article6Lines.length * 5 + 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('ARTICLE 7 - LITIGES', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const article7 =
    "Tout litige relatif au present avenant sera regle a l'amiable. A defaut d'accord, les juridictions competentes de Kinshasa seront seules saisies."
  const article7Lines = doc.splitTextToSize(article7, 170)
  doc.text(article7Lines, 20, y)
  y += article7Lines.length * 5 + 12

  doc.setDrawColor(5, 122, 85)
  doc.setLineWidth(0.5)
  doc.line(20, y, 190, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('SIGNATURE DU LOCATAIRE', 20, y)
  y += 8

  if (renouvellement.signature_data) {
    try {
      doc.addImage(renouvellement.signature_data, 'PNG', 20, y, 80, 30)
      y += 32
    } catch (err) {
      console.error('Erreur ajout signature:', err)
      y += 5
    }
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(nomLocataire, 20, y)
  y += 5
  doc.text(`Fait a Kinshasa, le ${formatDate(dateSignature)}`, 20, y)

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    'Document genere electroniquement par KENGE 14 Gestion Locative',
    105,
    285,
    { align: 'center' }
  )
  doc.text(`ID: ${renouvellement.id || 'N/A'}`, 105, 290, { align: 'center' })

  return doc
}