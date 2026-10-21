import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useApp, useAppData } from '../state/AppStore'
import type { Budget, BudgetDraft, BudgetPeriodType } from '../domain/types'
import { budgetFormSchema, type BudgetFormValues } from '../domain/validation'
import {
  BUDGET_PERIOD_LABELS,
  evaluateBudgets,
  normalizeBudgetAnchor,
  type BudgetEvaluation,
} from '../domain/finance'
import { formatDateFR, startOfMonth, todayISO } from '../domain/dates'
import { centsToInput, formatEUR, formatPercent, parseAmountToCents } from '../domain/money'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  InfoBanner,
  Modal,
  PageHeader,
  ProgressBar,
  StatCard,
  cx,
  inputClass,
} from '../components/ui'
import { CategoryIcon } from '../components/CategoryIcon'
import { useToast } from '../components/toast'

const PERIOD_OPTIONS: Array<{ value: BudgetPeriodType; label: string }> = [
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'semester', label: 'Semestriel' },
  { value: 'yearly', label: 'Annuel' },
]

function statusTone(status: BudgetEvaluation['status']) {
  return status === 'exceeded' ? 'expense' : status === 'warning' ? 'warn' : 'income'
}

function BudgetFormModal({ budget, onClose }: { budget?: Budget; onClose: () => void }) {
  const data = useAppData()
  const { addBudget, updateBudget } = useApp()
  const { pushToast } = useToast()
  const isEditing = Boolean(budget)

  const categories = useMemo(() => {
    const active = data.categories.filter((category) => category.type === 'expense' && category.isActive)
    if (budget) {
      const current = data.categories.find((category) => category.id === budget.categoryId)
      if (current && !active.some((category) => category.id === current.id)) return [current, ...active]
    }
    return active
  }, [data.categories, budget])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryId: budget?.categoryId ?? categories[0]?.id ?? '',
      limit: budget ? centsToInput(budget.limitCents) : '',
      periodType: budget?.periodType ?? 'monthly',
      startDate: budget?.startDate ?? startOfMonth(todayISO()),
      alertThresholdPercent: budget?.alertThresholdPercent ?? 80,
    },
  })

  const periodType = watch('periodType')
  const categoryId = watch('categoryId')
  const selectedCategory = data.categories.find((category) => category.id === categoryId)

  const onSubmit = handleSubmit(async (values) => {
    const limitCents = parseAmountToCents(values.limit)
    if (limitCents === null) {
      setError('limit', { message: 'Saisissez un plafond positif valide.' })
      return
    }
    const draft: BudgetDraft = {
      categoryId: values.categoryId,
      limitCents,
      periodType: values.periodType,
      startDate: normalizeBudgetAnchor(values.startDate, values.periodType),
      alertThresholdPercent: values.alertThresholdPercent,
    }
    try {
      if (budget) {
        await updateBudget(budget.id, draft)
        pushToast('success', 'Budget mis à jour.')
      } else {
        await addBudget(draft)
        pushToast('success', 'Budget créé. Le suivi démarre sur le cycle en cours.')
      }
      onClose()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible d’enregistrer le budget.'
      pushToast('error', message)
      setError('root', { message })
    }
  })

  return (
    <Modal
      title={isEditing ? 'Modifier le budget' : 'Nouveau budget'}
      description="Le budget se répète automatiquement à chaque période. Il ne crée jamais de transaction."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="budget-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <form id="budget-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Catégorie de dépenses"
          htmlFor="budget-category"
          error={errors.categoryId?.message}
          required
          hint={selectedCategory ? undefined : 'Créez d’abord une catégorie de dépenses active.'}
        >
          <div className="flex items-center gap-2">
            {selectedCategory && <CategoryIcon icon={selectedCategory.icon} color={selectedCategory.color} size="md" />}
            <select
              id="budget-category"
              aria-invalid={Boolean(errors.categoryId)}
              className={inputClass(Boolean(errors.categoryId))}
              {...register('categoryId')}
            >
              {categories.length === 0 && <option value="">Aucune catégorie de dépenses</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {!category.isActive ? ' (archivée)' : ''}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plafond" htmlFor="budget-limit" error={errors.limit?.message} required hint="Montant maximal en euros.">
            <div className="relative">
              <input
                id="budget-limit"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                data-autofocus
                aria-invalid={Boolean(errors.limit)}
                className={`${inputClass(Boolean(errors.limit))} tnum pr-8`}
                {...register('limit')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">€</span>
            </div>
          </Field>
          <Field label="Seuil d’alerte (%)" htmlFor="budget-threshold" error={errors.alertThresholdPercent?.message} hint="Entre 1 et 100 %.">
            <input
              id="budget-threshold"
              type="number"
              min={1}
              max={100}
              step={1}
              aria-invalid={Boolean(errors.alertThresholdPercent)}
              className={inputClass(Boolean(errors.alertThresholdPercent))}
              {...register('alertThresholdPercent', { valueAsNumber: true })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Période du budget" htmlFor="budget-period" error={errors.periodType?.message}>
            <select
              id="budget-period"
              className={inputClass(Boolean(errors.periodType))}
              {...register('periodType')}
              onChange={(event) => {
                const next = event.target.value as BudgetPeriodType
                setValue('periodType', next, { shouldValidate: true })
                setValue('startDate', normalizeBudgetAnchor(watch('startDate'), next))
              }}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Date de référence"
            htmlFor="budget-start"
            error={errors.startDate?.message}
            hint={`Cycle ${PERIOD_OPTIONS.find((option) => option.value === periodType)?.label.toLowerCase() ?? ''} aligné sur cette date.`}
          >
            <input
              id="budget-start"
              type="date"
              aria-invalid={Boolean(errors.startDate)}
              className={inputClass(Boolean(errors.startDate))}
              {...register('startDate')}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2.5 text-[11px] leading-5 text-muted">
          Exemple : un budget mensuel de 400 € pour les courses autorise 400 € du 1er au 31 du mois. Le montant
          consommé est calculé à partir des dépenses réelles, jamais des budgets eux-mêmes. Un dépassement déclenche
          une alerte mais ne bloque aucune saisie.
        </div>

        {errors.root?.message && (
          <p role="alert" className="rounded-lg border border-expense/25 bg-expense-soft px-3 py-2 text-xs text-expense">
            {errors.root.message}
          </p>
        )}
      </form>
    </Modal>
  )
}

export function BudgetsPage() {
  const data = useAppData()
  const { deleteBudget } = useApp()
  const { pushToast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Budget | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null)

  const reference = todayISO()
  const evaluations = useMemo(
    () => evaluateBudgets(data.budgets, data.categories, data.transactions, reference),
    [data.budgets, data.categories, data.transactions, reference],
  )
  const exceeded = evaluations.filter((evaluation) => evaluation.status === 'exceeded').length
  const warnings = evaluations.filter((evaluation) => evaluation.status === 'warning').length

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteBudget(deleteTarget.id)
      pushToast('success', 'Budget supprimé. Aucune transaction n’a été modifiée.')
      setDeleteTarget(null)
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Suppression impossible.')
    }
  }

  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  )

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Fixez un plafond par catégorie et suivez sa consommation réelle sur chaque cycle."
        actions={
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            <Plus aria-hidden className="h-4 w-4" />
            Nouveau budget
          </Button>
        }
      />

      <div className="mb-4">
        <InfoBanner tone="accent" icon={<ShieldCheck aria-hidden className="h-4 w-4" />}>
          Les budgets sont des repères de pilotage : ils ne sont jamais ajoutés aux revenus ou aux dépenses. Les
          alertes sont visuelles et n’empêchent aucune saisie.
        </InfoBanner>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Budgets suivis"
          value={String(evaluations.length)}
          hint={`Cycle en cours au ${formatDateFR(reference)}`}
          icon={<Wallet aria-hidden className="h-4 w-4" />}
        />
        <StatCard
          label="Seuil d’alerte atteint"
          value={String(warnings)}
          tone={warnings > 0 ? 'accent' : 'neutral'}
          hint="Alertes visuelles, sans blocage"
          icon={<TriangleAlert aria-hidden className="h-4 w-4" />}
        />
        <StatCard
          label="Budgets dépassés"
          value={String(exceeded)}
          tone={exceeded > 0 ? 'expense' : 'neutral'}
          hint={exceeded > 0 ? 'À surveiller ce cycle' : 'Aucun dépassement'}
          icon={<TriangleAlert aria-hidden className="h-4 w-4" />}
        />
      </div>

      {evaluations.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet aria-hidden className="h-5 w-5" />}
            title="Aucun budget défini"
            description="Commencez par les postes qui dérapent le plus souvent : courses, restaurants, loisirs ou transport."
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                <Plus aria-hidden className="h-4 w-4" />
                Créer un budget
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {evaluations.map((evaluation) => {
            const budget = data.budgets.find((item) => item.id === evaluation.budgetId)
            const category = categoryById.get(evaluation.categoryId)
            const originalCategory = category?.name ?? evaluation.categoryName
            return (
              <Card key={evaluation.budgetId} className="p-4">
                <div className="flex items-start gap-3">
                  <CategoryIcon
                    icon={category?.icon ?? 'circle-help'}
                    color={evaluation.categoryColor}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate text-sm font-semibold text-ink">{originalCategory}</h2>
                      <Badge tone="muted">{BUDGET_PERIOD_LABELS[evaluation.periodType]}</Badge>
                      {category && !category.isActive && <Badge tone="warn">Catégorie archivée</Badge>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Cycle {evaluation.cycleLabel} · alerte à {formatPercent(evaluation.alertThresholdPercent, 0)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!budget) return
                        setEditing(budget)
                        setFormOpen(true)
                      }}
                      className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      aria-label={`Modifier le budget ${originalCategory}`}
                      title="Modifier"
                    >
                      <Pencil aria-hidden className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => budget && setDeleteTarget(budget)}
                      className="rounded-md p-1.5 text-muted hover:bg-expense-soft hover:text-expense focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      aria-label={`Supprimer le budget ${originalCategory}`}
                      title="Supprimer"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <p className="tnum text-sm font-semibold text-ink">
                      {formatEUR(evaluation.consumedCents)}
                      <span className="text-xs font-normal text-muted"> / {formatEUR(evaluation.limitCents)}</span>
                    </p>
                    <Badge tone={statusTone(evaluation.status)}>
                      {evaluation.status === 'exceeded'
                        ? 'Dépassé'
                        : evaluation.status === 'warning'
                          ? 'Seuil atteint'
                          : 'Respecté'}
                    </Badge>
                  </div>
                  <ProgressBar
                    value={evaluation.usagePercent}
                    tone={statusTone(evaluation.status)}
                    label={`Consommation du budget ${originalCategory}`}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className={cx('tnum font-medium', evaluation.status === 'exceeded' ? 'text-expense' : 'text-muted')}>
                      {formatPercent(evaluation.usagePercent, 1)} consommé
                    </span>
                    <span className={evaluation.remainingCents < 0 ? 'text-expense' : 'text-muted'}>
                      {evaluation.remainingCents < 0
                        ? `Dépassement de ${formatEUR(Math.abs(evaluation.remainingCents))}`
                        : `Reste ${formatEUR(evaluation.remainingCents)}`}
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {data.categories.filter((category) => category.type === 'expense' && category.isActive).length === 0 && (
        <p className="mt-4 text-xs text-muted">
          Aucune catégorie de dépenses active.{' '}
          <Link to="/categories" className="font-medium text-accent hover:underline">
            Créez ou réactivez une catégorie
          </Link>{' '}
          avant d’ajouter un budget.
        </p>
      )}

      {formOpen && (
        <BudgetFormModal
          budget={editing ?? undefined}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer ce budget ?"
          confirmLabel="Supprimer"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          description={
            <>
              <p className="font-medium text-ink">
                {categoryById.get(deleteTarget.categoryId)?.name ?? 'Budget'} · {formatEUR(deleteTarget.limitCents)}
              </p>
              <p className="mt-1">
                Seul le plafond est supprimé. Les transactions et l’historique financier restent intacts.
              </p>
            </>
          }
        />
      )}
    </div>
  )
}
