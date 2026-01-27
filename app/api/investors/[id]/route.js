import { getData, saveData, addHistory } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PATCH(request, { params }) {
  const { id } = await params
  const body = await request.json()
  
  const data = getData()
  const investor = data.investors.find(i => i.id === id)
  
  if (!investor) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  if (body.mode) investor.mode = body.mode
  if (body.commissionRate) investor.commissionRate = body.commissionRate
  
  saveData(data)
  
  return NextResponse.json({ success: true, investor })
}

export async function DELETE(request, { params }) {
  const { id } = await params
  
  const data = getData()
  const investor = data.investors.find(i => i.id === id)
  
  if (!investor) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  
  // Recalculate capitals
  data.initialCapital -= investor.capital
  const share = investor.capital / (data.initialCapital + investor.capital)
  data.totalCapital -= data.totalCapital * share
  
  data.investors = data.investors.filter(i => i.id !== id)
  
  addHistory(data, 'Investisseur retiré', investor.name, -investor.capital)
  
  saveData(data)
  
  return NextResponse.json({ success: true })
}
