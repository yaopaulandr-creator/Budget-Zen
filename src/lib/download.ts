export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function datedFilename(prefix: string, extension: string, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10)
  return `${prefix}-${stamp}.${extension}`
}
