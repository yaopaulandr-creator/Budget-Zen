import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Database,
  Download,
  HardDriveDownload,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { useApp, useAppData } from '../state/AppStore'
import type { AppData, UserSettings } from '../domain/types'
import { settingsFormSchema, type SettingsFormValues, type BackupSummary } from '../domain/validation'
import {
  BackupError,
  MAX_BACKUP_BYTES,
  backupFilename,
  humanFileSize,
  parseBackup,
  serializeBackup,
} from '../domain/backup'
import { formatDateFR, formatDateTimeFR } from '../domain/dates'
import { centsToInput, formatEUR, parseAmountToCents } from '../domain/money'
import { storageEstimate } from '../storage/database'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  InfoBanner,
  Modal,
  PageHeader,
  cx,
  inputClass,
} from '../components/ui'
import { useToast } from '../components/toast'
import { ThemeChoice } from '../components/ThemeToggle'
import { triggerDownload } from '../lib/download'

interface PendingRestore {
  fileName: string
  size: number
  summary: BackupSummary
  data: AppData
}

function SettingsForm({ settings }: { settings: UserSettings }) {
  const { updateSettings } = useApp()
  const { pushToast } = useToast()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      initialBalance: centsToInput(settings.initialBalanceCents),
      balanceReferenceDate: settings.balanceReferenceDate,
      autoConfirmRecurring: settings.autoConfirmRecurring,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    const initialBalanceCents = parseAmountToCents(values.initialBalance, {
      allowNegative: true,
      allowZero: true,
    })
    if (initialBalanceCents === null) {
      setError('initialBalance', { message: 'Montant invalide.' })
      return
    }
    try {
      await updateSettings({
        initialBalanceCents,
        balanceReferenceDate: values.balanceReferenceDate,
        autoConfirmRecurring: values.autoConfirmRecurring,
      })
      pushToast('success', 'Paramètres enregistrés. Les soldes ont été recalculés.')
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Solde initial"
          htmlFor="initial-balance"
          error={errors.initialBalance?.message}
          hint="Valeur de départ à la date de référence. Un montant négatif est accepté."
        >
          <div className="relative">
            <input
              id="initial-balance"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              aria-invalid={Boolean(errors.initialBalance)}
              className={`${inputClass(Boolean(errors.initialBalance))} tnum pr-8`}
              {...register('initialBalance')}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">€</span>
          </div>
        </Field>
        <Field
          label="Date de référence"
          htmlFor="balance-date"
          error={errors.balanceReferenceDate?.message}
          hint="Seules les opérations à partir de cette date entrent dans le solde cumulé."
        >
          <input
            id="balance-date"
            type="date"
            aria-invalid={Boolean(errors.balanceReferenceDate)}
            className={inputClass(Boolean(errors.balanceReferenceDate))}
            {...register('balanceReferenceDate')}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2.5 text-[11px] leading-5 text-muted">
        Le solde initial n’est <strong className="text-ink">jamais compté comme un revenu</strong> de la période. Il
        sert uniquement de point de départ au solde cumulé. Les transactions antérieures à la date de référence
        restent visibles dans les rapports de leur période, mais ne sont pas ajoutées au solde cumulé.
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5">
        <input
          type="checkbox"              className="mt-0.5 h-4 w-4 rounded border-line-strong accent-accent-solid"
          {...register('autoConfirmRecurring')}
        />
        <span>
          <span className="block text-xs font-medium text-ink">Enregistrer automatiquement les échéances récurrentes</span>
          <span className="mt-0.5 block text-[11px] leading-4 text-muted">
            Si désactivé, les échéances dues restent en attente de confirmation et ne sont pas comptées dans les totaux.
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Enregistrer les paramètres
        </Button>
      </div>
    </form>
  )
}

export function SettingsPage() {
  const data = useAppData()
  const { hasDemoData, loadDemo, removeDemo, importData, resetAll } = useApp()
  const { pushToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    let active = true
    void storageEstimate().then((result) => {
      if (active) setUsage(result)
    })
    return () => {
      active = false
    }
  }, [])

  const handleExport = () => {
    const json = serializeBackup(data)
    triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8' }), backupFilename())
    pushToast('success', 'Sauvegarde JSON générée. Conservez-la dans un endroit sûr.')
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BACKUP_BYTES) {
      pushToast('error', 'Fichier refusé : la taille maximale est de 10 Mo.')
      return
    }
    try {
      const text = await file.text()
      const parsed = parseBackup(text)
      setPendingRestore({
        fileName: file.name,
        size: file.size,
        summary: parsed.summary,
        data: parsed.backup.data,
      })
    } catch (cause) {
      if (cause instanceof BackupError) {
        pushToast('error', cause.message, cause.details)
      } else {
        pushToast('error', 'Le fichier n’a pas pu être lu.')
      }
    }
  }

  const handleRestore = async () => {
    if (!pendingRestore) return
    setRestoring(true)
    try {
      await importData(pendingRestore.data)
      setPendingRestore(null)
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Restauration impossible.')
    } finally {
      setRestoring(false)
    }
  }

  const handleDemo = async () => {
    setDemoBusy(true)
    try {
      if (hasDemoData) await removeDemo()
      else await loadDemo()
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Opération impossible.')
    } finally {
      setDemoBusy(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetAll()
      setResetOpen(false)
      setResetConfirmation('')
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Suppression impossible.')
    } finally {
      setResetting(false)
    }
  }

  const resetReady = resetConfirmation.trim() === 'SUPPRIMER'

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Solde de départ, apparence, confidentialité, sauvegarde et restauration."
        actions={
          <Button variant="secondary" onClick={handleExport}>
            <HardDriveDownload aria-hidden className="h-4 w-4" />
            Exporter une sauvegarde
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Solde et préférences"
              description="La référence du calcul de votre solde cumulé."
            />
            <div className="px-5 pb-5 pt-4">
              <SettingsForm key={data.settings.updatedAt} settings={data.settings} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Apparence"
              description="Thème clair ou sombre, mémorisé sur cet appareil."
            />
            <div className="space-y-3 px-5 pb-5 pt-4">
              <ThemeChoice />
              <p className="text-[11px] leading-5 text-muted">
                Le choix est enregistré dans ce navigateur uniquement. Sans préférence enregistrée, BudgetZen suit le
                réglage clair/sombre de votre système. Le thème n’a aucun effet sur vos données ni sur les exports.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Sauvegarde et restauration"
              description="Un fichier JSON versionné contenant toutes vos données."
            />
            <div className="space-y-4 px-5 pb-5 pt-4">
              <InfoBanner tone="warn" icon={<TriangleAlert aria-hidden className="h-4 w-4" />}>
                Vos données vivent uniquement dans ce navigateur. Une sauvegarde exportée est le seul moyen de les
                retrouver si le stockage du navigateur est effacé. La restauration n’a pas de rôle de synchronisation
                automatique.
              </InfoBanner>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleExport}>
                  <Download aria-hidden className="h-4 w-4" />
                  Télécharger la sauvegarde
                </Button>
                <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  <Upload aria-hidden className="h-4 w-4" />
                  Restaurer depuis un fichier
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    void handleFile(file)
                  }}
                />
              </div>

              <div className="rounded-lg border border-line bg-canvas/60 px-3 py-2.5 text-[11px] leading-5 text-muted">
                <p>
                  Contenu : transactions, catégories, budgets, objectifs d’épargne, règles récurrentes, échéances,
                  solde initial, date de référence et préférences.
                </p>
                <p className="mt-1">
                  Une restauration <strong className="text-ink">remplace entièrement</strong> les données actuelles
                  après validation du fichier et confirmation explicite. La fusion n’est pas proposée pour éviter les
                  doublons. Taille maximale : 10 Mo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-canvas/40 px-4 py-6 text-center transition-colors hover:border-accent/50 hover:bg-accent-soft/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Upload aria-hidden className="h-5 w-5 text-muted" />
                <span className="mt-1.5 text-xs font-medium text-ink">Choisir un fichier de sauvegarde BudgetZen</span>
                <span className="mt-0.5 text-[11px] text-muted">JSON · aperçu obligatoire avant remplacement</span>
              </button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Données de démonstration" description="Isolées et supprimables en un clic." />
            <div className="space-y-3 px-5 pb-5 pt-4">
              <p className="text-xs leading-5 text-muted">
                Les données de démonstration permettent de découvrir les graphiques et rapports. Elles portent un
                identifiant dédié et sont signalées sur le tableau de bord. Elles ne sont jamais présentées comme vos
                données réelles.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => void handleDemo()}
                  loading={demoBusy}
                  className="max-w-full whitespace-normal text-center"
                >
                  <Sparkles aria-hidden className="h-4 w-4" />
                  {hasDemoData ? 'Supprimer les données de démonstration' : 'Charger des données de démonstration'}
                </Button>
                {hasDemoData && <Badge tone="warn">Données de démonstration actives</Badge>}
              </div>
            </div>
          </Card>

          <Card className="border-expense/25">
            <CardHeader title="Zone sensible" description="Suppression définitive des données locales." />
            <div className="space-y-3 px-5 pb-5 pt-4">
              <p className="text-xs leading-5 text-muted">
                Cette action supprime toutes les transactions, budgets, objectifs, règles, échéances et catégories
                personnalisées de ce navigateur, puis restaure les catégories par défaut et un solde initial de 0 €.
                Les fichiers de sauvegarde déjà téléchargés ne sont pas affectés.
              </p>
              <Button
                variant="secondary"
                className="border-expense/30 text-expense hover:bg-expense-soft"
                onClick={() => setResetOpen(true)}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                Supprimer toutes mes données
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Confidentialité" />
            <div className="space-y-3 px-5 pb-5 pt-4 text-[11px] leading-5 text-muted">
              <div className="flex items-start gap-2">
                <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-income" />
                <p>
                  Aucun compte, aucune requête réseau, aucun outil d’analyse. Vos données financières ne quittent pas
                  ce navigateur, sauf si vous exportez volontairement un fichier.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Database aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p>
                  Stockage : IndexedDB local{usage ? ` · ${humanFileSize(usage.usage)} utilisés` : ''}.
                  {usage && usage.quota > 0 ? ` Quota estimé : ${humanFileSize(usage.quota)}.` : ''}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <p>
                  Effacer les données du navigateur, utiliser une fenêtre de navigation privée ou perdre l’appareil
                  efface BudgetZen. Exportez une sauvegarde régulièrement. En production, servez l’application en
                  HTTPS.
                </p>
              </div>
              <p className="border-t border-line pt-3">
                Un déploiement statique en HTTPS suffit : aucune clé secrète n’est présente dans le code.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Format et devise" />
            <dl className="space-y-2.5 px-5 pb-5 pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Devise</dt>
                <dd className="font-medium text-ink">Euro (€)</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Langue</dt>
                <dd className="font-medium text-ink">Français</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Format des montants</dt>
                <dd className="tnum font-medium text-ink">{formatEUR(125050)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Format des dates</dt>
                <dd className="tnum font-medium text-ink">{formatDateFR('2026-10-19')}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Fuseau horaire</dt>
                <dd className="font-medium text-ink">Europe/Paris</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
                <dt className="text-muted">Version</dt>
                <dd className="font-medium text-ink">BudgetZen 1.0.0</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Calculs" />
            <div className="space-y-2 px-5 pb-5 pt-4 text-[11px] leading-5 text-muted">
              <p>Les montants sont stockés en centimes entiers, jamais en nombres flottants binaires.</p>
              <p>
                Solde cumulé = solde initial + revenus − dépenses depuis la date de référence, jusqu’à la fin de la
                période consultée.
              </p>
              <p>
                Les périodes utilisent une borne de début incluse et une borne de fin exclue. Une opération appartient
                donc à une seule période.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {pendingRestore && (
        <Modal
          title="Aperçu de la sauvegarde"
          description="Vérifiez le contenu avant de remplacer vos données actuelles."
          onClose={() => setPendingRestore(null)}
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setPendingRestore(null)} disabled={restoring}>
                Annuler
              </Button>
              <Button variant="danger" onClick={() => void handleRestore()} loading={restoring}>
                <RefreshCw aria-hidden className="h-4 w-4" />
                Remplacer toutes mes données
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-canvas/60 p-3 text-xs">
              <p className="font-medium text-ink">{pendingRestore.fileName}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {humanFileSize(pendingRestore.size)} · schéma v{pendingRestore.summary.schemaVersion} · exportée le{' '}
                {formatDateTimeFR(pendingRestore.summary.exportedAt)}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted">Transactions</dt>
                <dd className="tnum mt-1 text-sm font-semibold text-ink">{pendingRestore.summary.transactions}</dd>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted">Catégories</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">
                  {pendingRestore.summary.categories}
                  <span className="ml-1 text-[10px] font-normal text-muted">
                    ({pendingRestore.summary.customCategories} perso.)
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted">Budgets</dt>
                <dd className="tnum mt-1 text-sm font-semibold text-ink">{pendingRestore.summary.budgets}</dd>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted">Objectifs</dt>
                <dd className="tnum mt-1 text-sm font-semibold text-ink">{pendingRestore.summary.savingsGoals}</dd>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted">Règles récurrentes</dt>
                <dd className="tnum mt-1 text-sm font-semibold text-ink">{pendingRestore.summary.recurringRules}</dd>
              </div>
              <div className="rounded-lg border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-wide text-muted">Échéances</dt>
                <dd className="tnum mt-1 text-sm font-semibold text-ink">
                  {pendingRestore.summary.occurrences}
                  <span className="ml-1 text-[10px] font-normal text-muted">
                    ({pendingRestore.summary.pendingOccurrences} en attente)
                  </span>
                </dd>
              </div>
            </dl>

            <div className="space-y-1 text-xs text-muted">
              <p>
                Période couverte :{' '}
                <span className="font-medium text-ink">
                  {pendingRestore.summary.dateRange
                    ? `${formatDateFR(pendingRestore.summary.dateRange.start)} – ${formatDateFR(pendingRestore.summary.dateRange.end)}`
                    : 'aucune transaction'}
                </span>
              </p>
              <p>
                Solde initial :{' '}
                <span className="tnum font-medium text-ink">{formatEUR(pendingRestore.summary.initialBalanceCents)}</span>{' '}
                au {formatDateFR(pendingRestore.summary.balanceReferenceDate)}
              </p>
            </div>

            <div className={cx('rounded-lg border px-3 py-2.5 text-[11px] leading-5', 'border-expense/25 bg-expense-soft text-expense')}>
              Le fichier a été validé (format, montants, références et absence de doublons). La confirmation ci-dessous
              remplacera <strong>toutes</strong> les données actuellement présentes dans cet appareil. Pensez à
              exporter une sauvegarde de vos données actuelles au préalable.
            </div>
          </div>
        </Modal>
      )}

      {resetOpen && (
        <Modal
          title="Supprimer toutes les données ?"
          description="Cette action est définitive et ne peut pas être annulée."
          onClose={() => {
            setResetOpen(false)
            setResetConfirmation('')
          }}
          size="sm"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setResetOpen(false)
                  setResetConfirmation('')
                }}
                disabled={resetting}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleReset()}
                loading={resetting}
                disabled={!resetReady}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                Supprimer définitivement
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm leading-6 text-muted">
              Toutes les transactions, budgets, objectifs et récurrences seront supprimés de ce navigateur. Les
              catégories par défaut seront restaurées.
            </p>
            <InfoBanner tone="warn" icon={<TriangleAlert aria-hidden className="h-4 w-4" />}>
              Exportez une sauvegarde avant de continuer. Un fichier déjà téléchargé n’est pas affecté par cette
              suppression.
            </InfoBanner>
            <Field
              label="Saisissez SUPPRIMER pour confirmer"
              htmlFor="reset-confirmation"
              hint="Le mot doit être écrit en majuscules."
            >
              <input
                id="reset-confirmation"
                type="text"
                value={resetConfirmation}
                onChange={(event) => setResetConfirmation(event.target.value)}
                data-autofocus
                autoComplete="off"
                className={inputClass()}
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
