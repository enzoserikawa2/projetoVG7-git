# Validação e aceite

## Resultado automatizado

| Critério | Evidência |
|---|---|
| Build de produção | Vite gerou `dist/` e o service worker precacheou os recursos locais. |
| Qualidade estática | ESLint e TypeScript sem erros. |
| Regras técnicas | Testes cobrem quatro estados, snapshot, criticidade sugerida versus confirmada e pendências. |
| Persistência | Fluxo E2E altera dados, aguarda autosave, recarrega e encontra o registro. |
| Biblioteca local | Modelo ativo é aplicado e criticidades ficam disponíveis na ocorrência. |
| NC automática | Item marcado Não conforme abre uma ocorrência vinculada. |
| Fotografia | Upload, compressão, vínculo, legenda e rotação em 90° aprovados no navegador. |
| Offline | Página recarregada com o contexto de rede desligado após ativação do service worker. |
| Responsividade | Capturas verificadas em Pixel 7, tablet 820 × 1180 e desktop. |
| PDF | Download gerado pelo navegador, 6 páginas A4, duas NCs, duas figuras e fontes incorporadas. |
| Backup | Exportação, hashes, vínculos, blobs e restauração validados por teste. |

As capturas ficam em `output/screenshots/`. O PDF demonstrativo fica em `output/pdf/` e todo o conteúdo está identificado como fictício.

## Aceite obrigatório em Android físico

Esta parte depende de recursos do aparelho e não pode ser concluída por um navegador de teste em contêiner.

### Preparação

- [ ] Publicar `dist/` em HTTPS.
- [ ] Abrir a URL no Chrome atualizado.
- [ ] Confirmar a mensagem de disponibilidade offline.
- [ ] Instalar a PWA e abrir pelo ícone.
- [ ] Solicitar armazenamento persistente em **Backup** e registrar a resposta do navegador.

### Fluxo de campo

- [ ] Criar uma vistoria sem usar os dados demonstrativos.
- [ ] Fechar completamente e reabrir no mesmo ponto.
- [ ] Criar local e equipamento.
- [ ] Aplicar checklist e marcar os quatro estados.
- [ ] Marcar um critério Não conforme e confirmar a ocorrência automática.
- [ ] Criar uma ocorrência livre.
- [ ] Tirar foto com a câmera traseira.
- [ ] Selecionar uma foto da galeria.
- [ ] Girar, legendar, reordenar e excluir uma foto de teste.
- [ ] Confirmar que o original e a cópia otimizada permanecem utilizáveis.

### Offline e segurança dos dados

- [ ] Ativar modo avião e reiniciar a PWA.
- [ ] Alterar checklist, ocorrência e legenda sem rede.
- [ ] Fechar e reabrir ainda sem rede, confirmando os dados.
- [ ] Exportar backup completo.
- [ ] Restaurar o backup em um perfil de teste e conferir dados e imagens.
- [ ] Confirmar o aviso sobre desinstalação/limpeza dos dados do navegador.

### Relatório e compartilhamento

- [ ] Revisar contagens e pendências.
- [ ] Confirmar que Não inspecionado não aparece como Conforme.
- [ ] Gerar o PDF em modo avião.
- [ ] Inspecionar capa, cabeçalhos, rodapés, NCs, figuras, legendas e anexo.
- [ ] Usar **Compartilhar** e selecionar o Google Drive no menu do Android.
- [ ] Usar **Baixar** como alternativa.
- [ ] Corrigir a vistoria, gerar V02 e confirmar o histórico.

## Condições de reprovação

- perda de qualquer alteração após o indicador **Salvo**;
- impossibilidade de abrir o app em modo avião após o primeiro carregamento;
- fotografia vinculada à ocorrência errada;
- referência não confirmada apresentada como aplicável no PDF;
- item Não inspecionado contado como Conforme;
- foto cortada ou deformada;
- restauração de backup sem os blobs esperados;
- emissão permitida com ocorrência marcada como revisão pendente.

## Registro sugerido

Anote no aceite: data, aparelho, versão do Android, versão do Chrome, URL instalada, armazenamento persistente concedido ou não, tamanho do backup, nome/hash do PDF e qualquer comportamento divergente.
