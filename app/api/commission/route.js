import { getData, saveData, addHistory } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const body = await request.json()
  const { investorId, action, amount } = body
  
  const data = getData()
  const investor = data.investors.find(i => i.id === investorId)
  
  if (!investor) {
    return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
  }
  
  // Calculate current gains and commission
  const share = investor.capital / data.initialCapital
  const currentValue = share * data.totalCapital
  const gains = currentValue - investor.capital
  const maxCommission = gains > 0 ? gains * (investor.commissionRate / 100) : 0
  
  const commissionAmount = amount ? Math.min(amount, maxCommission) : maxCommission
  
  if (commissionAmount <= 0) {
    return NextResponse.json({ error: 'No commission available' }, { status: 400 })
  }
  
  if (action === 'withdraw') {
    // Withdraw: reduce total capital, keep investor's base capital same
    data.totalCapital -= commissionAmount
    addHistory(data, 'Commission retirée', investor.name, -commissionAmount)
  } else if (action === 'reinvest') {
    // Reinvest: add to investor's capital base
    investor.capital += commissionAmount
    data.initialCapital += commissionAmount
    addHistory(data, 'Commission réinvestie', investor.name, commissionAmount)
  }
  
  saveData(data)
  
  return NextResponse.json({ success: true, action, amount: commissionAmount })
}
