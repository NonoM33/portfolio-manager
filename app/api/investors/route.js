import { getData, saveData, addHistory } from '@/lib/db'
import { NextResponse } from 'next/server'
import { v4 as uuid } from 'uuid'

export async function POST(request) {
  const body = await request.json()
  const { name, capital, commissionRate, mode } = body
  
  const data = getData()
  
  const investor = {
    id: uuid(),
    name,
    capital: parseFloat(capital),
    commissionRate: parseFloat(commissionRate) || 55,
    mode: mode || 'reinvest',
    createdAt: new Date().toISOString()
  }
  
  data.investors.push(investor)
  data.initialCapital += investor.capital
  data.totalCapital += investor.capital
  
  addHistory(data, 'Nouvel investisseur', name, investor.capital)
  
  saveData(data)
  
  return NextResponse.json({ success: true, investor })
}
