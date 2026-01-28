import { getData } from '@/lib/db'
import pg from 'pg'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DATABASE_URL = process.env.DATABASE_URL

export async function PATCH(request, { params }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { newCapital } = body
    
    if (newCapital === undefined || newCapital <= 0) {
      return NextResponse.json({ error: 'newCapital must be a positive number' }, { status: 400 })
    }
    
    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Database required for this operation' }, { status: 400 })
    }
    
    const { Pool } = pg
    const pool = new Pool({ connectionString: DATABASE_URL })
    
    try {
      // Get current investor capital
      const investorRes = await pool.query('SELECT * FROM investors WHERE id = $1', [id])
      
      if (investorRes.rows.length === 0) {
        return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
      }
      
      const investor = investorRes.rows[0]
      const oldCapital = parseFloat(investor.capital)
      const capitalDiff = newCapital - oldCapital
      
      await pool.query('BEGIN')
      
      // Update investor capital
      await pool.query(
        'UPDATE investors SET capital = $1 WHERE id = $2',
        [newCapital, id]
      )
      
      // Adjust initial_capital in portfolio (this is a correction, not new money)
      await pool.query(
        'UPDATE portfolio SET initial_capital = initial_capital + $1, updated_at = NOW() WHERE id = 1',
        [capitalDiff]
      )
      
      // Log the change
      await pool.query(
        `INSERT INTO history (type, investor_name, amount) VALUES ($1, $2, $3)`,
        [
          capitalDiff >= 0 ? 'Capital ajusté (+)' : 'Capital ajusté (-)', 
          investor.name, 
          capitalDiff
        ]
      )
      
      await pool.query('COMMIT')
      
      return NextResponse.json({ 
        success: true, 
        investor: investor.name,
        oldCapital,
        newCapital,
        capitalDiff
      })
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    } finally {
      await pool.end()
    }
  } catch (error) {
    console.error('Update capital error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
