import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase, getComptesEpargne } from './supabase'
import { formatDateFR, formatDateFRLong } from './dateUtils'

// Les PDF de l'app evitent les accents (polices standard jsPDF)
const sansAccents = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/[→]/g, '->')

const LIBELLES = {
  depot: 'Depot',
  retrait_retour: 'Retrait - retour en banque',
  retrait_depense: 'Retrait - depense',
}

const usd = (n) => `${parseFloat(n || 0).toFixed(2)} USD`

/**
 * Releve d'un compte epargne enfant : tous les mouvements, du plus ancien
 * au plus recent, avec solde cumule apres chaque operation.
 */
export async function genererReleveEpargnePDF(compteId) {
  try {
    // 1. Parametres bailleur
    const { data: paramsData } = await supabase.from('parametres').select('cle, valeur')
    const params = {}
    ;(paramsData || []).forEach(p => { params[p.cle] = p.valeur })
    const nomBailleur = params.nom_bailleur || 'Cesar Okoma'
    const adresse = params.adresse_propriete || 'KENGE 14, Kinshasa, RDC'

    // 2. Compte + solde
    const { data: comptes, error: errC } = await getComptesEpargne()
    if (errC) return { success: false, error: errC.message }
    const compte = (comptes || []).find(c => c.id === compteId)
    if (!compte) return { success: false, error: 'Compte introuvable' }

    // 3. Mouvements, ordre chronologique
    const { data: mvts, error: errM } = await supabase
      .from('mouvements_epargne')
      .select('*')
      .eq('compte_id', compteId)
      .order('date_mouvement', { ascending: true })
      .order('created_at', { ascending: true })
    if (errM) return { success: false, error: errM.message }

    let solde = 0, totalDepots = 0, totalRetours = 0, totalDepenses = 0
    const lignes = (mvts || []).map(m => {
      const v = parseFloat(m.montant || 0)
      if (m.type === 'depot') { solde += v; totalDepots += v }
      else { solde -= v; if (m.type === 'retrait_retour') totalRetours += v; else totalDepenses += v }
      return [
        formatDateFR(m.date_mouvement),
        LIBELLES[m.type] || m.type,
        sansAccents(m.motif || '-'),
        m.type === 'depot' ? usd(v) : '',
        m.type === 'depot' ? '' : usd(v),
        usd(solde),
      ]
    })

    // 4. PDF
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const maintenant = new Date()

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('RELEVE DE COMPTE EPARGNE', pageWidth / 2, 20, { align: 'center' })
    doc.setFontSize(13)
    doc.text(sansAccents(compte.nom), pageWidth / 2, 28, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(sansAccents(`Titulaire du compte : ${nomBailleur}`), 14, 40)
    doc.text(sansAccents(`Adresse : ${adresse}`), 14, 46)
    doc.text(sansAccents(`Compte ouvert le ${formatDateFRLong(compte.date_ouverture)}`), 14, 52)
    doc.text(
      compte.statut === 'ferme'
        ? sansAccents(`Statut : ferme le ${formatDateFRLong(compte.date_fermeture)}`)
        : 'Statut : ouvert',
      14, 58
    )
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(
      `Document genere le ${maintenant.toLocaleDateString('fr-FR')} a ${maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      14, 64
    )
    doc.setTextColor(0)

    // Encadre recapitulatif
    doc.setDrawColor(200)
    doc.setFillColor(245, 247, 246)
    doc.roundedRect(14, 70, pageWidth - 28, 22, 2, 2, 'FD')
    doc.setFontSize(9)
    doc.setTextColor(90)
    const col = (pageWidth - 28) / 4
    ;[['Total depots', totalDepots], ['Retours en banque', totalRetours], ['Retraits', totalDepenses], ['Solde actuel', compte.solde]]
      .forEach(([label, v], i) => {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90)
        doc.text(label, 18 + i * col, 78)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(i === 3 ? 4 : 30, i === 3 ? 120 : 30, i === 3 ? 87 : 30)
        doc.setFontSize(12)
        doc.text(usd(v), 18 + i * col, 86)
        doc.setFontSize(9)
      })
    doc.setTextColor(0)

    // Tableau des mouvements
    if (lignes.length === 0) {
      doc.setFontSize(11)
      doc.setFont('helvetica', 'italic')
      doc.text('Aucun mouvement sur ce compte.', 14, 104)
    } else {
      autoTable(doc, {
        startY: 100,
        head: [['Date', 'Operation', 'Motif', 'Credit', 'Debit', 'Solde']],
        body: lignes,
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [4, 120, 87], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 44 },
          3: { halign: 'right', textColor: [4, 120, 87] },
          4: { halign: 'right', textColor: [185, 28, 28] },
          5: { halign: 'right', fontStyle: 'bold' },
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
      })
    }

    // Pied de page sur chaque page
    const nbPages = doc.internal.getNumberOfPages()
    for (let i = 1; i <= nbPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(130)
      doc.text(
        `KENGE 14 - Releve epargne ${sansAccents(compte.nom)} - page ${i}/${nbPages}`,
        pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' }
      )
    }

    const nomFichier = `releve-epargne-${sansAccents(compte.nom).toLowerCase()}-${maintenant.toISOString().slice(0, 10)}.pdf`
    doc.save(nomFichier)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
