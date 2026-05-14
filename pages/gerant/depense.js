import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import LayoutGerant from '../../components/LayoutGerant'
import { supabase, getProfilUtilisateur } from '../../lib/supabase'
import { formatDateFR } from '../../lib/dateUtils'

export default function DepenseGerant() {
  const router = useRouter()
  const [profil, setProfil] = useState(null)
  const [appartements, setAppartements] = useState([])
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSucces, setShowSucces] = useState(false)
  const [erreur, setErreur] = useState('')

  // === Formulaire ===
  const [categorie, setCategorie] = useState('Réparations')
  const [montant, setMontant] = useState('')
  const [dateDepense, setDateDepense] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [appartementId, setAppartementId] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    async function charger() {
      const { profil: prof } = await getProfilUtilisateur()
      setProfil(prof)

      const { data: apptsData } = await supabase
        .from('appartements')
        .select('id, nom')
        .order('nom')
      setAppartements(apptsData || [])
    }
    charger()
  }, [])

  function ouvrirConfirmation(e) {
    e.preventDefault()
    setErreur('')

    if (!montant || parseFloat(montant) <= 0) {
      setErreur('Le montant doit être supérieur à 0.')
      return
    }
    if (!description.trim()) {
      setErreur('La description est obligatoire.')
      return
    }
    setShowConfirm(true)
  }

  async function enregistrerDepense() {
    setLoading(true)
    setErreur('')

    const descriptionComplete = notes.trim()
      ? `${description.trim()} | Notes : ${notes.trim()}`
      : description.trim()

    const { error } = await supabase.from('depenses').insert({
      categorie: categorie,
      montant: parseFloat(montant),
      date_depense: dateDepense,
      description: descriptionComplete,
      appartement_id: appartementId || null,
      enregistre_par: profil?.id || null
    })

    setLoading(false)
    setShowConfirm(false)

    if (error) {
      setErreur('Erreur enregistrement : ' + error.message)
      return
    }

    // Réinitialiser le formulaire
    setCategorie('Réparations')
    setMontant('')
    setDateDepense(new Date().toISOString().split('T')[0])
    setDescription('')
    setAppartementId('')
    setNotes('')

    setShowSucces(true)
    setTimeout(() => setShowSucces(false), 5000)
  }

  return (
    <LayoutGerant activePage="depenses">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">📝 Mes Dépenses</h1>
          <p className="text-gray-600">Enregistrez ici les dépenses que vous effectuez pour KENGE14.</p>
        </div>

        {/* === Banner Succès === */}
        {showSucces && (
          <div className="bg-green-50 border-2 border-green-400 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <p className="font-bold text-green-800">Dépense enregistrée !</p>
              <p className="text-sm text-green-700">Le bailleur sera informé automatiquement.</p>
            </div>
          </div>
        )}

        {/* === Banner Erreur === */}
        {erreur && (
          <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-red-800 font-medium">{erreur}</p>
          </div>
        )}

        {/* === Formulaire === */}
        <form onSubmit={ouvrirConfirmation} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-amber-100 space-y-5">

          {/* Catégorie */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📂 Catégorie *
            </label>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none"
              required
            >
              <option value="Réparations">🔧 Réparations</option>
              <option value="Déplacement">🛵 Déplacement</option>
              <option value="Autres">📌 Autres</option>
            </select>
          </div>

          {/* Montant + Date côte à côte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                💵 Montant (USD) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Ex: 25"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                📅 Date de la dépense *
              </label>
              <input
                type="date"
                value={dateDepense}
                onChange={(e) => setDateDepense(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              📝 Description *
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Réparation robinet APT-2B"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          {/* Appartement (optionnel) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🏢 Appartement concerné <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <select
              value={appartementId}
              onChange={(e) => setAppartementId(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none"
            >
              <option value="">— Aucun appartement spécifique —</option>
              {appartements.map((a) => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
            </select>
          </div>

          {/* Notes (optionnel) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              💬 Notes <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Précisions complémentaires..."
              rows="3"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          {/* Bouton submit */}
          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl text-lg transition shadow-lg"
          >
            💾 Enregistrer la Dépense
          </button>
        </form>

        {/* === Modal de confirmation === */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">⚠️ Confirmer la dépense</h3>
              <div className="bg-amber-50 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <p><strong>Catégorie :</strong> {categorie}</p>
                <p><strong>Montant :</strong> <span className="text-amber-700 font-bold text-lg">{montant} USD</span></p>
                <p><strong>Date :</strong> {formatDateFR(dateDepense)}</p>
                <p><strong>Description :</strong> {description}</p>
                {appartementId && (
                  <p><strong>Appartement :</strong> {appartements.find(a => a.id === appartementId)?.nom}</p>
                )}
                {notes && <p><strong>Notes :</strong> {notes}</p>}
              </div>
              <p className="text-sm text-gray-600 mb-5">
                Une fois enregistrée, cette dépense apparaîtra dans la trésorerie du bailleur.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-xl transition"
                >
                  ✖️ Annuler
                </button>
                <button
                  onClick={enregistrerDepense}
                  disabled={loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : '✅ Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutGerant>
  )
}