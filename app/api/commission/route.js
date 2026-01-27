import { handleCommission } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const { investorId, action, amount } = body
    
    const result = await handleCommission(
      investorId, 
      action, 
      amount ? parseFloat(amount) : null
    )
    
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
