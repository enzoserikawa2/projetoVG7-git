# Registro de progresso

Atualizado em 20/09/2026.

| Fase | Estado | Resultado |
|---|---|---|
| 0 — Análise e validação | Concluída | Escopo, integridade técnica e arquitetura aprovados. |
| 1 — PWA e navegação | Concluída | Shell mobile-first, rotas, manifesto, ícones e atualização controlada do service worker. |
| 2 — Dados locais | Concluída | IndexedDB/Dexie, UUIDs, autosave, esquema v2, migração e retomada da última rota. |
| 3 — Fluxo de vistoria | Concluída | Dados básicos, locais, equipamentos, duplicação e percurso entre equipamentos. |
| 4 — Checklist e biblioteca | Concluída | Quatro estados, critérios positivos, snapshots e editores dos cinco tipos de conteúdo técnico. |
| 5 — Ocorrências e fotografias | Concluída | NC automática/livre, confirmações, câmera/galeria, blobs, compressão, ordem, legenda e rotação. |
| 6 — Revisão e PDF | Concluída | Resumo, pendências, conclusão editável, PDF A4 e histórico de geração. |
| 7 — Compartilhamento e backup | Concluída | Web Share, download, backup completo/individual, restauração e integridade SHA-256. |
| 8 — Testes e acabamento | Concluída no ambiente; aceite físico pendente | Build, lint, testes unitários/E2E, offline real, larguras responsivas e inspeção visual do PDF. |

## Verificações executadas

- `npm run build`: aprovado;
- `npm run lint`: aprovado;
- `npm test`: 5 testes aprovados;
- `npm run test:e2e`: 7 cenários aprovados e 8 combinações intencionalmente ignoradas por perfil;
- service worker: recarga sem rede aprovada em Chromium;
- autosave: alteração, recarga e retomada aprovadas;
- ocorrência: criação automática, fotografia, rotação, legenda e conclusão aprovadas;
- PDF: geração pelo navegador e pelo script de QA aprovada;
- PDF renderizado: 6 páginas A4 inspecionadas, sem cortes ou deformações;
- backup: exportação, inspeção e restauração com blobs aprovadas em teste automatizado.

## Ajustes feitos durante a validação

- identificação visual das NCs no PDF;
- quebras de página do resumo e do anexo;
- aviso da PWA reposicionado para não bloquear ações de campo;
- consulta de itens ativos da biblioteca corrigida para IndexedDB;
- revisão pendente de ocorrência passou a bloquear a emissão;
- rotação manual de fotografia adicionada sem alterar o original.

## Próximo marco

Executar o roteiro de aceite em um Android físico pela URL HTTPS definitiva. O resultado deve registrar modelo do aparelho, versão do Chrome, instalação, câmera, modo avião, compartilhamento com o Google Drive e restauração de backup.

## Preparação para o GitHub Pages

- navegação alterada para `HashRouter`, evitando erro ao atualizar telas internas em hospedagem estática;
- recursos, manifesto, escopo e início da PWA configurados com caminhos relativos;
- publicação automática adicionada em `.github/workflows/deploy-pages.yml`;
- instruções de ativação do GitHub Pages adicionadas ao README;
- build, lint e 5 testes unitários aprovados após a alteração;
- repetição local dos testes E2E pendente porque o servidor de download do Chromium devolveu timeout/erro 502; a suíte já havia sido aprovada antes desta alteração.
