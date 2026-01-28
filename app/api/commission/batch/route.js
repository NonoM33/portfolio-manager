import { getData } from '@/lib/db'
import pg from 'pg'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DATABASE_URL = process.env.DATABASE_URL

export async function POST(request) {
  try {
    const body = await request.json()
    const { reinvestments } = body // Array of { investorId, action, amount? }
    
    if (!reinvestments || !Array.isArray(reinvestments)) {
      return NextResponse.json({ error: 'reinvestments array required' }, { status: 400 })
    }
    
    // Take SNAPSHOT of all current values BEFORE any modifications
    const snapshot = await getData()
    
    // Calculate each investor's commission based on snapshot
    const investorCommissions = {}
    const currentRatio = snapshot.initialCapital > 0 ? snapshot.totalCapital / snapshot.initialCapital : 1
    for (const investor of snapshot.investors) {
      // Calculate gains based on entry ratio (when investor joined)
      const entryRatio = investor.entryRatio || 1.0
      const performanceSinceEntry = entryRatio > 0 ? currentRatio / entryRatio : 1
      const currentValue = investor.capital * performanceSinceEntry
      const gains = currentValue - investor.capital
      const maxCommission = gains > 0 ? gains * (investor.commissionRate / 100) : 0
      
      investorCommissions[investor.id] = {
        name: investor.name,
        capital: investor.capital,
        currentValue: Math.round(currentValue * 100) / 100,
        gains: Math.round(gains * 100) / 100,
        maxCommission: Math.round(maxCommission * 100) / 100
      }
    }
    
    // Validate all reinvestments before applying any
    const validatedReinvestments = []
    for (const r of reinvestments) {
      const investorData = investorCommissions[r.investorId]
      if (!investorData) {
        return NextResponse.json({ error: `Investor ${r.investorId} not found` }, { status: 400 })
      }
      
      const amount = r.amount !== undefined ? parseFloat(r.amount) : investorData.maxCommission
      
      if (amount > investorData.maxCommission + 0.01) { // small tolerance for rounding
        return NextResponse.json({ 
          error: `Cannot ${r.action} ${amount}€ for ${investorData.name}, max is ${investorData.maxCommission}€` 
        }, { status: 400 })
      }
      
      if (amount > 0) {
        validatedReinvestments.push({
          investorId: r.investorId,
          action: r.action || 'reinvest',
          amount: Math.round(amount * 100) / 100,
          name: investorData.name
        })
      }
    }
    
    if (validatedReinvestments.length === 0) {
      return NextResponse.json({ error: 'No valid reinvestments to apply' }, { status: 400 })
    }
    
    // Apply all in a single transaction
    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Batch operation requires database' }, { status: 400 })
    }
    
    const { Pool } = pg
    const pool = new Pool({ connectionString: DATABASE_URL })
    
    try {
      await pool.query('BEGIN')
      
      let totalReinvested = 0
      let totalWithdrawn = 0
      
      for (const r of validatedReinvestments) {
        if (r.action === 'withdraw') {
          await pool.query(
            'UPDATE portfolio SET total_capital = total_capital - $1, updated_at = NOW() WHERE id = 1',
            [r.amount]
          )
          await pool.query(
            `INSERT INTO history (type, investor_name, amount) VALUES ($1, $2, $3)`,
            ['Commission retirée (batch)', r.name, -r.amount]
          )
          totalWithdrawn += r.amount
        } else {
          // reinvest
          await pool.query(
            'UPDATE investors SET capital = capital + $1 WHERE id = $2',
            [r.amount, r.investorId]
          )
          await pool.query(
            'UPDATE portfolio SET initial_capital = initial_capital + $1, updated_at = NOW() WHERE id = 1',
            [r.amount]
          )
          await pool.query(
            `INSERT INTO history (type, investor_name, amount) VALUES ($1, $2, $3)`,
            ['Commission réinvestie (batch)', r.name, r.amount]
          )
          totalReinvested += r.amount
        }
      }
      
      await pool.query('COMMIT')
      
      return NextResponse.json({
        success: true,
        applied: validatedReinvestments.length,
        totalReinvested: Math.round(totalReinvested * 100) / 100,
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        snapshot: investorCommissions,
        details: validatedReinvestments
      })
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    } finally {
      await pool.end()
    }
  } catch (error) {
    console.error('Batch commission error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
