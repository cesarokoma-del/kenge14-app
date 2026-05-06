import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'
import SignatureCanvas from '../../components/SignatureCanvas'
import { getRenouvellementParLien, sauvegarderSignature } from '../../lib/supabase'

export default function PageSignature() {
  const router = useRouter()
  const { id } = router.query
  const canvasRef = useRef(null)

  const [renouvellement, setRenouvellement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nomSignataire, setNomSignataire] = useState('')
  const [accepte, setAccepte] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (id) {
      chargerRenouvellement()
    }
  }, [id])

  async function chargerRenouvellement() {
    setLoading(true)
    const { data, error } = await getRenouvellementParLien(id)

    if (error || !data) {
      setError('Renouvellement introuvable')
      setLoading(false)
      return
    }

    setRenouvellement(data)
    setLoading(false)
  }

  async function validerSignature(e) {
    e.preventDefault()

    if (!nomSignataire.trim()) {
      alert('❌ Veuillez entrer votre nom complet')
      return
    }

    if (!accepte) {
      alert('❌ Veuillez accepter les termes du renouvellement')
      return
    }

    if (!hasSignature) {
      alert('❌ Veuillez signer dans la zone prévue')
      return
    }

    setSubmitting(true)

    // Récupérer la signature
    const signatureData = canvasRef.current.getSignatureData()

    // Sauvegarder
    const { error } = await sauvegarderSignature(
      renouvellement.id,
      nomSignataire,
      signatureData
    )

    if (error) {
      alert('❌ Erreur lors de la sauvegarde de la signature')
      setSubmitting(false)
      return
    }

    setSuccess(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-emerald-600 text-xl">Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Erreur</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-green-50 border-2 border-green-200 rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">Contrat Signé !</h2>
          <p className="text-green-700 mb-4">
            Votre signature a été enregistrée avec succès.
          </p>
          <p className="text-sm text-green-600">Le propriétaire a été notifié.</p>
        </div>
      </div>
    )
  }

  const contrat = renouvellement.contrat

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🔄 Renouvellement de Bail
          </h1>
          <p className="text-gray-600">KENGE 14 - Gestion Locative</p>
        </div>

        {/* Contrat */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            📄 Votre Contrat de Renouvellement
          </h2>
          <div className="space-y-3 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Appartement :</span>
              <span className="font-bold text-gray-900">
                {contrat?.appartement?.nom || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Locataire :</span>
              <span className="font-bold text-gray-900">
                {contrat?.locataire?.noms_complet || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Loyer mensuel :</span>
              <span className="font-bold text-emerald-700">
                {contrat?.loyer || 'N/A'} USD
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Durée :</span>
              <span className="font-bold text-gray-900">12 mois</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-700">Date de début :</span>
              <span className="font-bold text-gray-900">
                {contrat?.date_fin
                  ? new Date(contrat.date_fin).toLocaleDateString('fr-FR')
                  : 'N/A'}
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-emerald-200">
              <p className="text-sm text-gray-600">
                ✅ Loyer inchangé ({contrat?.loyer} USD)
                <br />
                ✅ Mêmes conditions que le contrat actuel
                <br />
                ✅ Tacite reconduction
                <br />✅ Préavis de 90 jours
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire de signature */}
        <form onSubmit={validerSignature} className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">✍️ Signez ici</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Votre nom complet *
            </label>
            <input
              type="text"
              value={nomSignataire}
              onChange={(e) => setNomSignataire(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
              placeholder="Ex: Mme Ndimina Kyembe Adel"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Signature tactile *
            </label>
            <p className="text-sm text-gray-600 mb-2">
              Signez avec votre doigt ou votre souris dans la zone ci-dessous
            </p>
            <SignatureCanvas
              ref={canvasRef}
              onSignatureChange={setHasSignature}
            />
          </div>

          <div className="mt-6">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={accepte}
                onChange={(e) => setAccepte(e.target.checked)}
                className="mt-1"
                required
              />
              <span className="text-sm text-gray-700">
                J'accepte les termes du renouvellement de bail pour 12 mois supplémentaires
                aux mêmes conditions (loyer inchangé). Je comprends que ce contrat prendra
                effet à la fin du contrat actuel.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-6 px-6 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '⏳ Envoi en cours...' : '✅ Signer et Envoyer'}
          </button>
        </form>
      </div>
    </div>
  )
}
