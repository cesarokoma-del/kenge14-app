import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Users, DollarSign, FileText, Plus, Download, Edit2, Trash2, Check, X, Calendar, AlertCircle, TrendingUp, Home, Shield } from 'lucide-react';

const GestionLocativeKenge14 = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [appartements, setAppartements] = useState([]);
  const [locataires, setLocataires] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [devise, setDevise] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null);
  const [editData, setEditData] = useState(null);

  // Charger les données au démarrage
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [apptsRes, locatairesRes, paiementsRes, deviseRes] = await Promise.all([
        window.storage.get('appartements').catch(() => null),
        window.storage.get('locataires').catch(() => null),
        window.storage.get('paiements').catch(() => null),
        window.storage.get('devise').catch(() => null)
      ]);

      if (apptsRes?.value) {
        setAppartements(JSON.parse(apptsRes.value));
      } else {
        const initialAppts = [
          { id: '1', nom: 'APT-3RZ', loyer: 400, statut: 'loue', locataireId: '1' },
          { id: '2', nom: 'APT-1CAV', loyer: 400, statut: 'loue', locataireId: '2' },
          { id: '3', nom: 'APT-2A', loyer: 400, statut: 'loue', locataireId: '3' },
          { id: '4', nom: 'APT-2B', loyer: 400, statut: 'loue', locataireId: '4' },
          { id: '5', nom: 'APT-1ER', loyer: 400, statut: 'vacant', locataireId: null }
        ];
        setAppartements(initialAppts);
        await window.storage.set('appartements', JSON.stringify(initialAppts));
      }

      if (locatairesRes?.value) {
        setLocataires(JSON.parse(locatairesRes.value));
      } else {
        const initialLocataires = [
          { id: '1', nom: 'Mme Adel Ndimina', telephone: '0816 562 277', appartementId: '1', dateEntree: '2024-01-01', garantie: 800 },
          { id: '2', nom: 'M. Arnold Misiansu', telephone: '0822 842 682', appartementId: '2', dateEntree: '2024-01-01', garantie: 800 },
          { id: '3', nom: 'M. Daddy Yaya Buta', telephone: '0816 663 371', appartementId: '3', dateEntree: '2024-01-01', garantie: 800 },
          { id: '4', nom: 'Mme Elisabeth Masinga', telephone: '0815 205 183', appartementId: '4', dateEntree: '2024-01-01', garantie: 800 }
        ];
        setLocataires(initialLocataires);
        await window.storage.set('locataires', JSON.stringify(initialLocataires));
      }

      if (paiementsRes?.value) {
        setPaiements(JSON.parse(paiementsRes.value));
      }

      if (deviseRes?.value) {
        setDevise(deviseRes.value);
      }
    } catch (error) {
      console.error('Erreur chargement:', error);
    }
    setLoading(false);
  };

  // SYSTÈME CONGO: Calculer la date limite (fin du mois + 5 jours)
  const getDateLimite = (moisStr) => {
    const [annee, mois] = moisStr.split('-').map(Number);
    const dernierJour = new Date(annee, mois, 0);
    const dateLimite = new Date(dernierJour);
    dateLimite.setDate(dateLimite.getDate() + 5);
    return dateLimite;
  };

  // SYSTÈME CONGO: Obtenir le statut d'un mois pour un locataire
  const getStatutMois = (locataireId, moisStr) => {
    const aujourdhui = new Date();
    const dateLimite = getDateLimite(moisStr);
    const paiement = paiements.find(p => p.locataireId === locataireId && p.mois === moisStr);
    
    if (paiement) {
      return { statut: 'en_ordre', label: 'En ordre', color: 'green', date: paiement.date };
    }
    
    if (aujourdhui > dateLimite) {
      return { statut: 'en_retard', label: 'En retard', color: 'red', dateLimite };
    }
    
    return { statut: 'paiement_du', label: 'Paiement dû', color: 'yellow', dateLimite };
  };

  // Générer les N derniers mois
  const getDerniersMois = (nb = 6) => {
    const mois = [];
    const aujourdhui = new Date();
    for (let i = nb - 1; i >= 0; i--) {
      const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1);
      mois.push({
        str: d.toISOString().slice(0, 7),
        nom: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
      });
    }
    return mois;
  };

  // Calculer les statistiques avec système Congo
  const stats = useMemo(() => {
    const totalAppts = appartements.length;
    const loues = appartements.filter(a => a.statut === 'loue').length;
    const revenuTotal = appartements.filter(a => a.statut === 'loue').reduce((sum, a) => sum + a.loyer, 0);
    
    // Calculer les vrais retards (après le 5 du mois)
    const moisListe = getDerniersMois(12);
    let totalRetards = 0;
    let montantRetard = 0;
    
    locataires.forEach(loc => {
      const appt = appartements.find(a => a.id === loc.appartementId);
      if (!appt) return;
      
      moisListe.forEach(m => {
        const statut = getStatutMois(loc.id, m.str);
        if (statut.statut === 'en_retard') {
          totalRetards++;
          montantRetard += appt.loyer;
        }
      });
    });

    return { totalAppts, loues, revenuTotal, totalRetards, montantRetard };
  }, [appartements, locataires, paiements]);

  // Sauvegarder
  const saveAppartements = async (data) => {
    setAppartements(data);
    await window.storage.set('appartements', JSON.stringify(data));
  };

  const saveLocataires = async (data) => {
    setLocataires(data);
    await window.storage.set('locataires', JSON.stringify(data));
  };

  const savePaiements = async (data) => {
    setPaiements(data);
    await window.storage.set('paiements', JSON.stringify(data));
  };

  const saveDevise = async (newDevise) => {
    setDevise(newDevise);
    await window.storage.set('devise', newDevise);
  };

  // CRUD Appartements
  const ajouterAppartement = async (data) => {
    const newAppt = {
      id: Date.now().toString(),
      nom: data.nom,
      loyer: parseFloat(data.loyer),
      statut: data.statut,
      locataireId: data.locataireId || null
    };
    await saveAppartements([...appartements, newAppt]);
    setShowModal(null);
  };

  const modifierAppartement = async (data) => {
    const updated = appartements.map(a => 
      a.id === editData.id ? { ...a, ...data, loyer: parseFloat(data.loyer) } : a
    );
    await saveAppartements(updated);
    setShowModal(null);
    setEditData(null);
  };

  const supprimerAppartement = async (id) => {
    if (confirm('Supprimer cet appartement ?')) {
      await saveAppartements(appartements.filter(a => a.id !== id));
    }
  };

  // CRUD Locataires
  const ajouterLocataire = async (data) => {
    const newLoc = {
      id: Date.now().toString(),
      nom: data.nom,
      telephone: data.telephone,
      appartementId: data.appartementId,
      dateEntree: data.dateEntree,
      garantie: parseFloat(data.garantie) || 0
    };
    await saveLocataires([...locataires, newLoc]);
    setShowModal(null);
  };

  const modifierLocataire = async (data) => {
    const updated = locataires.map(l => 
      l.id === editData.id ? { ...l, ...data, garantie: parseFloat(data.garantie) || 0 } : l
    );
    await saveLocataires(updated);
    setShowModal(null);
    setEditData(null);
  };

  const supprimerLocataire = async (id) => {
    if (confirm('Supprimer ce locataire ?')) {
      await saveLocataires(locataires.filter(l => l.id !== id));
    }
  };

  // CRUD Paiements
  const ajouterPaiement = async (data) => {
    const newPaiement = {
      id: Date.now().toString(),
      locataireId: data.locataireId,
      appartementId: data.appartementId,
      montant: parseFloat(data.montant),
      date: data.date,
      mois: data.mois,
      notes: data.notes || ''
    };
    await savePaiements([...paiements, newPaiement]);
    setShowModal(null);
  };

  const supprimerPaiement = async (id) => {
    if (confirm('Supprimer ce paiement ?')) {
      await savePaiements(paiements.filter(p => p.id !== id));
    }
  };

  // Générer quittance
  const genererQuittance = (paiement) => {
    const locataire = locataires.find(l => l.id === paiement.locataireId);
    const appt = appartements.find(a => a.id === paiement.appartementId);
    
    const date = new Date(paiement.date);
    const moisAnnee = new Date(paiement.mois + '-01');
    const moisNom = moisAnnee.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const quittanceHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Quittance de Loyer - ${appt.nom}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    .header { text-align: center; border-bottom: 3px solid #2c5f2d; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2c5f2d; margin: 0; font-size: 28px; }
    .info-section { margin: 20px 0; }
    .info-section h2 { color: #2c5f2d; font-size: 18px; border-bottom: 2px solid #e0e0e0; padding-bottom: 5px; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .info-label { font-weight: bold; color: #555; }
    .total-section { background: #f8f9fa; padding: 20px; margin: 30px 0; border-left: 4px solid #2c5f2d; }
    .total-amount { font-size: 24px; font-weight: bold; color: #2c5f2d; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <h1>QUITTANCE DE LOYER</h1>
    <p>Immeuble KENGE 14</p>
    <p>14 Avenue Kenge KIN01, Kinshasa, RDC</p>
  </div>
  <div class="info-section">
    <h2>Informations du Locataire</h2>
    <div class="info-row"><span class="info-label">Nom :</span><span>${locataire.nom}</span></div>
    <div class="info-row"><span class="info-label">Téléphone :</span><span>${locataire.telephone}</span></div>
    <div class="info-row"><span class="info-label">Appartement :</span><span>${appt.nom}</span></div>
  </div>
  <div class="info-section">
    <h2>Détails du Paiement</h2>
    <div class="info-row"><span class="info-label">Période :</span><span>${moisNom}</span></div>
    <div class="info-row"><span class="info-label">Date de paiement :</span><span>${date.toLocaleDateString('fr-FR')}</span></div>
    <div class="info-row"><span class="info-label">Loyer mensuel :</span><span>${paiement.montant.toFixed(2)} ${devise}</span></div>
  </div>
  <div class="total-section">
    <div class="info-row" style="border: none;">
      <span class="info-label" style="font-size: 18px;">MONTANT TOTAL PAYÉ :</span>
      <span class="total-amount">${paiement.montant.toFixed(2)} ${devise}</span>
    </div>
  </div>
  <div style="margin: 30px 0; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107;">
    <strong>Pour solde de tout compte</strong> concernant le loyer de ${moisNom}.
  </div>
  <div style="margin-top: 50px; text-align: right;">
    <p>Fait à Kinshasa, le ${new Date().toLocaleDateString('fr-FR')}</p>
    <div style="margin-top: 60px; border-top: 1px solid #333; width: 200px; float: right; padding-top: 10px; text-align: center;">
      <p style="margin: 0;">Le Propriétaire</p>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([quittanceHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quittance_${appt.nom}_${paiement.mois}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-emerald-600">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Building2 className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-bold">KENGE 14</h1>
              <p className="text-emerald-100 text-sm">Gestion Locative - Congo</p>
            </div>
          </div>
          <select 
            value={devise}
            onChange={(e) => saveDevise(e.target.value)}
            className="bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white backdrop-blur-sm"
          >
            <option value="USD">USD $</option>
            <option value="CDF">CDF FC</option>
            <option value="EUR">EUR €</option>
          </select>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-md border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {[
            { id: 'dashboard', label: 'Tableau de bord', icon: Home },
            { id: 'appartements', label: 'Appartements', icon: Building2 },
            { id: 'locataires', label: 'Suivi Locataires', icon: Users },
            { id: 'paiements', label: 'Paiements', icon: DollarSign }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-4 transition-all ${
                activeTab === tab.id
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-transparent text-gray-600 hover:text-emerald-600'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="Total Appartements"
                value={stats.totalAppts}
                icon={Building2}
                color="blue"
              />
              <StatCard 
                title="Appartements Loués"
                value={stats.loues}
                subtitle={`${stats.totalAppts - stats.loues} vacant(s)`}
                icon={Building2}
                color="green"
              />
              <StatCard 
                title="Revenu Mensuel"
                value={`${stats.revenuTotal} ${devise}`}
                icon={DollarSign}
                color="emerald"
              />
              <StatCard 
                title="Loyers en Retard"
                value={stats.totalRetards}
                subtitle={`${stats.montantRetard} ${devise}`}
                icon={AlertCircle}
                color="red"
              />
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">📅 Paiements Récents</h2>
              <div className="space-y-3">
                {paiements.slice(0, 5).map(p => {
                  const loc = locataires.find(l => l.id === p.locataireId);
                  const appt = appartements.find(a => a.id === p.appartementId);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                          {appt?.nom.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{loc?.nom}</p>
                          <p className="text-sm text-gray-600">{appt?.nom} - {new Date(p.mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700">{p.montant} {devise}</p>
                        <p className="text-sm text-gray-500">{new Date(p.date).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Appartements */}
        {activeTab === 'appartements' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-800">Appartements</h2>
              <button
                onClick={() => setShowModal('ajouterAppartement')}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" />
                Ajouter
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {appartements.map(appt => {
                const loc = locataires.find(l => l.id === appt.locataireId);
                return (
                  <div key={appt.id} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-emerald-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-800">{appt.nom}</h3>
                        <p className="text-emerald-600 font-semibold text-lg">{appt.loyer} {devise}/mois</p>
                      </div>
                      <span className={`px-4 py-1 rounded-full text-sm font-medium ${
                        appt.statut === 'loue' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {appt.statut === 'loue' ? 'Loué' : 'Vacant'}
                      </span>
                    </div>
                    {loc && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">Locataire actuel</p>
                        <p className="font-semibold text-gray-800">{loc.nom}</p>
                        <p className="text-sm text-gray-600">{loc.telephone}</p>
                      </div>
                    )}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setEditData(appt);
                          setShowModal('modifierAppartement');
                        }}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200"
                      >
                        <Edit2 className="w-4 h-4" />
                        Modifier
                      </button>
                      <button
                        onClick={() => supprimerAppartement(appt.id)}
                        className="flex items-center justify-center bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Suivi Locataires - SYSTÈME CONGO */}
        {activeTab === 'locataires' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-800">Suivi Mensuel des Locataires</h2>
              <button
                onClick={() => setShowModal('ajouterLocataire')}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" />
                Ajouter
              </button>
            </div>

            {/* Légende des statuts */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="font-semibold text-blue-900 mb-2">📋 Règles de paiement (Congo)</p>
              <p className="text-sm text-blue-800">
                Loyer payable à la <strong>fin du mois de consommation</strong> + <strong>5 jours de grâce</strong>.
                <br />
                Exemple : Loyer d'avril 2026 dû <strong>au plus tard le 5 mai 2026</strong>.
              </p>
            </div>

            {locataires.map(loc => {
              const appt = appartements.find(a => a.id === loc.appartementId);
              const moisListe = getDerniersMois(6);
              
              // Calculer les retards pour ce locataire
              let retards = 0;
              let montantRetard = 0;
              moisListe.forEach(m => {
                const statut = getStatutMois(loc.id, m.str);
                if (statut.statut === 'en_retard') {
                  retards++;
                  montantRetard += appt?.loyer || 0;
                }
              });

              return (
                <div key={loc.id} className={`bg-white rounded-2xl shadow-lg p-6 border-2 ${retards > 0 ? 'border-red-200' : 'border-emerald-100'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">{loc.nom}</h3>
                      <p className="text-gray-600">{loc.telephone}</p>
                      <div className="flex gap-3 items-center mt-2">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium text-sm">
                          {appt?.nom || '-'}
                        </span>
                        <span className="text-sm text-gray-600">
                          {appt?.loyer || 0} {devise}/mois
                        </span>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Shield className="w-4 h-4" />
                          Garantie: {loc.garantie} {devise}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {retards > 0 ? (
                        <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg">
                          <p className="font-bold text-lg">-{montantRetard} {devise}</p>
                          <p className="text-sm">{retards} mois en retard</p>
                        </div>
                      ) : (
                        <div className="bg-green-100 text-green-700 px-4 py-2 rounded-lg">
                          <p className="font-bold">✓ En ordre</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grille de suivi mensuel */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-700 mb-3">Suivi des 6 derniers mois</h4>
                    <div className="grid grid-cols-6 gap-2">
                      {moisListe.map(m => {
                        const statut = getStatutMois(loc.id, m.str);
                        const colors = {
                          en_ordre: 'bg-green-100 text-green-700 border-green-300',
                          en_retard: 'bg-red-100 text-red-700 border-red-300',
                          paiement_du: 'bg-yellow-100 text-yellow-700 border-yellow-300'
                        };
                        const icons = {
                          en_ordre: '✓',
                          en_retard: '⚠️',
                          paiement_du: '○'
                        };
                        
                        return (
                          <div 
                            key={m.str} 
                            className={`border-2 ${colors[statut.statut]} rounded-lg p-2 text-center`}
                            title={`${statut.label} - Dû le ${statut.dateLimite?.toLocaleDateString('fr-FR')}`}
                          >
                            <div className="text-xs font-medium">{m.nom}</div>
                            <div className="text-xl">{icons[statut.statut]}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span> En ordre
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span> En retard
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></span> Paiement dû
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        setEditData(loc);
                        setShowModal('modifierLocataire');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200"
                    >
                      <Edit2 className="w-4 h-4" />
                      Modifier
                    </button>
                    <button
                      onClick={() => supprimerLocataire(loc.id)}
                      className="flex items-center justify-center bg-red-100 text-red-700 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paiements */}
        {activeTab === 'paiements' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-800">Gestion des Paiements</h2>
              <button
                onClick={() => setShowModal('ajouterPaiement')}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Plus className="w-5 h-5" />
                Enregistrer un paiement
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                  <tr>
                    <th className="text-left px-6 py-4">Date</th>
                    <th className="text-left px-6 py-4">Locataire</th>
                    <th className="text-left px-6 py-4">Appartement</th>
                    <th className="text-left px-6 py-4">Mois concerné</th>
                    <th className="text-left px-6 py-4">Montant</th>
                    <th className="text-left px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((p, idx) => {
                    const loc = locataires.find(l => l.id === p.locataireId);
                    const appt = appartements.find(a => a.id === p.appartementId);
                    return (
                      <tr key={p.id} className={idx % 2 === 0 ? 'bg-emerald-50/30' : 'bg-white'}>
                        <td className="px-6 py-4">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-6 py-4">{loc?.nom}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium">
                            {appt?.nom}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {new Date(p.mois + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-700">{p.montant} {devise}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => genererQuittance(p)}
                              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-200"
                            >
                              <FileText className="w-4 h-4" />
                              Quittance
                            </button>
                            <button
                              onClick={() => supprimerPaiement(p.id)}
                              className="bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {/* Modal Appartement */}
      {(showModal === 'ajouterAppartement' || showModal === 'modifierAppartement') && (
        <Modal 
          onClose={() => { setShowModal(null); setEditData(null); }}
          title={editData ? "Modifier l'appartement" : "Ajouter un appartement"}
        >
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
              nom: formData.get('nom'),
              loyer: formData.get('loyer'),
              statut: formData.get('statut'),
              locataireId: formData.get('locataireId') || null
            };
            editData ? modifierAppartement(data) : ajouterAppartement(data);
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                <input
                  type="text"
                  name="nom"
                  required
                  defaultValue={editData?.nom}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Loyer mensuel</label>
                <input
                  type="number"
                  name="loyer"
                  step="0.01"
                  required
                  defaultValue={editData?.loyer}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                <select 
                  name="statut" 
                  defaultValue={editData?.statut || 'vacant'}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="loue">Loué</option>
                  <option value="vacant">Vacant</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Locataire (optionnel)</label>
                <select 
                  name="locataireId" 
                  defaultValue={editData?.locataireId || ''}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">Aucun</option>
                  {locataires.map(l => (
                    <option key={l.id} value={l.id}>{l.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setShowModal(null); setEditData(null); }}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                {editData ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Locataire */}
      {(showModal === 'ajouterLocataire' || showModal === 'modifierLocataire') && (
        <Modal 
          onClose={() => { setShowModal(null); setEditData(null); }}
          title={editData ? "Modifier le locataire" : "Ajouter un locataire"}
        >
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
              nom: formData.get('nom'),
              telephone: formData.get('telephone'),
              appartementId: formData.get('appartementId'),
              dateEntree: formData.get('dateEntree'),
              garantie: formData.get('garantie')
            };
            editData ? modifierLocataire(data) : ajouterLocataire(data);
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet</label>
                <input
                  type="text"
                  name="nom"
                  required
                  defaultValue={editData?.nom}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                <input
                  type="tel"
                  name="telephone"
                  required
                  defaultValue={editData?.telephone}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Appartement</label>
                <select 
                  name="appartementId" 
                  required
                  defaultValue={editData?.appartementId}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                >
                  <option value="">Sélectionner</option>
                  {appartements.map(a => (
                    <option key={a.id} value={a.id}>{a.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date d'entrée</label>
                <input
                  type="date"
                  name="dateEntree"
                  required
                  defaultValue={editData?.dateEntree}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Garantie / Caution
                </label>
                <input
                  type="number"
                  name="garantie"
                  step="0.01"
                  required
                  defaultValue={editData?.garantie || 0}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setShowModal(null); setEditData(null); }}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                {editData ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Paiement */}
      {showModal === 'ajouterPaiement' && (
        <Modal onClose={() => setShowModal(null)} title="Enregistrer un paiement">
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            ajouterPaiement({
              locataireId: formData.get('locataireId'),
              appartementId: formData.get('appartementId'),
              montant: formData.get('montant'),
              date: formData.get('date'),
              mois: formData.get('mois'),
              notes: formData.get('notes')
            });
          }}>
            <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-800">
                  ℹ️ <strong>Règle Congo :</strong> Le loyer est dû à la fin du mois de consommation + 5 jours de grâce.
                  <br />Ex: Loyer d'avril 2026 dû au plus tard le 5 mai 2026.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Locataire</label>
                <select name="locataireId" required className="w-full border-2 border-gray-300 rounded-lg px-4 py-2">
                  <option value="">Sélectionner</option>
                  {locataires.map(l => (
                    <option key={l.id} value={l.id}>{l.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Appartement</label>
                <select name="appartementId" required className="w-full border-2 border-gray-300 rounded-lg px-4 py-2">
                  <option value="">Sélectionner</option>
                  {appartements.map(a => (
                    <option key={a.id} value={a.id}>{a.nom} - {a.loyer} {devise}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mois concerné (mois de consommation)</label>
                <input
                  type="month"
                  name="mois"
                  required
                  defaultValue={new Date().toISOString().slice(0, 7)}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Montant</label>
                <input
                  type="number"
                  name="montant"
                  step="0.01"
                  required
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date de paiement</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optionnel)</label>
                <textarea
                  name="notes"
                  rows="3"
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2"
                  placeholder="Reçu par dépôt bancaire..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowModal(null)}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

// Composant StatCard
const StatCard = ({ title, value, subtitle, icon: Icon, color }) => {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    emerald: 'from-emerald-500 to-emerald-600',
    red: 'from-red-500 to-red-600'
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-emerald-100">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 bg-gradient-to-br ${colors[color]} rounded-xl flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
};

// Composant Modal
const Modal = ({ onClose, title, children }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/20 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default GestionLocativeKenge14;
