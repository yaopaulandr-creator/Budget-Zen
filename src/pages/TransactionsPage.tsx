import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  ListFilter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useApp, useAppData } from '../state/AppStore'
import type { IsoDate, Transaction, TransactionType } from '../domain/types'
import { addDays, formatDateFR, startOfMonth, startOfYear, todayISO } from '../domain/dates'
import { formatEUR, formatSignedEUR, parseAmountToCents } from '../domain/money'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  SegmentedControl,
  cx,
  inputClass,
} from '../components/ui'
import { CategoryIcon } from '../components/CategoryIcon'
import { TransactionFormModal } from '../components/TransactionForm'
import { useToast } from '../components/toast'
import { createTransactionsCsv } from '../lib/csv'
import { datedFilename, triggerDownload } from '../lib/download'

type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'
type Scope = 'filtered' | 'all'
type FormState = { mode: 'edit'; transaction: Transaction } | { mode: 'duplicate'; transaction: Transaction } | null

const PAGE_SIZE = 20

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
}

function lastDayOfMonth(date: IsoDate): IsoDate {
  return addDays(startOfMonth(addDays(startOfMonth(date), 32)), -1)
}

export function TransactionsPage() {
  const data = useAppData()
  const { deleteTransaction } = useApp()
  const { pushToast } = useToast()

  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | TransactionType>('all')
  const [categoryId, setCategoryId] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [recurringOnly, setRecurringOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('date-desc')
  const [page, setPage] = useState(1)
  const [exportScope, setExportScope] = useState<Scope>('filtered')
  const [addOpen, setAddOpen] = useState(false)
  const [formState, setFormState] = useState<FormState>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)

  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  )

  const minCents = parseAmountToCents(minAmount, { allowZero: true })
  const maxCents = parseAmountToCents(maxAmount, { allowZero: true })
  const minInvalid = minAmount.trim() !== '' && minCents === null
  const maxInvalid = maxAmount.trim() !== '' && maxCents === null

  const filtered = useMemo(() => {
    const term = normalize(search.trim())
    const rows = data.transactions.filter((transaction) => {
      if (type !== 'all' && transaction.type !== type) return false
      if (categoryId !== 'all' && transaction.categoryId !== categoryId) return false
      if (dateFrom && transaction.transactionDate < dateFrom) return false
      if (dateTo && transaction.transactionDate > dateTo) return false
      if (minCents !== null && transaction.amountCents < minCents) return false
      if (maxCents !== null && transaction.amountCents > maxCents) return false
      if (recurringOnly && !transaction.recurringOccurrenceId) return false
      if (term) {
        const category = categoryById.get(transaction.categoryId)
        const haystack = normalize(`${transaction.description} ${category?.name ?? ''}`)
        if (!haystack.includes(term)) return false
      }
      return true
    })
    rows.sort((a, b) => {
      switch (sort) {
        case 'date-asc':
          return a.transactionDate.localeCompare(b.transactionDate) || a.createdAt.localeCompare(b.createdAt)
        case 'amount-desc':
          return b.amountCents - a.amountCents || b.transactionDate.localeCompare(a.transactionDate)
        case 'amount-asc':
          return a.amountCents - b.amountCents || b.transactionDate.localeCompare(a.transactionDate)
        case 'date-desc':
        default:
          return b.transactionDate.localeCompare(a.transactionDate) || b.createdAt.localeCompare(a.createdAt)
      }
    })
    return rows
  }, [
    data.transactions,
    categoryById,
    type,
    categoryId,
    dateFrom,
    dateTo,
    minCents,
    maxCents,
    recurringOnly,
    search,
    sort,
  ])

  const totals = useMemo(() => {
    let incomeCents = 0
    let expenseCents = 0
    for (const transaction of filtered) {
      if (transaction.type === 'income') incomeCents += transaction.amountCents
      else expenseCents += transaction.amountCents
    }
    return { incomeCents, expenseCents, netCents: incomeCents - expenseCents }
  }, [filtered])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const lastShown = Math.min(currentPage * PAGE_SIZE, filtered.length)

  useEffect(() => {
    setPage(1)
  }, [search, type, categoryId, dateFrom, dateTo, minAmount, maxAmount, recurringOnly, sort])

  const filtersActive =
    search !== '' ||
    type !== 'all' ||
    categoryId !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    minAmount !== '' ||
    maxAmount !== '' ||
    recurringOnly

  const resetFilters = () => {
    setSearch('')
    setType('all')
    setCategoryId('all')
    setDateFrom('')
    setDateTo('')
    setMinAmount('')
    setMaxAmount('')
    setRecurringOnly(false)
    setSort('date-desc')
  }

  const today = todayISO()
  const presets = [
    {
      key: 'all',
      label: 'Tout',
      active: dateFrom === '' && dateTo === '',
      apply: () => {
        setDateFrom('')
        setDateTo('')
      },
    },
    {
      key: 'month',
      label: 'Ce mois',
      active: dateFrom === startOfMonth(today) && dateTo === lastDayOfMonth(today),
      apply: () => {
        setDateFrom(startOfMonth(today))
        setDateTo(lastDayOfMonth(today))
      },
    },
    {
      key: 'previous',
      label: 'Mois précédent',
      active:
        dateFrom === startOfMonth(addDays(startOfMonth(today), -1)) &&
        dateTo === lastDayOfMonth(addDays(startOfMonth(today), -1)),
      apply: () => {
        const previous = addDays(startOfMonth(today), -1)
        setDateFrom(startOfMonth(previous))
        setDateTo(lastDayOfMonth(previous))
      },
    },
    {
      key: 'year',
      label: 'Cette année',
      active: dateFrom === startOfYear(today) && dateTo === `${today.slice(0, 4)}-12-31`,
      apply: () => {
        setDateFrom(startOfYear(today))
        setDateTo(`${today.slice(0, 4)}-12-31`)
      },
    },
  ]

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteTransaction(deleteTarget.id)
      pushToast('success', 'Transaction supprimée. Les totaux ont été recalculés.')
      setDeleteTarget(null)
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Suppression impossible.')
    }
  }

  const exportRows = (scope: Scope) => (scope === 'filtered' ? filtered : data.transactions)

  const handleCsv = () => {
    const rows = exportRows(exportScope)
    const csv = createTransactionsCsv(rows, data.categories)
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), datedFilename('budgetzen-transactions', 'csv'))
    pushToast('success', `Export CSV généré : ${rows.length} opération${rows.length > 1 ? 's' : ''}.`)
  }

  const handleXlsx = async () => {
    const rows = exportRows(exportScope)
    try {
      const { createTransactionsXlsx } = await import('../lib/xlsx')
      triggerDownload(createTransactionsXlsx(rows, data.categories), datedFilename('budgetzen-transactions', 'xlsx'))
      pushToast('success', `Export Excel généré : ${rows.length} opération${rows.length > 1 ? 's' : ''}.`)
    } catch {
      pushToast('error', 'Génération du fichier Excel impossible.')
    }
  }

  const categoryGroups = useMemo(() => {
    const group = (categoryType: TransactionType) =>
      data.categories
        .filter((category) => category.type === categoryType)
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    return { income: group('income'), expense: group('expense') }
  }, [data.categories])

  const exportLabel = exportScope === 'filtered' ? 'filtrées' : 'complètes'

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Tous vos revenus et vos dépenses, filtrables et modifiables."
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            Ajouter une transaction
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="border-b border-line px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher une description ou une catégorie…"
                  aria-label="Rechercher une transaction"
                  className={`${inputClass()} pl-9`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  label="Type de transaction"
                  options={[
                    { value: 'all', label: 'Tout' },
                    { value: 'income', label: 'Revenus' },
                    { value: 'expense', label: 'Dépenses' },
                  ]}
                  value={type}
                  onChange={setType}
                  size="sm"
                />
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className={`${inputClass()} h-8 w-auto py-1 text-xs`}
                  aria-label="Trier les transactions"
                >
                  <option value="date-desc">Date : plus récentes</option>
                  <option value="date-asc">Date : plus anciennes</option>
                  <option value="amount-desc">Montant : décroissant</option>
                  <option value="amount-asc">Montant : croissant</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted">
                <ListFilter aria-hidden className="h-3.5 w-3.5" /> Période
              </span>
              {presets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={preset.apply}
                  aria-pressed={preset.active}
                  className={cx(
                    'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                    preset.active
                      ? 'border-accent/30 bg-accent-soft text-accent'
                      : 'border-line bg-surface text-muted hover:bg-canvas hover:text-ink',
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Catégorie" htmlFor="filter-category">
                <select
                  id="filter-category"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className={inputClass()}
                >
                  <option value="all">Toutes les catégories</option>
                  <optgroup label="Revenus">
                    {categoryGroups.income.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Dépenses">
                    {categoryGroups.expense.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <Field label="Du" htmlFor="filter-from">
                <input
                  id="filter-from"
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className={inputClass()}
                />
              </Field>
              <Field label="Au" htmlFor="filter-to">
                <input
                  id="filter-to"
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className={inputClass()}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min. €" htmlFor="filter-min" error={minInvalid ? 'Invalide' : undefined}>
                  <input
                    id="filter-min"
                    type="text"
                    inputMode="decimal"
                    value={minAmount}
                    onChange={(event) => setMinAmount(event.target.value)}
                    placeholder="0"
                    aria-invalid={minInvalid}
                    className={inputClass(minInvalid)}
                  />
                </Field>
                <Field label="Max. €" htmlFor="filter-max" error={maxInvalid ? 'Invalide' : undefined}>
                  <input
                    id="filter-max"
                    type="text"
                    inputMode="decimal"
                    value={maxAmount}
                    onChange={(event) => setMaxAmount(event.target.value)}
                    placeholder="—"
                    aria-invalid={maxInvalid}
                    className={inputClass(maxInvalid)}
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={recurringOnly}
                  onChange={(event) => setRecurringOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-line-strong accent-accent-solid"
                />
                Uniquement les opérations générées par une récurrence
              </label>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <RotateCcw aria-hidden className="h-3.5 w-3.5" />
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-medium text-ink">
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            </span>
            <span className="text-income">Revenus {formatEUR(totals.incomeCents)}</span>
            <span className="text-expense">Dépenses {formatEUR(totals.expenseCents)}</span>
            <span className={totals.netCents >= 0 ? 'text-income' : 'text-expense'}>
              Net {formatSignedEUR(totals.netCents)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <label htmlFor="export-scope" className="sr-only">
              Périmètre d’export
            </label>
            <select
              id="export-scope"
              value={exportScope}
              onChange={(event) => setExportScope(event.target.value as Scope)}
              className="h-8 rounded-lg border border-line bg-surface px-2 text-[11px] text-muted focus:border-accent focus:outline-none"
            >
              <option value="filtered">Opérations filtrées</option>
              <option value="all">Toutes les opérations</option>
            </select>
            <Button size="sm" variant="secondary" onClick={handleCsv} disabled={filtered.length === 0 && exportScope === 'filtered'}>
              <Download aria-hidden className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={handleXlsx} disabled={filtered.length === 0 && exportScope === 'filtered'}>
              <FileSpreadsheet aria-hidden className="h-3.5 w-3.5" />
              Excel
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet aria-hidden className="h-5 w-5" />}
            title={filtersActive ? 'Aucune transaction ne correspond aux filtres' : 'Aucune transaction enregistrée'}
            description={
              filtersActive
                ? 'Essayez d’élargir la période, de retirer un filtre ou de modifier votre recherche.'
                : 'Ajoutez votre premier revenu ou votre première dépense pour commencer à suivre votre budget.'
            }
            action={
              filtersActive ? (
                <Button variant="secondary" onClick={resetFilters}>
                  <RotateCcw aria-hidden className="h-4 w-4" />
                  Réinitialiser les filtres
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setAddOpen(true)}>
                  <Plus aria-hidden className="h-4 w-4" />
                  Ajouter une transaction
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Liste des transactions filtrées</caption>
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                    <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Opération</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Catégorie</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Montant</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {visible.map((transaction) => {
                    const category = categoryById.get(transaction.categoryId)
                    return (
                      <tr key={transaction.id} className="group hover:bg-canvas/60">
                        <td className="tnum whitespace-nowrap px-4 py-3 text-xs text-muted">
                          {formatDateFR(transaction.transactionDate)}
                        </td>
                        <td className="max-w-[290px] px-4 py-3">
                          <p className="truncate text-xs font-medium text-ink">
                            {transaction.description || category?.name || 'Sans description'}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <Badge tone={transaction.type === 'income' ? 'income' : 'expense'}>
                              {transaction.type === 'income' ? 'Revenu' : 'Dépense'}
                            </Badge>
                            {transaction.recurringOccurrenceId && <Badge tone="accent">Récurrente</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 text-xs text-ink">
                            <CategoryIcon
                              icon={category?.icon ?? 'circle-help'}
                              color={category?.color ?? '#6B7280'}
                              size="xs"
                            />
                            <span className="truncate">{category?.name ?? 'Catégorie inconnue'}</span>
                          </span>
                        </td>
                        <td
                          className={cx(
                            'tnum whitespace-nowrap px-4 py-3 text-right text-xs font-semibold',
                            transaction.type === 'income' ? 'text-income' : 'text-expense',
                          )}
                        >
                          {transaction.type === 'income' ? '+' : '−'}
                          {formatEUR(transaction.amountCents)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => setFormState({ mode: 'edit', transaction })}
                              className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-ink hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                              aria-label={`Modifier : ${transaction.description || category?.name || 'transaction'}`}
                              title="Modifier"
                            >
                              <Pencil aria-hidden className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormState({ mode: 'duplicate', transaction })}
                              className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-ink hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                              aria-label={`Dupliquer : ${transaction.description || category?.name || 'transaction'}`}
                              title="Dupliquer"
                            >
                              <Copy aria-hidden className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(transaction)}
                              className="rounded-md p-1.5 text-muted hover:bg-expense-soft hover:text-expense focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                              aria-label={`Supprimer : ${transaction.description || category?.name || 'transaction'}`}
                              title="Supprimer"
                            >
                              <Trash2 aria-hidden className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {visible.map((transaction) => {
                const category = categoryById.get(transaction.categoryId)
                return (
                  <li key={transaction.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <CategoryIcon
                        icon={category?.icon ?? 'circle-help'}
                        color={category?.color ?? '#6B7280'}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {transaction.description || category?.name || 'Sans description'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {formatDateFR(transaction.transactionDate)} · {category?.name ?? 'Catégorie inconnue'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Badge tone={transaction.type === 'income' ? 'income' : 'expense'}>
                            {transaction.type === 'income' ? 'Revenu' : 'Dépense'}
                          </Badge>
                          {transaction.recurringOccurrenceId && <Badge tone="accent">Récurrente</Badge>}
                        </div>
                      </div>
                      <span
                        className={cx(
                          'tnum shrink-0 text-sm font-semibold',
                          transaction.type === 'income' ? 'text-income' : 'text-expense',
                        )}
                      >
                        {transaction.type === 'income' ? '+' : '−'}
                        {formatEUR(transaction.amountCents)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setFormState({ mode: 'edit', transaction })}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-muted hover:bg-canvas"
                      >
                        <Pencil aria-hidden className="h-3 w-3" /> Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormState({ mode: 'duplicate', transaction })}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-muted hover:bg-canvas"
                      >
                        <Copy aria-hidden className="h-3 w-3" /> Dupliquer
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(transaction)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-expense hover:bg-expense-soft"
                      >
                        <Trash2 aria-hidden className="h-3 w-3" /> Supprimer
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <p className="text-xs text-muted">
                {firstShown}–{lastShown} sur {filtered.length} · page {currentPage}/{pageCount}
                <span className="ml-2 text-[11px]">(export {exportLabel})</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Page précédente"
                >
                  <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
                  Précédent
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                  disabled={currentPage >= pageCount}
                  aria-label="Page suivante"
                >
                  Suivant
                  <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <p className="mt-3 flex items-start gap-2 text-[11px] leading-4 text-muted">
        <TriangleAlert aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
        La recherche et les filtres ne modifient aucune donnée. Les exports neutralisent les contenus pouvant être
        interprétés comme des formules par un tableur.
      </p>

      {addOpen && <TransactionFormModal onClose={() => setAddOpen(false)} />}
      {formState?.mode === 'edit' && (
        <TransactionFormModal transaction={formState.transaction} onClose={() => setFormState(null)} />
      )}
      {formState?.mode === 'duplicate' && (
        <TransactionFormModal duplicateOf={formState.transaction} onClose={() => setFormState(null)} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cette transaction ?"
          confirmLabel="Supprimer"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          description={
            <>
              <p className="font-medium text-ink">
                {deleteTarget.description || categoryById.get(deleteTarget.categoryId)?.name || 'Transaction'}
              </p>
              <p className="mt-1">
                {formatDateFR(deleteTarget.transactionDate)} ·{' '}
                {deleteTarget.type === 'income' ? '+' : '−'}
                {formatEUR(deleteTarget.amountCents)}
              </p>
              <p className="mt-2">
                Cette action est définitive et recalcule immédiatement tous les indicateurs et rapports.
                {deleteTarget.recurringOccurrenceId &&
                  ' L’échéance récurrente associée sera marquée comme ignorée et ne sera pas régénérée.'}
              </p>
            </>
          }
        />
      )}
    </div>
  )
}
