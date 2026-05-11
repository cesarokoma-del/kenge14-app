// components/JournalAudit.js
import { useState, useEffect } from 'react'
import {
  getEvenementsAudit,
  getUtilisateursAudit,
  resumerEvenement,
  telechargerCSV,
  LIBELLES_TABLES,
  LIBELLES_OPERATIONS,
  COULEURS_OPERATIONS,
} from '../lib/auditLog'

export default function JournalAudit() {
  const [ouvert, setOuvert] = useState(false)
  const [evenements, setEvenements] = useState([])
  const [utilisateurs, setUtilisateurs] = useState([])
  const [chargement, setChargement] = useState(false)
  const [details, setDetails] = useState(null)

  // Filtres
  const [filtreTable, setFiltreTable] = useState('')
  const [filtreOperation, setFiltreOperation] = useState('')
  const [filtreUtilisateur, setFiltreUtilisateur] = useState('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')

  // Charger utilisateurs au premier dépliage
  useEffect(() => {
    if (ouvert && utilisateurs.length === 0) {
      getUtilisateursAudit().then(setUtilisateurs)
    }
  }, [ouvert])

  // Recharger événements quand filtres ou dépliage changent
  useEffect(() => {
    if (!ouvert) return
    setChargement(true)
    getEvenementsAudit({
      table: filtreTable || null,
      operation: filtreOperation || null,
      userEmail: filtreUtilisateur || null,
      dateDebut: filtreDateDebut || null,
      dateFin: filtreDateFin || null,
      limite: 200,
    }).then(({ data }) => {
      setEvenements(data)
      setChargement(false)
    })
  }, [ouvert, filtreTable, filtreOperation, filtreUtilisateur, filtreDateDebut, filtreDateFin])

  function reinitialiserFiltres() {
    setFiltreTable('')
    setFiltreOperation('')
    setFiltreUtilisateur('')
    setFiltreDateDebut('')
    setFiltreDateFin('')
  }

  function exporter() {
    if (evenements.length === 0) {
      alert('Aucun événement à exporter.')
      return
    }
    const date = new Date().toISOString().split('T')[0]
    telechargerCSV(evenements, `audit-kenge14-${date}.csv`)
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mt-6">
      {/* Header cliquable */}
      <button
        onClick={() => setOuvert(!ouvert)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📜</span>
          <div className="text-left">
            <h2 className="text-xl font-bold text-gray-800">Journal d'audit</h2>
            <p className="text-sm text-gray-500">
              Historique des actions sur les données sensibles
            </p>
          </div>
        </div>
        <span className={`text-xl text-gray-400 transition-transform ${ouvert ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Contenu déplié */}
      {ouvert && (
        <div className="border-t border-gray-200 p-6">
          {/* Filtres */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Table</label>
              <select
                value={filtreTable}
                onChange={(e) => setFiltreTable(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Toutes</option>
                {Object.entries(LIBELLES_TABLES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Action</label>
              <select
                value={filtreOperation}
                onChange={(e) => setFiltreOperation(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Toutes</option>
                {Object.entries(LIBELLES_OPERATIONS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Utilisateur</label>
              <select
                value={filtreUtilisateur}
                onChange={(e) => setFiltreUtilisateur(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Tous</option>
                {utilisateurs.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Du</label>
              <input
                type="date"
                value={filtreDateDebut}
                onChange={(e) => setFiltreDateDebut(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Au</label>
              <input
                type="date"
                value={filtreDateFin}
                onChange={(e) => setFiltreDateFin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Barre actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-600">
              {chargement ? 'Chargement...' : `${evenements.length} événement(s)`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reinitialiserFiltres}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Réinitialiser
              </button>
              <button
                onClick={exporter}
                disabled={evenements.length === 0}
                className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                📥 Exporter CSV
              </button>
            </div>
          </div>

          {/* Tableau */}
          {chargement ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : evenements.length === 0 ? (
            <div className="text-center py-8 text-gray-500 italic">
              Aucun événement ne correspond aux filtres.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Date & heure</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Utilisateur</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Action</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Détails</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {evenements.map((evt) => (
                    <tr key={evt.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(evt.cree_le).toLocaleString('fr-FR')}
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <div className="text-gray-800">{evt.user_email || 'Système'}</div>
                        <div className="text-gray-400 capitalize">{evt.user_role || '—'}</div>
                      </td>
                      <td className="py-2 px-3 text-xs">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${COULEURS_OPERATIONS[evt.operation] || ''}`}>
                          {LIBELLES_OPERATIONS[evt.operation]}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-700">
                        {resumerEvenement(evt)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => setDetails(evt)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal détails */}
      {details && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setDetails(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-gray-800">Détails de l'événement</h3>
              <button
                onClick={() => setDetails(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div><span className="font-semibold text-gray-600">ID :</span> <span className="font-mono text-xs">{details.id}</span></div>
              <div><span className="font-semibold text-gray-600">Date :</span> {new Date(details.cree_le).toLocaleString('fr-FR')}</div>
              <div><span className="font-semibold text-gray-600">Utilisateur :</span> {details.user_email || '—'} ({details.user_role || '—'})</div>
              <div><span className="font-semibold text-gray-600">Action :</span> {LIBELLES_OPERATIONS[details.operation]} {LIBELLES_TABLES[details.table_name]?.toLowerCase()}</div>
              <div><span className="font-semibold text-gray-600">ID enregistrement :</span> <span className="font-mono text-xs">{details.record_id || '—'}</span></div>

              {details.changed_fields?.length > 0 && (
                <div>
                  <span className="font-semibold text-gray-600">Champs modifiés :</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {details.changed_fields.map((f) => (
                      <span key={f} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {details.old_data && (
                <div>
                  <div className="font-semibold text-gray-600 mb-1">Avant :</div>
                  <pre className="bg-red-50 border border-red-200 rounded p-3 text-xs overflow-x-auto">{JSON.stringify(details.old_data, null, 2)}</pre>
                </div>
              )}

              {details.new_data && (
                <div>
                  <div className="font-semibold text-gray-600 mb-1">Après :</div>
                  <pre className="bg-green-50 border border-green-200 rounded p-3 text-xs overflow-x-auto">{JSON.stringify(details.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}