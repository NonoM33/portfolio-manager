import { getData, saveData, addHistory } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const body = await request.json()
  const { newTotal } = body
  
  const data = getData()
  const oldTotal = data.totalCapital
  const diff = newTotal - oldTotal
  
  data.totalCapital = parseFloat(newTotal)
  
  addHistory(data, diff >= 0 ? 'Profit' : 'Perte', null, diff)
  
  saveData(data)
  
  return NextResponse.json({ success: true, oldTotal, newTotal: data.totalCapital, diff })
}
