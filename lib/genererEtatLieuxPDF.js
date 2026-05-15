// lib/genererEtatLieuxPDF.js
// PDF officiel d'un état des lieux (entrée ou sortie) — KENGE 14
// Conforme au style des autres PDFs (bail, décompte, accord résiliation)
// Contient: parties + état par pièce avec photos + signatures + validation bailleur
import { jsPDF } from 'jspdf'
import { formatDateFR, formatDateFRLong, formatDateHeureFR } from './dateUtils'

/**
 * Génère un PDF d'état des lieux.
 *
 * @param {Object} donnees
 * @param {Object} donnees.contrat        Contrat avec locataire + appartement
 * @param {Object} donnees.etatLieux      Objet etats_lieux + pieces + profils
 * @param {Object} donnees.parametres     Infos bailleur (nom, adresse, contact)
 *
 * @returns {Promise<jsPDF>} Document jsPDF prêt à .save() ou .output()
 */
export async function genererEtatLieuxPDF({ contrat, etatLieux, parametres = {} }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20

  // Infos bailleur
  const nomBailleur = parametres?.nom_bailleur || 'M. Cesar OKOMA'
  const adresseBailleur = parametres?.adresse_bailleur || 'n° 15, Avenue de la Science, Commune de la Gombe, Kinshasa'

  // Type + couleurs
  const estEntree = etatLieux.type === 'entree'
  const titreType = estEntree ? "D'ENTRÉE" : 'DE SORTIE'

  // Numéro de référence
  const numeroEtat = `KENGE14-ETAT-${(etatLieux.id || '').toString().slice(-8).toUpperCase()}`

  // ============================================================
  // En-tête : KENGE 14 (bandeau vert)
  // ============================================================
  doc.setFillColor(5, 150, 105) // emerald-600
  doc.rect(0, 0, pageWidth, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('KENGE 14', margin, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Gestion Locative Professionnelle - Kinshasa, RDC', margin, 20)
  doc.text(adresseBailleur, margin, 26)

  // ============================================================
  // Titre du document
  // ============================================================
  doc.setTextColor(31, 41, 55) // gray-800
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(`ÉTAT DES LIEUX ${titreType}`, pageWidth / 2, 48, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128) // gray-500
  doc.text(`N° ${numeroEtat}`, pageWidth / 2, 56, { align: 'center' })
  doc.text(`Réalisé le ${formatDateFRLong(etatLieux.date_realisation)}`, pageWidth / 2, 62, { align: 'center' })

  let y = 72

  // ============================================================
  // Encadré parties
  // ============================================================
  doc.setDrawColor(229, 231, 235) // gray-200
  doc.setFillColor(249, 250, 251) // gray-50
  doc.roundedRect(margin, y, pageWidth - 2 * margin, 32, 3, 3, 'FD')

  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Entre les parties :', margin + 4, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Le BAILLEUR : ${nomBailleur}`, margin + 4, y + 13)
  doc.text(`Le LOCATAIRE : ${contrat.locataire?.noms_complet || 'N/A'}`, margin + 4, y + 19)
  doc.text(`Téléphone : ${contrat.locataire?.telephone || 'N/A'}`, margin + 4, y + 25)
  doc.text(`Appartement : ${contrat.appartement?.nom || 'N/A'}`, pageWidth - margin - 60, y + 25)

  y += 40

  // ============================================================
  // Section : État par pièce
  // ============================================================
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('ÉTAT PAR PIÈCE', margin, y)

  // Ligne de séparation
  doc.setDrawColor(5, 150, 105)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, margin + 50, y + 2)
  doc.setLineWidth(0.2)

  y += 10

  const pieces = (etatLieux.pieces || []).sort((a, b) => a.ordre - b.ordre)

  for (const piece of pieces) {
    // Vérifier l'espace restant (besoin ~15mm minimum pour l'en-tête de la pièce)
    if (y > pageHeight - 30) {
      doc.addPage()
      y = margin
    }

    // Couleur du statut
    const couleursStatut = {
      bon: { r: 22, g: 163, b: 74, txt: '🟢 Bon' },           // green-600
      moyen: { r: 217, g: 119, b: 6, txt: '🟡 Moyen' },        // amber-600
      mauvais: { r: 220, g: 38, b: 38, txt: '🔴 Mauvais' },    // red-600
    }
    const cfg = couleursStatut[piece.etat] || { r: 107, g: 114, b: 128, txt: piece.etat }

    // Nom de la pièce
    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`• ${piece.nom_piece}`, margin, y)

    // Badge état (sans emoji pour jsPDF qui ne les rend pas bien)
    const txtStatut = piece.etat.charAt(0).toUpperCase() + piece.etat.slice(1)
    doc.setTextColor(cfg.r, cfg.g, cfg.b)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(txtStatut, pageWidth - margin, y, { align: 'right' })

    y += 6

    // Remarque
    if (piece.remarque) {
      doc.setTextColor(107, 114, 128)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      const remarqueLignes = doc.splitTextToSize(`Remarque : "${piece.remarque}"`, pageWidth - 2 * margin - 5)
      doc.text(remarqueLignes, margin + 5, y)
      y += remarqueLignes.length * 4
    }

    // Photo si présente
    if (piece.photo_url) {
      try {
        // Vérifier l'espace pour la photo (besoin ~70mm)
        if (y > pageHeight - 75) {
          doc.addPage()
          y = margin
        }

        // Charger la photo
        const imageData = await chargerImageEnBase64(piece.photo_url)
        if (imageData) {
          const photoMaxWidth = 80
          const photoMaxHeight = 60
          // Centrer la photo
          const photoX = margin + 5
          doc.addImage(imageData, 'JPEG', photoX, y + 2, photoMaxWidth, photoMaxHeight, undefined, 'MEDIUM')
          y += photoMaxHeight + 6
        }
      } catch (err) {
        // Si erreur de chargement de la photo, on continue sans
        console.warn('Impossible de charger la photo:', piece.photo_url, err)
        doc.setTextColor(156, 163, 175)
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('[Photo non chargée]', margin + 5, y)
        y += 5
      }
    }

    y += 5 // Espacement entre pièces
  }

  // ============================================================
  // Section : Remarques générales
  // ============================================================
  if (etatLieux.remarques_generales) {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = margin
    }

    doc.setTextColor(31, 41, 55)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('REMARQUES GÉNÉRALES', margin, y)
    doc.setDrawColor(5, 150, 105)
    doc.setLineWidth(0.5)
    doc.line(margin, y + 2, margin + 70, y + 2)
    doc.setLineWidth(0.2)
    y += 10

    doc.setTextColor(55, 65, 81) // gray-700
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lignes = doc.splitTextToSize(etatLieux.remarques_generales, pageWidth - 2 * margin)
    doc.text(lignes, margin, y)
    y += lignes.length * 5 + 5
  }

  // ============================================================
  // Section : Signatures
  // ============================================================
  // Réserver au moins 60mm pour les signatures
  if (y > pageHeight - 70) {
    doc.addPage()
    y = margin
  }

  y += 5
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('SIGNATURES', margin, y)
  doc.setDrawColor(5, 150, 105)
  doc.setLineWidth(0.5)
  doc.line(margin, y + 2, margin + 35, y + 2)
  doc.setLineWidth(0.2)
  y += 10

  // 2 colonnes : réalisateur (gauche) et locataire (droite)
  const colWidth = (pageWidth - 2 * margin - 10) / 2
  const colGauche = margin
  const colDroite = margin + colWidth + 10
  const sigY = y

  // Labels
  doc.setTextColor(107, 114, 128)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Le réalisateur', colGauche, sigY)
  doc.text('Le locataire', colDroite, sigY)

  // Cadres
  doc.setDrawColor(229, 231, 235)
  doc.rect(colGauche, sigY + 3, colWidth, 30)
  doc.rect(colDroite, sigY + 3, colWidth, 30)

  // Images de signature
  if (etatLieux.signature_realisateur) {
    try {
      doc.addImage(etatLieux.signature_realisateur, 'PNG', colGauche + 5, sigY + 5, colWidth - 10, 26)
    } catch (e) { /* ignore */ }
  }
  if (etatLieux.signature_locataire) {
    try {
      doc.addImage(etatLieux.signature_locataire, 'PNG', colDroite + 5, sigY + 5, colWidth - 10, 26)
    } catch (e) { /* ignore */ }
  }

  // Noms + dates sous les signatures
  y = sigY + 38
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(etatLieux.realise_par_profil?.nom_complet || nomBailleur, colGauche, y)
  doc.text(contrat.locataire?.noms_complet || 'N/A', colDroite, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(107, 114, 128)
  if (etatLieux.date_signature_realisateur) {
    doc.text(`Signé le ${formatDateHeureFR(etatLieux.date_signature_realisateur)}`, colGauche, y + 5)
  }
  if (etatLieux.date_signature_locataire) {
    doc.text(`Signé le ${formatDateHeureFR(etatLieux.date_signature_locataire)}`, colDroite, y + 5)
  }

  y += 14

  // Validation bailleur si présente
  if (etatLieux.statut === 'valide_bailleur' && etatLieux.date_validation_bailleur) {
    doc.setDrawColor(5, 150, 105)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6
    doc.setTextColor(5, 150, 105)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Validé par le bailleur le ${formatDateHeureFR(etatLieux.date_validation_bailleur)}`, margin, y)
    if (etatLieux.valide_par_profil?.nom_complet) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(etatLieux.valide_par_profil.nom_complet, margin, y + 5)
    }
  }

  // ============================================================
  // Pied de page sur toutes les pages
  // ============================================================
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setTextColor(156, 163, 175)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text(
      `Document généré électroniquement par l'application KENGE 14. Les signatures électroniques apposées ont valeur d'engagement contractuel.`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center', maxWidth: pageWidth - 2 * margin }
    )
    doc.text(`Page ${i}/${totalPages} — ${numeroEtat}`, pageWidth / 2, pageHeight - 6, { align: 'center' })
  }

  return doc
}

/**
 * Charge une image depuis une URL et la convertit en base64 pour jsPDF.
 * @param {string} url URL publique de l'image
 * @returns {Promise<string|null>} data:image/jpeg;base64,... ou null si erreur
 */
async function chargerImageEnBase64(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('Erreur chargement image:', err)
    return null
  }
}