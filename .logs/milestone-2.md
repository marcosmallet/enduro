# Registro de validação — Marco 2

Data: 2026-08-02  
Escopo: Regras Autênticas.

## Resultado

**APROVADO.** O modo autêntico agora sustenta a corrida por dias contínuos, com meta 200/300, prazo até o amanhecer, recorde local e dificuldade progressiva configurável. Nenhum item do Marco 3 foi declarado concluído.

## Regras verificadas

- Dia 1 inicia com 200 veículos; do Dia 2 em diante a meta é 300.
- A meta zerada mostra confirmação discreta, mas não encerra a corrida antes do amanhecer.
- O novo amanhecer avança imediatamente o dia, reinicia o contador e preserva distância e total de ultrapassagens.
- Meta incompleta no amanhecer produz game over específico.
- Dias concluídos são persistidos em `localStorage` como melhor resultado.
- A corrida não possui limite máximo de dias.
- A curva de dificuldade aumenta velocidade do tráfego, reduz intervalos, eleva agrupamentos e amplia variação lateral, com teto no nível 18.

## Verificações automáticas

### `npm run check`

- Exit code: 0.
- ESLint: sem erros ou avisos.
- Vitest: 6 arquivos e 22 testes aprovados.
- TypeScript strict: sem erros.
- Build Vite/PWA: aprovada.

### `npm run test:e2e -- --reporter=line`

- Exit code: 0.
- Playwright: 8 testes aprovados em desktop 1280 × 720 e celular horizontal.
- Duração final observada: 11,5 segundos.
- Regressão do Marco 1, meta cumprida, transição para Dia 2, recorde persistido e derrota por meta incompleta aprovados.

### `npm run build:public`

- Exit code: 0.
- Varredura de `dist/` por `Enduro`, `Activision` e `fan remake`: limpa.
- Manifesto público permaneceu identificado como `ROAD ENDURANCE`.
- A build privada padrão foi regenerada após a verificação.

## Validação manual no navegador

- Authentic Endurance iniciou em `DIA 1 / CARROS RESTANTES 200`.
- F3 apresentou 180 segundos, dificuldade `L0 / +0 KM/H`, perfil HIGH e 10 veículos ativos.
- Pausa e reinício mantiveram a modalidade e restauraram o contador em 200.
- Captura manual observada a 60 FPS / 16,7 ms em 1280 × 720.
- Console: nenhum erro ou aviso.

## Inspeção visual

- `goal-complete`: confirmação legível sem interromper a estrada.
- `new-day`: DIA 2, contador 300 e melhor resultado 1 aparecem juntos sem sobreposição.
- `game-over`: amanhecer preservado e mensagem específica apresentada em duas linhas.
- As capturas revelaram rótulos fantasmas no HUD durante a virada do dia; o efeito de desfoque foi removido, mantendo painel opaco e sombra, e a captura final ficou limpa.
- Evidências salvas em `screenshots/milestone-2/`.

## Itens intencionalmente pendentes

- Marco 3: clima jogável, gelo, neblina e ciclo ambiental final.
- Marco 4: assets raster originais com ImageGen.
- Marco 5: áudio, gamepad e transição Legacy completa.
- Marco 6: matriz canônica de dez screenshots e otimização final.
