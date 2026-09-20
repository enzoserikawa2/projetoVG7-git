import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { ensureSeedData } from './db/seed'
import './styles/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Elemento raiz não encontrado.')

const root = createRoot(rootElement)

ensureSeedData()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Falha desconhecida na inicialização.'
    root.render(
      <main className="startup-error">
        <h1>Não foi possível abrir o aplicativo</h1>
        <p>{message}</p>
        <p>Os dados locais não foram apagados. Feche e abra novamente antes de tomar outra ação.</p>
      </main>
    )
  })
