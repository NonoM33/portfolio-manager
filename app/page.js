'use client'

import { useState, useEffect } from 'react'

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', { 
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
}

export default function Home() {
  const [data, setData] = useState({ totalCapital: 0, initialCapital: 0, investors: [], history: [] })
  const [loading, setLoading] = useState(true)
  const [showAddInvestor, setShowAddInvestor] = useState(false)
  const [showUpdateCapital, setShowUpdateCapital] = useState(false)
  const [showCommissionModal, setShowCommissionModal] = useState(null)
  const [showEditInvestor, setShowEditInvestor] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showBatchReinvest, setShowBatchReinvest] = useState(false)
  const [batchSelections, setBatchSelections] = useState({})
  
  const [newInvestor, setNewInvestor] = useState({ name: '', capital: '', commission: 55, mode: 'reinvest' })
  const [capitalUpdate, setCapitalUpdate] = useState({ newTotal: '' })
  const [commissionAction, setCommissionAction] = useState({ amount: '', action: 'withdraw' })
  const [editForm, setEditForm] = useState({ commissionRate: '', capital: '' })

  const fetchData = async () => {
    try {
      const res = await fetch('/api/portfolio')
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error('Fetch error:', e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const addInvestor = async (e) => {
    e.preventDefault()
    await fetch('/api/investors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newInvestor.name,
        capital: parseFloat(newInvestor.capital),
        commissionRate: parseFloat(newInvestor.commission),
        mode: newInvestor.mode
      })
    })
    setNewInvestor({ name: '', capital: '', commission: 55, mode: 'reinvest' })
    setShowAddInvestor(false)
    fetchData()
  }

  const updateCapital = async (e) => {
    e.preventDefault()
    await fetch('/api/capital', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTotal: parseFloat(capitalUpdate.newTotal) })
    })
    setCapitalUpdate({ newTotal: '' })
    setShowUpdateCapital(false)
    fetchData()
  }

  const handleCommission = async (investorId) => {
    await fetch('/api/commission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        investorId,
        action: commissionAction.action,
        amount: commissionAction.amount ? parseFloat(commissionAction.amount) : null
      })
    })
    setCommissionAction({ amount: '', action: 'withdraw' })
    setShowCommissionModal(null)
    fetchData()
  }

  const saveEditInvestor = async (investorId) => {
    // Update commission rate
    await fetch('/api/investors/' + investorId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        commissionRate: parseFloat(editForm.commissionRate)
      })
    })
    
    // Update capital if changed
    const originalCapital = showEditInvestor?.capital
    const newCapital = parseFloat(editForm.capital)
    if (newCapital && newCapital !== originalCapital && newCapital > 0) {
      await fetch('/api/investors/' + investorId + '/capital', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCapital })
      })
    }
    
    setShowEditInvestor(null)
    setEditForm({ commissionRate: '', capital: '' })
    fetchData()
  }

  const openBatchReinvest = () => {
    // Initialize selections with max commission for each investor
    const selections = {}
    const currentRatio = initialCapital > 0 ? totalCapital / initialCapital : 1
    data.investors?.forEach(inv => {
      const entryRatio = inv.entryRatio || 1.0
      const performanceSinceEntry = entryRatio > 0 ? currentRatio / entryRatio : 1
      const currentValue = inv.capital * performanceSinceEntry
      const gains = currentValue - inv.capital
      const maxCommission = gains > 0 ? gains * (inv.commissionRate / 100) : 0
      
      if (maxCommission > 0) {
        selections[inv.id] = {
          selected: true,
          amount: Math.round(maxCommission * 100) / 100,
          maxCommission: Math.round(maxCommission * 100) / 100,
          name: inv.name
        }
      }
    })
    setBatchSelections(selections)
    setShowBatchReinvest(true)
  }

  const applyBatchReinvest = async () => {
    const reinvestments = Object.entries(batchSelections)
      .filter(([_, val]) => val.selected && val.amount > 0)
      .map(([investorId, val]) => ({
        investorId,
        action: 'reinvest',
        amount: parseFloat(val.amount)
      }))
    
    if (reinvestments.length === 0) {
      alert('Sélectionne au moins un investisseur')
      return
    }
    
    try {
      const res = await fetch('/api/commission/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reinvestments })
      })
      const json = await res.json()
      
      if (json.success) {
        alert(`✅ ${json.applied} réinvestissement(s) appliqué(s)\nTotal: ${formatCurrency(json.totalReinvested)}`)
        setShowBatchReinvest(false)
        setBatchSelections({})
        fetchData()
      } else {
        alert('Erreur: ' + json.error)
      }
    } catch (e) {
      alert('Erreur de connexion')
    }
  }

  const toggleMode = async (investorId, currentMode) => {
    await fetch('/api/investors/' + investorId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: currentMode === 'reinvest' ? 'withdraw' : 'reinvest' })
    })
    fetchData()
  }

  const removeInvestor = async (investorId) => {
    if (!confirm('Supprimer cet investisseur ?')) return
    await fetch('/api/investors/' + investorId, { method: 'DELETE' })
    fetchData()
  }

  const downloadBackup = () => {
    window.open('/api/backup', '_blank')
  }

  if (loading) return <div className="container"><h1>Chargement...</h1></div>

  const totalCapital = data.totalCapital || 0
  const initialCapital = data.initialCapital || 0
  const profit = totalCapital - initialCapital
  const profitPercent = initialCapital > 0 ? ((profit / initialCapital) * 100).toFixed(2) : '0.00'

  return (
    <div className="container">
      <h1>💹 Portfolio Manager</h1>

      <button 
        onClick={() => setShowHelp(true)} 
        style={{ 
          position: 'absolute', 
          top: '20px', 
          right: '20px', 
          background: 'rgba(255,255,255,0.1)', 
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          fontSize: '1.2rem',
          cursor: 'pointer'
        }}
      >
        ❓
      </button>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>💰 Capital Total</h3>
          <div className="value">{formatCurrency(totalCapital)}</div>
        </div>
        <div className="stat-card">
          <h3>📊 Capital Initial</h3>
          <div className="value">{formatCurrency(initialCapital)}</div>
        </div>
        <div className="stat-card">
          <h3>{profit >= 0 ? '📈' : '📉'} Performance</h3>
          <div className={`value ${profit > 0 ? 'profit' : profit < 0 ? 'loss' : ''}`}>
            {profit > 0 ? '+' : ''}{formatCurrency(profit)}
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}> ({profitPercent}%)</span>
          </div>
        </div>
        <div className="stat-card">
          <h3>👥 Investisseurs</h3>
          <div className="value">{data.investors?.length || 0}</div>
        </div>
      </div>

      <div className="section">
        <div className="action-buttons">
          <button className="btn-primary btn-large" onClick={() => setShowAddInvestor(true)}>
            ➕ Ajouter Investisseur
          </button>
          <button className="btn-success btn-large" onClick={() => setShowUpdateCapital(true)}>
            📈 Mettre à jour Capital
          </button>
          <button className="btn-secondary btn-large" onClick={downloadBackup}>
            💾 Backup
          </button>
          <button className="btn-warning btn-large" onClick={openBatchReinvest}>
            🔄 Réinvestir tout
          </button>
        </div>
      </div>

      <div className="section">
        <h2>👥 Investisseurs</h2>
        {data.investors?.length > 0 ? (
          <div className="investor-cards">
            {data.investors.map(inv => {
              // Calculate gains based on entry ratio (when investor joined)
              const currentRatio = initialCapital > 0 ? totalCapital / initialCapital : 1
              const entryRatio = inv.entryRatio || 1.0
              // Current value = capital * (performance since entry)
              const performanceSinceEntry = entryRatio > 0 ? currentRatio / entryRatio : 1
              const currentValue = inv.capital * performanceSinceEntry
              const gains = currentValue - inv.capital
              const commission = gains > 0 ? gains * (inv.commissionRate / 100) : 0
              const share = initialCapital > 0 ? (inv.capital / initialCapital) * 100 : 0
              
              return (
                <div className="investor-card" key={inv.id}>
                  <div className="investor-header">
                    <strong>{inv.name}</strong>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span 
                        className={`badge ${inv.mode === 'reinvest' ? 'badge-reinvest' : 'badge-withdraw'}`}
                        onClick={() => toggleMode(inv.id, inv.mode)}
                      >
                        {inv.mode === 'reinvest' ? '🔄' : '💸'}
                      </span>
                      <button 
                        onClick={() => {
                          setShowEditInvestor(inv)
                          setEditForm({ commissionRate: inv.commissionRate.toString(), capital: inv.capital.toString() })
                        }}
                        style={{ 
                          background: 'rgba(255,255,255,0.1)', 
                          border: 'none', 
                          borderRadius: '5px',
                          padding: '5px 8px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        ✏️
                      </button>
                    </div>
                  </div>
                  
                  <div className="investor-stats">
                    <div className="stat-row">
                      <span>Capital investi</span>
                      <span>{formatCurrency(inv.capital)}</span>
                    </div>
                    <div className="stat-row">
                      <span>Part du portfolio</span>
                      <span>{share.toFixed(1)}%</span>
                    </div>
                    <div className="stat-row">
                      <span>Valeur actuelle</span>
                      <span>{formatCurrency(currentValue)}</span>
                    </div>
                    <div className="stat-row">
                      <span>Gains/Pertes</span>
                      <span style={{ color: gains >= 0 ? '#00ff88' : '#ff4757', fontWeight: 'bold' }}>
                        {gains >= 0 ? '+' : ''}{formatCurrency(gains)}
                      </span>
                    </div>
                    <div className="stat-row">
                      <span>Commission ({inv.commissionRate}%)</span>
                      <span style={{ color: inv.commissionRate > 0 ? '#00d4ff' : '#666' }}>
                        {inv.commissionRate > 0 ? formatCurrency(commission) : '—'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="investor-actions">
                    {inv.commissionRate > 0 && (
                      <button 
                        className="btn-primary btn-sm" 
                        onClick={() => setShowCommissionModal(inv)}
                        disabled={commission <= 0}
                      >
                        💰 Commission
                      </button>
                    )}
                    <button className="btn-danger btn-sm" onClick={() => removeInvestor(inv.id)}>
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>Aucun investisseur</p>
            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
              Commence par ajouter toi-même (0% commission)<br/>
              puis les autres investisseurs
            </p>
          </div>
        )}
      </div>

      <div className="section">
        <h2>📜 Historique</h2>
        {data.history?.length > 0 ? (
          <div className="history-list">
            {data.history.slice(0, 10).map((h, i) => (
              <div className="history-item" key={i}>
                <div>
                  <strong>{h.type}</strong>
                  {h.investor && <span className="investor-name"> • {h.investor}</span>}
                  <div className="date">{formatDate(h.date)}</div>
                </div>
                <div className={`amount ${h.amount >= 0 ? 'positive' : 'negative'}`}>
                  {h.amount >= 0 ? '+' : ''}{formatCurrency(h.amount)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Aucun historique</p>
        )}
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>❓ Comment utiliser l'app</h3>
            <div className="help-content">
              <h4>1️⃣ Ajouter les investisseurs</h4>
              <p>• <strong>Toi (le trader)</strong> : ajoute-toi avec <strong>0% commission</strong></p>
              <p>• <strong>Tes investisseurs</strong> : ajoute-les avec leur % de commission (ex: 50%)</p>
              
              <h4>2️⃣ Mettre à jour le capital</h4>
              <p>Quand ton portfolio évolue, clique sur "Mettre à jour Capital" et entre la <strong>nouvelle valeur totale</strong>.</p>
              
              <h4>3️⃣ Modifier un investisseur</h4>
              <p>Clique sur ✏️ pour modifier le % de commission.</p>
              
              <h4>4️⃣ Gérer les commissions</h4>
              <p>• <strong>💸 Retirer</strong> : l'argent sort du portfolio</p>
              <p>• <strong>🔄 Réinvestir</strong> : augmente le capital de l'investisseur</p>
            </div>
            <button className="btn-primary" onClick={() => setShowHelp(false)} style={{ width: '100%', marginTop: '20px' }}>
              Compris ! 👍
            </button>
          </div>
        </div>
      )}

      {/* Edit Investor Modal */}
      {showEditInvestor && (
        <div className="modal-overlay" onClick={() => setShowEditInvestor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>✏️ Modifier {showEditInvestor.name}</h3>
            <div className="form-group">
              <label>Capital investi (€)</label>
              <input 
                type="number"
                step="0.01"
                value={editForm.capital}
                onChange={e => setEditForm({...editForm, capital: e.target.value})}
                placeholder="Montant investi"
              />
              <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                💰 Modifie le capital initial de l'investisseur
              </small>
            </div>
            <div className="form-group">
              <label>Commission sur gains (%)</label>
              <input 
                type="number"
                step="0.1"
                value={editForm.commissionRate}
                onChange={e => setEditForm({...editForm, commissionRate: e.target.value})}
                placeholder="0 pour toi-même"
              />
              <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                💡 Mets 0% si c'est toi (le trader)
              </small>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-danger" onClick={() => setShowEditInvestor(null)}>
                Annuler
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => saveEditInvestor(showEditInvestor.id)}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Investor Modal */}
      {showAddInvestor && (
        <div className="modal-overlay" onClick={() => setShowAddInvestor(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>➕ Ajouter un Investisseur</h3>
            <form onSubmit={addInvestor}>
              <div className="form-group">
                <label>Nom</label>
                <input 
                  type="text" 
                  value={newInvestor.name}
                  onChange={e => setNewInvestor({...newInvestor, name: e.target.value})}
                  placeholder="Ex: Lenny, Pierre..."
                  required
                />
              </div>
              <div className="form-group">
                <label>Capital investi (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={newInvestor.capital}
                  onChange={e => setNewInvestor({...newInvestor, capital: e.target.value})}
                  placeholder="Ex: 5000"
                  required
                />
              </div>
              <div className="form-group">
                <label>Commission sur gains (%)</label>
                <input 
                  type="number"
                  step="0.1"
                  value={newInvestor.commission}
                  onChange={e => setNewInvestor({...newInvestor, commission: e.target.value})}
                  placeholder="0 pour toi, 50 pour investisseurs"
                  required
                />
                <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                  💡 Mets 0% pour toi-même (le trader)
                </small>
              </div>
              <div className="form-group">
                <label>Mode par défaut</label>
                <select 
                  value={newInvestor.mode}
                  onChange={e => setNewInvestor({...newInvestor, mode: e.target.value})}
                >
                  <option value="reinvest">🔄 Réinvestir les gains</option>
                  <option value="withdraw">💸 Retirer les gains</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-danger" onClick={() => setShowAddInvestor(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-primary">Ajouter</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Capital Modal */}
      {showUpdateCapital && (
        <div className="modal-overlay" onClick={() => setShowUpdateCapital(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>📈 Mettre à jour le Capital</h3>
            <p style={{ color: '#aaa', marginBottom: '15px' }}>
              Capital actuel : <strong style={{ color: '#00d4ff' }}>{formatCurrency(totalCapital)}</strong>
            </p>
            <form onSubmit={updateCapital}>
              <div className="form-group">
                <label>Nouvelle valeur totale du portfolio (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={capitalUpdate.newTotal}
                  onChange={e => setCapitalUpdate({...capitalUpdate, newTotal: e.target.value})}
                  placeholder={totalCapital.toString()}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-danger" onClick={() => setShowUpdateCapital(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn-success">Mettre à jour</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commission Modal */}
      {showCommissionModal && (
        <div className="modal-overlay" onClick={() => setShowCommissionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💰 Commission - {showCommissionModal.name}</h3>
            {(() => {
              const currentRatio = initialCapital > 0 ? totalCapital / initialCapital : 1
              const entryRatio = showCommissionModal.entryRatio || 1.0
              const performanceSinceEntry = entryRatio > 0 ? currentRatio / entryRatio : 1
              const currentValue = showCommissionModal.capital * performanceSinceEntry
              const gains = currentValue - showCommissionModal.capital
              const commission = gains > 0 ? gains * (showCommissionModal.commissionRate / 100) : 0
              return (
                <div style={{ marginBottom: '20px' }}>
                  <div className="stat-row" style={{ marginBottom: '10px' }}>
                    <span>Gains actuels</span>
                    <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{formatCurrency(gains)}</span>
                  </div>
                  <div className="stat-row">
                    <span>Commission dispo ({showCommissionModal.commissionRate}%)</span>
                    <span style={{ color: '#00d4ff', fontWeight: 'bold' }}>{formatCurrency(commission)}</span>
                  </div>
                </div>
              )
            })()}
            <div className="form-group">
              <label>Action</label>
              <select 
                value={commissionAction.action}
                onChange={e => setCommissionAction({...commissionAction, action: e.target.value})}
              >
                <option value="withdraw">💸 Retirer (sort du portfolio)</option>
                <option value="reinvest">🔄 Réinvestir (augmente son capital)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Montant (vide = tout)</label>
              <input 
                type="number" 
                step="0.01"
                value={commissionAction.amount}
                onChange={e => setCommissionAction({...commissionAction, amount: e.target.value})}
                placeholder="Laisser vide pour tout"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-danger" onClick={() => setShowCommissionModal(null)}>
                Annuler
              </button>
              <button 
                type="button" 
                className="btn-primary"
                onClick={() => handleCommission(showCommissionModal.id)}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Reinvest Modal */}
      {showBatchReinvest && (
        <div className="modal-overlay" onClick={() => setShowBatchReinvest(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>🔄 Réinvestir les commissions</h3>
            <p style={{ color: '#aaa', marginBottom: '15px', fontSize: '0.9rem' }}>
              ⚡ Les calculs sont basés sur un snapshot. L'ordre de sélection n'affecte pas les montants.
            </p>
            
            {Object.keys(batchSelections).length === 0 ? (
              <p style={{ color: '#ff4757', textAlign: 'center', padding: '20px' }}>
                Aucune commission disponible à réinvestir
              </p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {Object.entries(batchSelections).map(([investorId, sel]) => (
                  <div key={investorId} style={{ 
                    background: 'rgba(255,255,255,0.05)', 
                    padding: '12px', 
                    borderRadius: '8px',
                    marginBottom: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <input 
                        type="checkbox"
                        checked={sel.selected}
                        onChange={e => setBatchSelections({
                          ...batchSelections,
                          [investorId]: { ...sel, selected: e.target.checked }
                        })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <strong>{sel.name}</strong>
                      <span style={{ marginLeft: 'auto', color: '#00d4ff' }}>
                        max: {formatCurrency(sel.maxCommission)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#888' }}>Montant:</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={sel.amount}
                        onChange={e => setBatchSelections({
                          ...batchSelections,
                          [investorId]: { ...sel, amount: e.target.value }
                        })}
                        style={{ 
                          flex: 1, 
                          padding: '8px', 
                          background: 'rgba(0,0,0,0.3)', 
                          border: '1px solid #333',
                          borderRadius: '5px',
                          color: 'white'
                        }}
                        max={sel.maxCommission}
                      />
                      <button 
                        onClick={() => setBatchSelections({
                          ...batchSelections,
                          [investorId]: { ...sel, amount: sel.maxCommission }
                        })}
                        style={{ 
                          padding: '8px 12px', 
                          background: 'rgba(0,212,255,0.2)', 
                          border: 'none',
                          borderRadius: '5px',
                          color: '#00d4ff',
                          cursor: 'pointer'
                        }}
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="btn-danger" onClick={() => setShowBatchReinvest(false)}>
                Annuler
              </button>
              <button 
                type="button" 
                className="btn-success"
                onClick={applyBatchReinvest}
                disabled={Object.keys(batchSelections).length === 0}
              >
                ✅ Réinvestir
              </button>
            </div>
          </div>
        </div>
      )}

      <p style={{ textAlign: 'center', color: '#555', marginTop: '30px', fontSize: '0.8rem' }}>
        🗄️ Données sauvegardées • Backup mensuel auto
      </p>
    </div>
  )
}
