import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Ban,
  CalendarClock,
  Check,
  Clock,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Trash2,
} from 'lucide-react'
import { useApp, useAppData } from '../state/AppStore'
import type { RecurringRule, RecurringRuleDraft, TransactionType } from '../domain/types'
import { ruleFormSchema, type RuleFormValues } from '../domain/validation'
import { FREQUENCY_LABELS, firstOccurrenceOnOrAfter, isRuleEnded } from '../domain/recurrence'
import { formatDateFR, todayISO } from '../domain/dates'
import { centsToInput, formatEUR, parseAmountToCents } from '../domain/money'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  InfoBanner,
  Modal,
  PageHeader,
  StatCard,
  cx,
  inputClass,
} from '../components/ui'
import { CategoryIcon } from '../components/CategoryIcon'
import { useToast } from '../components/toast'

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS) as Array<[keyof typeof FREQUENCY_LABELS, string]>

function RuleFormModal({ rule, onClose }: { rule?: RecurringRule; onClose: () => void }) {
  const data = useAppData()
  const { addRule, updateRule, generateRecurring } = useApp()
  const { pushToast } = useToast()
  const isEditing = Boolean(rule)

  const categoriesFor = (type: TransactionType) => {
    const active = data.categories.filter((category) => category.type === type && category.isActive)
    if (rule) {
      const current = data.categories.find((category) => category.id === rule.categoryId)
      if (current && current.type === type && !active.some((category) => category.id === current.id)) {
        return [current, ...active]
      }
    }
    return active
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      type: rule?.type ?? 'expense',
      amount: rule ? centsToInput(rule.amountCents) : '',
      categoryId: rule?.categoryId ?? data.categories.find((category) => category.type === 'expense' && category.isActive)?.id ?? '',
      description: rule?.description ?? '',
      frequency: rule?.frequency ?? 'monthly',
      startDate: rule?.startDate ?? todayISO(),
      endDate: rule?.endDate ?? '',
    },
  })

  const type = watch('type')
  const startDate = watch('startDate')
  const frequency = watch('frequency')
  const categoryId = watch('categoryId')
  const categories = categoriesFor(type)
  const selectedCategory = data.categories.find((category) => category.id === categoryId)
  const nextPreview = startDate
    ? firstOccurrenceOnOrAfter({ startDate, frequency }, todayISO())
    : null

  const selectType = (next: TransactionType) => {
    setValue('type', next, { shouldValidate: true })
    const nextCategories = categoriesFor(next)
    if (!nextCategories.some((category) => category.id === categoryId)) {
      setValue('categoryId', nextCategories.find((category) => category.isActive)?.id ?? '', {
        shouldValidate: true,
      })
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    const amountCents = parseAmountToCents(values.amount)
    if (amountCents === null) {
      setError('amount', { message: 'Montant invalide.' })
      return
    }
    const category = data.categories.find((item) => item.id === values.categoryId)
    if (!category || category.type !== values.type) {
      setError('categoryId', { message: 'Choisissez une catégorie compatible.' })
      return
    }
    const draft: RecurringRuleDraft = {
      type: values.type,
      amountCents,
      categoryId: values.categoryId,
      description: values.description,
      frequency: values.frequency,
      startDate: values.startDate,
      endDate: values.endDate || null,
    }
    try {
      if (rule) {
        await updateRule(rule.id, draft)
        pushToast('success', 'Règle mise à jour. Les transactions déjà générées sont conservées.')
      } else {
        await addRule(draft)
        pushToast('success', 'Règle créée.')
      }
      onClose()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible d’enregistrer la règle.'
      pushToast('error', message)
      setError('root', { message })
      return
    }
    try {
      await generateRecurring({ silent: true })
    } catch (cause) {
      pushToast(
        'error',
        cause instanceof Error ? cause.message : 'La règle est enregistrée, mais les échéances dues n’ont pas pu être générées.',
      )
    }
  })

  return (
    <Modal
      title={isEditing ? 'Modifier la règle récurrente' : 'Nouvelle règle récurrente'}
      description="Une règle planifie une opération. Elle ne devient réelle qu’une fois l’échéance confirmée."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="rule-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <form id="rule-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-ink">Type d’opération</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={type === 'expense'}
              onClick={() => selectType('expense')}
              className={cx(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                type === 'expense'
                  ? 'border-expense/40 bg-expense-soft text-expense'
                  : 'border-line-strong bg-surface text-muted hover:bg-canvas',
              )}
            >
              Dépense
            </button>
            <button
              type="button"
              aria-pressed={type === 'income'}
              onClick={() => selectType('income')}
              className={cx(
                'rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                type === 'income'
                  ? 'border-income/40 bg-income-soft text-income'
                  : 'border-line-strong bg-surface text-muted hover:bg-canvas',
              )}
            >
              Revenu
            </button>
          </div>
          <input type="hidden" {...register('type')} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant" htmlFor="rule-amount" error={errors.amount?.message} required>
            <div className="relative">
              <input
                id="rule-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                data-autofocus
                aria-invalid={Boolean(errors.amount)}
                className={`${inputClass(Boolean(errors.amount))} tnum pr-8`}
                {...register('amount')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">€</span>
            </div>
          </Field>
          <Field label="Fréquence" htmlFor="rule-frequency" error={errors.frequency?.message} required>
            <select id="rule-frequency" className={inputClass(Boolean(errors.frequency))} {...register('frequency')}>
              {FREQUENCY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Catégorie" htmlFor="rule-category" error={errors.categoryId?.message} required>
          <div className="flex items-center gap-2">
            {selectedCategory && <CategoryIcon icon={selectedCategory.icon} color={selectedCategory.color} size="md" />}
            <select
              id="rule-category"
              aria-invalid={Boolean(errors.categoryId)}
              className={inputClass(Boolean(errors.categoryId))}
              {...register('categoryId')}
              onChange={(event) => setValue('categoryId', event.target.value, { shouldValidate: true })}
            >
              {categories.length === 0 && <option value="">Aucune catégorie active</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {!category.isActive ? ' (archivée)' : ''}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Description" htmlFor="rule-description" error={errors.description?.message} hint="Facultative, reprise sur chaque transaction générée.">
          <input
            id="rule-description"
            type="text"
            maxLength={500}
            placeholder="Ex. Loyer, salaire, abonnement…"
            className={inputClass(Boolean(errors.description))}
            {...register('description')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date de début" htmlFor="rule-start" error={errors.startDate?.message} required>
            <input
              id="rule-start"
              type="date"
              aria-invalid={Boolean(errors.startDate)}
              className={inputClass(Boolean(errors.startDate))}
              {...register('startDate')}
            />
          </Field>
          <Field label="Date de fin" htmlFor="rule-end" error={errors.endDate?.message} hint="Facultative. Laissez vide pour une règle sans fin.">
            <input
              id="rule-end"
              type="date"
              aria-invalid={Boolean(errors.endDate)}
              className={inputClass(Boolean(errors.endDate))}
              {...register('endDate')}
            />
          </Field>
        </div>

        {nextPreview && (
          <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2.5 text-[11px] leading-5 text-muted">
            Prochaine échéance à traiter : <strong className="text-ink">{formatDateFR(nextPreview)}</strong>. Les
            échéances passées non encore générées seront rattrapées. Une même règle et une même date ne peuvent jamais
            produire deux transactions.
          </div>
        )}

        {isEditing && (
          <InfoBanner tone="warn" icon={<Clock aria-hidden className="h-4 w-4" />}>
            Modifier la fréquence ou la date de début recalcule les échéances futures. Les transactions déjà
            enregistrées ne sont pas supprimées ni modifiées.
          </InfoBanner>
        )}

        {errors.root?.message && (
          <p role="alert" className="rounded-lg border border-expense/25 bg-expense-soft px-3 py-2 text-xs text-expense">
            {errors.root.message}
          </p>
        )}
      </form>
    </Modal>
  )
}

export function RecurringPage() {
  const data = useAppData()
  const {
    setRuleActive,
    deleteRule,
    generateRecurring,
    confirmOccurrence,
    skipOccurrence,
  } = useApp()
  const { pushToast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecurringRule | null>(null)
  const [generating, setGenerating] = useState(false)
  const [busyOccurrence, setBusyOccurrence] = useState<string | null>(null)

  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  )
  const ruleById = useMemo(
    () => new Map(data.recurringRules.map((rule) => [rule.id, rule])),
    [data.recurringRules],
  )
  const pending = useMemo(
    () =>
      data.occurrences
        .filter((occurrence) => occurrence.status === 'pending')
        .slice()
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [data.occurrences],
  )
  const sortedRules = useMemo(
    () =>
      data.recurringRules.slice().sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
        return a.nextOccurrenceDate.localeCompare(b.nextOccurrenceDate)
      }),
    [data.recurringRules],
  )
  const activeCount = data.recurringRules.filter((rule) => rule.isActive).length
  const nextDate = data.recurringRules
    .filter((rule) => rule.isActive && !isRuleEnded(rule, rule.nextOccurrenceDate))
    .map((rule) => rule.nextOccurrenceDate)
    .sort()[0]

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateRecurring()
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Génération impossible.')
    } finally {
      setGenerating(false)
    }
  }

  const handleToggle = async (rule: RecurringRule) => {
    try {
      await setRuleActive(rule.id, !rule.isActive)
      pushToast(
        'success',
        rule.isActive
          ? 'Règle suspendue. Aucune nouvelle échéance ne sera générée.'
          : 'Règle réactivée. Les échéances dues vont être traitées.',
      )
      if (!rule.isActive) await generateRecurring({ silent: true })
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Opération impossible.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteRule(deleteTarget.id)
      pushToast('success', 'Règle supprimée. Les transactions déjà générées sont conservées.')
      setDeleteTarget(null)
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Suppression impossible.')
    }
  }

  const handleOccurrence = async (id: string, action: 'confirm' | 'skip') => {
    setBusyOccurrence(id)
    try {
      if (action === 'confirm') {
        await confirmOccurrence(id)
        pushToast('success', 'Échéance confirmée : la transaction a été enregistrée.')
      } else {
        await skipOccurrence(id)
        pushToast('success', 'Échéance ignorée. Aucune transaction n’a été créée.')
      }
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Opération impossible.')
    } finally {
      setBusyOccurrence(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Récurrences"
        subtitle="Programmez vos revenus et dépenses réguliers sans double saisie."
        actions={
          <>
            <Button variant="secondary" onClick={() => void handleGenerate()} loading={generating}>
              <RefreshCw aria-hidden className="h-4 w-4" />
              Générer les échéances
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus aria-hidden className="h-4 w-4" />
              Nouvelle règle
            </Button>
          </>
        }
      />

      <div className="mb-4">
        <InfoBanner
          tone={data.settings.autoConfirmRecurring ? 'accent' : 'warn'}
          icon={<Repeat2 aria-hidden className="h-4 w-4" />}
        >
          {data.settings.autoConfirmRecurring ? (
            <>
              Les échéances dues sont <strong>enregistrées automatiquement</strong> à l’ouverture de l’application ou
              via le bouton « Générer les échéances ». Une règle et une date ne peuvent produire qu’une seule
              transaction.
            </>
          ) : (
            <>
              La confirmation manuelle est activée : les échéances restent <strong>en attente</strong> et ne sont pas
              comptées dans vos totaux avant validation.{' '}
              <Link to="/parametres" className="font-medium underline underline-offset-2">
                Modifier ce réglage
              </Link>
              .
            </>
          )}
        </InfoBanner>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Règles actives" value={String(activeCount)} hint={`${data.recurringRules.length} règle(s) au total`} icon={<Repeat2 aria-hidden className="h-4 w-4" />} />
        <StatCard label="Prochaine échéance" value={nextDate ? formatDateFR(nextDate) : '—'} hint="Hors règles suspendues" icon={<CalendarClock aria-hidden className="h-4 w-4" />} />
        <StatCard label="En attente de confirmation" value={String(pending.length)} tone={pending.length > 0 ? 'accent' : 'neutral'} hint="Non comptées dans les totaux" icon={<Clock aria-hidden className="h-4 w-4" />} />
      </div>

      {pending.length > 0 && (
        <Card className="mb-4 border-accent/30">
          <CardHeader
            title="Échéances en attente"
            description="Confirmez pour créer la transaction réelle, ou ignorez pour cette occurrence."
          />
          <ul className="divide-y divide-line px-2 pb-2 pt-2">
            {pending.map((occurrence) => {
              const rule = ruleById.get(occurrence.recurringRuleId)
              const category = rule ? categoryById.get(rule.categoryId) : undefined
              return (
                <li key={occurrence.id} className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CategoryIcon icon={category?.icon ?? 'circle-help'} color={category?.color ?? '#6B7280'} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">
                        {rule?.description || category?.name || 'Échéance récurrente'}
                      </p>
                      <p className="text-[11px] text-muted">
                        {formatDateFR(occurrence.scheduledDate)} ·{' '}
                        {rule ? `${rule.type === 'income' ? '+' : '−'}${formatEUR(rule.amountCents)}` : 'règle supprimée'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5 pl-10 sm:pl-0">
                    {rule && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => void handleOccurrence(occurrence.id, 'confirm')}
                        loading={busyOccurrence === occurrence.id}
                      >
                        <Check aria-hidden className="h-3.5 w-3.5" />
                        Confirmer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleOccurrence(occurrence.id, 'skip')}
                      loading={busyOccurrence === occurrence.id}
                    >
                      <Ban aria-hidden className="h-3.5 w-3.5" />
                      Ignorer
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {sortedRules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat2 aria-hidden className="h-5 w-5" />}
            title="Aucune règle récurrente"
            description="Programmez par exemple votre salaire le 2 du mois, votre loyer le 5, ou un abonnement annuel."
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                <Plus aria-hidden className="h-4 w-4" />
                Créer une règle
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sortedRules.map((rule) => {
            const category = categoryById.get(rule.categoryId)
            const ended = rule.endDate !== null && isRuleEnded(rule, todayISO())
            return (
              <Card key={rule.id} className={cx('p-4', !rule.isActive && 'bg-canvas/60')}>
                <div className="flex items-start gap-3">
                  <CategoryIcon icon={category?.icon ?? 'circle-help'} color={category?.color ?? '#6B7280'} size="md" />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-ink">
                      {rule.description || category?.name || 'Règle récurrente'}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {category?.name ?? 'Catégorie inconnue'} · {FREQUENCY_LABELS[rule.frequency]}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={rule.isActive ? 'income' : 'muted'}>
                        {rule.isActive ? 'Active' : 'Suspendue'}
                      </Badge>
                      {ended && <Badge tone="warn">Terminée</Badge>}
                      <Badge tone={rule.type === 'income' ? 'income' : 'expense'}>
                        {rule.type === 'income' ? 'Revenu' : 'Dépense'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(rule)
                        setFormOpen(true)
                      }}
                      className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      aria-label={`Modifier la règle ${rule.description || category?.name || ''}`}
                      title="Modifier"
                    >
                      <Pencil aria-hidden className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggle(rule)}
                      className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      aria-label={rule.isActive ? 'Suspendre la règle' : 'Réactiver la règle'}
                      title={rule.isActive ? 'Suspendre' : 'Réactiver'}
                    >
                      {rule.isActive ? <Pause aria-hidden className="h-3.5 w-3.5" /> : <Play aria-hidden className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(rule)}
                      className="rounded-md p-1.5 text-muted hover:bg-expense-soft hover:text-expense focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      aria-label="Supprimer la règle"
                      title="Supprimer"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">Montant</p>
                    <p className={cx('tnum mt-0.5 text-sm font-semibold', rule.type === 'income' ? 'text-income' : 'text-expense')}>
                      {rule.type === 'income' ? '+' : '−'}
                      {formatEUR(rule.amountCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted">Prochaine échéance</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {rule.isActive && !ended && (!rule.endDate || rule.nextOccurrenceDate <= rule.endDate)
                        ? formatDateFR(rule.nextOccurrenceDate)
                        : '—'}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted">
                  Depuis le {formatDateFR(rule.startDate)}
                  {rule.endDate ? ` · jusqu’au ${formatDateFR(rule.endDate)}` : ' · sans date de fin'}
                </p>
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-4 text-muted">
        Une opération prévue n’est pas une opération réelle. Les échéances en attente sont exclues des totaux et des
        rapports. Supprimer une règle n’efface jamais les transactions déjà générées.
      </p>

      {formOpen && (
        <RuleFormModal
          rule={editing ?? undefined}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cette règle ?"
          confirmLabel="Supprimer la règle"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          description={
            <>
              <p className="font-medium text-ink">{deleteTarget.description || 'Règle récurrente'}</p>
              <p className="mt-1">
                Aucune nouvelle échéance ne sera générée. Les transactions déjà enregistrées et leur historique sont
                conservés.
              </p>
            </>
          }
        />
      )}
    </div>
  )
}
