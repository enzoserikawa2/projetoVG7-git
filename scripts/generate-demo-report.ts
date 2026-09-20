import 'fake-indexeddb/auto'
import { Buffer } from 'node:buffer'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

class LocalFileReader {
  result: string | ArrayBuffer | null = null
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  readAsDataURL(blob: Blob): void {
    void blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`
        this.onload?.()
      })
      .catch(() => this.onerror?.())
  }
}

function installNodeAdapters(projectRoot: string): void {
  Object.defineProperty(globalThis, 'FileReader', {
    configurable: true,
    value: LocalFileReader
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const demoFile = target.match(/demo\/(chiller-(?:corrosao|isolamento)\.png)$/)?.[1]
    if (!demoFile) return originalFetch(input, init)
    const bytes = await readFile(path.join(projectRoot, 'public', 'demo', demoFile))
    return new Response(bytes, { headers: { 'content-type': 'image/png' } })
  }
}

export async function generateDemoReport(): Promise<void> {
  const projectRoot = process.cwd()
  installNodeAdapters(projectRoot)

  const [{ db }, { DEMO_IDS, ensureSeedData }, { generateReportPdf }] = await Promise.all([
    import('../src/db/database'),
    import('../src/db/seed'),
    import('../src/services/report-pdf')
  ])

  await ensureSeedData()
  const [inspection, settings, photos] = await Promise.all([
    db.inspections.get(DEMO_IDS.inspection),
    db.settings.get('professional'),
    db.photos.where('inspectionId').equals(DEMO_IDS.inspection).toArray()
  ])
  if (!inspection || !settings) throw new Error('Dados demonstrativos não foram carregados.')

  const report = await generateReportPdf({ inspection, settings, photos, reportVersion: 1 })
  const outputDirectory = path.join(projectRoot, 'output', 'pdf')
  const outputPath = path.join(outputDirectory, 'RELATORIO_HVAC_DEMONSTRACAO_V01.pdf')
  await mkdir(outputDirectory, { recursive: true })
  await writeFile(outputPath, Buffer.from(await report.blob.arrayBuffer()))
  db.close()

  console.log(`PDF demonstrativo: ${outputPath}`)
  console.log(`SHA-256: ${report.sha256}`)
}
