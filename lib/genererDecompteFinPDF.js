// lib/genererDecompteFinPDF.js
// PDF officiel du décompte de fin de contrat (KENGE 14)
// Conforme au style des autres PDFs (bail, renouvellement)

import { jsPDF } from 'jspdf'
import { formatDateFR } from './dateUtils'

/**
 * Génère un PDF professionnel du décompte de fin de contrat.
 *
 * @param {Object} donnees
 * @param {Object} donnees.contrat        Contrat avec locataire + appartement
 * @param {Object} donnees.decompte       Résultat de calculerDecompteComplet()
 * @param {Object} donnees.parametres     Infos bailleur (nom, adresse, contact bancaire)
 *
 * @returns {jsPDF} Document jsPDF prêt à .save() ou .output()
 */
export function genererDecompteFinPDF({ contrat, decompte, parametres, signatureBailleur, signatureLocataire, etatLieuxSortie = null }) {
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
  const telephoneLocataire = locataire.telephone || 'N/A'
  const nomAppartement = appartement.nom || 'N/A'
  const garantie = parseFloat(contrat.garantie) || 0
  const loyer = parseFloat(contrat.loyer) || 0

  const reliquat = decompte.reliquat
  const loyersImpayes = decompte.loyersImpayes

  // Bailleur
  const nomBailleur = parametres?.nom_bailleur || 'M. Cesar OKOMA'
  const adresseBailleur = parametres?.adresse_bailleur || 'n° 15, Avenue de la Science, Commune de la Gombe, Kinshasa'
  const whatsappBailleur = parametres?.whatsapp_bailleur || '+243 999 999 999'
  const compteBancaire = parametres?.compte_bancaire || ''

  // Numéro de décompte
  const numeroDecompte = `KENGE14-FIN-${(contrat.id || '').toString().slice(-8).toUpperCase() || 'XXXXXXXX'}`

  /// Format date (helper centralisé lib/dateUtils.js, sans bug de fuseau)
  const formatOuNA = (val) => {
    if (!val) return 'N/A'
    const formatted = formatDateFR(val)
    return formatted === '—' ? 'N/A' : formatted
  }
  const dateAujourdhui = formatDateFR(new Date())
  const dateDebut = formatOuNA(contrat.date_debut)
  const dateFinEffective = contrat.date_fin_effective ? formatDateFR(contrat.date_fin_effective) : formatDateFR(new Date())

  // ============================================================
  // En-tête : KENGE 14
  // ============================================================
  let y = 18

  doc.setFillColor(5, 150, 105) // emerald-600
  doc.rect(0, 0, 210, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('KENGE 14', 15, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Gestion Locative Professionnelle - Kinshasa, RDC', 15, 22)
  doc.text(adresseBailleur, 15, 27)

  // ============================================================
  // Titre du document
  // ============================================================
  y = 45

  doc.setTextColor(0, 0, 0)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('DÉCOMPTE DE FIN DE CONTRAT', 105, y, { align: 'center' })

  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`N° ${numeroDecompte}`, 105, y, { align: 'center' })

  y += 5
  doc.text(`Établi le ${dateAujourdhui}`, 105, y, { align: 'center' })

  // ============================================================
  // Cadre : Parties
  // ============================================================
  y += 10
  doc.setDrawColor(200, 200, 200)
  doc.setFillColor(248, 250, 252) // slate-50
  doc.roundedRect(15, y, 180, 38, 2, 2, 'FD')

  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Entre les parties :', 20, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Le BAILLEUR : ${nomBailleur}`, 20, y + 13)
  doc.text(`Adresse : ${adresseBailleur}`, 20, y + 18)
  doc.text(`Contact : ${whatsappBailleur}`, 20, y + 23)

  doc.text(`Le LOCATAIRE : ${nomLocataire}`, 20, y + 30)
  doc.text(`Téléphone : ${telephoneLocataire}    Appartement : ${nomAppartement}`, 20, y + 35)

  // ============================================================
  // Cadre : Contrat de référence
  // ============================================================
  y += 44
  // Calcul dynamique de la hauteur du cadre selon les lignes optionnelles
  const aRaisonFin = !!contrat.raison_fin
  const aEtatLieuxSortie = !!etatLieuxSortie
  let hauteurCadre = 20
  if (aRaisonFin) hauteurCadre += 5
  if (aEtatLieuxSortie) hauteurCadre += 5

  doc.setFillColor(254, 252, 232) // amber-50
  doc.setDrawColor(252, 211, 77) // amber-300
  doc.roundedRect(15, y, 180, hauteurCadre, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Contrat de référence :', 20, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Période : du ${dateDebut} au ${dateFinEffective}    Loyer mensuel : ${loyer.toFixed(2)} USD    Garantie : ${garantie.toFixed(2)} USD`, 20, y + 13)

  let yLignesSup = y + 18
  if (aRaisonFin) {
    doc.text(`Motif de fin : ${contrat.raison_fin.replace(/_/g, ' ')}`, 20, yLignesSup)
    yLignesSup += 5
  }
  if (aEtatLieuxSortie) {
    const numeroEtat = `KENGE14-ETAT-${(etatLieuxSortie.id || '').toString().slice(-8).toUpperCase()}`
    doc.setFont('helvetica', 'italic')
    doc.text(`Voir état des lieux de sortie : ${numeroEtat}`, 20, yLignesSup)
    doc.setFont('helvetica', 'normal')
  }

  // Adapter le y de la suite à la nouvelle hauteur du cadre
  y += hauteurCadre - 20

  // ============================================================
  // Synthèse du décompte
  // ============================================================
  y += 27
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(0, 0, 0)
  doc.text('SYNTHÈSE DU DÉCOMPTE', 15, y)

  y += 4
  doc.setDrawColor(5, 150, 105)
  doc.setLineWidth(0.5)
  doc.line(15, y, 195, y)

  // Lignes du décompte
  y += 7
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const ligneDecompte = (libelle, montant, couleur = 'black') => {
    doc.setTextColor(80, 80, 80)
    doc.text(libelle, 20, y)
    if (couleur === 'red') doc.setTextColor(185, 28, 28)
    else if (couleur === 'green') doc.setTextColor(21, 128, 61)
    else doc.setTextColor(0, 0, 0)
    doc.text(`${montant >= 0 ? '+' : '-'}${Math.abs(montant).toFixed(2)} USD`, 190, y, { align: 'right' })
    y += 6
  }

  ligneDecompte('Garantie versée par le locataire', garantie, 'green')
  ligneDecompte(
    `Loyers impayés${loyersImpayes.prorataJours > 0 ? ` (dont prorata ${loyersImpayes.prorataJours} j sur le dernier mois)` : ''}`,
    -loyersImpayes.totalImpaye,
    'red'
  )
  ligneDecompte('Dégâts constatés (état des lieux de sortie)', -(parseFloat(contrat.degats_constates) || 0), 'red')

  if (loyersImpayes.surplus > 0) {
    ligneDecompte("Surplus payé d'avance par le locataire", loyersImpayes.surplus, 'green')
  }

  // Ligne séparatrice
  y += 1
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(20, y, 190, y)
  y += 8

  // Reliquat final (encadré + couleur)
  const bgReliquat = reliquat.sens === 'restituer'
    ? [220, 252, 231] // green-100
    : reliquat.sens === 'recouvrer'
    ? [254, 226, 226] // red-100
    : [243, 244, 246] // gray-100

  const txtReliquat = reliquat.sens === 'restituer'
    ? [21, 128, 61] // green-700
    : reliquat.sens === 'recouvrer'
    ? [185, 28, 28] // red-700
    : [55, 65, 81] // gray-700

  doc.setFillColor(bgReliquat[0], bgReliquat[1], bgReliquat[2])
  doc.roundedRect(15, y - 3, 180, 13, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(txtReliquat[0], txtReliquat[1], txtReliquat[2])

  let libelleReliquat = ''
  if (reliquat.sens === 'restituer') libelleReliquat = 'À RESTITUER AU LOCATAIRE'
  else if (reliquat.sens === 'recouvrer') libelleReliquat = 'À RECOUVRER DU LOCATAIRE'
  else libelleReliquat = 'BALANCE NEUTRE'

  doc.text(libelleReliquat, 20, y + 5)
  doc.text(`${reliquat.montantAbsolu.toFixed(2)} USD`, 190, y + 5, { align: 'right' })

  y += 18

  // Compte bancaire si à restituer/recouvrer
  if (reliquat.sens !== 'neutre' && compteBancaire) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(`Compte bancaire du bailleur : ${compteBancaire}`, 15, y)
    y += 5
  }

  // ============================================================
  // PAGE 2 — Détail des loyers
  // ============================================================
  if (loyersImpayes.moisDus && loyersImpayes.moisDus.length > 0) {
    doc.addPage()
    y = 20

    // Mini en-tête page 2
    doc.setFillColor(5, 150, 105)
    doc.rect(0, 0, 210, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('KENGE 14 — Décompte (suite)', 15, 8)
    doc.text(numeroDecompte, 195, 8, { align: 'right' })

    y = 22
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('DÉTAIL DES LOYERS', 15, y)

    y += 4
    doc.setDrawColor(5, 150, 105)
    doc.setLineWidth(0.5)
    doc.line(15, y, 195, y)

    y += 8
    // En-têtes tableau
    doc.setFillColor(243, 244, 246)
    doc.rect(15, y - 5, 180, 7, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    doc.text('Mois concerné', 20, y)
    doc.text('Montant dû', 110, y, { align: 'right' })
    doc.text('Montant payé', 145, y, { align: 'right' })
    doc.text('Statut', 190, y, { align: 'right' })

    y += 6

    // Lignes tableau
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    for (const m of loyersImpayes.moisDus) {
      if (y > 270) {
        doc.addPage()
        y = 20
      }

      doc.setTextColor(0, 0, 0)
      doc.text(m.libelle, 20, y)
      doc.text(`${m.montantDu.toFixed(2)} USD`, 110, y, { align: 'right' })

      if (m.statut === 'paye') doc.setTextColor(21, 128, 61)
      else if (m.statut === 'partiel') doc.setTextColor(180, 83, 9)
      else doc.setTextColor(185, 28, 28)

      doc.text(`${m.montantPaye.toFixed(2)} USD`, 145, y, { align: 'right' })

      let libelleStatut = ''
      if (m.statut === 'paye') libelleStatut = 'Payé'
      else if (m.statut === 'partiel') libelleStatut = 'Partiel'
      else if (m.statut === 'impaye') libelleStatut = 'Impayé'
      else if (m.statut === 'trop_paye') libelleStatut = 'Trop-payé'

      doc.text(libelleStatut, 190, y, { align: 'right' })

      y += 5

      // Ligne séparatrice fine
      doc.setDrawColor(230, 230, 230)
      doc.setLineWidth(0.1)
      doc.line(20, y - 1, 190, y - 1)
    }

    // Totaux en bas de tableau
    y += 4
    doc.setDrawColor(100, 100, 100)
    doc.setLineWidth(0.5)
    doc.line(20, y - 2, 190, y - 2)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text('TOTAL IMPAYÉ', 20, y + 3)
    doc.setTextColor(185, 28, 28)
    doc.text(`${loyersImpayes.totalImpaye.toFixed(2)} USD`, 190, y + 3, { align: 'right' })

    if (loyersImpayes.surplus > 0) {
      y += 6
      doc.setTextColor(0, 0, 0)
      doc.text('TOTAL SURPLUS', 20, y + 3)
      doc.setTextColor(21, 128, 61)
      doc.text(`+${loyersImpayes.surplus.toFixed(2)} USD`, 190, y + 3, { align: 'right' })
    }
  }

  // ============================================================
  // Notes + Signatures avec positionnement dynamique (pas d'overlap)
  // ============================================================
  const pageHeight = doc.internal.pageSize.height
  const HAUTEUR_BLOC_SIGNATURES = 35     // Hauteur réservée signatures (images + ligne + libellé)
  const MARGE_BAS = 15                    // Marge basse avant le pied de page
  const MARGE_NOTES_SIGS = 12             // Espacement entre Notes et Signatures

  // Préparer les lignes de notes (si présentes) pour calculer la hauteur réelle
  let lignesNotes = []
  let hauteurNotes = 0
  if (contrat.notes_fin) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    lignesNotes = doc.splitTextToSize(contrat.notes_fin, 180)
    // Hauteur = titre (5) + marge (5) + lignes (4mm chacune)
    hauteurNotes = 10 + lignesNotes.length * 4
  }

  // Espace nécessaire = Notes + marge + signatures + marge basse
  const espaceNecessaire = hauteurNotes + (hauteurNotes > 0 ? MARGE_NOTES_SIGS : 0) + HAUTEUR_BLOC_SIGNATURES + MARGE_BAS
  const ySuivant = y + 10  // y actuel après le tableau, + marge

  // Si pas la place sur la page courante, on saute à la page suivante
  if (ySuivant + espaceNecessaire > pageHeight) {
    doc.addPage()
    y = 30
  } else {
    y = ySuivant
  }

  // ============================================================
  // Bloc Notes (positionnement dynamique)
  // ============================================================
  if (contrat.notes_fin && lignesNotes.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text('Notes complémentaires :', 15, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(60, 60, 60)
    doc.text(lignesNotes, 15, y)
    y += lignesNotes.length * 4 + MARGE_NOTES_SIGS
  }

  // ============================================================
  // Bloc Signatures (sur la page courante, en bas)
  // ============================================================
  doc.setPage(doc.internal.getNumberOfPages())
  let ySig = pageHeight - MARGE_BAS - 20  // ligne de signature à 35mm du bas (au-dessus du footer)
  // S'assurer que ySig est au moins après les notes (sécurité)
  if (contrat.notes_fin && ySig < y + 25) {
    ySig = y + 25
  }
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(15, ySig, 95, ySig)
  doc.line(115, ySig, 195, ySig)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  // Signature bailleur
  doc.text('Signature du Bailleur', 55, ySig + 5, { align: 'center' })
  if (signatureBailleur) {
    doc.addImage(signatureBailleur, 'PNG', 30, ySig - 25, 50, 22)
  } else {
    doc.text('(en attente de signature électronique)', 55, ySig + 9, { align: 'center' })
  }
  // Signature locataire
  doc.text('Signature du Locataire', 155, ySig + 5, { align: 'center' })
  if (signatureLocataire) {
    doc.addImage(signatureLocataire, 'PNG', 130, ySig - 25, 50, 22)
  } else {
    doc.text('(en attente de signature électronique)', 155, ySig + 9, { align: 'center' })
  }

  // Mention légale en bas
  doc.setFontSize(7)
  doc.setTextColor(120, 120, 120)
  doc.setFont('helvetica', 'italic')
  const mentionLegale = 'Document émis par KENGE 14. Le présent décompte fait foi entre les parties après signature des deux. Toute contestation doit être notifiée par écrit dans les 15 jours suivant la remise du présent document.'
  const lignesMention = doc.splitTextToSize(mentionLegale, 180)
  doc.text(lignesMention, 105, pageHeight - 15, { align: 'center' })

  // Numéro de page (footer)
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Page ${i} / ${totalPages}`, 195, pageHeight - 8, { align: 'right' })
  }

  return doc
}