import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from './supabase'
import { listerStockActuel, getInfoCategorie } from './inventaire'
import { formatDateFRLong } from './dateUtils'

/**
 * Génère un PDF de l'état du stock à un instant T.
 * Items actifs uniquement, regroupés par catégorie, avec totaux.
 */
export async function genererInventairePDF() {
  try {
    // 1. Charger les paramètres bailleur
    const { data: paramsData } = await supabase
      .from('parametres')
      .select('cle, valeur')

    const params = {}
    ;(paramsData || []).forEach(p => { params[p.cle] = p.valeur })

    const nomBailleur = params.nom_bailleur || 'Cesar Okoma'
    const adresse = params.adresse_propriete || 'KENGE 14, Kinshasa, RDC'
    const signatureBase64 = params.signature_bailleur || null

    // 2. Charger les items actifs avec stock
    const { data: items, error: errItems } = await listerStockActuel({ inclureInactifs: false })
    if (errItems) return { success: false, error: errItems.message }

    // 3. Regrouper par catégorie
    const parCategorie = {}
    items.forEach(item => {
      const cat = item.categorie || 'autre'
      if (!parCategorie[cat]) parCategorie[cat] = []
      parCategorie[cat].push(item)
    })

    const ordreCategories = ['outil', 'consommable', 'bien_appartement', 'autre']

    // 4. Initialiser le PDF
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const dateGeneration = new Date()

    // EN-TÊTE
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('INVENTAIRE KENGE 14', pageWidth / 2, 20, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Proprietaire : ${nomBailleur}`, 14, 32)
    doc.text(`Adresse : ${adresse}`, 14, 38)
    doc.text(`Etat au ${formatDateFRLong(dateGeneration.toISOString().split('T')[0])}`, 14, 44)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(
      `Document genere le ${dateGeneration.toLocaleDateString('fr-FR')} a ${dateGeneration.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      14, 50
    )
    doc.setTextColor(0)

    doc.setLineWidth(0.5)
    doc.line(14, 54, pageWidth - 14, 54)

    let cursorY = 62
    let totalGlobalItems = 0
    let totalGlobalValeur = 0
    let totalGlobalStockBas = 0

    // 5. Tableaux par catégorie
    ordreCategories.forEach(catKey => {
      const itemsCat = parCategorie[catKey]
      if (!itemsCat || itemsCat.length === 0) return

      const catInfo = getInfoCategorie(catKey)

      if (cursorY > 240) {
        doc.addPage()
        cursorY = 20
      }

      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 100, 60)
      doc.text(catInfo.label, 14, cursorY)
      doc.setTextColor(0)
      cursorY += 4

      const rows = itemsCat.map(item => {
        const stockActuel = Number(item.stock_actuel) || 0
        const seuil = item.seuil_alerte != null ? Number(item.seuil_alerte) : null
        const prixUnit = item.prix_unitaire_usd != null ? Number(item.prix_unitaire_usd) : null
        const valeur = prixUnit != null ? stockActuel * prixUnit : null
        const enAlerte = seuil != null && stockActuel <= seuil

        if (enAlerte) totalGlobalStockBas++
        if (valeur != null) totalGlobalValeur += valeur

        return [
          item.nom + (enAlerte ? ' (!)' : ''),
          stockActuel.toString(),
          item.unite || '-',
          seuil != null ? seuil.toString() : '-',
          prixUnit != null ? `$${prixUnit.toFixed(2)}` : '-',
          valeur != null ? `$${valeur.toFixed(2)}` : '-',
        ]
      })

      const sousTotalValeur = itemsCat.reduce((sum, i) => {
        if (i.prix_unitaire_usd != null && i.stock_actuel != null) {
          return sum + (Number(i.prix_unitaire_usd) * Number(i.stock_actuel))
        }
        return sum
      }, 0)

      autoTable(doc, {
        startY: cursorY,
        head: [['Nom', 'Stock', 'Unite', 'Seuil', 'Prix unit.', 'Valeur']],
        body: rows,
        foot: [['', '', '', '', 'Sous-total', `$${sousTotalValeur.toFixed(2)}`]],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 10 },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 20, halign: 'right' },
          2: { cellWidth: 20 },
          3: { cellWidth: 20, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 28, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
      })

      cursorY = doc.lastAutoTable.finalY + 10
      totalGlobalItems += itemsCat.length
    })

    // 6. Récapitulatif
    if (cursorY > 230) {
      doc.addPage()
      cursorY = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('RECAPITULATIF', 14, cursorY)
    cursorY += 6

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Nombre total d'items : ${totalGlobalItems}`, 14, cursorY)
    cursorY += 5
    doc.text(`Valeur totale du stock : $${totalGlobalValeur.toFixed(2)} USD`, 14, cursorY)
    cursorY += 5
    if (totalGlobalStockBas > 0) {
      doc.setTextColor(180, 100, 0)
      doc.text(`Items en stock bas : ${totalGlobalStockBas}`, 14, cursorY)
      doc.setTextColor(0)
      cursorY += 5
    }

    // 7. Signature
    cursorY += 15
    if (cursorY > 240) {
      doc.addPage()
      cursorY = 20
    }

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Signature du proprietaire :', 14, cursorY)
    cursorY += 5

    if (signatureBase64) {
      try {
        doc.addImage(signatureBase64, 'PNG', 14, cursorY, 50, 25)
      } catch (e) {
        doc.text('(signature non chargee)', 14, cursorY + 10)
      }
    } else {
      doc.setLineWidth(0.3)
      doc.line(14, cursorY + 20, 70, cursorY + 20)
    }

    doc.text(nomBailleur, 14, cursorY + 35)
    doc.setFontSize(9)
    doc.text(`Date : ${dateGeneration.toLocaleDateString('fr-FR')}`, 14, cursorY + 40)

    // 8. Pied de page
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(
        `KENGE 14 - Inventaire - Page ${i} / ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
      doc.setTextColor(0)
    }

    // 9. Téléchargement
    const nomFichier = `Inventaire-KENGE14-${dateGeneration.toISOString().split('T')[0]}.pdf`
    doc.save(nomFichier)

    return { success: true }
  } catch (error) {
    console.error('Erreur generation PDF inventaire:', error)
    return { success: false, error: error.message }
  }
}