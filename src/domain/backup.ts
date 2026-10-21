import { nowISOString } from './dates'
import type { AppData } from './types'
import {
  BACKUP_SCHEMA_VERSION,
  backupSchema,
  checkIntegrity,
  summarizeBackup,
  type BackupEnvelope,
  type BackupSummary,
} from './validation'

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

export class BackupError extends Error {
  readonly details: string[]

  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = 'BackupError'
    this.details = details
  }
}

export function createBackup(data: AppData, exportedAt: string = nowISOString()): BackupEnvelope {
  return {
    app: 'BudgetZen',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: structuredClone(data),
  }
}

export function serializeBackup(data: AppData, exportedAt?: string): string {
  return JSON.stringify(createBackup(data, exportedAt), null, 2)
}

export interface ParsedBackup {
  backup: BackupEnvelope
  summary: BackupSummary
}

/** Validates a backup file without touching existing data. */
export function parseBackup(text: string): ParsedBackup {
  if (text.trim().length === 0) {
    throw new BackupError('Le fichier est vide.')
  }
  if (new Blob([text]).size > MAX_BACKUP_BYTES) {
    throw new BackupError('Le fichier dépasse la taille maximale autorisée de 10 Mo.')
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupError('Le fichier n’est pas un JSON valide.')
  }

  if (typeof json !== 'object' || json === null) {
    throw new BackupError('Le fichier ne contient pas une sauvegarde BudgetZen.')
  }
  const version = (json as { schemaVersion?: unknown }).schemaVersion
  if (typeof version === 'number' && version > BACKUP_SCHEMA_VERSION) {
    throw new BackupError(
      'Cette sauvegarde provient d’une version plus récente de BudgetZen et ne peut pas être restaurée ici.',
    )
  }

  const result = backupSchema.safeParse(json)
  if (!result.success) {
    const details = result.error.issues.slice(0, 6).map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : 'racine'
      return `${path} : ${issue.message}`
    })
    throw new BackupError('Le format de la sauvegarde est invalide.', details)
  }

  const integrityErrors = checkIntegrity(result.data.data)
  if (integrityErrors.length > 0) {
    throw new BackupError(
      'La sauvegarde est incohérente et n’a pas été importée.',
      integrityErrors.slice(0, 8),
    )
  }

  return {
    backup: result.data,
    summary: summarizeBackup(result.data),
  }
}

export function backupFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `budgetzen-sauvegarde-${stamp}.json`
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
