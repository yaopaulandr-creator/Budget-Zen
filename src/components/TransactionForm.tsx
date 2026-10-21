import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useAppData } from '../state/AppStore'
import { useApp } from '../state/AppStore'
import { centsToInput, parseAmountToCents } from '../domain/money'
import { todayISO } from '../domain/dates'
import type { Transaction, TransactionDraft } from '../domain/types'
import {
  transactionFormSchema,
  type TransactionFormValues,
} from '../domain/validation'
import { Button, Field, Modal, inputClass } from './ui'
import { CategoryIcon } from './CategoryIcon'
import { useToast } from './toast'

export function TransactionFormModal({
  transaction,
  duplicateOf,
  onClose,
}: {
  transaction?: Transaction
  duplicateOf?: Transaction
  onClose: () => void
}) {
  const data = useAppData()
  const { addTransaction, updateTransaction } = useApp()
  const { pushToast } = useToast()
  const isEditing = Boolean(transaction)
  const source = transaction ?? duplicateOf

  const categories = useMemo(
    () => data.categories.filter((category) => category.type === (source?.type ?? 'expense')),
    [data.categories, source?.type],
  )

  const defaults: TransactionFormValues = {
    type: source?.type ?? 'expense',
    amount: source ? centsToInput(source.amountCents) : '',
    transactionDate: duplicateOf ? todayISO() : (source?.transactionDate ?? todayISO()),
    categoryId: source?.categoryId ?? categories.find((category) => category.isActive)?.id ?? '',
    description: source?.description ?? '',
  }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaults,
  })

  const type = watch('type')
  const categoryId = watch('categoryId')
  const description = watch('description') ?? ''

  const categoryOptions = useMemo(() => {
    const active = data.categories.filter((category) => category.type === type && category.isActive)
    if (isEditing && transaction) {
      const current = data.categories.find((category) => category.id === transaction.categoryId)
      if (current && current.type === type && !active.some((category) => category.id === current.id)) {
        return [current, ...active]
      }
    }
    return active
  }, [data.categories, type, isEditing, transaction])

  useEffect(() => {
    const current = data.categories.find((category) => category.id === categoryId)
    if (current && current.type === type) return
    const next = categoryOptions[0]
    setValue('categoryId', next?.id ?? '', { shouldValidate: false })
  }, [type, categoryId, categoryOptions, data.categories, setValue])

  const selectedCategory = data.categories.find((category) => category.id === categoryId)

  const onSubmit = handleSubmit(async (values) => {
    const amountCents = parseAmountToCents(values.amount)
    if (amountCents === null) {
      setError('amount', { message: 'Montant invalide.' })
      return
    }
    const category = data.categories.find((item) => item.id === values.categoryId)
    if (!category) {
      setError('categoryId', { message: 'Choisissez une catégorie.' })
      return
    }
    if (category.type !== values.type) {
      setError('categoryId', { message: 'Cette catégorie ne correspond pas au type choisi.' })
      return
    }
    if (!category.isActive && category.id !== transaction?.categoryId) {
      setError('categoryId', { message: 'Cette catégorie est archivée.' })
      return
    }
    const draft: TransactionDraft = {
      type: values.type,
      amountCents,
      transactionDate: values.transactionDate,
      categoryId: values.categoryId,
      description: values.description,
    }
    try {
      if (transaction) {
        await updateTransaction(transaction.id, draft)
        pushToast('success', 'Transaction modifiée. Les totaux ont été recalculés.')
      } else {
        await addTransaction(draft)
        pushToast('success', 'Transaction enregistrée. Les totaux ont été recalculés.')
      }
      onClose()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible d’enregistrer la transaction.'
      pushToast('error', message)
      setError('root', { message })
    }
  })

  return (
    <Modal
      title={isEditing ? 'Modifier la transaction' : 'Nouvelle transaction'}
      description={
        isEditing
          ? 'Les indicateurs et rapports seront recalculés automatiquement.'
          : 'Ajoutez un revenu ou une dépense à votre budget.'
      }
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" loading={isSubmitting} type="submit" form="transaction-form">
            Enregistrer
          </Button>
        </div>
      }
    >
      <form id="transaction-form" onSubmit={onSubmit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-ink">Type d’opération</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={type === 'expense'}
              onClick={() => setValue('type', 'expense', { shouldValidate: true })}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                type === 'expense'
                  ? 'border-expense/40 bg-expense-soft text-expense'
                  : 'border-line-strong bg-surface text-muted hover:bg-canvas'
              }`}
            >
              <ArrowUpRight aria-hidden className="h-4 w-4" />
              Dépense
            </button>
            <button
              type="button"
              aria-pressed={type === 'income'}
              onClick={() => setValue('type', 'income', { shouldValidate: true })}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                type === 'income'
                  ? 'border-income/40 bg-income-soft text-income'
                  : 'border-line-strong bg-surface text-muted hover:bg-canvas'
              }`}
            >
              <ArrowDownLeft aria-hidden className="h-4 w-4" />
              Revenu
            </button>
          </div>
          <input type="hidden" {...register('type')} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant" htmlFor="transaction-amount" error={errors.amount?.message} required hint="En euros, par exemple 1 250,50.">
            <div className="relative">
              <input
                id="transaction-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                data-autofocus
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? 'transaction-amount-error' : 'transaction-amount-hint'}
                className={`${inputClass(Boolean(errors.amount))} tnum pr-8 text-base`}
                {...register('amount')}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">€</span>
            </div>
          </Field>

          <Field label="Date de l’opération" htmlFor="transaction-date" error={errors.transactionDate?.message} required>
            <input
              id="transaction-date"
              type="date"
              aria-invalid={Boolean(errors.transactionDate)}
              aria-describedby={errors.transactionDate ? 'transaction-date-error' : undefined}
              className={inputClass(Boolean(errors.transactionDate))}
              {...register('transactionDate')}
            />
          </Field>
        </div>

        <Field
          label="Catégorie"
          htmlFor="transaction-category"
          error={errors.categoryId?.message}
          required
          hint={selectedCategory ? undefined : 'Créez d’abord une catégorie active pour ce type d’opération.'}
        >
          <div className="flex items-center gap-2">
            {selectedCategory && (
              <CategoryIcon icon={selectedCategory.icon} color={selectedCategory.color} size="md" />
            )}
            <select
              id="transaction-category"
              aria-invalid={Boolean(errors.categoryId)}
              aria-describedby={errors.categoryId ? 'transaction-category-error' : undefined}
              className={inputClass(Boolean(errors.categoryId))}
              {...register('categoryId')}
            >
              {categoryOptions.length === 0 && <option value="">Aucune catégorie disponible</option>}
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {!category.isActive ? ' (archivée)' : ''}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <Field label="Description" htmlFor="transaction-description" error={errors.description?.message} hint={`Facultative · ${description.length}/500`}>
          <textarea
            id="transaction-description"
            rows={3}
            maxLength={500}
            placeholder="Ex. Courses de la semaine"
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? 'transaction-description-error' : undefined}
            className={`${inputClass(Boolean(errors.description))} resize-none`}
            {...register('description')}
          />
        </Field>

        {errors.root?.message && (
          <p role="alert" className="rounded-lg border border-expense/25 bg-expense-soft px-3 py-2 text-xs text-expense">
            {errors.root.message}
          </p>
        )}
        <p className="text-[11px] leading-4 text-muted">
          Le montant est stocké en centimes et les calculs sont exacts. Un dépassement de budget ne bloque jamais
          l’enregistrement.
        </p>
      </form>
    </Modal>
  )
}
