import { jsPDF } from 'jspdf'
import { formatDateFR } from './dateUtils'

/**
 * Génère un PDF du contrat de bail initial complet (13 articles + annexe état des lieux)
 * Conforme au modèle KENGE 14
 * @param {Object} contrat - Les données du contrat (peut être vide pour version vierge)
 * @returns {jsPDF} Le document PDF prêt à être téléchargé
 */
export function genererContratInitialPDF(contrat = {}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  doc.setLanguage('fr')

  // Données du contrat (avec valeurs par défaut pour version vierge)
  const locataire = contrat.locataire || {}
  const appartement = contrat.appartement || {}

  const nomLocataire = locataire.noms_complet || '_______________________________'
  const adresseLocataire = locataire.adresse_actuelle || '_______________________________'
  const telephoneLocataire = locataire.telephone || '_______________________________'
  const nomAppartement = appartement.nom || '_____________'
  const loyer = contrat.loyer_base || contrat.loyer || '___________'
  const garantie = contrat.garantie || (loyer ? loyer * 4 : '__________')
  const occupants = contrat.occupants || '___'

  // Dates : on garde des strings ISO; le formatage se fait via le helper centralisé
  const dateDebut = contrat.date_debut || null
  const dateFin = contrat.date_fin || null
  const numeroContrat = `KENGE14-BAIL-${contrat.id?.toString().slice(-8) || 'NOUVEAU'}`
  
  // Wrapper pour conserver le placeholder '____/____/______' du contrat vierge
  const formatDate = (val) => {
    if (!val) return '____/____/______'
    const formatted = formatDateFR(val)
    return formatted === '—' ? '____/____/______' : formatted
  }

  // Helper pour gérer la pagination automatique
  let y = 0
  const checkPageBreak = (espaceNecessaire = 30) => {
    if (y > 280 - espaceNecessaire) {
      doc.addPage()
      addEnTetePageSuivante()
      y = 35
    }
  }

  const addEnTetePageSuivante = () => {
    doc.setFillColor(5, 122, 85)
    doc.rect(0, 0, 210, 20, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('KENGE 14 GESTION LOCATIVE - Contrat de Bail', 105, 13, {
      align: 'center',
    })
    doc.setTextColor(0, 0, 0)
  }

  const ajouterArticle = (titre, contenu, espaceLigne = 5) => {
    checkPageBreak(20)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(titre, 20, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lignes = doc.splitTextToSize(contenu, 170)
    doc.text(lignes, 20, y)
    y += lignes.length * espaceLigne + 4
  }

  // ═══════════════════════════════════════════════
  // PAGE 1 : EN-TÊTE + IDENTIFICATION + ARTICLES 1-3
  // ═══════════════════════════════════════════════

  // En-tête vert KENGE 14
  doc.setFillColor(5, 122, 85)
  doc.rect(0, 0, 210, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('KENGE 14 GESTION LOCATIVE', 105, 15, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Kinshasa, République Démocratique du Congo', 105, 24, { align: 'center' })

  // Titre du document
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text("CONTRAT DE BAIL À USAGE D'HABITATION", 105, 50, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`N° ${numeroContrat}`, 105, 57, { align: 'center' })

  // Ligne séparatrice
  doc.setDrawColor(5, 122, 85)
  doc.setLineWidth(0.5)
  doc.line(20, 65, 190, 65)

  y = 75
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('ENTRE LES SOUSSIGNÉS :', 20, y)

  y += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('LE BAILLEUR', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text("M. Cesar OKOMA, demeurant au n° 15, Avenue de la Science,", 20, y)
  y += 5
  doc.text('Commune de la Gombe, Ville de Kinshasa,', 20, y)
  y += 5
  doc.setFont('helvetica', 'italic')
  doc.text('ci-après dénommé « le Bailleur », d\'une part ;', 20, y)
  y += 8

  doc.setFont('helvetica', 'bold')
  doc.text('LE PRENEUR', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.text(`Nom : ${nomLocataire}`, 20, y)
  y += 5
  doc.text(`Adresse : ${adresseLocataire}`, 20, y)
  y += 5
  doc.text(`Téléphone : ${telephoneLocataire}`, 20, y)
  y += 5
  doc.setFont('helvetica', 'italic')
  doc.text('ci-après dénommé(e) « le Preneur », d\'autre part ;', 20, y)
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.text('Il a été convenu et arrêté ce qui suit :', 20, y)
  y += 8

  // Description de l'appartement (utilise description_complete si disponible, sinon fallback)
  const descriptionAppt = appartement.description_complete || 'tel qu\'il se trouve sur place'

  // ARTICLE 1
  ajouterArticle(
    'ARTICLE 1 - OBJET DU BAIL',
    `Le Bailleur donne en location au Preneur, qui accepte, l'immeuble sis au n° 14, Avenue Kenge, Quartier Mama Yemo, Commune de Ngaliema, Ville de Kinshasa, appartement ${nomAppartement}, ${descriptionAppt}. Le Preneur reconnaît prendre les lieux loués dans l'état où ils se trouvent et s'engage à n'en changer la destination qu'avec l'accord préalable et écrit du Bailleur.`
  )

  // ARTICLE 2
  ajouterArticle(
    'ARTICLE 2 - DESTINATION ET OCCUPATION DES LIEUX',
    `Le logement est exclusivement destiné à l'habitation du Preneur et des personnes expressément mentionnées au présent contrat. Le nombre maximum d'occupants est fixé à ${occupants} personne(s). Toute occupation par un nombre supérieur constitue un manquement grave aux obligations contractuelles et pourra entraîner la résiliation du bail. Le Preneur s'engage à informer le Bailleur de tout changement dans la composition du foyer.`
  )

  // ARTICLE 3
  ajouterArticle(
    'ARTICLE 3 - LOYER ET CHARGES',
    `Le présent bail est consenti et accepté moyennant le paiement d'un loyer mensuel de ${loyer} USD (dollars américains), payable à la fin de chaque mois consommé. À la demande écrite et préalable du Preneur, une période de grâce de cinq (5) jours pourra être exceptionnellement accordée. Les charges locatives, notamment celles relatives à la consommation d'eau (Regideso) et d'électricité (SNEL), sont à la charge exclusive du Preneur.`
  )

  // ═══════════════════════════════════════════════
  // PAGE 2 : ARTICLES 4-7
  // ═══════════════════════════════════════════════

  // ARTICLE 4 - Modalités de paiement (texte officiel)
  ajouterArticle(
    'ARTICLE 4 - MODALITÉS DE PAIEMENT',
    "Le paiement du loyer s'effectuera par dépôt sur le compte bancaire Equity-BCDC n° 233200011755382. En cas d'impossibilité pour le Preneur d'effectuer lui-même le dépôt, le gérant pourra s'en charger moyennant une indemnité forfaitaire de cinq dollars américains (USD 5,00) pour frais de transport et de service. Le Preneur devra transmettre le bordereau du dépôt au Bailleur via WhatsApp au numéro +1 817 353 8862, en précisant son nom ainsi que le mois concerné. Le non-respect de cette procédure ou le défaut de paiement à l'échéance constituera un cas d'insolvabilité du Preneur."
  )

  // ARTICLE 5
  ajouterArticle(
    'ARTICLE 5 - GARANTIE LOCATIVE',
    `À la signature du présent bail, le Preneur verse au Bailleur la somme de ${garantie} USD (dollars américains) à titre de garantie locative. Cette somme ne portera pas intérêt et sera restituée au Preneur à la fin du contrat, après déduction des éventuelles sommes dues au Bailleur, notamment au titre de réparations ou de remise en état des lieux.`
  )

  // ARTICLE 6
  ajouterArticle(
    'ARTICLE 6 - OBLIGATIONS DU PRENEUR',
    "Le Preneur s'engage à entretenir les lieux loués et à les restituer, à l'expiration du bail, dans l'état constaté lors de l'entrée en jouissance, sauf usure normale. Il prendra en charge la réparation de tout dégât imputable à sa responsabilité, le remplacement de tout vitrage brisé ou endommagé de son fait, ainsi que les grosses réparations résultant de sa négligence ou de sa faute."
  )

  // ARTICLE 7
  ajouterArticle(
    'ARTICLE 7 - OBLIGATIONS DU BAILLEUR',
    "Le Bailleur prendra à sa charge les grosses réparations qui ne sont pas imputables au Preneur. Toute modification ou réparation envisagée par le Preneur devra faire l'objet d'un accord préalable et écrit du Bailleur."
  )

  // ARTICLE 8
  ajouterArticle(
    'ARTICLE 8 - DURÉE DU BAIL',
    `Le présent contrat est conclu pour une durée d'une (1) année, prenant effet le ${formatDate(dateDebut)} et se terminant le ${formatDate(dateFin)}, renouvelable par tacite reconduction, sauf dénonciation ou résiliation dans les conditions prévues au présent contrat.`
  )

  // ARTICLE 9
  ajouterArticle(
    'ARTICLE 9 - DROIT DE VISITE EN FIN DE BAIL',
    "Durant les deux (2) mois précédant l'échéance du présent contrat, le Bailleur pourra organiser des visites de la parcelle au profit de candidats Preneurs, à raison de deux jours par semaine, à convenir avec le Preneur. Cette disposition ne s'applique pas si le Preneur notifie, par écrit et dans les délais, sa volonté de renouveler le bail."
  )

  // ARTICLE 10
  ajouterArticle(
    'ARTICLE 10 - INTERDICTION DE SOUS-LOCATION ET CESSION',
    "Le Preneur s'interdit formellement de sous-louer tout ou partie du bien loué, sous quelque prétexte que ce soit. Toute cession ou transfert du présent bail est soumis à l'autorisation préalable et écrite du Bailleur."
  )

  // ARTICLE 11
  ajouterArticle(
    'ARTICLE 11 - ÉTAT DES LIEUX',
    "Un état des lieux contradictoire sera dressé entre les parties lors de l'entrée en jouissance et à la fin du contrat. Le tableau d'état des lieux figure en annexe du présent contrat."
  )

  // ARTICLE 12
  ajouterArticle(
    'ARTICLE 12 - RÉSILIATION',
    "Chacune des parties pourra résilier le présent bail à tout moment, sans motif particulier, moyennant un préavis de quatre-vingt-dix (90) jours, notifié par écrit à l'autre partie, avec accusé de réception. Le délai de préavis court à compter de la date de réception de la notification."
  )

  // ARTICLE 13
  ajouterArticle(
    'ARTICLE 13 - RÈGLEMENT DES LITIGES',
    "Tout différend relatif à l'interprétation ou à l'exécution du présent contrat sera, dans un premier temps, réglé à l'amiable entre les parties. En cas d'échec, le litige sera soumis à la compétence des juridictions compétentes de la République Démocratique du Congo."
  )

  // ═══════════════════════════════════════════════
  // PAGE SIGNATURES
  // ═══════════════════════════════════════════════
  doc.addPage()
  addEnTetePageSuivante()
  y = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Fait à Kinshasa, le ' + formatDate(dateDebut), 20, y)
  y += 15

  doc.setFontSize(11)
  doc.text('SIGNATURES', 105, y, { align: 'center' })
  y += 15

  // Zone Bailleur
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('LE BAILLEUR', 40, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('M. Cesar OKOMA', 40, y)
y += 4
// 🖋️ Image signature du bailleur (si présente)
if (contrat?.signature_bailleur) {
  try {
    doc.addImage(contrat.signature_bailleur, 'PNG', 25, y, 50, 22)
  } catch (e) {
    console.error('Erreur image signature bailleur:', e)
  }
}
y += 26
  doc.setDrawColor(150, 150, 150)
  doc.line(20, y, 90, y)
  y += 5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Signature et date', 35, y)

  // Zone Preneur (à droite)
  let yPreneur = y - 41
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('LE PRENEUR', 130, yPreneur)
  yPreneur += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(nomLocataire, 130, yPreneur)
yPreneur += 4
// 🖋️ Image signature du locataire (si présente)
if (contrat?.signature_locataire) {
  try {
    doc.addImage(contrat.signature_locataire, 'PNG', 115, yPreneur, 50, 22)
  } catch (e) {
    console.error('Erreur image signature locataire:', e)
  }
}
yPreneur += 26
  doc.setDrawColor(150, 150, 150)
  doc.line(110, yPreneur, 180, yPreneur)
  yPreneur += 5
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Signature et date', 130, yPreneur)

  // ═══════════════════════════════════════════════
  // PAGE ANNEXE : ÉTAT DES LIEUX
  // ═══════════════════════════════════════════════
  doc.addPage()
  addEnTetePageSuivante()
  y = 35

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text("ANNEXE — ÉTAT DES LIEUX CONTRADICTOIRE", 105, y, { align: 'center' })
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Adresse du bien : 14 Avenue Kenge, C/Ngaliema, Q/Mama-Yemo, Kinshasa-RDC`, 20, y)
  y += 5
  doc.text(`Appartement : ${nomAppartement}`, 20, y)
  y += 5
  doc.text(`Date : ____________________`, 20, y)
  y += 5
  doc.text(`Bailleur : Cesar Okoma`, 20, y)
  y += 5
  doc.text(`Preneur : ${nomLocataire}`, 20, y)
  y += 10

  // Tableau état des lieux
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setFillColor(220, 240, 230)
  doc.rect(15, y - 5, 180, 7, 'F')
  doc.text('Pièce / Équipement', 17, y)
  doc.text('État entrée', 75, y)
  doc.text('État sortie', 125, y)
  doc.text('Observations', 165, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  const pieces = [
    'Salon',
    'Salle à manger',
    'Chambre 1',
    'Chambre 2',
    'Chambre 3',
    'Cuisine',
    'Garde-manger',
    'Salle de bain 1',
    'Salle de bain 2',
    'Couloir / Entrée',
    'Murs',
    'Plafonds',
    'Sols',
    'Portes',
    'Fenêtres / vitres',
    'Électricité',
    'Eau / plomberie',
    'Autres',
  ]

  pieces.forEach((piece) => {
    doc.setDrawColor(180, 180, 180)
    doc.line(15, y, 195, y)
    doc.text(piece, 17, y + 5)
    y += 9
  })
  doc.line(15, y, 195, y)

  y += 10
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.text(
    "Les parties déclarent avoir procédé ensemble à l'état des lieux ci-dessus, en deux exemplaires originaux.",
    20,
    y
  )
  y += 5
  doc.text("Chaque partie reconnaît avoir reçu un exemplaire signé.", 20, y)

  y += 12
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Le Bailleur :', 30, y)
  doc.text('Le Preneur :', 130, y)
  y += 18
  doc.setDrawColor(150, 150, 150)
  doc.line(20, y, 90, y)
  doc.line(110, y, 180, y)

  // Pied de page
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(
    'Document généré électroniquement par KENGE 14 Gestion Locative',
    105,
    285,
    { align: 'center' }
  )
  doc.text(`ID: ${contrat.id || 'NOUVEAU'}`, 105, 290, { align: 'center' })

  return doc
}