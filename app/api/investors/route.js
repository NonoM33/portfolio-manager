import { addInvestor } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const { name, capital, commissionRate, mode } = body
    
    // Fix: handle 0% commission correctly (0 is falsy in JS)
    const rate = commissionRate !== undefined && commissionRate !== null && commissionRate !== '' 
      ? parseFloat(commissionRate) 
      : 55
    
    const investor = await addInvestor({
      name,
      capital: parseFloat(capital),
      commissionRate: rate,
      mode: mode || 'reinvest'
    })
    
    return NextResponse.json({ success: true, investor })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
