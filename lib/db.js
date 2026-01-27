import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'portfolio.json')
const BACKUP_FILE = join(DATA_DIR, 'portfolio.backup.json')

const defaultData = {
  totalCapital: 0,
  initialCapital: 0,
  investors: [],
  history: []
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

export function getData() {
  try {
    ensureDataDir()
    if (!existsSync(DATA_FILE)) {
      // Try to restore from backup
      if (existsSync(BACKUP_FILE)) {
        const backup = readFileSync(BACKUP_FILE, 'utf-8')
        writeFileSync(DATA_FILE, backup)
        return JSON.parse(backup)
      }
      writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2))
      return defaultData
    }
    const raw = readFileSync(DATA_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('Error reading data:', e)
    return defaultData
  }
}

export function saveData(data) {
  ensureDataDir()
  // Create backup before saving
  if (existsSync(DATA_FILE)) {
    copyFileSync(DATA_FILE, BACKUP_FILE)
  }
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
