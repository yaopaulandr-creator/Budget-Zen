import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createDefaultCategories, createDefaultSettings } from '../domain/defaults'
import { nowISOString, todayISO } from '../domain/dates'
import type {
  AppData,
  Budget,
  Category,
  RecurringOccurrence,
  RecurringRule,
  SavingsGoal,
  Transaction,
  UserSettings,
} from '../domain/types'

const DB_NAME = 'budgetzen'
const DB_VERSION = 1

export type StoreName =
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'savingsGoals'
  | 'recurringRules'
  | 'occurrences'
  | 'settings'

interface BudgetZenDB extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string; 'by-category': string }
  }
  categories: {
    key: string
    value: Category
    indexes: { 'by-type': string }
  }
  budgets: { key: string; value: Budget; indexes: { 'by-category': string } }
  savingsGoals: { key: string; value: SavingsGoal }
  recurringRules: { key: string; value: RecurringRule }
  occurrences: {
    key: string
    value: RecurringOccurrence
    indexes: { 'by-rule': string; 'by-date': string }
  }
  settings: { key: string; value: UserSettings }
}

let dbPromise: Promise<IDBPDatabase<BudgetZenDB>> | null = null

function getDB(): Promise<IDBPDatabase<BudgetZenDB>> {
  if (!dbPromise) {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB n’est pas disponible dans ce navigateur.'))
    }
    dbPromise = openDB<BudgetZenDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transactions')) {
          const store = db.createObjectStore('transactions', { keyPath: 'id' })
          store.createIndex('by-date', 'transactionDate')
          store.createIndex('by-category', 'categoryId')
        }
        if (!db.objectStoreNames.contains('categories')) {
          const store = db.createObjectStore('categories', { keyPath: 'id' })
          store.createIndex('by-type', 'type')
        }
        if (!db.objectStoreNames.contains('budgets')) {
          const store = db.createObjectStore('budgets', { keyPath: 'id' })
          store.createIndex('by-category', 'categoryId')
        }
        if (!db.objectStoreNames.contains('savingsGoals')) {
          db.createObjectStore('savingsGoals', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('recurringRules')) {
          db.createObjectStore('recurringRules', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('occurrences')) {
          const store = db.createObjectStore('occurrences', { keyPath: 'id' })
          store.createIndex('by-rule', 'recurringRuleId')
          store.createIndex('by-date', 'scheduledDate')
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' })
        }
      },
      blocked() {
        // Another tab keeps an older version open; the browser will retry on close.
      },
    })
  }
  return dbPromise
}

export async function loadAppData(): Promise<AppData | null> {
  const db = await getDB()
  const [transactions, categories, budgets, savingsGoals, recurringRules, occurrences, settings] =
    await Promise.all([
      db.getAll('transactions'),
      db.getAll('categories'),
      db.getAll('budgets'),
      db.getAll('savingsGoals'),
      db.getAll('recurringRules'),
      db.getAll('occurrences'),
      db.get('settings', 'settings'),
    ])

  const isEmpty =
    transactions.length === 0 &&
    categories.length === 0 &&
    budgets.length === 0 &&
    savingsGoals.length === 0 &&
    recurringRules.length === 0 &&
    occurrences.length === 0 &&
    !settings
  if (isEmpty) return null

  return {
    transactions,
    categories,
    budgets,
    savingsGoals,
    recurringRules,
    occurrences,
    settings: settings ?? createDefaultSettings(),
  }
}

async function seedIfNeeded(): Promise<AppData> {
  const existing = await loadAppData()
  if (existing) return existing
  const now = nowISOString()
  const data: AppData = {
    transactions: [],
    categories: createDefaultCategories(now),
    budgets: [],
    savingsGoals: [],
    recurringRules: [],
    occurrences: [],
    settings: createDefaultSettings(now, todayISO()),
  }
  await replaceAllData(data)
  return data
}

export async function initializeAppData(): Promise<AppData> {
  return seedIfNeeded()
}

export async function putEntity(store: StoreName, value: unknown): Promise<void> {
  const db = await getDB()
  await (db as IDBPDatabase).put(store, value)
}

export async function putEntities(store: StoreName, values: unknown[]): Promise<void> {
  if (values.length === 0) return
  const db = await getDB()
  const tx = (db as IDBPDatabase).transaction(store, 'readwrite')
  const objectStore = tx.objectStore(store)
  await Promise.all([...values.map((value) => objectStore.put(value)), tx.done])
}

export async function deleteEntity(store: StoreName, id: string): Promise<void> {
  const db = await getDB()
  await (db as IDBPDatabase).delete(store, id)
}

export interface BatchChanges {
  transactions?: Transaction[]
  updatedTransactions?: Transaction[]
  occurrences?: RecurringOccurrence[]
  updatedOccurrences?: RecurringOccurrence[]
  recurringRules?: RecurringRule[]
  updatedRules?: RecurringRule[]
}

/** Atomically persists a recurring generation batch. */
export async function writeRecurringBatch(changes: BatchChanges): Promise<void> {
  const db = await getDB() as IDBPDatabase
  const stores = ['transactions', 'occurrences', 'recurringRules'] as const
  const tx = db.transaction(stores, 'readwrite')
  const jobs: Array<Promise<unknown>> = []
  for (const transaction of changes.transactions ?? []) jobs.push(tx.objectStore('transactions').add(transaction))
  for (const transaction of changes.updatedTransactions ?? []) jobs.push(tx.objectStore('transactions').put(transaction))
  for (const occurrence of changes.occurrences ?? []) jobs.push(tx.objectStore('occurrences').add(occurrence))
  for (const occurrence of changes.updatedOccurrences ?? []) jobs.push(tx.objectStore('occurrences').put(occurrence))
  for (const rule of changes.recurringRules ?? []) jobs.push(tx.objectStore('recurringRules').add(rule))
  for (const rule of changes.updatedRules ?? []) jobs.push(tx.objectStore('recurringRules').put(rule))
  await Promise.all(jobs)
  await tx.done
}

/** Deletes a transaction and unlinks its recurring occurrence in one transaction. */
export async function deleteTransactionAtomic(
  transactionId: string,
  occurrence?: RecurringOccurrence,
): Promise<void> {
  const db = await getDB() as IDBPDatabase
  const tx = db.transaction(['transactions', 'occurrences'], 'readwrite')
  await tx.objectStore('transactions').delete(transactionId)
  if (occurrence) await tx.objectStore('occurrences').put(occurrence)
  await tx.done
}

/** Replaces every store in one transaction. Used by backup restore only. */
export async function replaceAllData(data: AppData): Promise<void> {
  const db = await getDB() as IDBPDatabase
  const stores: StoreName[] = [
    'transactions',
    'categories',
    'budgets',
    'savingsGoals',
    'recurringRules',
    'occurrences',
    'settings',
  ]
  const tx = db.transaction(stores, 'readwrite')
  const jobs: Array<Promise<unknown>> = []
  for (const store of stores) jobs.push(tx.objectStore(store).clear())
  for (const value of data.transactions) jobs.push(tx.objectStore('transactions').put(value))
  for (const value of data.categories) jobs.push(tx.objectStore('categories').put(value))
  for (const value of data.budgets) jobs.push(tx.objectStore('budgets').put(value))
  for (const value of data.savingsGoals) jobs.push(tx.objectStore('savingsGoals').put(value))
  for (const value of data.recurringRules) jobs.push(tx.objectStore('recurringRules').put(value))
  for (const value of data.occurrences) jobs.push(tx.objectStore('occurrences').put(value))
  jobs.push(tx.objectStore('settings').put(data.settings))
  await Promise.all(jobs)
  await tx.done
}

export async function resetAllData(): Promise<AppData> {
  const now = nowISOString()
  const data: AppData = {
    transactions: [],
    categories: createDefaultCategories(now),
    budgets: [],
    savingsGoals: [],
    recurringRules: [],
    occurrences: [],
    settings: createDefaultSettings(now, todayISO()),
  }
  await replaceAllData(data)
  return data
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const estimate = await navigator.storage.estimate()
    return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  } catch {
    return null
  }
}
