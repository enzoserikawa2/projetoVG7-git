# VG7 Vistorias HVAC

PWA pessoal, instalável e offline para o registro de vistorias HVAC visuais e documentais. O aplicativo mantém vistorias, biblioteca técnica, configurações e fotografias exclusivamente no dispositivo e gera o relatório A4 sem servidor.

> O software apoia o registro e a rastreabilidade. Ele não substitui o julgamento, a validação nem a responsabilidade técnica do engenheiro.

## Estado do MVP

O fluxo principal está implementado:

- criação e retomada de vistorias;
- locais e equipamentos, com duplicação e exclusão confirmada;
- checklist com Conforme, Não conforme, Não aplicável e Não inspecionado;
- ocorrência automática ao marcar Não conforme e ocorrência livre;
- separação entre constatação, descrição técnica, recomendação, criticidade e referência;
- fotografias por ocorrência ou observação geral, com legenda, ordem, compressão e rotação;
- revisão com alertas bloqueantes e não bloqueantes;
- PDF A4 integralmente local, com paginação, fotos, NCs e rastreabilidade do checklist;
- compartilhamento por Web Share API e download como alternativa;
- backup completo ou por vistoria, com fotografias e verificação SHA-256;
- funcionamento offline por service worker após o primeiro carregamento.

Os dados demonstrativos são fictícios e aparecem identificados como exemplo sem valor técnico. Nenhum item normativo foi inventado; a demonstração usa “Referência a validar”.

## Tecnologias

- React 19 e TypeScript;
- Vite e `vite-plugin-pwa`;
- IndexedDB com Dexie;
- pdfmake com fontes empacotadas;
- fflate para backups ZIP locais;
- Vitest e Playwright.

Não há backend, login, sincronização, banco SQL, CDN, telemetria, OAuth ou integração automática com o Google Drive.

## Requisitos para desenvolvimento

- Node.js 22 LTS ou superior;
- npm;
- Chromium para os testes de navegador.

## Executar localmente

```bash
npm ci
npm run dev
```

Abra o endereço informado pelo Vite. Para testar a versão de produção:

```bash
npm run build
npm run preview
```

O diretório publicável é `dist/`.

## Verificações

```bash
npm run lint
npm test
npm run build
```

Para os testes de navegador:

```bash
npx playwright install chromium
npm run test:e2e
```

Para gerar o PDF demonstrativo diretamente pelo mesmo serviço usado na PWA:

```bash
npm run qa:pdf
```

O arquivo é criado em `output/pdf/RELATORIO_HVAC_DEMONSTRACAO_V01.pdf`.

## Publicar gratuitamente no GitHub Pages

O projeto já inclui a automação `.github/workflows/deploy-pages.yml`. Ela verifica o código, gera a versão final e publica a pasta `dist/` sempre que houver uma alteração na branch `main`.

1. Crie um repositório no GitHub e mantenha a branch principal com o nome `main`.
2. Envie os arquivos descompactados deste projeto para o repositório. Não envie apenas o arquivo ZIP.
3. No repositório, abra **Settings > Pages**.
4. Em **Build and deployment > Source**, escolha **GitHub Actions**.
5. Abra a aba **Actions** e acompanhe a execução chamada **Publicar PWA no GitHub Pages**.
6. Quando ela terminar, o endereço aparecerá na execução e em **Settings > Pages**. Normalmente será `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Não é necessário comprar domínio. Os caminhos da PWA são relativos e a navegação utiliza hash, por isso o aplicativo funciona tanto na raiz quanto em um subdiretório do GitHub Pages.

## Disponibilização e instalação no Android

Uma PWA normal precisa ser disponibilizada por **HTTPS ao menos no primeiro acesso**. `localhost` é aceito apenas para desenvolvimento. O GitHub Pages fornece esse HTTPS gratuitamente.

No Android com Chrome:

1. Abra a URL HTTPS com internet.
2. Aguarde a indicação “Aplicativo pronto para uso offline”.
3. Use o menu do navegador e escolha **Instalar app** ou **Adicionar à tela inicial**.
4. Abra o aplicativo instalado uma vez.
5. Em **Backup**, selecione **Solicitar persistência**.
6. Faça um backup inicial e teste a reabertura em modo avião antes da primeira vistoria real.

Um APK via Capacitor pode ser avaliado futuramente, mas não integra este MVP.

## Atualização da PWA

1. Exporte um backup completo antes de uma atualização importante.
2. Gere e publique o novo conteúdo de `dist/` sem apagar os dados do site no navegador.
3. Ao abrir o aplicativo, confirme o aviso **Atualização disponível**.
4. Verifique a versão com uma vistoria de teste antes do uso em campo.

O esquema local está na versão 2. A migração atual preserva os registros existentes e inicializa a informação de rotação das fotografias. Desinstalar a PWA ou limpar os dados do navegador pode remover todas as vistorias, independentemente da atualização do código.

## Uso em campo

Fluxo recomendado:

1. Cadastre os dados essenciais da vistoria.
2. Crie o local e o equipamento.
3. Aplique um checklist da biblioteca.
4. Marque cada critério pelo texto do status, não apenas pela cor.
5. Ao marcar **Não conforme**, revise a ficha aberta automaticamente.
6. Registre a constatação, confirme a criticidade e fotografe.
7. Use **Próximo equipamento** para seguir o percurso.
8. Na revisão, trate pendências bloqueantes e confirme conscientemente as demais.
9. Gere o PDF e use **Compartilhar** para escolher o Google Drive no menu do Android; se indisponível, use **Baixar**.

## Dados e confiabilidade

- Cada alteração de formulário é salva automaticamente no IndexedDB.
- A vistoria registra a última rota para retomada.
- Fotografias originais e cópias otimizadas são armazenadas como blobs.
- A cópia para relatório respeita proporção e rotação; o original é preservado.
- O PDF não é salvo permanentemente pelo aplicativo: gere-o novamente a partir da vistoria ou faça download/compartilhamento.
- O histórico registra versão, revisão local, data, nome e SHA-256 de cada geração.
- O backup `.vg7backup` contém manifesto, dados estruturados e blobs e é validado antes da restauração.
- A restauração mescla registros por identificador estável; não apaga outros registros existentes.

## Estrutura do projeto

```text
src/
  app/          composição, PWA e estado global de salvamento
  components/   componentes de campo, fotografia e interface
  db/           Dexie, migrações, repositório e dados demonstrativos
  domain/       tipos e regras técnicas sem dependência da interface
  features/     cabeçalho e consultas reativas da vistoria
  pages/        telas do fluxo
  services/     fotografia, backup e PDF
  styles/       interface mobile-first e responsiva
e2e/            fluxo real no navegador
scripts/        geração reproduzível do PDF demonstrativo
output/         evidências de QA e PDF de exemplo
```

## Decisões e limites

- A vistoria é um documento estruturado; fotografias e históricos ficam em tabelas separadas para evitar regravação de blobs a cada campo.
- Checklists aplicados são snapshots. Alterar a biblioteca não modifica uma vistoria já registrada.
- Referências só podem ter aplicabilidade confirmada quando a identificação foi preenchida e a referência foi validada na biblioteca.
- Referências pendentes não são exibidas como aplicáveis no PDF.
- Não inspecionado nunca é contado como Conforme.
- Ocorrências com revisão pendente bloqueiam a emissão; outras pendências exigem confirmação consciente.
- O pacote JavaScript é maior porque o gerador de PDF e as fontes precisam existir localmente para o uso offline. O service worker foi configurado para armazená-lo.
- Não há sincronização entre dispositivos. A transferência de dados ocorre somente por backup, PDF ou compartilhamento iniciado pelo usuário.

Consulte [docs/VALIDACAO.md](docs/VALIDACAO.md) para os resultados e o roteiro de aceite em Android, e [docs/PROGRESSO.md](docs/PROGRESSO.md) para o registro das fases.
