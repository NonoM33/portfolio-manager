import pg from 'pg'

const { Pool } = pg

// Use DATABASE_URL from environment or fallback to memory storage
const DATABASE_URL = process.env.DATABASE_URL

let pool = null
let useMemory = !DATABASE_URL

const memoryStore = {
  totalCapital: 0,
  initialCapital: 0,
  investors: [],
  history: []
}

async function initDB() {
  if (useMemory) {
    console.log('Using in-memory storage (no DATABASE_URL)')
    return
  }

  try {
    pool = new Pool({ connectionString: DATABASE_URL })
    
    // Create tables if not exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio (
        id SERIAL PRIMARY KEY,
        total_capital DECIMAL(15,2) DEFAULT 0,
        initial_capital DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS investors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        capital DECIMAL(15,2) NOT NULL,
        commission_rate DECIMAL(5,2) DEFAULT 55,
        mode VARCHAR(20) DEFAULT 'reinvest',
        entry_ratio DECIMAL(10,6) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        investor_name VARCHAR(255),
        amount DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      INSERT INTO portfolio (id, total_capital, initial_capital)
      VALUES (1, 0, 0)
      ON CONFLICT (id) DO NOTHING;
    `)
    
    // Migration: add entry_ratio column if not exists
    await pool.query(`
      ALTER TABLE investors ADD COLUMN IF NOT EXISTS entry_ratio DECIMAL(10,6) DEFAULT 1.0;
    `)
    
    console.log('PostgreSQL connected and tables ready')
  } catch (error) {
    console.error('PostgreSQL connection failed, using memory:', error.message)
    useMemory = true
  }
}

// Initialize on module load
initDB()

export async function getData() {
  if (useMemory) {
    return { ...memoryStore }
  }

  try {
    const portfolioRes = await pool.query('SELECT * FROM portfolio WHERE id = 1')
    const investorsRes = await pool.query('SELECT * FROM investors ORDER BY created_at')
    const historyRes = await pool.query('SELECT * FROM history ORDER BY created_at DESC LIMIT 100')
    
    const portfolio = portfolioRes.rows[0] || { total_capital: 0, initial_capital: 0 }
    
    return {
      totalCapital: parseFloat(portfolio.total_capital) || 0,
      initialCapital: parseFloat(portfolio.initial_capital) || 0,
      investors: investorsRes.rows.map(inv => ({
        id: inv.id,
        name: inv.name,
        capital: parseFloat(inv.capital),
        commissionRate: parseFloat(inv.commission_rate),
        mode: inv.mode,
        entryRatio: parseFloat(inv.entry_ratio) || 1.0,
        createdAt: inv.created_at
      })),
      history: historyRes.rows.map(h => ({
        type: h.type,
        investor: h.investor_name,
        amount: parseFloat(h.amount),
        date: h.created_at
      }))
    }
  } catch (error) {
    console.error('getData error:', error)
    return { totalCapital: 0, initialCapital: 0, investors: [], history: [] }
  }
}

export async function addInvestor(investor) {
  if (useMemory) {
    memoryStore.investors.push(investor)
    memoryStore.initialCapital += investor.capital
    memoryStore.totalCapital += investor.capital
    memoryStore.history.unshift({
      type: 'Nouvel investisseur',
      investor: investor.name,
      amount: investor.capital,
      date: new Date().toISOString()
    })
    return investor
  }

  try {
    await pool.query('BEGIN')
    
    // Calculate entry ratio BEFORE adding new capital
    // This ensures the new investor doesn't inherit past gains
    const portfolioRes = await pool.query('SELECT total_capital, initial_capital FROM portfolio WHERE id = 1')
    const portfolio = portfolioRes.rows[0]
    const currentTotal = parseFloat(portfolio?.total_capital) || 0
    const currentInitial = parseFloat(portfolio?.initial_capital) || 0
    // Entry ratio = current performance. New investor starts at this point.
    const entryRatio = currentInitial > 0 ? currentTotal / currentInitial : 1.0
    
    const res = await pool.query(
      `INSERT INTO investors (name, capital, commission_rate, mode, entry_ratio) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [investor.name, investor.capital, investor.commissionRate, investor.mode, entryRatio]
    )
    
    await pool.query(
      `UPDATE portfolio SET 
        total_capital = total_capital + $1,
        initial_capital = initial_capital + $1,
        updated_at = NOW()
       WHERE id = 1`,
      [investor.capital]
    )
    
    await pool.query(
      `INSERT INTO history (type, investor_name, amount) VALUES ($1, $2, $3)`,
      ['Nouvel investisseur', investor.name, investor.capital]
    )
    
    await pool.query('COMMIT')
    
    return {
      id: res.rows[0].id,
      name: res.rows[0].name,
      capital: parseFloat(res.rows[0].capital),
      commissionRate: parseFloat(res.rows[0].commission_rate),
      mode: res.rows[0].mode,
      createdAt: res.rows[0].created_at
    }
  } catch (error) {
    await pool.query('ROLLBACK')
    throw error
  }
}

export async function updateCapital(newTotal) {
  if (useMemory) {
    const diff = newTotal - memoryStore.totalCapital
    memoryStore.totalCapital = newTotal
    memoryStore.history.unshift({
      type: diff >= 0 ? 'Profit' : 'Perte',
      investor: null,
      amount: diff,
      date: new Date().toISOString()
    })
    return { oldTotal: memoryStore.totalCapital - diff, newTotal, diff }
  }

  try {
    const oldRes = await pool.query('SELECT total_capital FROM portfolio WHERE id = 1')
    const oldTotal = parseFloat(oldRes.rows[0]?.total_capital) || 0
    const diff = newTotal - oldTotal
    
    await pool.query(
      'UPDATE portfolio SET total_capital = $1, updated_at = NOW() WHERE id = 1',
      [newTotal]
    )
    
    await pool.query(
      `INSERT INTO history (type, amount) VALUES ($1, $2)`,
      [diff >= 0 ? 'Profit' : 'Perte', diff]
    )
    
    return { oldTotal, newTotal, diff }
  } catch (error) {
    throw error
  }
}

export async function updateInvestor(id, updates) {
  if (useMemory) {
    const idx = memoryStore.investors.findIndex(i => i.id === id)
    if (idx >= 0) {
      memoryStore.investors[idx] = { ...memoryStore.investors[idx], ...updates }
    }
    return memoryStore.investors[idx]
  }

  try {
    const sets = []
    const values = []
    let paramCount = 1
    
    if (updates.mode) {
      sets.push(`mode = $${paramCount++}`)
      values.push(updates.mode)
    }
    if (updates.commissionRate !== undefined) {
      sets.push(`commission_rate = $${paramCount++}`)
      values.push(updates.commissionRate)
    }
    if (updates.capital !== undefined) {
      sets.push(`capital = $${paramCount++}`)
      values.push(updates.capital)
    }
    
    values.push(id)
    
    const res = await pool.query(
      `UPDATE investors SET ${sets.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    )
    
    return res.rows[0]
  } catch (error) {
    throw error
  }
}

export async function removeInvestor(id) {
  if (useMemory) {
    const idx = memoryStore.investors.findIndex(i => i.id === id)
    if (idx >= 0) {
      const investor = memoryStore.investors[idx]
      const share = investor.capital / memoryStore.initialCapital
      memoryStore.initialCapital -= investor.capital
      memoryStore.totalCapital -= memoryStore.totalCapital * share
      memoryStore.investors.splice(idx, 1)
      memoryStore.history.unshift({
        type: 'Investisseur retiré',
        investor: investor.name,
        amount: -investor.capital,
        date: new Date().toISOString()
      })
    }
    return true
  }

  try {
    const investorRes = await pool.query('SELECT * FROM investors WHERE id = $1', [id])
    if (investorRes.rows.length === 0) return false
    
    const investor = investorRes.rows[0]
    const portfolioRes = await pool.query('SELECT * FROM portfolio WHERE id = 1')
    const portfolio = portfolioRes.rows[0]
    
    const share = parseFloat(investor.capital) / parseFloat(portfolio.initial_capital)
    const valueToRemove = share * parseFloat(portfolio.total_capital)
    
    await pool.query('BEGIN')
    
    await pool.query('DELETE FROM investors WHERE id = $1', [id])
    
    await pool.query(
      `UPDATE portfolio SET 
        initial_capital = initial_capital - $1,
        total_capital = total_capital - $2,
        updated_at = NOW()
       WHERE id = 1`,
      [investor.capital, valueToRemove]
    )
    
    await pool.query(
      `INSERT INTO history (type, investor_name, amount) VALUES ($1, $2, $3)`,
      ['Investisseur retiré', investor.name, -parseFloat(investor.capital)]
    )
    
    await pool.query('COMMIT')
    return true
  } catch (error) {
    await pool.query('ROLLBACK')
    throw error
  }
}

export async function handleCommission(investorId, action, amount) {
  const data = await getData()
  const investor = data.investors.find(i => i.id === investorId)
  if (!investor) throw new Error('Investor not found')
  
  // Calculate gains based on entry ratio
  const currentRatio = data.initialCapital > 0 ? data.totalCapital / data.initialCapital : 1
  const entryRatio = investor.entryRatio || 1.0
  const performanceSinceEntry = entryRatio > 0 ? currentRatio / entryRatio : 1
  const currentValue = investor.capital * performanceSinceEntry
  const gains = currentValue - investor.capital
  const maxCommission = gains > 0 ? gains * (investor.commissionRate / 100) : 0
  const commissionAmount = amount ? Math.min(amount, maxCommission) : maxCommission
  
  if (commissionAmount <= 0) throw new Error('No commission available')
  
  if (useMemory) {
    if (action === 'withdraw') {
      memoryStore.totalCapital -= commissionAmount
      memoryStore.history.unshift({
        type: 'Commission retirée',
        investor: investor.name,
        amount: -commissionAmount,
        date: new Date().toISOString()
      })
    } else {
      const idx = memoryStore.investors.findIndex(i => i.id === investorId)
      memoryStore.investors[idx].capital += commissionAmount
      memoryStore.initialCapital += commissionAmount
      memoryStore.history.unshift({
        type: 'Commission réinvestie',
        investor: investor.name,
        amount: commissionAmount,
        date: new Date().toISOString()
      })
    }
    return { action, amount: commissionAmount }
  }

  try {
    await pool.query('BEGIN')
    
    if (action === 'withdraw') {
      await pool.query(
        'UPDATE portfolio SET total_capital = total_capital - $1, updated_at = NOW() WHERE id = 1',
        [commissionAmount]
      )
      await pool.query(
        `INSERT INTO history (type, investor_name, amount) VALUES ($1, $2, $3)`,
        ['Commission retirée', investor.name, -commissionAmount]
      )
    } else {
      await pool.query(
        'UPDATE investors SET capital = capital + $1 WHERE id = $2',
        [commissionAmount, investorId]
      )
      await pool.query(
        'UPDATE portfolio SET initial_capital = initial_capital + $1, updated_at = NOW() WHERE id = 1',
        [commissionAmount]
      )
      await pool.query(
        `INSERT INTO history (type, investor_name, amount) VALUES ($1, $2, $3)`,
        ['Commission réinvestie', investor.name, commissionAmount]
      )
    }
    
    await pool.query('COMMIT')
    return { action, amount: commissionAmount }
  } catch (error) {
    await pool.query('ROLLBACK')
    throw error
  }
}

// Backup function for cron job
export async function createBackup() {
  const data = await getData()
  return JSON.stringify(data, null, 2)
}
