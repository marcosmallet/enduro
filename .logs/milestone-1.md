# Registro de validação — Marco 1

Data: 2026-08-02  
Escopo: planejamento e Protótipo de Identidade.

## Resultado

**APROVADO.** O Marco 1 atende aos critérios objetivos definidos em `PLAN.md`. Nenhum marco posterior foi declarado concluído.

## Verificações automáticas

### `npm run check`

- Exit code: 0.
- ESLint 10.8.0: sem erros e sem avisos.
- Vitest 4.1.10: 5 arquivos, 14 testes aprovados.
- TypeScript 6.0.3 strict: sem erros.
- Vite 8.2.0: build de produção aprovada.
- PWA: service worker gerado, 7 entradas e aproximadamente 49,93 KiB em precache.

### `npm run test:e2e -- --reporter=line`

- Exit code: 0.
- Playwright 1.62.1: 4 testes aprovados.
- Duração final: 5,8 segundos; o processo encerrou normalmente.
- Perfis: desktop Chromium em 1280 × 720 e Chromium mobile em orientação horizontal.
- Fluxos: menu, Quick Race, Authentic Endurance, aceleração, direção, ultrapassagem, colisão, pausa e reinício.

### Correção do executor E2E

- A primeira revalidação concluiu os cenários, mas ficou presa ao encerrar o servidor Vite iniciado pelo Playwright no Windows.
- `scripts/run-e2e.mjs` agora hospeda o Vite durante a suíte e o encerra no bloco de limpeza.
- `npm run test:e2e -- --reporter=line` passou com exit code 0 e sem processos residuais na porta 4173.

### `npm run build:public`

- Exit code: 0.
- HTML, metadados e manifest usam `ROAD ENDURANCE / THE NEVER-ENDING RACE`.
- Varredura de todo o `dist/` por nomes reservados do modo privado: limpa.
- A build privada padrão foi regenerada após essa verificação.

## Validação no navegador

- Jogo aberto novamente no navegador integrado em `1280 × 720`.
- Menu, início de Quick Race, pausa/continuação, reinício, retorno ao menu, alternância Legacy/Hyper e diagnóstico F3 verificados por interação real.
- Painel F3 observado em perfil HIGH com 10 veículos e 56–58 FPS / 17,2–17,9 ms durante a inspeção.
- Console após a interação: nenhum erro ou aviso.

## Inspeção visual

- Menu: identidade, aviso legal, hierarquia, estrada ao fundo e modos claramente legíveis.
- Jogabilidade: câmera traseira fixa, horizonte central, estrada em perspectiva, carro ancorado na base, tráfego com escala por profundidade e HUD em área segura.
- Legacy: scanlines e tratamento de cor funcionam sem mudar a composição; a redução real de resolução e a transição completa continuam reservadas ao Marco 5.
- Correção feita após inspeção: controles de toque deixaram de aparecer em desktop e permanecem disponíveis em dispositivos touch.
- Screenshots de menu e jogabilidade foram renovadas e aprovadas em `screenshots/milestone-1/`.

## Itens intencionalmente pendentes

- Marco 2: transição real entre dias, meta 300 após o primeiro dia, falha autêntica por amanhecer, recorde persistido e dificuldade progressiva.
- Marco 3: neblina e gelo com impacto jogável e ciclo ambiental final.
- Marco 4: sprites e paisagens produzidos com ImageGen; o Marco 1 usa somente Canvas procedural original.
- Marco 5: áudio, gamepad, acabamento de tela cheia e transição Legacy completa.
- Marco 6: perfis dinâmicos finais, matriz completa e dez screenshots canônicos.
