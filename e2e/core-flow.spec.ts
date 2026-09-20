import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const screenshots = path.resolve('output/screenshots')
const pdfOutput = path.resolve('output/pdf')

async function dismissPwaNotice(page: Page) {
  await page.waitForTimeout(400)
  const notice = page.locator('.pwa-prompt')
  const close = notice.getByRole('button', { name: 'Fechar' })
  if (await close.isVisible()) await close.click()
}

test.beforeAll(async () => {
  await mkdir(screenshots, { recursive: true })
  await mkdir(pdfOutput, { recursive: true })
})

test('abre a base offline e apresenta o fluxo demonstrativo', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Vistoria HVAC em campo' })).toBeVisible()
  await expect(page.getByText('Fluxo demonstrativo pronto')).toBeVisible()
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByText('Nenhuma nuvem conectada')).toBeVisible()
  } else {
    await expect(page.locator('.mobile-header').getByText('Local', { exact: true })).toBeVisible()
  }
  await dismissPwaNotice(page)
  await page.screenshot({
    path: path.join(screenshots, `home-${testInfo.project.name}.png`),
    fullPage: true
  })
})

test('cria, salva automaticamente e retoma uma vistoria', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-android', 'Fluxo de campo principal validado no perfil Android.')
  await page.goto('/')
  await page.getByRole('button', { name: 'Nova vistoria' }).click()
  await expect(page.getByRole('heading', { name: 'Dados da vistoria' })).toBeVisible()
  await page.getByLabel('Cliente *').fill('Cliente E2E')
  await page.getByLabel('Empreendimento *').fill('Unidade Teste Offline')
  await page.getByLabel('Responsável técnico').fill('Engenheiro E2E')
  await page.waitForTimeout(750)
  await dismissPwaNotice(page)
  await page.getByRole('link', { name: /Locais e equipamentos/ }).click()
  await page.getByLabel('Nome do novo local').fill('Casa de Máquinas E2E')
  await page.getByRole('button', { name: 'Adicionar local' }).click()
  await expect(page.getByRole('heading', { name: 'Casa de Máquinas E2E' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Casa de Máquinas E2E' })).toBeVisible()
  await page.screenshot({ path: path.join(screenshots, 'field-flow-mobile.png'), fullPage: true })
})

test('reabre pelo service worker sem conexão', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Teste offline executado uma vez no Chromium desktop.')
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Vistoria HVAC em campo' })).toBeVisible()
  await expect(page.getByText('Modo offline')).toBeVisible()
  await context.setOffline(false)
})

test('cria ocorrência automática, vincula fotografia e conclui a revisão', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-android', 'Fluxo rápido de campo validado no perfil Android.')
  await page.goto('/')
  await page.getByRole('link', { name: 'Abrir demonstração' }).click()
  await dismissPwaNotice(page)
  await page.getByRole('link', { name: 'Voltar ao campo' }).click()
  await page.getByRole('link', { name: 'Abrir', exact: true }).click()
  await page.getByRole('link', { name: /Abrir checklist/ }).click()

  const criterion = page.locator('.criterion-card').filter({
    hasText: 'Documentação de manutenção disponibilizada para consulta.'
  })
  await criterion.getByRole('button', { name: 'Não conforme', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Não conformidade observada' })).toBeVisible()

  await page.getByLabel('Constatação observada').fill('Documentação não apresentada durante a verificação demonstrativa.')
  await page.getByLabel('Recomendação').fill('Solicitar e revisar a documentação aplicável ao escopo confirmado.')
  await page.getByLabel('Criticidade confirmada pelo engenheiro').selectOption({ label: 'Baixa' })
  await page.locator('input[type="file"]').nth(1).setInputFiles(path.resolve('public/demo/chiller-corrosao.png'))
  await expect(page.getByText('Otimizada')).toBeVisible({ timeout: 15000 })
  const photoImage = page.locator('.photo-card img')
  const dimensionsBeforeRotation = await photoImage.evaluate((image) => ({
    width: (image as HTMLImageElement).naturalWidth,
    height: (image as HTMLImageElement).naturalHeight
  }))
  await page.getByRole('button', { name: 'Girar fotografia 90 graus para a direita' }).click()
  await expect.poll(async () =>
    photoImage.evaluate((image) => ({
      width: (image as HTMLImageElement).naturalWidth,
      height: (image as HTMLImageElement).naturalHeight
    }))
  ).toEqual({ width: dimensionsBeforeRotation.height, height: dimensionsBeforeRotation.width })
  await page.getByLabel('Legenda').fill('Fotografia demonstrativa vinculada à ocorrência criada no teste.')
  await page.waitForTimeout(750)
  await page.getByRole('button', { name: 'Concluir revisão' }).click()

  await expect(page.getByRole('heading', { name: 'Checklist — Chiller 01' })).toBeVisible()
  await expect(criterion.getByText('Não conforme', { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: path.join(screenshots, 'checklist-occurrence-mobile.png'), fullPage: true })
})

test('gera e baixa o relatório demonstrativo em PDF', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'PDF gerado uma vez para inspeção visual.')
  await page.goto('/')
  await page.getByRole('link', { name: 'Abrir demonstração' }).click()
  await expect(page.getByRole('heading', { name: 'Resumo e revisão técnica' })).toBeVisible()
  await page.getByLabel(/Estou ciente das pendências/).check()
  await dismissPwaNotice(page)
  await page.getByRole('button', { name: 'Abrir prévia' }).click()
  await expect(page.getByRole('heading', { name: 'Relatório técnico HVAC' })).toBeVisible()
  await page.getByRole('button', { name: 'Gerar PDF final' }).click()
  await expect(page.getByText('Relatório pronto')).toBeVisible({ timeout: 30000 })
  await page.screenshot({ path: path.join(screenshots, 'report-preview-desktop.png'), fullPage: true })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^RELATORIO_HVAC_.*_V01\.pdf$/)
  await download.saveAs(path.join(pdfOutput, 'RELATORIO_HVAC_DEMONSTRACAO_V01.pdf'))
})
