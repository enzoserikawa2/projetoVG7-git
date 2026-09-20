import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true }
})

try {
  const module = await server.ssrLoadModule('/scripts/generate-demo-report.ts')
  await module.generateDemoReport()
} finally {
  await server.close()
}
