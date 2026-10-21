import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { buildDemoData, hasDemoData, stripDemoData } from '../domain/demo'
import { nowISOString, todayISO } from '../domain/dates'
import { normalizeBudgetAnchor } from '../domain/finance'
import { planRecurringGeneration } from '../domain/recurrence'
import type {
  AppData,
  Budget,
  BudgetDraft,
  Category,
  RecurringOccurrence,
  RecurringRule,
  RecurringRuleDraft,
  SavingsGoal,
  SavingsGoalDraft,
  SavingsGoalStatus,
  Transaction,
  TransactionDraft,
  TransactionType,
  UserSettings,
} from '../domain/types'
import {
  deleteEntity,
  deleteTransactionAtomic,
  initializeAppData,
  putEntity,
  replaceAllData,
  resetAllData,
  writeRecurringBatch,
} from '../storage/database'
import { useToast } from '../components/toast'

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function fail(message: string): never {
  throw new Error(message)
}

function assertCategory(
  data: AppData,
  categoryId: string,
  type: TransactionType,
  allowArchived: boolean,
): Category {
  const category = data.categories.find((item) => item.id === categoryId)
  if (!category) fail('La catégorie sélectionnée est introuvable.')
  if (category.type !== type) fail('La catégorie ne correspond pas au type d’opération.')
  if (!category.isActive && !allowArchived) fail('Cette catégorie est archivée. Choisissez une catégorie active.')
  return category
}

function assertNameAvailable(data: AppData, name: string, type: TransactionType, excludeId?: string): void {
  const normalized = name.trim().toLocaleLowerCase('fr-FR')
  const duplicate = data.categories.some(
    (category) =>
      category.id !== excludeId &&
      category.type === type &&
      category.name.toLocaleLowerCase('fr-FR') === normalized,
  )
  if (duplicate) fail('Une catégorie de ce type porte déjà ce nom.')
}

export interface GenerationResult {
  created: number
  confirmed: number
  pending: number
}

export interface AppStoreValue {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  data: AppData | null
  hasDemoData: boolean
  addTransaction: (draft: TransactionDraft) => Promise<Transaction>
  updateTransaction: (id: string, draft: TransactionDraft) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  addCategory: (values: { name: string; type: TransactionType; icon: string; color: string }) => Promise<Category>
  updateCategory: (id: string, values: { name: string; icon: string; color: string }) => Promise<void>
  setCategoryActive: (id: string, active: boolean) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addBudget: (draft: BudgetDraft) => Promise<Budget>
  updateBudget: (id: string, draft: BudgetDraft) => Promise<void>
  deleteBudget: (id: string) => Promise<void>
  addGoal: (draft: SavingsGoalDraft) => Promise<SavingsGoal>
  updateGoal: (id: string, draft: SavingsGoalDraft) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  contributeToGoal: (id: string, amountCents: number) => Promise<void>
  setGoalStatus: (id: string, status: SavingsGoalStatus) => Promise<void>
  addRule: (draft: RecurringRuleDraft) => Promise<RecurringRule>
  updateRule: (id: string, draft: RecurringRuleDraft) => Promise<void>
  setRuleActive: (id: string, active: boolean) => Promise<void>
  deleteRule: (id: string) => Promise<void>
  generateRecurring: (options?: { silent?: boolean }) => Promise<GenerationResult>
  confirmOccurrence: (id: string) => Promise<void>
  skipOccurrence: (id: string) => Promise<void>
  updateSettings: (values: {
    initialBalanceCents: number
    balanceReferenceDate: string
    autoConfirmRecurring: boolean
  }) => Promise<void>
  importData: (data: AppData) => Promise<void>
  resetAll: () => Promise<void>
  loadDemo: () => Promise<void>
  removeDemo: () => Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AppData | null>(null)
  const dataRef = useRef<AppData | null>(null)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const generationStarted = useRef(false)
  const initStarted = useRef(false)
  const { pushToast } = useToast()

  useEffect(() => {
    if (initStarted.current) return
    initStarted.current = true
    initializeAppData()
      .then((loaded) => {
        dataRef.current = loaded
        setData(loaded)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Le stockage local du navigateur est inaccessible. Vos données ne peuvent pas être chargées.',
        )
        setStatus('error')
      })
  }, [])

  /** Serialises every mutation so concurrent writes cannot overwrite each other. */
  const mutate = useCallback(
    <T,>(operation: (current: AppData) => Promise<{ data: AppData; result: T }>): Promise<T> => {
      const run = queueRef.current.then(async () => {
        const current = dataRef.current
        if (!current) throw new Error('Les données ne sont pas encore disponibles.')
        const outcome = await operation(current)
        dataRef.current = outcome.data
        setData(outcome.data)
        return outcome.result
      })
      queueRef.current = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
    [],
  )

  const addTransaction = useCallback(
    (draft: TransactionDraft) =>
      mutate(async (current) => {
        assertCategory(current, draft.categoryId, draft.type, false)
        const now = nowISOString()
        const transaction: Transaction = {
          id: newId(),
          type: draft.type,
          amountCents: draft.amountCents,
          transactionDate: draft.transactionDate,
          categoryId: draft.categoryId,
          description: draft.description.trim(),
          recurringOccurrenceId: null,
          createdAt: now,
          updatedAt: now,
        }
        await putEntity('transactions', transaction)
        return {
          data: { ...current, transactions: [transaction, ...current.transactions] },
          result: transaction,
        }
      }),
    [mutate],
  )

  const updateTransaction = useCallback(
    (id: string, draft: TransactionDraft) =>
      mutate(async (current) => {
        const existing = current.transactions.find((item) => item.id === id)
        if (!existing) fail('Cette transaction est introuvable.')
        assertCategory(
          current,
          draft.categoryId,
          draft.type,
          draft.categoryId === existing.categoryId,
        )
        const updated: Transaction = {
          ...existing,
          type: draft.type,
          amountCents: draft.amountCents,
          transactionDate: draft.transactionDate,
          categoryId: draft.categoryId,
          description: draft.description.trim(),
          updatedAt: nowISOString(),
        }
        await putEntity('transactions', updated)
        return {
          data: {
            ...current,
            transactions: current.transactions.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const deleteTransaction = useCallback(
    (id: string) =>
      mutate(async (current) => {
        const transaction = current.transactions.find((item) => item.id === id)
        if (!transaction) fail('Cette transaction est introuvable.')
        let updatedOccurrences = current.occurrences
        let occurrence: RecurringOccurrence | undefined
        if (transaction.recurringOccurrenceId) {
          const existingOccurrence = current.occurrences.find(
            (item) => item.id === transaction.recurringOccurrenceId,
          )
          if (existingOccurrence) {
            occurrence = {
              ...existingOccurrence,
              transactionId: null,
              status: 'skipped',
              updatedAt: nowISOString(),
            }
            updatedOccurrences = current.occurrences.map((item) =>
              item.id === occurrence?.id ? occurrence : item,
            )
          }
        }
        await deleteTransactionAtomic(id, occurrence)
        return {
          data: {
            ...current,
            transactions: current.transactions.filter((item) => item.id !== id),
            occurrences: updatedOccurrences,
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const addCategory = useCallback(
    (values: { name: string; type: TransactionType; icon: string; color: string }) =>
      mutate(async (current) => {
        assertNameAvailable(current, values.name, values.type)
        const now = nowISOString()
        const category: Category = {
          id: newId(),
          name: values.name.trim(),
          type: values.type,
          icon: values.icon,
          color: values.color,
          isDefault: false,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }
        await putEntity('categories', category)
        return { data: { ...current, categories: [...current.categories, category] }, result: category }
      }),
    [mutate],
  )

  const updateCategory = useCallback(
    (id: string, values: { name: string; icon: string; color: string }) =>
      mutate(async (current) => {
        const existing = current.categories.find((item) => item.id === id)
        if (!existing) fail('Cette catégorie est introuvable.')
        assertNameAvailable(current, values.name, existing.type, id)
        const updated: Category = {
          ...existing,
          name: values.name.trim(),
          icon: values.icon,
          color: values.color,
          updatedAt: nowISOString(),
        }
        await putEntity('categories', updated)
        return {
          data: {
            ...current,
            categories: current.categories.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const setCategoryActive = useCallback(
    (id: string, active: boolean) =>
      mutate(async (current) => {
        const existing = current.categories.find((item) => item.id === id)
        if (!existing) fail('Cette catégorie est introuvable.')
        const updated: Category = { ...existing, isActive: active, updatedAt: nowISOString() }
        await putEntity('categories', updated)
        return {
          data: {
            ...current,
            categories: current.categories.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const deleteCategory = useCallback(
    (id: string) =>
      mutate(async (current) => {
        const existing = current.categories.find((item) => item.id === id)
        if (!existing) fail('Cette catégorie est introuvable.')
        if (existing.isDefault) {
          fail('Les catégories prédéfinies ne peuvent pas être supprimées. Archivez-la pour la masquer.')
        }
        const usage =
          current.transactions.filter((item) => item.categoryId === id).length +
          current.recurringRules.filter((item) => item.categoryId === id).length +
          current.budgets.filter((item) => item.categoryId === id).length
        if (usage > 0) {
          fail(
            'Cette catégorie est utilisée par votre historique. Archivez-la pour conserver les données existantes.',
          )
        }
        await deleteEntity('categories', id)
        return {
          data: { ...current, categories: current.categories.filter((item) => item.id !== id) },
          result: undefined,
        }
      }),
    [mutate],
  )

  const assertBudgetAvailable = (
    current: AppData,
    categoryId: string,
    periodType: Budget['periodType'],
    excludeId?: string,
  ) => {
    const category = current.categories.find((item) => item.id === categoryId)
    if (!category) fail('La catégorie sélectionnée est introuvable.')
    if (category.type !== 'expense') fail('Un budget ne peut concerner qu’une catégorie de dépenses.')
    const duplicate = current.budgets.some(
      (budget) =>
        budget.id !== excludeId &&
        budget.categoryId === categoryId &&
        budget.periodType === periodType,
    )
    if (duplicate) fail('Un budget existe déjà pour cette catégorie et cette période.')
  }

  const addBudget = useCallback(
    (draft: BudgetDraft) =>
      mutate(async (current) => {
        assertBudgetAvailable(current, draft.categoryId, draft.periodType)
        const now = nowISOString()
        const budget: Budget = {
          id: newId(),
          categoryId: draft.categoryId,
          limitCents: draft.limitCents,
          periodType: draft.periodType,
          startDate: normalizeBudgetAnchor(draft.startDate, draft.periodType),
          alertThresholdPercent: draft.alertThresholdPercent,
          createdAt: now,
          updatedAt: now,
        }
        await putEntity('budgets', budget)
        return { data: { ...current, budgets: [...current.budgets, budget] }, result: budget }
      }),
    [mutate],
  )

  const updateBudget = useCallback(
    (id: string, draft: BudgetDraft) =>
      mutate(async (current) => {
        const existing = current.budgets.find((item) => item.id === id)
        if (!existing) fail('Ce budget est introuvable.')
        assertBudgetAvailable(current, draft.categoryId, draft.periodType, id)
        const updated: Budget = {
          ...existing,
          categoryId: draft.categoryId,
          limitCents: draft.limitCents,
          periodType: draft.periodType,
          startDate: normalizeBudgetAnchor(draft.startDate, draft.periodType),
          alertThresholdPercent: draft.alertThresholdPercent,
          updatedAt: nowISOString(),
        }
        await putEntity('budgets', updated)
        return {
          data: {
            ...current,
            budgets: current.budgets.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const deleteBudget = useCallback(
    (id: string) =>
      mutate(async (current) => {
        await deleteEntity('budgets', id)
        return {
          data: { ...current, budgets: current.budgets.filter((item) => item.id !== id) },
          result: undefined,
        }
      }),
    [mutate],
  )

  const addGoal = useCallback(
    (draft: SavingsGoalDraft) =>
      mutate(async (current) => {
        const now = nowISOString()
        const goal: SavingsGoal = {
          id: newId(),
          name: draft.name.trim(),
          targetCents: draft.targetCents,
          savedCents: draft.savedCents,
          targetDate: draft.targetDate,
          description: draft.description.trim(),
          status: draft.savedCents >= draft.targetCents ? 'achieved' : 'active',
          createdAt: now,
          updatedAt: now,
        }
        await putEntity('savingsGoals', goal)
        return { data: { ...current, savingsGoals: [...current.savingsGoals, goal] }, result: goal }
      }),
    [mutate],
  )

  const updateGoal = useCallback(
    (id: string, draft: SavingsGoalDraft) =>
      mutate(async (current) => {
        const existing = current.savingsGoals.find((item) => item.id === id)
        if (!existing) fail('Cet objectif est introuvable.')
        const status: SavingsGoalStatus =
          existing.status === 'archived'
            ? 'archived'
            : draft.savedCents >= draft.targetCents
              ? 'achieved'
              : 'active'
        const updated: SavingsGoal = {
          ...existing,
          name: draft.name.trim(),
          targetCents: draft.targetCents,
          savedCents: draft.savedCents,
          targetDate: draft.targetDate,
          description: draft.description.trim(),
          status,
          updatedAt: nowISOString(),
        }
        await putEntity('savingsGoals', updated)
        return {
          data: {
            ...current,
            savingsGoals: current.savingsGoals.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const deleteGoal = useCallback(
    (id: string) =>
      mutate(async (current) => {
        await deleteEntity('savingsGoals', id)
        return {
          data: { ...current, savingsGoals: current.savingsGoals.filter((item) => item.id !== id) },
          result: undefined,
        }
      }),
    [mutate],
  )

  const updateGoalPersisted = useCallback(
    async (id: string, updater: (goal: SavingsGoal) => SavingsGoal) => {
      return mutate(async (current) => {
        const existing = current.savingsGoals.find((item) => item.id === id)
        if (!existing) fail('Cet objectif est introuvable.')
        const updated = updater(existing)
        await putEntity('savingsGoals', updated)
        return {
          data: {
            ...current,
            savingsGoals: current.savingsGoals.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      })
    },
    [mutate],
  )

  const contributeToGoal = useCallback(
    (id: string, amountCents: number) =>
      updateGoalPersisted(id, (goal) => {
        if (goal.status === 'archived') fail('Cet objectif est archivé.')
        const savedCents = goal.savedCents + amountCents
        return {
          ...goal,
          savedCents,
          status: savedCents >= goal.targetCents ? 'achieved' : 'active',
          updatedAt: nowISOString(),
        }
      }),
    [updateGoalPersisted],
  )

  const setGoalStatus = useCallback(
    (id: string, status: SavingsGoalStatus) =>
      updateGoalPersisted(id, (goal) => ({ ...goal, status, updatedAt: nowISOString() })),
    [updateGoalPersisted],
  )

  const assertRuleDraft = (current: AppData, draft: RecurringRuleDraft) => {
    if (draft.endDate && draft.endDate < draft.startDate) {
      fail('La date de fin doit suivre la date de début.')
    }
    assertCategory(current, draft.categoryId, draft.type, false)
  }

  const addRule = useCallback(
    (draft: RecurringRuleDraft) =>
      mutate(async (current) => {
        assertRuleDraft(current, draft)
        const now = nowISOString()
        const rule: RecurringRule = {
          id: newId(),
          type: draft.type,
          amountCents: draft.amountCents,
          categoryId: draft.categoryId,
          description: draft.description.trim(),
          frequency: draft.frequency,
          startDate: draft.startDate,
          endDate: draft.endDate,
          nextOccurrenceDate: draft.startDate,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }
        await putEntity('recurringRules', rule)
        return { data: { ...current, recurringRules: [...current.recurringRules, rule] }, result: rule }
      }),
    [mutate],
  )

  const updateRule = useCallback(
    (id: string, draft: RecurringRuleDraft) =>
      mutate(async (current) => {
        const existing = current.recurringRules.find((item) => item.id === id)
        if (!existing) fail('Cette règle est introuvable.')
        assertRuleDraft(current, draft)
        const timingChanged =
          existing.frequency !== draft.frequency ||
          existing.startDate !== draft.startDate ||
          existing.type !== draft.type ||
          existing.categoryId !== draft.categoryId
        let nextOccurrenceDate = timingChanged ? draft.startDate : existing.nextOccurrenceDate
        if (nextOccurrenceDate < draft.startDate) nextOccurrenceDate = draft.startDate
        const updated: RecurringRule = {
          ...existing,
          type: draft.type,
          amountCents: draft.amountCents,
          categoryId: draft.categoryId,
          description: draft.description.trim(),
          frequency: draft.frequency,
          startDate: draft.startDate,
          endDate: draft.endDate,
          nextOccurrenceDate,
          updatedAt: nowISOString(),
        }
        await putEntity('recurringRules', updated)
        return {
          data: {
            ...current,
            recurringRules: current.recurringRules.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const setRuleActive = useCallback(
    (id: string, active: boolean) =>
      mutate(async (current) => {
        const existing = current.recurringRules.find((item) => item.id === id)
        if (!existing) fail('Cette règle est introuvable.')
        const updated: RecurringRule = {
          ...existing,
          isActive: active,
          updatedAt: nowISOString(),
        }
        await putEntity('recurringRules', updated)
        return {
          data: {
            ...current,
            recurringRules: current.recurringRules.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const deleteRule = useCallback(
    (id: string) =>
      mutate(async (current) => {
        if (!current.recurringRules.some((rule) => rule.id === id)) fail('Cette règle est introuvable.')
        const now = nowISOString()
        const skipped = current.occurrences
          .filter((occurrence) => occurrence.recurringRuleId === id && occurrence.status === 'pending')
          .map<RecurringOccurrence>((occurrence) => ({
            ...occurrence,
            status: 'skipped',
            transactionId: null,
            updatedAt: now,
          }))
        for (const occurrence of skipped) await putEntity('occurrences', occurrence)
        await deleteEntity('recurringRules', id)
        const skippedIds = new Set(skipped.map((occurrence) => occurrence.id))
        return {
          data: {
            ...current,
            recurringRules: current.recurringRules.filter((item) => item.id !== id),
            occurrences: current.occurrences.map((occurrence) =>
              skippedIds.has(occurrence.id)
                ? (skipped.find((item) => item.id === occurrence.id) ?? occurrence)
                : occurrence,
            ),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const generateRecurring = useCallback(
    async (options: { silent?: boolean } = {}): Promise<GenerationResult> => {
      const result = await mutate(async (current) => {
        const plan = planRecurringGeneration(current.recurringRules, current.occurrences, {
          autoConfirm: current.settings.autoConfirmRecurring,
          idFactory: newId,
          today: todayISO(),
          now: nowISOString(),
        })
        if (plan.occurrences.length === 0 && plan.updatedRules.length === 0) {
          return { data: current, result: { created: 0, confirmed: 0, pending: 0 } }
        }
        await writeRecurringBatch({
          transactions: plan.transactions,
          occurrences: plan.occurrences,
          updatedRules: plan.updatedRules,
        })
        const ruleById = new Map(plan.updatedRules.map((rule) => [rule.id, rule]))
        return {
          data: {
            ...current,
            transactions: [...plan.transactions, ...current.transactions],
            occurrences: [...plan.occurrences, ...current.occurrences],
            recurringRules: current.recurringRules.map((rule) => ruleById.get(rule.id) ?? rule),
          },
          result: {
            created: plan.occurrences.length,
            confirmed: plan.occurrences.filter((occurrence) => occurrence.status === 'confirmed').length,
            pending: plan.occurrences.filter((occurrence) => occurrence.status === 'pending').length,
          },
        }
      })
      if (result.created > 0) {
        pushToast(
          'success',
          `${result.created} échéance${result.created > 1 ? 's' : ''} récurrente${result.created > 1 ? 's' : ''} traitée${result.created > 1 ? 's' : ''}.`,
          result.pending > 0
            ? [`${result.confirmed} transaction(s) enregistrée(s), ${result.pending} en attente de confirmation.`]
            : undefined,
        )
      } else if (!options.silent) {
        pushToast('info', 'Aucune échéance récurrente à traiter pour aujourd’hui.')
      }
      return result
    },
    [mutate, pushToast],
  )

  const confirmOccurrence = useCallback(
    (id: string) =>
      mutate(async (current) => {
        const occurrence = current.occurrences.find((item) => item.id === id)
        if (!occurrence) fail('Cette échéance est introuvable.')
        if (occurrence.status !== 'pending') fail('Cette échéance a déjà été traitée.')
        const rule = current.recurringRules.find((item) => item.id === occurrence.recurringRuleId)
        if (!rule) fail('La règle associée à cette échéance a été supprimée.')
        const now = nowISOString()
        const transaction: Transaction = {
          id: newId(),
          type: rule.type,
          amountCents: rule.amountCents,
          transactionDate: occurrence.scheduledDate,
          categoryId: rule.categoryId,
          description: rule.description,
          recurringOccurrenceId: occurrence.id,
          createdAt: now,
          updatedAt: now,
        }
        const updatedOccurrence: RecurringOccurrence = {
          ...occurrence,
          transactionId: transaction.id,
          status: 'confirmed',
          updatedAt: now,
        }
        await writeRecurringBatch({
          transactions: [transaction],
          updatedOccurrences: [updatedOccurrence],
        })
        return {
          data: {
            ...current,
            transactions: [transaction, ...current.transactions],
            occurrences: current.occurrences.map((item) =>
              item.id === id ? updatedOccurrence : item,
            ),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const skipOccurrence = useCallback(
    (id: string) =>
      mutate(async (current) => {
        const occurrence = current.occurrences.find((item) => item.id === id)
        if (!occurrence) fail('Cette échéance est introuvable.')
        const updated: RecurringOccurrence = {
          ...occurrence,
          status: 'skipped',
          transactionId: null,
          updatedAt: nowISOString(),
        }
        await putEntity('occurrences', updated)
        return {
          data: {
            ...current,
            occurrences: current.occurrences.map((item) => (item.id === id ? updated : item)),
          },
          result: undefined,
        }
      }),
    [mutate],
  )

  const updateSettings = useCallback(
    (values: { initialBalanceCents: number; balanceReferenceDate: string; autoConfirmRecurring: boolean }) =>
      mutate(async (current) => {
        const now = nowISOString()
        const settings: UserSettings = {
          ...current.settings,
          initialBalanceCents: values.initialBalanceCents,
          balanceReferenceDate: values.balanceReferenceDate,
          autoConfirmRecurring: values.autoConfirmRecurring,
          updatedAt: now,
        }
        await putEntity('settings', settings)
        return { data: { ...current, settings }, result: undefined }
      }),
    [mutate],
  )

  const importData = useCallback(
    (incoming: AppData) =>
      mutate(async () => {
        await replaceAllData(incoming)
        generationStarted.current = true
        return { data: incoming, result: undefined }
      }).then(() => {
        pushToast('success', 'Sauvegarde restaurée. Les données précédentes ont été remplacées.')
      }),
    [mutate, pushToast],
  )

  const resetAll = useCallback(async () => {
    await mutate(async () => {
      const fresh = await resetAllData()
      generationStarted.current = true
      return { data: fresh, result: undefined }
    })
    pushToast('success', 'Toutes les données ont été supprimées. Les catégories par défaut sont restaurées.')
  }, [mutate, pushToast])

  const loadDemo = useCallback(async () => {
    await mutate(async (current) => {
      const demo = buildDemoData()
      const stripped = stripDemoData(current)
      const merged: AppData = {
        ...stripped,
        transactions: [...demo.transactions, ...stripped.transactions],
        budgets: [...demo.budgets, ...stripped.budgets],
        savingsGoals: [...demo.savingsGoals, ...stripped.savingsGoals],
      }
      await replaceAllData(merged)
      return { data: merged, result: undefined }
    })
    pushToast('info', 'Données de démonstration ajoutées. Elles sont identifiées et supprimables en un clic.')
  }, [mutate, pushToast])

  const removeDemo = useCallback(async () => {
    await mutate(async (current) => {
      const stripped = stripDemoData(current)
      await replaceAllData(stripped)
      return { data: stripped, result: undefined }
    })
    pushToast('success', 'Les données de démonstration ont été supprimées.')
  }, [mutate, pushToast])

  useEffect(() => {
    if (status !== 'ready' || generationStarted.current) return
    generationStarted.current = true
    void generateRecurring({ silent: true }).catch((cause: unknown) => {
      pushToast(
        'error',
        cause instanceof Error
          ? cause.message
          : 'Les échéances récurrentes n’ont pas pu être générées.',
      )
    })
  }, [status, generateRecurring, pushToast])

  const hasDemo = data ? hasDemoData(data) : false

  const value = useMemo<AppStoreValue>(
    () => ({
      status,
      error,
      data,
      hasDemoData: hasDemo,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      setCategoryActive,
      deleteCategory,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      contributeToGoal,
      setGoalStatus,
      addRule,
      updateRule,
      setRuleActive,
      deleteRule,
      generateRecurring,
      confirmOccurrence,
      skipOccurrence,
      updateSettings,
      importData,
      resetAll,
      loadDemo,
      removeDemo,
    }),
    [
      status,
      error,
      data,
      hasDemo,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      updateCategory,
      setCategoryActive,
      deleteCategory,
      addBudget,
      updateBudget,
      deleteBudget,
      addGoal,
      updateGoal,
      deleteGoal,
      contributeToGoal,
      setGoalStatus,
      addRule,
      updateRule,
      setRuleActive,
      deleteRule,
      generateRecurring,
      confirmOccurrence,
      skipOccurrence,
      updateSettings,
      importData,
      resetAll,
      loadDemo,
      removeDemo,
    ],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useApp(): AppStoreValue {
  const context = useContext(AppStoreContext)
  if (!context) throw new Error('useApp must be used within AppStoreProvider')
  return context
}

export function useAppData(): AppData {
  const { data } = useApp()
  if (!data) throw new Error('Les données ne sont pas encore disponibles.')
  return data
}

