import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Archive,
  ArchiveRestore,
  Check,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react'
import { useApp, useAppData } from '../state/AppStore'
import type { Category, TransactionType } from '../domain/types'
import { categoryFormSchema, type CategoryFormValues } from '../domain/validation'
import { formatEUR } from '../domain/money'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SegmentedControl,
  cx,
  inputClass,
} from '../components/ui'
import { CATEGORY_ICONS, CategoryIcon } from '../components/CategoryIcon'
import { CATEGORY_SWATCHES } from '../domain/defaults'
import { useToast } from '../components/toast'

function CategoryFormModal({
  category,
  defaultType,
  onClose,
}: {
  category?: Category
  defaultType: TransactionType
  onClose: () => void
}) {
  const data = useAppData()
  const { addCategory, updateCategory } = useApp()
  const { pushToast } = useToast()
  const isEditing = Boolean(category)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name ?? '',
      type: category?.type ?? defaultType,
      icon: category?.icon ?? 'tag',
      color: category?.color ?? CATEGORY_SWATCHES[0],
    },
  })

  const icon = watch('icon')
  const color = watch('color')
  const name = watch('name')
  const type = watch('type')

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (category) {
        await updateCategory(category.id, { name: values.name, icon: values.icon, color: values.color })
        pushToast('success', 'Catégorie mise à jour. Les opérations existantes sont conservées.')
      } else {
        await addCategory(values)
        pushToast('success', 'Catégorie créée.')
      }
      onClose()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible d’enregistrer la catégorie.'
      pushToast('error', message)
      setError('root', { message })
    }
  })

  return (
    <Modal
      title={isEditing ? 'Modifier la catégorie' : `Nouvelle catégorie de ${type === 'income' ? 'revenus' : 'dépenses'}`}
      description={
        isEditing
          ? 'Le type d’une catégorie ne peut pas être modifié pour préserver l’historique.'
          : 'Choisissez un nom, une icône et une couleur faciles à reconnaître.'
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="category-form" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <form id="category-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <input type="hidden" {...register('type')} />
        <input type="hidden" {...register('icon')} />
        <input type="hidden" {...register('color')} />

        <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas/50 p-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{name.trim() || 'Nom de la catégorie'}</p>
            <p className="text-[11px] text-muted">
              {type === 'income' ? 'Revenu' : 'Dépense'}
              {category?.isDefault ? ' · catégorie prédéfinie' : ' · catégorie personnalisée'}
            </p>
          </div>
        </div>

        <Field label="Nom" htmlFor="category-name" error={errors.name?.message} required hint={`${name.length}/80 caractères`}>
          <input
            id="category-name"
            type="text"
            maxLength={80}
            data-autofocus
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'category-name-error' : undefined}
            className={inputClass(Boolean(errors.name))}
            {...register('name')}
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink">Icône</legend>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
            {CATEGORY_ICONS.map((entry) => {
              const Icon = entry.Icon
              return (
                <button
                  key={entry.value}
                  type="button"
                  title={entry.label}
                  aria-label={entry.label}
                  aria-pressed={icon === entry.value}
                  onClick={() => setValue('icon', entry.value, { shouldValidate: true })}
                  className={cx(
                    'flex h-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                    icon === entry.value
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface text-muted hover:bg-canvas hover:text-ink',
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-ink">Couleur</legend>
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Couleur ${swatch}`}
                aria-pressed={color.toLowerCase() === swatch.toLowerCase()}
                onClick={() => setValue('color', swatch, { shouldValidate: true })}
                className={cx(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  color.toLowerCase() === swatch.toLowerCase() ? 'border-ink scale-105' : 'border-transparent',
                )}
                style={{ backgroundColor: swatch }}
              >
                {color.toLowerCase() === swatch.toLowerCase() && (
                  <Check aria-hidden className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                )}
              </button>
            ))}
            <label className="ml-1 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 text-[11px] text-muted hover:bg-canvas">
              <input
                type="color"
                value={color}
                onChange={(event) => setValue('color', event.target.value, { shouldValidate: true })}
                className="h-4 w-5 cursor-pointer border-0 bg-transparent p-0"
                aria-label="Couleur personnalisée"
              />
              Personnalisée
            </label>
          </div>
          {errors.color?.message && <p className="mt-1 text-xs text-expense">{errors.color.message}</p>}
        </fieldset>

        {isEditing && (
          <p className="rounded-lg border border-line bg-canvas/60 px-3 py-2 text-[11px] leading-4 text-muted">
            Les anciennes opérations conservent cette catégorie. Aucun historique n’est modifié rétroactivement.
          </p>
        )}

        {errors.root?.message && (
          <p role="alert" className="rounded-lg border border-expense/25 bg-expense-soft px-3 py-2 text-xs text-expense">
            {errors.root.message}
          </p>
        )}

        <p className="text-[11px] text-muted">
          {data.categories.filter((item) => item.type === type).length} catégorie(s) de ce type disponible(s).
        </p>
      </form>
    </Modal>
  )
}

export function CategoriesPage() {
  const data = useAppData()
  const { setCategoryActive, deleteCategory } = useApp()
  const { pushToast } = useToast()
  const [tab, setTab] = useState<TransactionType>('expense')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  const usage = useMemo(() => {
    const map = new Map<
      string,
      { transactions: number; totalCents: number; rules: number; budgets: number }
    >()
    for (const category of data.categories) {
      map.set(category.id, { transactions: 0, totalCents: 0, rules: 0, budgets: 0 })
    }
    for (const transaction of data.transactions) {
      const entry = map.get(transaction.categoryId)
      if (!entry) continue
      entry.transactions += 1
      entry.totalCents +=
        transaction.type === 'income' ? transaction.amountCents : transaction.amountCents
    }
    for (const rule of data.recurringRules) {
      const entry = map.get(rule.categoryId)
      if (entry) entry.rules += 1
    }
    for (const budget of data.budgets) {
      const entry = map.get(budget.categoryId)
      if (entry) entry.budgets += 1
    }
    return map
  }, [data])

  const byType = useMemo(
    () =>
      data.categories
        .filter((category) => category.type === tab)
        .slice()
        .sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
          return a.name.localeCompare(b.name, 'fr')
        }),
    [data.categories, tab],
  )
  const activeCategories = byType.filter((category) => category.isActive)
  const archivedCategories = byType.filter((category) => !category.isActive)

  const handleArchive = async (category: Category) => {
    try {
      await setCategoryActive(category.id, !category.isActive)
      pushToast(
        'success',
        category.isActive
          ? 'Catégorie archivée. Elle reste visible dans l’historique.'
          : 'Catégorie réactivée. Elle est de nouveau sélectionnable.',
      )
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Opération impossible.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCategory(deleteTarget.id)
      pushToast('success', 'Catégorie supprimée.')
      setDeleteTarget(null)
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Suppression impossible.')
    }
  }

  const renderCard = (category: Category) => {
    const stats = usage.get(category.id) ?? { transactions: 0, totalCents: 0, rules: 0, budgets: 0 }
    const canDelete = !category.isDefault && stats.transactions === 0 && stats.rules === 0 && stats.budgets === 0
    return (
      <Card key={category.id} className={cx('p-4', !category.isActive && 'bg-canvas/60')}>
        <div className="flex items-start justify-between gap-2">
          <CategoryIcon icon={category.icon} color={category.color} size="md" />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                setEditing(category)
                setFormOpen(true)
              }}
              className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              aria-label={`Modifier ${category.name}`}
              title="Modifier"
            >
              <Pencil aria-hidden className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleArchive(category)}
              className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              aria-label={category.isActive ? `Archiver ${category.name}` : `Réactiver ${category.name}`}
              title={category.isActive ? 'Archiver' : 'Réactiver'}
            >
              {category.isActive ? (
                <Archive aria-hidden className="h-3.5 w-3.5" />
              ) : (
                <ArchiveRestore aria-hidden className="h-3.5 w-3.5" />
              )}
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteTarget(category)}
                className="rounded-md p-1.5 text-muted hover:bg-expense-soft hover:text-expense focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                aria-label={`Supprimer ${category.name}`}
                title="Supprimer"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink">{category.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1">
              {category.isDefault && <Badge tone="muted">Prédéfinie</Badge>}
              {!category.isActive && <Badge tone="warn">Archivée</Badge>}
            </div>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted">Opérations</dt>
            <dd className="tnum mt-0.5 text-xs font-semibold text-ink">{stats.transactions}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-muted">Total</dt>
            <dd className="tnum mt-0.5 text-xs font-semibold text-ink">{formatEUR(stats.totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[10px] text-muted">
          {stats.rules} règle(s) récurrente(s) · {stats.budgets} budget(s)
        </p>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title="Catégories"
        subtitle="Organisez vos revenus et vos dépenses. L’historique n’est jamais modifié sans votre action."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus aria-hidden className="h-4 w-4" />
            Ajouter une catégorie
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          label="Type de catégorie"
          options={[
            { value: 'expense', label: `Dépenses (${data.categories.filter((category) => category.type === 'expense').length})` },
            { value: 'income', label: `Revenus (${data.categories.filter((category) => category.type === 'income').length})` },
          ]}
          value={tab}
          onChange={setTab}
        />
        <p className="text-[11px] text-muted">
          {activeCategories.length} active(s) · {archivedCategories.length} archivée(s)
        </p>
      </div>

      {activeCategories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tags aria-hidden className="h-5 w-5" />}
            title="Aucune catégorie active"
            description="Créez une catégorie pour pouvoir enregistrer une transaction de ce type."
            action={
              <Button variant="primary" onClick={() => setFormOpen(true)}>
                <Plus aria-hidden className="h-4 w-4" />
                Créer une catégorie
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{activeCategories.map(renderCard)}</div>
      )}

      {archivedCategories.length > 0 && (
        <section className="mt-7">
          <div className="mb-2.5 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">Catégories archivées</h2>
            <span className="text-xs text-muted">({archivedCategories.length})</span>
          </div>
          <p className="mb-3 text-xs text-muted">
            Elles ne sont plus proposées lors de la saisie, mais restent attachées aux opérations existantes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{archivedCategories.map(renderCard)}</div>
        </section>
      )}

      <p className="mt-5 text-[11px] leading-4 text-muted">
        Une catégorie utilisée par des transactions, une règle ou un budget ne peut pas être supprimée définitivement :
        archivez-la pour conserver l’historique. Les catégories prédéfinies ne sont jamais supprimables.
      </p>

      {formOpen && (
        <CategoryFormModal
          category={editing ?? undefined}
          defaultType={editing?.type ?? tab}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Supprimer cette catégorie ?"
          confirmLabel="Supprimer"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          description={
            <>
              <p className="font-medium text-ink">{deleteTarget.name}</p>
              <p className="mt-1">
                Cette catégorie personnalisée n’est utilisée par aucune opération, règle ou budget. Sa suppression est
                définitive.
              </p>
            </>
          }
        />
      )}
    </div>
  )
}
