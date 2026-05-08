import { useEffect, useState, useRef } from 'react'
import Layout from '../components/Layout'
import SignatureCanvas from '../components/SignatureCanvas'
import { getSignatureBailleur, setSignatureBailleur } from '../lib/supabase'

export default function Parametres() {
  const [signatureActuelle, setSignatureActuelle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modeEdition, setModeEdition] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    chargerSignature()
  }, [])

  async function chargerSignature() {
    setLoading(true)
    const { signature } = await getSignatureBailleur()
    setSignatureActuelle(signature)
    setLoading(false)
  }

  async function enregistrerSignature() {
    if (!canvasRef.current?.hasSignature()) {
      alert('⚠️ Veuillez d\'abord signer dans la zone prévue à cet effet.')
      return
    }

    setSaving(true)
    const signatureData = canvasRef.current.getSignatureData()
    
    const { error } = await setSignatureBailleur(signatureData)
    
    if (error) {
      alert('❌ Erreur : ' + error.message)
      setSaving(false)
      return
    }

    setSignatureActuelle(signatureData)
    setModeEdition(false)
    setSaving(false)
    alert('✅ Votre signature a été enregistrée avec succès !')
  }

  function commencerEdition() {
    setModeEdition(true)
  }

  function annulerEdition() {
    setModeEdition(false)
    if (canvasRef.current) {
      canvasRef.current.clear()
    }
  }

  if (loading) {
    return (
      <Layout activePage="parametres">
        <div className="flex justify-center items-center h-64">
          <div className="text-emerald-600 text-xl">Chargement...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activePage="parametres">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">⚙️ Paramètres</h1>

        {/* Section Signature Bailleur */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ✍️ Ma signature électronique
          </h2>
          <p className="text-gray-600 mb-6">
            Cette signature sera utilisée pour signer les contrats de bail initial en tant que bailleur (M. Cesar OKOMA).
            Vous pouvez la modifier à tout moment.
          </p>

          {/* Affichage de la signature actuelle */}
          {!modeEdition && signatureActuelle && (
            <div className="border-2 border-gray-200 rounded-lg p-6 mb-4 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700 mb-3">
                ✅ Signature actuelle enregistrée :
              </p>
              <div className="bg-white p-4 rounded border border-gray-200 inline-block">
                <img 
                  src={signatureActuelle} 
                  alt="Signature actuelle" 
                  className="max-h-32"
                />
              </div>
            </div>
          )}

          {/* Message si pas de signature */}
          {!modeEdition && !signatureActuelle && (
            <div className="border-2 border-dashed border-orange-300 rounded-lg p-8 mb-4 bg-orange-50 text-center">
              <p className="text-orange-800 font-semibold text-lg mb-2">
                ⚠️ Aucune signature enregistrée
              </p>
              <p className="text-orange-700 text-sm">
                Cliquez sur "Créer ma signature" ci-dessous pour commencer.
              </p>
            </div>
          )}

          {/* Mode édition */}
          {modeEdition && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Astuce :</strong> Sur mobile/tablette, signez avec votre doigt. Sur ordinateur, utilisez la souris.
                  Faites une signature claire et reproductible.
                </p>
              </div>

              <SignatureCanvas ref={canvasRef} />

              <div className="flex gap-3">
                <button
                  onClick={enregistrerSignature}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {saving ? '⏳ Enregistrement...' : '💾 Enregistrer ma signature'}
                </button>
                <button
                  onClick={annulerEdition}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Bouton modifier (si pas en mode édition) */}
          {!modeEdition && (
            <button
              onClick={commencerEdition}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              {signatureActuelle ? '✏️ Modifier ma signature' : '✍️ Créer ma signature'}
            </button>
          )}
        </div>

        {/* Section informations bailleur (lecture seule) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            👤 Informations Bailleur
          </h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>Nom :</strong> M. Cesar OKOMA</p>
            <p><strong>Adresse :</strong> n° 15, Avenue de la Science, Commune de la Gombe, Kinshasa</p>
            <p><strong>WhatsApp :</strong> +1 817 353 8862</p>
            <p><strong>Compte bancaire :</strong> Equity-BCDC n° 233200011755382</p>
          </div>
          <p className="text-xs text-gray-500 mt-4 italic">
            Ces informations sont utilisées dans tous les contrats générés.
          </p>
        </div>
      </div>
    </Layout>
  )
}