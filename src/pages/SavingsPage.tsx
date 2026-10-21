import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Coins,
  Pencil,
  PiggyBank,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import { useApp, useAppData } from '../state/AppStore'
import type { SavingsGoal, SavingsGoalStatus } from '../domain/types'
import { goalContributionSchema, goalFormSchema, type GoalFormValues } from '../domain/validation'
import {
  goalMonthlyAmount,
  goalProgressPercent,
  savingsSummary,
} from '../domain/finance'
import { formatDateFR } from '../domain/dates'
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
import { useToast } from '../components/toast'

function GoalFormModal({ goal, onClose }: { goal?: SavingsGoal; onClose: () => void }) {
  const { addGoal, updateGoal } = useApp()
  const { pushToast } = useToast()
  const isEditing = Boolean(goal)

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: goal?.name ?? '',
      target: goal ? centsToInput(goal.targetCents) : '',
      saved: goal ? centsToInput(goal.savedCents) : '0,00',
      targetDate: goal?.targetDate ?? '',
      description: goal?.description ?? '',
    },
  })

  const description = watch('description') ?? ''

  const onSubmit = handleSubmit(async (values) => {
    const targetCents = parseAmountToCents(values.target)
    const savedCents = parseAmountToCents(values.saved, { allowZero: true })
    if (targetCents === null || savedCents === null) {
      setError('root', { message: 'Vérifiez les montants saisis.' })
      return
    }
    const draft = {
      name: values.name,
      targetCents,
      savedCents,
      targetDate: values.targetDate || null,
      description: values.description,
    }
    try {
      if (goal) {
        await updateGoal(goal.id, draft)
        pushToast('success', 'Objectif mis à jour.')
      } else {
        await addGoal(draft)
        pushToast('success', 'Objectif d’épargne créé.')
      }
      onClose()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible d’enregistrer l’objectif.'
      pushToast('error', message)
      setError('root', { message })
    }
  })

  return (
    <Modal
      title={isEditing ? 'Modifier l’objectif' : 'Nouvel objectif d’épargne'}
      description="L’épargne suivie ici est un repère. Elle ne modifie pas le solde sans transaction réelle."
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="goal-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <form id="goal-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Nom de l’objectif" htmlFor="goal-name" error={errors.name?.message} required>
          <input
            id="goal-name"
            type="text"
            maxLength={100}
            placeholder="Ex. Fonds d’urgence"
            data-autofocus
            aria-invalid={Boolean(errors.name)}
            className={inputClass(Boolean(errors.name))}
            {...register('name')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant cible" htmlFor="goal-target" error={errors.target?.message} required>
            <div className="relative">
              <input
                id="goal-target"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                aria-invalid={Boolean(errors.target)}
                className={`${inputClass(Boolean(errors.target))} tnum pr-8`}
                {...register('target')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">€</span>
            </div>
          </Field>
          <Field label="Déjà épargné" htmlFor="goal-saved" error={errors.saved?.message} required hint="Montant réellement mis de côté.">
            <div className="relative">
              <input
                id="goal-saved"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                aria-invalid={Boolean(errors.saved)}
                className={`${inputClass(Boolean(errors.saved))} tnum pr-8`}
                {...register('saved')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">€</span>
            </div>
          </Field>
        </div>

        <Field label="Date cible" htmlFor="goal-date" error={errors.targetDate?.message} hint="Facultative. Sert à estimer l’effort mensuel.">
          <input
            id="goal-date"
            type="date"
            aria-invalid={Boolean(errors.targetDate)}
            className={inputClass(Boolean(errors.targetDate))}
            {...register('targetDate')}
          />
        </Field>

        <Field label="Description" htmlFor="goal-description" error={errors.description?.message} hint={`Facultative · ${description.length}/500`}>
          <textarea
            id="goal-description"
            rows={3}
            maxLength={500}
            placeholder="À quoi sert cet objectif ?"
            className={`${inputClass(Boolean(errors.description))} resize-none`}
            {...register('description')}
          />
        </Field>

        {errors.root?.message && (
          <p role="alert" className="rounded-lg border border-expense/25 bg-expense-soft px-3 py-2 text-xs text-expense">
            {errors.root.message}
          </p>
        )}
      </form>
    </Modal>
  )
}

function ContributionModal({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const { contributeToGoal } = useApp()
  const { pushToast } = useToast()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ amount: string }>({
    resolver: zodResolver(goalContributionSchema),
    defaultValues: { amount: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    const amountCents = parseAmountToCents(values.amount)
    if (amountCents === null) {
      setError('amount', { message: 'Montant invalide.' })
      return
    }
    try {
      await contributeToGoal(goal.id, amountCents)
      pushToast('success', `Versement de ${formatEUR(amountCents)} ajouté à « ${goal.name} ».`)
      onClose()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Versement impossible.'
      pushToast('error', message)
      setError('root', { message })
    }
  })

  const remaining = Math.max(0, goal.targetCents - goal.savedCents)

  return (
    <Modal
      title="Ajouter un versement"
      description={`Objectif « ${goal.name} » · reste ${formatEUR(remaining)}.`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="contribution-form" loading={isSubmitting}>
            Ajouter
          </Button>
        </div>
      }
    >
      <form id="contribution-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Montant du versement" htmlFor="contribution-amount" error={errors.amount?.message} required>
          <div className="relative">
            <input
              id="contribution-amount"
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
        <InfoBanner tone="accent" icon={<Coins aria-hidden className="h-4 w-4" />}>
          Ce versement met à jour le suivi de l’objectif uniquement. Si l’argent a réellement quitté votre budget,
          enregistrez aussi une transaction de dépense ou un virement dans votre relevé.
        </InfoBanner>
        {errors.root?.message && <p role="alert" className="text-xs text-expense">{errors.root.message}</p>}
      </form>
    </Modal>
  )
}

function statusMeta(status: SavingsGoalStatus) {
  switch (status) {
    case 'achieved':
      return { label: 'Atteint', tone: 'income' as const }
    case 'archived':
      return { label: 'Archivé', tone: 'muted' as const }
    default:
      return { label: 'En cours', tone: 'accent' as const }
  }
}

function GoalCard({
  goal,
  onEdit,
  onContribute,
  onArchive,
  onAchieve,
  onDelete,
}: {
  goal: SavingsGoal
  onEdit: () => void
  onContribute: () => void
  onArchive: () => void
  onAchieve: () => void
  onDelete: () => void
}) {
  const progress = goalProgressPercent(goal)
  const remaining = Math.max(0, goal.targetCents - goal.savedCents)
  const monthly = goalMonthlyAmount(goal)
  const status = statusMeta(goal.status)
  const over = goal.savedCents > goal.targetCents

  return (
    <Card className={cx('p-4', goal.status === 'archived' && 'bg-canvas/60')}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-income-soft text-income">
          <Target aria-hidden className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">{goal.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={status.tone}>{status.label}</Badge>
            {goal.targetDate && <span className="text-[11px] text-muted">Échéance {formatDateFR(goal.targetDate)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            aria-label={`Modifier ${goal.name}`}
            title="Modifier"
          >
            <Pencil aria-hidden className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onArchive}
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            aria-label={goal.status === 'archived' ? `Réactiver ${goal.name}` : `Archiver ${goal.name}`}
            title={goal.status === 'archived' ? 'Réactiver' : 'Archiver'}
          >
            {goal.status === 'archived' ? (
              <ArchiveRestore aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <Archive aria-hidden className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted hover:bg-expense-soft hover:text-expense focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            aria-label={`Supprimer ${goal.name}`}
            title="Supprimer"
          >
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between">
          <p className="tnum text-sm font-semibold text-ink">
            {formatEUR(goal.savedCents)}
            <span className="text-xs font-normal text-muted"> / {formatEUR(goal.targetCents)}</span>
          </p>
          <span className="text-xs font-medium text-income">{formatPercent(progress, 1)}</span>
        </div>
        <ProgressBar value={progress} tone={goal.status === 'achieved' ? 'income' : 'accent'} label={`Progression de ${goal.name}`} />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted">
          <span>{over ? `Objectif dépassé de ${formatEUR(goal.savedCents - goal.targetCents)}` : `Reste ${formatEUR(remaining)}`}</span>
          {monthly !== null && goal.status === 'active' && (
            <span>≈ {formatEUR(monthly)} / mois d’ici l’échéance</span>
          )}
        </div>
      </div>

      {goal.description && <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted">{goal.description}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        {goal.status === 'active' && (
          <Button size="sm" variant="secondary" onClick={onContribute}>
            <Plus aria-hidden className="h-3.5 w-3.5" />
            Versement
          </Button>
        )}
        {goal.status === 'active' && (
          <Button size="sm" variant="ghost" onClick={onAchieve}>
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
            Marquer atteint
          </Button>
        )}
        {goal.status === 'achieved' && (
          <Button size="sm" variant="secondary" onClick={onContribute}>
            <Plus aria-hidden className="h-3.5 w-3.5" />
            Compléter
          </Button>
        )}
      </div>
    </Card>
  )
}

export function SavingsPage() {
  const data = useAppData()
  const { deleteGoal, setGoalStatus } = useApp()
  const { pushToast } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [contributing, setContributing] = useState<SavingsGoal | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavingsGoal | null>(null)

  const summary = useMemo(() => savingsSummary(data.savingsGoals), [data.savingsGoals])
  const active = data.savingsGoals.filter((goal) => goal.status === 'active')
  const achieved = data.savingsGoals.filter((goal) => goal.status === 'achieved')
  const archived = data.savingsGoals.filter((goal) => goal.status === 'archived')
  const monthlyEffort = active.reduce((sum, goal) => sum + (goalMonthlyAmount(goal) ?? 0), 0)

  const handleStatus = async (goal: SavingsGoal, status: SavingsGoalStatus) => {
    try {
      await setGoalStatus(goal.id, status)
      pushToast(
        'success',
        status === 'archived'
          ? 'Objectif archivé. Vous pouvez le réactiver à tout moment.'
          : status === 'achieved'
            ? 'Objectif marqué comme atteint.'
            : 'Objectif réactivé.',
      )
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Opération impossible.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteGoal(deleteTarget.id)
      pushToast('success', 'Objectif supprimé. Aucun mouvement n’a été créé sur votre solde.')
      setDeleteTarget(null)
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Suppression impossible.')
    }
  }

  const renderGoal = (goal: SavingsGoal) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      onEdit={() => {
        setEditing(goal)
        setFormOpen(true)
      }}
      onContribute={() => setContributing(goal)}
      onArchive={() => void handleStatus(goal, goal.status === 'archived' ? 'active' : 'archived')}
      onAchieve={() => void handleStatus(goal, 'achieved')}
      onDelete={() => setDeleteTarget(goal)}
    />
  )

  return (
    <div>
      <PageHeader
        title="Épargne"
        subtitle="Suivez vos projets sans confondre épargne suivie et argent disponible."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus aria-hidden className="h-4 w-4" />
            Nouvel objectif
          </Button>
        }
      />

      <div className="mb-4">
        <InfoBanner tone="accent" icon={<PiggyBank aria-hidden className="h-4 w-4" />}>
          Les objectifs d’épargne sont des outils de suivi. Un versement dans un objectif n’est jamais ajouté
          automatiquement au solde : seule une transaction réelle modifie votre budget.
        </InfoBanner>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total épargné" value={formatEUR(summary.savedCents)} tone="income" hint={`${summary.activeCount} objectif(s) en cours`} />
        <StatCard label="Total visé" value={formatEUR(summary.targetCents)} hint={`${summary.achievedCount} objectif(s) atteint(s)`} />
        <StatCard label="Reste à épargner" value={formatEUR(summary.remainingCents)} hint="Hors objectifs archivés" />
        <StatCard
          label="Effort mensuel estimé"
          value={monthlyEffort > 0 ? formatEUR(monthlyEffort) : '—'}
          hint="Objectifs avec une date cible"
        />
      </div>

      {summary.targetCents > 0 && (
        <Card className="mb-4 p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">Progression globale</span>
            <span className="tnum text-muted">
              {formatEUR(summary.savedCents)} / {formatEUR(summary.targetCents)} · {formatPercent(summary.progressPercent, 1)}
            </span>
          </div>
          <ProgressBar value={summary.progressPercent} tone="income" label="Progression globale de l’épargne" />
        </Card>
      )}

      {data.savingsGoals.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Target aria-hidden className="h-5 w-5" />}
            title="Aucun objectif d’épargne"
            description="Créez un objectif pour visualiser votre progression, par exemple un fonds d’urgence ou un projet de voyage."
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                <Plus aria-hidden className="h-4 w-4" />
                Créer mon premier objectif
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-sm font-semibold text-ink">Objectifs en cours</h2>
              <div className="grid gap-3 lg:grid-cols-2">{active.map(renderGoal)}</div>
            </section>
          )}

          {achieved.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2.5 text-sm font-semibold text-ink">Objectifs atteints</h2>
              <div className="grid gap-3 lg:grid-cols-2">{achieved.map(renderGoal)}</div>
            </section>
          )}

          {archived.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2.5 text-sm font-semibold text-ink">Objectifs archivés</h2>
              <div className="grid gap-3 lg:grid-cols-2">{archived.map(renderGoal)}</div>
            </section>
          )}
        </>
      )}

      <p className="mt-4 text-[11px] leading-4 text-muted">
        Progression = montant épargné ÷ montant cible × 100, plafonnée à 100 % pour l’affichage. Le montant réel
        épargné reste conservé même s’il dépasse la cible. L’estimation mensuelle suppose un effort constant jusqu’à la
        date cible.
      </p>

      {formOpen && (
        <GoalFormModal
          goal={editing ?? undefined}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}
      {contributing && <ContributionModal goal={contributing} onClose={() => setContributing(null)} />}

      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cet objectif ?"
          confirmLabel="Supprimer"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          description={
            <>
              <p className="font-medium text-ink">{deleteTarget.name}</p>
              <p className="mt-1">
                L’objectif et son suivi seront supprimés. Aucune transaction liée à votre budget ne sera modifiée.
              </p>
            </>
          }
        />
      )}
    </div>
  )
}
