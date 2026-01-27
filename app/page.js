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
  
  const [newInvestor, setNewInvestor] = useState({ name: '', capital: '', commission: 55, mode: 'reinvest' })
  const [capitalUpdate, setCapitalUpdate] = useState({ newTotal: '' })
  const [commissionAction, setCommissionAction] = useState({ amount: '', action: 'withdraw' })

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
  const profitPercent = initialCapital > 0 ? ((profit / initialCapital) * 100).toFixed(2) : 0

  return (
    <div className="container">
      <h1>💹 Trading Portfolio Manager</h1>

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

      <div className="section">
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <button className="btn-primary" onClick={() => setShowAddInvestor(true)}>
            ➕ Ajouter Investisseur
          </button>
          <button className="btn-success" onClick={() => setShowUpdateCapital(true)}>
            📈 Mettre à jour le Capital
          </button>
          <button className="btn-secondary" onClick={downloadBackup} style={{ background: '#666' }}>
            💾 Télécharger Backup
          </button>
        </div>
      </div>

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
        🗄️ Données stockées en base PostgreSQL avec backup mensuel automatique
      </p>
    </div>
  )
}
