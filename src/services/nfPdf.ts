import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

export type ExtractedNfFields = {
  numberNf: string
  acessKey: string
  emissionDate: string
  totalValue: string
}

export type NfPdfField = keyof ExtractedNfFields

export type NfPdfExtraction = {
  fields: ExtractedNfFields
  missing: NfPdfField[]
}

const emptyFields: ExtractedNfFields = {
  numberNf: '',
  acessKey: '',
  emissionDate: '',
  totalValue: '',
}

function valueAfterLabel(text: string, label: string, pattern: RegExp) {
  const start = text.indexOf(label)
  if (start < 0) return null
  return text.slice(start + label.length).match(pattern)?.[1] ?? null
}

function normalizeMoney(value: string) {
  const amount = Number(value.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(amount) ? String(amount) : ''
}

export async function extractNfFields(file: File): Promise<NfPdfExtraction> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() })
  const pdf = await loadingTask.promise
  const pageTexts: string[] = []

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      pageTexts.push(content.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' '))
    }
  } finally {
    await loadingTask.destroy()
  }

  const text = pageTexts.join(' ').replace(/\s+/g, ' ').trim()
  if (!text) throw new Error('O PDF não contém texto selecionável. Preencha os campos manualmente.')

  const numberNf = valueAfterLabel(text, 'NÚMERO DA NFS-e', /\s*(\d+)/) ?? ''
  const acessKey = valueAfterLabel(text, 'CHAVE DE ACESSO DA NFS-e', /\s*(\d{44,50})(?!\d)/) ?? ''
  const rawDate = valueAfterLabel(text, 'DATA E HORA DA EMISSÃO DA NFS-e', /\s*(\d{2}\/\d{2}\/\d{4})/) ?? ''
  const dateParts = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const emissionDate = dateParts ? `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}` : ''
  const rawTotal = valueAfterLabel(
    text,
    'VALOR TOTAL DA NFS-e VALOR DA OPERAÇÃO / SERVIÇO',
    /R\$\s*([\d.,]+)/,
  )
  const totalValue = rawTotal ? normalizeMoney(rawTotal) : ''

  const fields = { numberNf, acessKey, emissionDate, totalValue }
  const missing = (Object.keys(emptyFields) as NfPdfField[]).filter((field) => !fields[field])
  return { fields, missing }
}