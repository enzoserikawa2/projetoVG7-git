import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { CHECKLIST_STATUS, EQUIPMENT_STATE } from '../domain/constants'
import { formatDate, sanitizeFilePart } from '../domain/ids'
import { findEquipment, findLocation, getReviewSummary } from '../domain/inspection'
import type { Inspection, InspectionPhoto, ProfessionalSettings } from '../domain/types'

pdfMake.addVirtualFileSystem(pdfFonts)

function safe(value: string | undefined, fallback = 'Não informado'): string {
  const text = value?.trim() || fallback
  return text.replace(/[\u2010-\u2015]/g, '-').replace(/\u00a0/g, ' ')
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler uma imagem para o relatório.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

function labelValue(label: string, value: string): Content {
  return {
    stack: [
      { text: label.toUpperCase(), style: 'metaLabel' },
      { text: safe(value), style: 'metaValue' }
    ],
    margin: [0, 0, 0, 12]
  }
}

function section(title: string, content: Content | Content[]): Content[] {
  return [
    { text: safe(title), style: 'sectionTitle', margin: [0, 12, 0, 8] },
    ...(Array.isArray(content) ? content : [content])
  ]
}

export interface GeneratedReport {
  blob: Blob
  fileName: string
  sha256: string
  reportVersion: number
}

export async function generateReportPdf(args: {
  inspection: Inspection
  settings: ProfessionalSettings
  photos: InspectionPhoto[]
  reportVersion: number
}): Promise<GeneratedReport> {
  const { inspection, settings, photos, reportVersion } = args
  const photoData = new Map<string, string>()
  for (const photo of photos) {
    const blob = photo.reportBlob
    if (!['image/jpeg', 'image/png'].includes(blob.type)) continue
    try {
      photoData.set(photo.id, await blobToDataUrl(blob))
    } catch {
      // O original permanece no IndexedDB; a ausência da imagem é indicada no conteúdo.
    }
  }

  let logo: string | undefined
  if (settings.logoBlob && ['image/jpeg', 'image/png'].includes(settings.logoBlob.type)) {
    try {
      logo = await blobToDataUrl(settings.logoBlob)
    } catch {
      logo = undefined
    }
  }

  const summary = getReviewSummary(inspection, photos.length)
  const versionLabel = `V${String(reportVersion).padStart(2, '0')}`
  const content: Content[] = []

  content.push({
    stack: [
      logo
        ? { image: logo, fit: [150, 72], alignment: 'left', margin: [0, 0, 0, 28] }
        : {
            columns: [
              { text: 'VG7', style: 'brandMark', width: 74 },
              {
                stack: [
                  { text: safe(settings.companyName || 'VG7 Engenharia').toUpperCase(), style: 'brandName' },
                  { text: 'ENGENHARIA E INSPEÇÃO TÉCNICA', style: 'brandSub' }
                ],
                margin: [14, 8, 0, 0]
              }
            ],
            margin: [0, 0, 0, 36]
          },
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 7, color: '#e7a930' }], margin: [0, 0, 0, 34] },
      { text: 'RELATÓRIO TÉCNICO', style: 'coverKicker' },
      { text: 'VISTORIA HVAC', style: 'coverTitle' },
      { text: safe(inspection.facility), style: 'coverFacility', margin: [0, 8, 0, 34] },
      {
        columns: [
          { width: '*', stack: [labelValue('Cliente', inspection.client), labelValue('Endereço', inspection.address)] },
          {
            width: 180,
            stack: [labelValue('Data da vistoria', formatDate(inspection.inspectionDate)), labelValue('Versão', versionLabel)]
          }
        ]
      },
      inspection.isDemo
        ? {
            text: 'DOCUMENTO DEMONSTRATIVO - CONTEÚDO FICTÍCIO - SEM VALOR TÉCNICO',
            style: 'demoWarning',
            margin: [0, 24, 0, 0]
          }
        : { text: '' },
      {
        text: safe(inspection.technicalLead || inspection.inspector),
        style: 'coverResponsible',
        margin: [0, 78, 0, 0]
      },
      { text: 'Responsável técnico', style: 'metaLabel' }
    ],
    pageBreak: 'after'
  })

  content.push(
    ...section('1. Identificação', {
      table: {
        widths: [145, '*'],
        body: [
          ['Cliente', safe(inspection.client)],
          ['Empreendimento', safe(inspection.facility)],
          ['Endereço', safe(inspection.address)],
          ['Data', formatDate(inspection.inspectionDate)],
          ['Inspetor', safe(inspection.inspector)],
          ['Responsável técnico', safe(inspection.technicalLead)],
          ['Proposta / contrato', safe(inspection.contractNumber, 'Não informado')],
          ['Tipo de inspeção', safe(inspection.inspectionType)]
        ]
      },
      layout: 'reportTable'
    }),
    ...section('2. Objetivo e finalidade', { text: safe(inspection.purpose), style: 'body' }),
    ...section('3. Escopo', { text: safe(inspection.scope), style: 'body' }),
    ...section('4. Metodologia', { text: safe(inspection.methodology), style: 'body' }),
    ...section('5. Limitações da inspeção', {
      stack: [
        { text: safe(inspection.limitations), style: 'body' },
        ...summary.limitations
          .filter((item) => !item.startsWith('Geral:'))
          .map((item) => ({ text: `• ${safe(item)}`, style: 'bullet' as const }))
      ]
    })
  )

  const equipmentRows: Content[][] = [['Local', 'Equipamento', 'Tipo', 'Estado']]
  for (const location of inspection.locations) {
    if (location.equipment.length === 0) equipmentRows.push([safe(location.name), 'Nenhum', '-', '-'])
    for (const equipment of location.equipment) {
      equipmentRows.push([
        safe(location.name),
        safe(equipment.tag),
        safe(equipment.type),
        EQUIPMENT_STATE[equipment.operatingState]
      ])
    }
  }
  content.push(
    ...section('6. Locais e equipamentos inspecionados', {
      table: { headerRows: 1, widths: ['*', '*', 95, 80], body: equipmentRows },
      layout: 'reportTable'
    })
  )

  content.push(
    { text: '7. Resumo quantitativo', style: 'sectionTitle', pageBreak: 'before', margin: [0, 0, 0, 8] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 64],
        body: [
          ['Classificação', 'Quantidade'],
          ['Critérios conformes', summary.conforme],
          ['Critérios não conformes', summary.naoConforme],
          ['Critérios não aplicáveis', summary.naoAplicavel],
          ['Critérios não inspecionados', summary.naoInspecionado],
          ['Ocorrências registradas', summary.occurrences],
          ['Fotografias', summary.photos]
        ]
      },
      layout: 'reportTable'
    },
    {
      text: 'Itens não inspecionados não foram considerados conformes.',
      style: 'note',
      margin: [0, 7, 0, 0]
    }
  )

  content.push({ text: '8. Não conformidades', style: 'sectionTitle', pageBreak: 'before', margin: [0, 0, 0, 10] })
  if (inspection.occurrences.length === 0) {
    content.push({
      text: 'Nenhuma ocorrência foi registrada. Esta informação não constitui declaração de conformidade ou segurança global.',
      style: 'note'
    })
  }

  for (const occurrence of inspection.occurrences.slice().sort((a, b) => a.internalNumber - b.internalNumber)) {
    const location = findLocation(inspection, occurrence.locationId)
    const equipment = findEquipment(inspection, occurrence.locationId, occurrence.equipmentId)
    const confirmedReferences = occurrence.references.filter((reference) => reference.applicabilityConfirmed)
    content.push({
      stack: [
        {
          table: {
            widths: [70, '*'],
            body: [
              [
                {
                  text: `NC-${String(occurrence.internalNumber).padStart(3, '0')}`,
                  style: 'occurrenceNumber',
                  fillColor: '#123b35'
                },
                {
                  stack: [
                    { text: safe(occurrence.title), style: 'occurrenceTitle' },
                    {
                      text: `${safe(location?.name)} / ${safe(equipment?.tag, 'Sem equipamento específico')}`,
                      style: 'occurrenceContext'
                    }
                  ],
                  margin: [10, 0, 0, 0]
                }
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 12]
        },
        { text: 'CONSTATAÇÃO', style: 'fieldLabel' },
        { text: safe(occurrence.finding), style: 'body', margin: [0, 2, 0, 9] },
        { text: 'DESCRIÇÃO TÉCNICA', style: 'fieldLabel' },
        { text: safe(occurrence.technicalDescription, 'Não informada'), style: 'body', margin: [0, 2, 0, 9] },
        { text: 'RECOMENDAÇÃO', style: 'fieldLabel' },
        { text: safe(occurrence.recommendation), style: 'body', margin: [0, 2, 0, 9] },
        {
          columns: [
            {
              width: '50%',
              stack: [
                { text: 'CRITICIDADE CONFIRMADA', style: 'fieldLabel' },
                { text: safe(occurrence.confirmedCriticalityLabel, 'Não confirmada'), style: 'body' }
              ]
            },
            {
              width: '50%',
              stack: [
                { text: 'REFERÊNCIAS COM APLICABILIDADE CONFIRMADA', style: 'fieldLabel' },
                confirmedReferences.length
                  ? {
                      ul: confirmedReferences.map((reference) =>
                        safe(
                          [reference.standardId, reference.standardTitle, reference.edition, reference.clause]
                            .filter(Boolean)
                            .join(' - ')
                        )
                      ),
                      style: 'body'
                    }
                  : { text: 'Nenhuma referência confirmada.', style: 'body' }
              ]
            }
          ],
          columnGap: 18
        }
      ],
      style: 'occurrenceBox',
      margin: [0, 0, 0, 18]
    })
  }

  content.push({ text: '9. Registro fotográfico', style: 'sectionTitle', pageBreak: 'before', margin: [0, 0, 0, 12] })
  let figureNumber = 0
  for (const occurrence of inspection.occurrences.slice().sort((a, b) => a.internalNumber - b.internalNumber)) {
    const occurrencePhotos = photos
      .filter((photo) => photo.occurrenceId === occurrence.id)
      .sort((a, b) => a.order - b.order)
    for (const photo of occurrencePhotos) {
      figureNumber += 1
      const dataUrl = photoData.get(photo.id)
      content.push({
        stack: [
          { text: `NC-${String(occurrence.internalNumber).padStart(3, '0')} - ${safe(occurrence.title)}`, style: 'photoContext' },
          dataUrl
            ? { image: dataUrl, fit: [480, 300], alignment: 'center', margin: [0, 7, 0, 7] }
            : { text: 'Imagem não incorporada ao PDF. O arquivo original permanece no aplicativo.', style: 'photoMissing' },
          { text: `Figura ${figureNumber} - ${safe(photo.caption, 'Sem legenda')}`, style: 'caption' }
        ],
        unbreakable: true,
        margin: [0, 0, 0, 18]
      })
    }
  }
  for (const photo of photos.filter((item) => item.scope === 'general' && !item.occurrenceId).sort((a, b) => a.order - b.order)) {
    figureNumber += 1
    const dataUrl = photoData.get(photo.id)
    content.push({
      stack: [
        { text: 'Observação geral da vistoria', style: 'photoContext' },
        dataUrl
          ? { image: dataUrl, fit: [480, 300], alignment: 'center', margin: [0, 7, 0, 7] }
          : { text: 'Imagem não incorporada ao PDF. O arquivo original permanece no aplicativo.', style: 'photoMissing' },
        { text: `Figura ${figureNumber} - ${safe(photo.caption, 'Sem legenda')}`, style: 'caption' }
      ],
      unbreakable: true,
      margin: [0, 0, 0, 18]
    })
  }
  if (figureNumber === 0) content.push({ text: 'Nenhuma fotografia incluída.', style: 'note' })

  content.push(
    ...section('10. Observações gerais', { text: safe(inspection.generalNotes, 'Nenhuma observação geral registrada.'), style: 'body' }),
    ...section('11. Conclusão', { text: safe(inspection.conclusion), style: 'body' })
  )

  content.push({ text: 'Anexo A - Rastreabilidade do checklist', style: 'sectionTitle', margin: [0, 20, 0, 12] })
  for (const location of inspection.locations) {
    for (const equipment of location.equipment) {
      if (!equipment.checklist) continue
      const rows: Content[][] = [['Critério', 'Estado', 'Observação']]
      for (const response of equipment.checklist.responses.slice().sort((a, b) => a.order - b.order)) {
        rows.push([safe(response.criterionText), CHECKLIST_STATUS[response.status].label, safe(response.note, '-')])
      }
      content.push({
        stack: [
          { text: `${safe(location.name)} / ${safe(equipment.tag)}`, style: 'subsectionTitle' },
          { text: safe(equipment.checklist.templateTitle), style: 'note', margin: [0, 0, 0, 6] },
          { table: { headerRows: 1, widths: ['*', 88, 120], body: rows }, layout: 'reportTable' }
        ],
        margin: [0, 0, 0, 16]
      })
    }
  }

  const document: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [42, 64, 42, 54],
    info: {
      title: `Relatório HVAC - ${safe(inspection.client)}`,
      author: safe(settings.companyName || 'VG7 Engenharia'),
      subject: 'Vistoria HVAC visual e documental',
      creator: 'VG7 Vistorias HVAC - geração local'
    },
    header: (currentPage) =>
      currentPage === 1
        ? { text: '' }
        : {
            columns: [
              { text: safe(settings.reportHeader || 'VG7 Engenharia - Relatório Técnico'), style: 'headerText' },
              { text: `${versionLabel} | ${formatDate(inspection.inspectionDate)}`, style: 'headerText', alignment: 'right' }
            ],
            margin: [42, 24, 42, 0]
          },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: safe(settings.reportFooter || 'Documento sujeito à validação do responsável técnico.'), style: 'footerText' },
        { text: `Página ${currentPage} de ${pageCount}`, style: 'footerText', alignment: 'right', width: 90 }
      ],
      margin: [42, 0, 42, 20]
    }),
    content,
    styles: {
      brandMark: { fontSize: 25, bold: true, color: '#123b35', fillColor: '#e7a930', margin: [11, 9, 0, 8] },
      brandName: { fontSize: 13, bold: true, color: '#123b35', characterSpacing: 1.2 },
      brandSub: { fontSize: 7, color: '#63706d', characterSpacing: 1.1, margin: [0, 3, 0, 0] },
      coverKicker: { fontSize: 10, bold: true, color: '#24665b', characterSpacing: 2.1 },
      coverTitle: { fontSize: 30, bold: true, color: '#123b35', margin: [0, 7, 0, 0] },
      coverFacility: { fontSize: 15, color: '#43534f' },
      coverResponsible: { fontSize: 11, bold: true, color: '#123b35' },
      demoWarning: { fontSize: 9, bold: true, color: '#8a3c19', fillColor: '#fff0d4', alignment: 'center', margin: [8, 8, 8, 8] },
      metaLabel: { fontSize: 7, bold: true, color: '#73817d', characterSpacing: 0.7 },
      metaValue: { fontSize: 10.5, color: '#1d2d2a', margin: [0, 3, 0, 0] },
      sectionTitle: { fontSize: 15, bold: true, color: '#123b35' },
      subsectionTitle: { fontSize: 11, bold: true, color: '#123b35', margin: [0, 5, 0, 6] },
      body: { fontSize: 9.4, color: '#273633', lineHeight: 1.32 },
      bullet: { fontSize: 9.2, color: '#273633', lineHeight: 1.3, margin: [8, 4, 0, 0] },
      note: { fontSize: 8.3, color: '#63706d', italics: true, lineHeight: 1.25 },
      occurrenceNumber: { fontSize: 10, bold: true, color: '#ffffff', alignment: 'center', margin: [5, 7, 5, 7] },
      occurrenceTitle: { fontSize: 12, bold: true, color: '#123b35' },
      occurrenceContext: { fontSize: 8.5, color: '#63706d', margin: [0, 3, 0, 0] },
      occurrenceBox: { fillColor: '#f7f9f8' },
      fieldLabel: { fontSize: 7.2, bold: true, color: '#687672', characterSpacing: 0.6 },
      photoContext: { fontSize: 9.5, bold: true, color: '#123b35' },
      caption: { fontSize: 8.3, italics: true, color: '#43534f', alignment: 'center' },
      photoMissing: { fontSize: 8.5, italics: true, color: '#8a3c19', alignment: 'center', margin: [0, 30, 0, 30] },
      headerText: { fontSize: 7.2, color: '#687672' },
      footerText: { fontSize: 6.8, color: '#7b8784' }
    },
    defaultStyle: { font: 'Roboto' }
  }

  pdfMake.addTableLayouts({
    reportTable: {
      hLineWidth: (index: number, node: { table: { body: unknown[] } }) => (index === 0 || index === node.table.body.length ? 0.8 : 0.35),
      vLineWidth: () => 0,
      hLineColor: () => '#c9d3d0',
      paddingLeft: () => 7,
      paddingRight: () => 7,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e9f1ef' : null)
    }
  })

  const blob = await pdfMake.createPdf(document).getBlob()
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  const sha256 = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const fileName = `RELATORIO_HVAC_${sanitizeFilePart(inspection.client)}_${inspection.inspectionDate || 'SEM_DATA'}_${versionLabel}.pdf`
  return { blob, fileName, sha256, reportVersion }
}

export function downloadPdf(report: GeneratedReport): void {
  const url = URL.createObjectURL(report.blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = report.fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function canSharePdf(report: GeneratedReport): boolean {
  if (!navigator.share || !navigator.canShare) return false
  const file = new File([report.blob], report.fileName, { type: 'application/pdf' })
  return navigator.canShare({ files: [file] })
}

export async function sharePdf(report: GeneratedReport): Promise<void> {
  const file = new File([report.blob], report.fileName, { type: 'application/pdf' })
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    throw new Error('O compartilhamento de arquivos não é suportado neste navegador.')
  }
  await navigator.share({
    files: [file],
    title: 'Relatório técnico HVAC',
    text: 'Relatório técnico gerado localmente no VG7 Vistorias HVAC.'
  })
}
