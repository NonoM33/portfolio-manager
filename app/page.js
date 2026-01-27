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

const defaultData = {
  totalCapital: 0,
  initialCapital: 0,
  investors: [],
  history: []
}

// Local storage helpers
const STORAGE_KEY = 'portfolio_data'

function loadData() {
  if (typeof window === 'undefined') return defaultData
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : defaultData
  } catch {
    return defaultData
  }
}

function saveData(data) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

export default function Home() {
  const [data, setData] = useState(defaultData)
  const [loading, setLoading] = useState(true)
  const [showAddInvestor, setShowAddInvestor] = useState(false)
  const [showUpdateCapital, setShowUpdateCapital] = useState(false)
  const [showCommissionModal, setShowCommissionModal] = useState(null)
  
  // Form states
  const [newInvestor, setNewInvestor] = useState({ name: '', capital: '', commission: 55, mode: 'reinvest' })
  const [capitalUpdate, setCapitalUpdate] = useState({ newTotal: '' })
  const [commissionAction, setCommissionAction] = useState({ amount: '', action: 'withdraw' })

  useEffect(() => {
    setData(loadData())
    setLoading(false)
  }, [])

  const updateData = (newData) => {
    setData(newData)
    saveData(newData)
  }

  const addInvestor = (e) => {
    e.preventDefault()
    const investor = {
      id: generateId(),
      name: newInvestor.name,
      capital: parseFloat(newInvestor.capital),
      commissionRate: parseFloat(newInvestor.commission) || 55,
      mode: newInvestor.mode,
      createdAt: new Date().toISOString()
    }
    
    const newData = {
      ...data,
      investors: [...data.investors, investor],
      initialCapital: data.initialCapital + investor.capital,
      totalCapital: data.totalCapital + investor.capital,
      history: [{
        type: 'Nouvel investisseur',
        investor: investor.name,
        amount: investor.capital,
        date: new Date().toISOString()
      }, ...data.history].slice(0, 100)
    }
    
    updateData(newData)
    setNewInvestor({ name: '', capital: '', commission: 55, mode: 'reinvest' })
    setShowAddInvestor(false)
  }

  const updateCapital = (e) => {
    e.preventDefault()
    const newTotal = parseFloat(capitalUpdate.newTotal)
    const diff = newTotal - data.totalCapital
    
    const newData = {
      ...data,
      totalCapital: newTotal,
      history: [{
        type: diff >= 0 ? 'Profit' : 'Perte',
        investor: null,
        amount: diff,
        date: new Date().toISOString()
      }, ...data.history].slice(0, 100)
    }
    
    updateData(newData)
    setCapitalUpdate({ newTotal: '' })
    setShowUpdateCapital(false)
  }

  const handleCommission = (investorId) => {
    const investor = data.investors.find(i => i.id === investorId)
    if (!investor) return
    
    const share = investor.capital / data.initialCapital
    const currentValue = share * data.totalCapital
    const gains = currentValue - investor.capital
    const maxCommission = gains > 0 ? gains * (investor.commissionRate / 100) : 0
    const amount = commissionAction.amount ? Math.min(parseFloat(commissionAction.amount), maxCommission) : maxCommission
    
    if (amount <= 0) return
    
    let newData
    if (commissionAction.action === 'withdraw') {
      newData = {
        ...data,
        totalCapital: data.totalCapital - amount,
        history: [{
          type: 'Commission retirée',
          investor: investor.name,
          amount: -amount,
          date: new Date().toISOString()
        }, ...data.history].slice(0, 100)
      }
    } else {
      newData = {
        ...data,
        investors: data.investors.map(i => 
          i.id === investorId ? { ...i, capital: i.capital + amount } : i
        ),
        initialCapital: data.initialCapital + amount,
        history: [{
          type: 'Commission réinvestie',
          investor: investor.name,
          amount: amount,
          date: new Date().toISOString()
        }, ...data.history].slice(0, 100)
      }
    }
    
    updateData(newData)
    setCommissionAction({ amount: '', action: 'withdraw' })
    setShowCommissionModal(null)
  }

  const toggleMode = (investorId, currentMode) => {
    const newData = {
      ...data,
      investors: data.investors.map(i => 
        i.id === investorId ? { ...i, mode: currentMode === 'reinvest' ? 'withdraw' : 'reinvest' } : i
      )
    }
    updateData(newData)
  }

  const removeInvestor = (investorId) => {
    if (!confirm('Supprimer cet investisseur ?')) return
    
    const investor = data.investors.find(i => i.id === investorId)
    if (!investor) return
    
    const share = investor.capital / data.initialCapital
    const valueToRemove = share * data.totalCapital
    
    const newData = {
      ...data,
      investors: data.investors.filter(i => i.id !== investorId),
      initialCapital: data.initialCapital - investor.capital,
      totalCapital: data.totalCapital - valueToRemove,
      history: [{
        type: 'Investisseur retiré',
        investor: investor.name,
        amount: -investor.capital,
        date: new Date().toISOString()
      }, ...data.history].slice(0, 100)
    }
    
    updateData(newData)
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
  }

  const importData = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result)
        if (imported.investors && imported.totalCapital !== undefined) {
          updateData(imported)
          alert('Données importées avec succès !')
        } else {
          alert('Format de fichier invalide')
        }
      } catch {
        alert('Erreur lors de l\'import')
      }
    }
    reader.readAsText(file)
  }

  if (loading) return <div className="container"><h1>Chargement...</h1></div>

  const totalCapital = data.totalCapital || 0
  const initialCapital = data.initialCapital || 0
  const profit = totalCapital - initialCapital
  const profitPercent = initialCapital > 0 ? ((profit / initialCapital) * 100).toFixed(2) : 0

  return (
    <div className="container">
      <h1>💹 Trading Portfolio Manager</h1>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Capital Total</h3>
          <div className="value">{formatCurrency(totalCapital)}</div>
        </div>
        <div className="stat-card">
          <h3>Capital Initial</h3>
          <div className="value">{formatCurrency(initialCapital)}</div>
        </div>
        <div className="stat-card">
          <h3>Profit/Perte</h3>
          <div className={`value ${profit >= 0 ? 'profit' : 'loss'}`}>
            {profit >= 0 ? '+' : ''}{formatCurrency(profit)} ({profitPercent}%)
          </div>
        </div>
        <div className="stat-card">
          <h3>Investisseurs</h3>
          <div className="value">{data.investors?.length || 0}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="section">
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => setShowAddInvestor(true)}>
            ➕ Ajouter Investisseur
          </button>
          <button className="btn-success" onClick={() => setShowUpdateCapital(true)}>
            📈 Mettre à jour le Capital
          </button>
          <button className="btn-secondary" onClick={exportData} style={{ background: '#666' }}>
            💾 Exporter
          </button>
          <label className="btn-secondary" style={{ background: '#666', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer' }}>
            📂 Importer
            <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Investors Table */}
      <div className="section">
        <h2>👥 Investisseurs</h2>
        {data.investors?.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Capital Investi</th>
                <th>Part (%)</th>
                <th>Valeur Actuelle</th>
                <th>Gains</th>
                <th>Commission (%)</th>
                <th>Mode</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.investors.map(inv => {
                const share = initialCapital > 0 ? (inv.capital / initialCapital) * 100 : 0
                const currentValue = initialCapital > 0 ? (share / 100) * totalCapital : inv.capital
                const gains = currentValue - inv.capital
                const commission = gains > 0 ? gains * (inv.commissionRate / 100) : 0
                
                return (
                  <tr key={inv.id}>
                    <td><strong>{inv.name}</strong></td>
                    <td>{formatCurrency(inv.capital)}</td>
                    <td>{share.toFixed(2)}%</td>
                    <td>{formatCurrency(currentValue)}</td>
                    <td style={{ color: gains >= 0 ? '#00ff88' : '#ff4757' }}>
                      {gains >= 0 ? '+' : ''}{formatCurrency(gains)}
                    </td>
                    <td>{inv.commissionRate}%</td>
                    <td>
                      <span 
                        className={`badge ${inv.mode === 'reinvest' ? 'badge-reinvest' : 'badge-withdraw'}`}
                        onClick={() => toggleMode(inv.id, inv.mode)}
                        style={{ cursor: 'pointer' }}
                      >
                        {inv.mode === 'reinvest' ? '🔄 Réinvestir' : '💸 Retirer'}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button 
                          className="btn-primary btn-sm" 
                          onClick={() => setShowCommissionModal(inv)}
                          disabled={commission <= 0}
                        >
                          Commission
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => removeInvestor(inv.id)}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>
            Aucun investisseur. Ajoutez le premier !
          </p>
        )}
      </div>

      {/* History */}
      <div className="section">
        <h2>📜 Historique</h2>
        {data.history?.length > 0 ? (
          data.history.slice(0, 10).map((h, i) => (
            <div className="history-item" key={i}>
              <div>
                <strong>{h.type}</strong>
                {h.investor && <span style={{ color: '#aaa' }}> - {h.investor}</span>}
                <div className="date">{formatDate(h.date)}</div>
              </div>
              <div className={`amount ${h.amount >= 0 ? 'positive' : 'negative'}`}>
                {h.amount >= 0 ? '+' : ''}{formatCurrency(h.amount)}
              </div>
            </div>
          ))
        ) : (
          <p style={{ color: '#aaa', textAlign: 'center' }}>Aucun historique</p>
        )}
      </div>

      {/* Modal: Add Investor */}
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
                  required
                />
              </div>
              <div className="form-group">
                <label>Capital (€)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={newInvestor.capital}
                  onChange={e => setNewInvestor({...newInvestor, capital: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Commission sur gains (%)</label>
                <input 
                  type="number"
                  value={newInvestor.commission}
                  onChange={e => setNewInvestor({...newInvestor, commission: e.target.value})}
                  required
                />
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

      {/* Modal: Update Capital */}
      {showUpdateCapital && (
        <div className="modal-overlay" onClick={() => setShowUpdateCapital(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>📈 Mettre à jour le Capital Total</h3>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>
              Capital actuel : <strong>{formatCurrency(totalCapital)}</strong>
            </p>
            <form onSubmit={updateCapital}>
              <div className="form-group">
                <label>Nouveau Capital Total (€)</label>
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

      {/* Modal: Commission Action */}
      {showCommissionModal && (
        <div className="modal-overlay" onClick={() => setShowCommissionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>💰 Commission - {showCommissionModal.name}</h3>
            {(() => {
              const share = initialCapital > 0 ? (showCommissionModal.capital / initialCapital) * 100 : 0
              const currentValue = (share / 100) * totalCapital
              const gains = currentValue - showCommissionModal.capital
              const commission = gains > 0 ? gains * (showCommissionModal.commissionRate / 100) : 0
              return (
                <>
                  <p style={{ color: '#aaa', marginBottom: '10px' }}>
                    Gains actuels : <strong style={{ color: '#00ff88' }}>{formatCurrency(gains)}</strong>
                  </p>
                  <p style={{ color: '#aaa', marginBottom: '20px' }}>
                    Commission disponible ({showCommissionModal.commissionRate}%) : <strong style={{ color: '#00d4ff' }}>{formatCurrency(commission)}</strong>
                  </p>
                </>
              )
            })()}
            <div className="form-group">
              <label>Action</label>
              <select 
                value={commissionAction.action}
                onChange={e => setCommissionAction({...commissionAction, action: e.target.value})}
              >
                <option value="withdraw">💸 Retirer la commission</option>
                <option value="reinvest">🔄 Réinvestir la commission</option>
              </select>
            </div>
            <div className="form-group">
              <label>Montant (vide = tout)</label>
              <input 
                type="number" 
                step="0.01"
                value={commissionAction.amount}
                onChange={e => setCommissionAction({...commissionAction, amount: e.target.value})}
                placeholder="Tout"
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

      <p style={{ textAlign: 'center', color: '#666', marginTop: '30px', fontSize: '0.85rem' }}>
        💾 Les données sont stockées localement dans votre navigateur. Utilisez Export/Import pour sauvegarder.
      </p>
    </div>
  )
}
