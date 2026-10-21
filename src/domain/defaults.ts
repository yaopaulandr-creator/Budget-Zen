import { nowISOString, todayISO } from './dates'
import type { Category, TransactionType, UserSettings } from './types'

interface CategorySeed {
  id: string
  name: string
  type: TransactionType
  icon: string
  color: string
}

const INCOME_SEEDS: CategorySeed[] = [
  { id: 'cat-income-salary', name: 'Salaire', type: 'income', icon: 'briefcase', color: '#1F7A4D' },
  { id: 'cat-income-bonus', name: 'Primes et bonus', type: 'income', icon: 'gift', color: '#2E8B57' },
  { id: 'cat-income-freelance', name: 'Activité indépendante', type: 'income', icon: 'laptop', color: '#3A7D6C' },
  { id: 'cat-income-rental', name: 'Revenus locatifs', type: 'income', icon: 'building', color: '#4C7A61' },
  { id: 'cat-income-benefits', name: 'Allocations et aides', type: 'income', icon: 'heart-handshake', color: '#5B8C5A' },
  { id: 'cat-income-refund', name: 'Remboursements', type: 'income', icon: 'rotate-ccw', color: '#3F7F8F' },
  { id: 'cat-income-interest', name: 'Intérêts et placements', type: 'income', icon: 'trending-up', color: '#2F6F5E' },
  { id: 'cat-income-gifts', name: 'Cadeaux et autres revenus', type: 'income', icon: 'sparkles', color: '#6B8E23' },
  { id: 'cat-income-other', name: 'Autres revenus', type: 'income', icon: 'circle-ellipsis', color: '#6B7280' },
]

const EXPENSE_SEEDS: CategorySeed[] = [
  { id: 'cat-expense-housing', name: 'Logement et loyer', type: 'expense', icon: 'home', color: '#B46A55' },
  { id: 'cat-expense-energy', name: 'Électricité, eau et énergie', type: 'expense', icon: 'zap', color: '#C98A3B' },
  { id: 'cat-expense-phone', name: 'Téléphone et Internet', type: 'expense', icon: 'wifi', color: '#5E7FA3' },
  { id: 'cat-expense-groceries', name: 'Courses alimentaires', type: 'expense', icon: 'shopping-basket', color: '#C2703D' },
  { id: 'cat-expense-restaurants', name: 'Restaurants et sorties', type: 'expense', icon: 'utensils', color: '#C9544D' },
  { id: 'cat-expense-transport', name: 'Transport et carburant', type: 'expense', icon: 'car', color: '#A06A4F' },
  { id: 'cat-expense-health', name: 'Santé et pharmacie', type: 'expense', icon: 'stethoscope', color: '#B34F6E' },
  { id: 'cat-expense-insurance', name: 'Assurances', type: 'expense', icon: 'shield-check', color: '#7A6A9B' },
  { id: 'cat-expense-subscriptions', name: 'Abonnements', type: 'expense', icon: 'repeat', color: '#7C6FA3' },
  { id: 'cat-expense-leisure', name: 'Loisirs et divertissement', type: 'expense', icon: 'gamepad-2', color: '#9A5FA3' },
  { id: 'cat-expense-shopping', name: 'Shopping et vêtements', type: 'expense', icon: 'shirt', color: '#B85C8A' },
  { id: 'cat-expense-education', name: 'Éducation et formation', type: 'expense', icon: 'graduation-cap', color: '#4D6FA8' },
  { id: 'cat-expense-family', name: 'Famille et enfants', type: 'expense', icon: 'baby', color: '#C77B4A' },
  { id: 'cat-expense-taxes', name: 'Impôts et taxes', type: 'expense', icon: 'landmark', color: '#8A6A5A' },
  { id: 'cat-expense-travel', name: 'Voyages et vacances', type: 'expense', icon: 'plane', color: '#3F8A9B' },
  { id: 'cat-expense-maintenance', name: 'Entretien et réparations', type: 'expense', icon: 'wrench', color: '#7B7B6A' },
  { id: 'cat-expense-other', name: 'Autres dépenses', type: 'expense', icon: 'circle-ellipsis', color: '#6B7280' },
]

export const CATEGORY_SWATCHES = [
  '#1F7A4D',
  '#B46A55',
  '#C98A3B',
  '#5E7FA3',
  '#B34F6E',
  '#7A6A9B',
  '#3F8A9B',
  '#C2703D',
  '#8A6A5A',
  '#6B7280',
  '#4D6FA8',
  '#9A5FA3',
]

export function createDefaultCategories(now: string = nowISOString()): Category[] {
  return [...INCOME_SEEDS, ...EXPENSE_SEEDS].map((seed) => ({
    ...seed,
    isDefault: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }))
}

export function createDefaultSettings(now: string = nowISOString(), today: string = todayISO()): UserSettings {
  return {
    id: 'settings',
    initialBalanceCents: 0,
    balanceReferenceDate: today,
    currency: 'EUR',
    locale: 'fr-FR',
    timezone: 'Europe/Paris',
    autoConfirmRecurring: true,
    createdAt: now,
    updatedAt: now,
  }
}
