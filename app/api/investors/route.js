import { addInvestor } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const { name, capital, commissionRate, mode } = body
    
    const investor = await addInvestor({
      name,
      capital: parseFloat(capital),
      commissionRate: parseFloat(commissionRate) || 55,
      mode: mode || 'reinvest'
    })
    
    return NextResponse.json({ success: true, investor })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
