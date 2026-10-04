// Charte graphique commune des documents PDF KENGE 14
// (contrat initial, avenant de renouvellement, et futurs documents)

export const CHARTE = {
  nom: 'KENGE 14',
  sousTitre: 'Gestion Locative  ·  Kinshasa, République Démocratique du Congo',
  telephone: '+1 817 353 8862',
  email: 'cesarokoma@gmail.com',
  VERT: [5, 122, 85],
  VERT_FONCE: [4, 78, 56],
  VERT_CLAIR: [168, 214, 190],
}

// En-tete de la premiere page : monogramme, nom, barre de coordonnees, bandes.
// Occupe le haut de la page jusqu'a 42 mm ; commencer le titre vers 57 mm.
export function enTetePremierePage(doc) {
  const { VERT, VERT_FONCE, VERT_CLAIR } = CHARTE

  // Bandes en biais paralleles (coin droit)
  doc.setFillColor(...VERT_CLAIR)
  doc.lines([[8, 0], [16, -28], [-8, 0]], 185, 42, [1, 1], 'F', true)
  doc.setFillColor(...VERT)
  doc.lines([[8, 0], [16, -28], [-8, 0]], 173, 42, [1, 1], 'F', true)

  // Monogramme K14 : cercle plein + filet interieur facon sceau
  doc.setFillColor(...VERT)
  doc.circle(31, 21, 11, 'F')
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.4)
  doc.circle(31, 21, 9.2, 'S')
  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bolditalic')
  doc.setFontSize(19)
  doc.text('K14', 31, 21, { align: 'center', baseline: 'middle' })

  // Nom (meme police que le monogramme) et sous-titre
  doc.setTextColor(...VERT_FONCE)
  doc.setFontSize(24)
  doc.text(CHARTE.nom, 47, 21)
  doc.setTextColor(90, 90, 90)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(CHARTE.sousTitre, 47, 28)

  // Filet fin + barre de coordonnees
  doc.setFillColor(...VERT_FONCE)
  doc.rect(0, 33.5, 170, 0.8, 'F')
  doc.rect(0, 36, 173, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.text(
    `Tél. / WhatsApp : ${CHARTE.telephone}     |     ${CHARTE.email}`,
    166, 40.2, { align: 'right' }
  )

  // Remise a zero pour la suite du document
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
}

// En-tete discret des pages suivantes : texte gris + filet fin.
// Commencer le contenu vers 35 mm.
export function enTetePageSuivante(doc, libelle, numero) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110, 110, 110)
  doc.text(`KENGE 14 GESTION LOCATIVE  ·  ${libelle}`, 20, 14)
  if (numero) doc.text(`N° ${numero}`, 190, 14, { align: 'right' })
  doc.setDrawColor(160, 160, 160)
  doc.setLineWidth(0.2)
  doc.line(20, 17, 190, 17)
  doc.setTextColor(0, 0, 0)
}

// Pied de page de toutes les pages : paraphes, pagination, authentification.
// A appeler une seule fois, juste avant "return doc". Garder le contenu au-dessus de 280 mm.
export function piedDePage(doc, idDocument) {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(160, 160, 160)
    doc.setLineWidth(0.2)
    doc.line(20, 283, 190, 283)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)
    doc.text('Paraphes :   Bailleur ________     Preneur ________', 20, 287.5)
    doc.text(`Page ${i} / ${totalPages}`, 190, 287.5, { align: 'right' })

    doc.setFontSize(6.5)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Document généré électroniquement par KENGE 14 Gestion Locative  ·  ID : ${idDocument || 'N/A'}`,
      105, 292, { align: 'center' }
    )
  }
  doc.setTextColor(0, 0, 0)
}
