import { zipSync, strToU8 } from 'fflate'
import type { Category, Transaction } from '../domain/types'
import { sanitizeSpreadsheetText } from './csv'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function textCell(reference: string, value: string, style = 0): string {
  const safe = sanitizeSpreadsheetText(value).replace(/\r?\n/g, ' / ')
  const styleAttr = style ? ` s="${style}"` : ''
  return `<c r="${reference}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(safe)}</t></is></c>`
}

function numberCell(reference: string, value: number, style = 0): string {
  const styleAttr = style ? ` s="${style}"` : ''
  return `<c r="${reference}"${styleAttr}><v>${value}</v></c>`
}

function columnLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

export function createTransactionsXlsx(
  transactions: Transaction[],
  categories: Category[],
  generatedAt: Date = new Date(),
): Blob {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const sorted = [...transactions].sort((a, b) => {
    if (a.transactionDate === b.transactionDate) return a.createdAt.localeCompare(b.createdAt)
    return a.transactionDate < b.transactionDate ? 1 : -1
  })
  const headers = ['Date', 'Type', 'Catégorie', 'Montant (EUR)', 'Description', 'Récurrente']
  const rows: string[] = []
  rows.push(
    `<row r="1" ht="22" customHeight="1">${headers
      .map((header, index) => textCell(`${columnLetter(index)}1`, header, 1))
      .join('')}</row>`,
  )

  sorted.forEach((transaction, index) => {
    const rowNumber = index + 2
    const category = categoryById.get(transaction.categoryId)
    const cells = [
      textCell(`A${rowNumber}`, transaction.transactionDate),
      textCell(`B${rowNumber}`, transaction.type === 'income' ? 'Revenu' : 'Dépense'),
      textCell(`C${rowNumber}`, category?.name ?? 'Catégorie inconnue'),
      numberCell(`D${rowNumber}`, transaction.amountCents / 100, 2),
      textCell(`E${rowNumber}`, transaction.description),
      textCell(`F${rowNumber}`, transaction.recurringOccurrenceId ? 'Oui' : 'Non'),
    ]
    rows.push(`<row r="${rowNumber}">${cells.join('')}</row>`)
  })

  const lastRow = Math.max(1, sorted.length + 1)
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:F${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="12" customWidth="1"/>
    <col min="2" max="2" width="11" customWidth="1"/>
    <col min="3" max="3" width="30" customWidth="1"/>
    <col min="4" max="4" width="16" customWidth="1"/>
    <col min="5" max="5" width="50" customWidth="1"/>
    <col min="6" max="6" width="13" customWidth="1"/>
  </cols>
  <sheetData>${rows.join('')}</sheetData>
  <autoFilter ref="A1:F${lastRow}"/>
</worksheet>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Transactions" sheetId="1" r:id="rId1"/></sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><color rgb="FF23272B"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2C5F73"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

  const timestamp = generatedAt.toISOString()
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Transactions BudgetZen</dc:title>
  <dc:creator>BudgetZen</dc:creator>
  <cp:lastModifiedBy>BudgetZen</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified>
</cp:coreProperties>`

  const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>BudgetZen</Application></Properties>`

  const archive = zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rootRels),
      'docProps/core.xml': strToU8(core),
      'docProps/app.xml': strToU8(app),
      'xl/workbook.xml': strToU8(workbook),
      'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
      'xl/styles.xml': strToU8(styles),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
    },
    { level: 6 },
  )

  return new Blob([archive as BlobPart], { type: XLSX_MIME })
}

export function xlsxFilename(now: Date = new Date(), filtered: boolean): string {
  return `budgetzen-transactions${filtered ? '-filtrees' : ''}-${now.toISOString().slice(0, 10)}.xlsx`
}
