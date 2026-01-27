import { getData } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const data = getData()
  return NextResponse.json(data)
}
