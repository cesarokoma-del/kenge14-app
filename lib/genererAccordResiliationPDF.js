// lib/genererAccordResiliationPDF.js
// PDF officiel de l'accord de résiliation amiable du contrat de bail (KENGE 14)
// Adapté au contexte RDC (Kinshasa, Code Civil congolais)
// Style conforme aux autres PDFs (bail, décompte de fin)

import { jsPDF } from 'jspdf'
import { formatDateFRLong } from './dateUtils'

/**
 * Génère un PDF de l'accord de résiliation amiable du contrat de bail.
 *
 * @param {Object} donnees
 * @param {Object} donnees.contrat                       Contrat avec locataire + appartement
 * @param {Object} donnees.parametres                    Infos bailleur (nom, etc.)
 * @param {string} [donnees.signatureBailleur]           PNG base64 (optionnel)
 * @param {string} [donnees.signatureLocataire]          PNG base64 (optionnel)
 *
 * @returns {jsPDF} Document jsPDF prêt à .save() ou .output()
 */
export function genererAccordResiliationPDF({
  contrat,
  parametres,
  signatureBailleur,
  signatureLocataire,
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  doc.setLanguage('fr')

  // ── Données extraites ──
  const locataire = contrat.locataire || {}
  const appartement = contrat.appartement || {}
  const nomLocataire = locataire.noms_complet || 'N/A'
  const nomAppartement = appartement.nom || 'N/A'
  const garantie = parseFloat(contrat.garantie) || 0

  const nomBailleur = parametres?.nom_bailleur || 'M. Cesar OKOMA'

  // Dates (helper centralisé lib/dateUtils.js, sans bug de fuseau)
  const formatOuNA = (val) => {
    if (!val) return 'N/A'
    const formatted = formatDateFRLong(val)
    return formatted === '—' ? 'N/A' : formatted
  }
  const dateDebut = formatOuNA(contrat.date_debut)
  const dateFin = formatOuNA(contrat.date_fin_effective || contrat.date_fin)
  const dateEtatLieux = formatOuNA(contrat.date_etat_lieux_sortie)
  const heureEtatLieux = contrat.heure_etat_lieux_sortie || 'N/A'
  const dateAujourdhui = formatDateFRLong(new Date())

  // Référence du document
  const refContrat = (contrat.id || '').toString().slice(-5).toUpperCase()
  const refResiliation = `KENGE14-RESIL-${refContrat}`
  const refDecompte = `KENGE14-FIN-${refContrat}`

  // ── Constantes de mise en page ──
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 15
  const contentWidth = pageWidth - 2 * marginX
  let y = 15

  // ═══════════════════════════════════════════════════════════════════
  // EN-TÊTE
  // ═══════════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(20, 60, 30)
  doc.text('KENGE 14', marginX, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text('Résidence locative — Kinshasa, RDC', marginX, y + 5)

  doc.setFontSize(8)
  doc.text(`Date d'émission : ${dateAujourdhui}`, pageWidth - marginX, y, { align: 'right' })
  doc.text(`Référence : ${refResiliation}`, pageWidth - marginX, y + 5, { align: 'right' })

  y += 12
  doc.setDrawColor(20, 60, 30)
  doc.setLineWidth(0.5)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  // ═══════════════════════════════════════════════════════════════════
  // TITRE
  // ═══════════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text('ACCORD DE RÉSILIATION AMIABLE', pageWidth / 2, y, { align: 'center' })
  y += 6
  doc.setFontSize(11)
  doc.text('DU CONTRAT DE BAIL', pageWidth / 2, y, { align: 'center' })
  y += 10

  // ═══════════════════════════════════════════════════════════════════
  // PRÉAMBULE — Parties
  // ═══════════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Entre les soussignés :', marginX, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const partieBailleur = doc.splitTextToSize(
    `D'une part, ${nomBailleur}, propriétaire de la résidence KENGE 14, ci-après dénommé « Le Bailleur »,`,
    contentWidth
  )
  doc.text(partieBailleur, marginX, y)
  y += partieBailleur.length * 5 + 2

  const partieLocataire = doc.splitTextToSize(
    `Et d'autre part, ${nomLocataire}, titulaire du contrat de bail portant sur l'appartement ${nomAppartement}, ci-après dénommé « Le Locataire »,`,
    contentWidth
  )
  doc.text(partieLocataire, marginX, y)
  y += partieLocataire.length * 5 + 4

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text(
    "Il a été convenu et arrêté ce qui suit, conformément aux dispositions du Code Civil congolais en matière de baux :",
    marginX,
    y,
    { maxWidth: contentWidth }
  )
  y += 10
  doc.setTextColor(0, 0, 0)

  // ═══════════════════════════════════════════════════════════════════
  // ARTICLES
  // ═══════════════════════════════════════════════════════════════════
  const ecrireArticle = (numero, titre, corps) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Article ${numero} — ${titre}`, marginX, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const lignes = doc.splitTextToSize(corps, contentWidth)
    doc.text(lignes, marginX, y)
    y += lignes.length * 4.5 + 4
  }

  // Article 1
  ecrireArticle(
    1,
    "Objet",
    `Les parties conviennent d'un commun accord de mettre fin au contrat de bail signé le ${dateDebut}, portant sur l'appartement ${nomAppartement} situé à la résidence KENGE 14, à Kinshasa.`
  )

  // Article 2
  ecrireArticle(
    2,
    "Date d'effet de la résiliation",
    `La présente résiliation prend effet le ${dateFin}. À cette date, le Locataire libère définitivement l'appartement et restitue les clés au Bailleur.`
  )

  // Article 3
  ecrireArticle(
    3,
    "Dispense de préavis",
    `Les parties conviennent expressément de se dispenser mutuellement de tout préavis légal ou contractuel, conformément au principe de liberté contractuelle. Aucune indemnité ne sera due par l'une ou l'autre partie à ce titre.`
  )

  // Article 4
  ecrireArticle(
    4,
    "État des lieux de sortie et remise des clés",
    `Un état des lieux contradictoire de sortie sera dressé le ${dateEtatLieux} à ${heureEtatLieux}, en présence des deux parties ou de leurs représentants. Lors de cette rencontre, le Locataire procèdera à la remise effective des clés de l'appartement au Bailleur.`
  )

  // Article 5
  ecrireArticle(
    5,
    "Sort du dépôt de garantie",
    `Le dépôt de garantie versé par le Locataire, d'un montant de ${garantie.toFixed(2)} USD, sera traité conformément au décompte de fin de contrat (réf. ${refDecompte}) annexé au présent accord et signé séparément par les deux parties.`
  )

  // Article 6
  ecrireArticle(
    6,
    "Quitus mutuel",
    `Sous réserve du règlement intégral des sommes éventuellement dues au titre du décompte de fin de contrat susvisé, les parties se donnent mutuellement quitus de toute somme, créance, indemnité ou réclamation découlant du contrat de bail. Aucune action contentieuse ne pourra être engagée par l'une ou l'autre partie postérieurement à la date d'effet.`
  )

  // ═══════════════════════════════════════════════════════════════════
  // MENTION FINALE
  // ═══════════════════════════════════════════════════════════════════
  y += 2
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9.5)
  doc.text(
    `Fait à Kinshasa, le ${dateAujourdhui}, en deux exemplaires originaux.`,
    marginX,
    y
  )
  y += 6

  // ═══════════════════════════════════════════════════════════════════
  // ZONE SIGNATURES
  // ═══════════════════════════════════════════════════════════════════
  const ySig = pageHeight - 45

  // Lignes de signature
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.3)
  doc.line(marginX, ySig, marginX + 80, ySig)
  doc.line(pageWidth - marginX - 80, ySig, pageWidth - marginX, ySig)

  // Signature bailleur (gauche)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text('Le Bailleur', marginX + 40, ySig + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(nomBailleur, marginX + 40, ySig + 10, { align: 'center' })

  if (signatureBailleur) {
    try {
      doc.addImage(signatureBailleur, 'PNG', marginX + 15, ySig - 25, 50, 22)
    } catch (e) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('(signature non affichable)', marginX + 40, ySig - 3, { align: 'center' })
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('(en attente de signature électronique)', marginX + 40, ySig + 14, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  // Signature locataire (droite)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Le Locataire', pageWidth - marginX - 40, ySig + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(nomLocataire, pageWidth - marginX - 40, ySig + 10, { align: 'center' })

  if (signatureLocataire) {
    try {
      doc.addImage(signatureLocataire, 'PNG', pageWidth - marginX - 65, ySig - 25, 50, 22)
    } catch (e) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text('(signature non affichable)', pageWidth - marginX - 40, ySig - 3, { align: 'center' })
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('(en attente de signature électronique)', pageWidth - marginX - 40, ySig + 14, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  // ═══════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.text(
    "Document généré électroniquement par l'application KENGE 14. Les signatures électroniques apposées ont valeur d'engagement contractuel.",
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center', maxWidth: contentWidth }
  )
  doc.text(`Page 1/1 — ${refResiliation}`, pageWidth / 2, pageHeight - 5, { align: 'center' })

  return doc
}