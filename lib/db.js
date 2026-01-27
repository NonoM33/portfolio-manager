import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'data', 'portfolio.json')

const defaultData = {
  totalCapital: 0,
  initialCapital: 0,
  investors: [],
  history: []
}

export function getData() {
  try {
    if (!existsSync(DATA_FILE)) {
      writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2))
      return defaultData
    }
    const raw = readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    return defaultData
  }
}

export function saveData(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

export function addHistory(data, type, investor, amount) {
  data.history.unshift({
    type,
    investor,
    amount,
    date: new Date().toISOString()
  })
  // Keep only last 100 entries
  if (data.history.length > 100) {
    data.history = data.history.slice(0, 100)
  }
}
