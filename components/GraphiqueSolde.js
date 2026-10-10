// Petite courbe SVG d'evolution du solde d'epargne, sans dependance.
// mouvements : tries du plus recent au plus ancien (comme getMouvementsEpargne)
// soldeActuel : compte.solde (la courbe se termine exactement dessus)
import { formatDateFR } from '../lib/dateUtils'

const SIGNE = { depot: 1, retrait_retour: -1, retrait_depense: -1 }

export default function GraphiqueSolde({ mouvements, soldeActuel }) {
  if (mouvements.length < 2) return null

  // Reconstitution du solde apres chaque mouvement, en remontant depuis le solde actuel
  const chrono = [...mouvements].reverse()
  let solde = Number(soldeActuel)
  const soldes = new Array(chrono.length)
  for (let i = chrono.length - 1; i >= 0; i--) {
    soldes[i] = solde
    solde -= (SIGNE[chrono[i].type] || 0) * Number(chrono[i].montant)
  }
  const points = [{ date: chrono[0].date_mouvement, solde }]
    .concat(chrono.map((m, i) => ({ date: m.date_mouvement, solde: soldes[i] })))

  const W = 320, H = 140, PG = 10, PH = 24, PB = 22
  const max = Math.max(...points.map(p => p.solde), 0)
  const min = Math.min(...points.map(p => p.solde), 0)
  const plage = max - min || 1
  const x = i => PG + (i * (W - 2 * PG)) / (points.length - 1)
  const y = v => PH + ((max - v) * (H - PH - PB)) / plage

  const ligne = points.map((p, i) => `${x(i)},${y(p.solde)}`).join(' ')
  const zone = `${x(0)},${y(0)} ${ligne} ${x(points.length - 1)},${y(0)}`
  const dernier = points[points.length - 1]

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-bold text-gray-800">Évolution du solde</h2>
        <span className="text-xs text-gray-400">{points.length - 1} mouvements</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Évolution du solde">
        <line x1={PG} x2={W - PG} y1={y(0)} y2={y(0)} stroke="#d1d5db" strokeWidth="0.5" />
        <polygon points={zone} fill="#047857" fillOpacity="0.12" />
        <polyline points={ligne} fill="none" stroke="#047857" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.solde)} r="2.5" fill="#047857" />
        ))}
        <text x={x(points.length - 1)} y={y(dernier.solde) - 6} textAnchor="end" fontSize="9" fill="#047857" fontWeight="bold">
          {dernier.solde.toFixed(0)} USD
        </text>
        <text x={PG} y={H - 6} fontSize="8" fill="#9ca3af">{formatDateFR(points[0].date)}</text>
        <text x={W - PG} y={H - 6} fontSize="8" fill="#9ca3af" textAnchor="end">{formatDateFR(dernier.date)}</text>
      </svg>
    </div>
  )
}
