# Registro de validação — Marco 3

Data: 2026-08-02  
Escopo: Assinaturas Ambientais.

## Resultado

**APROVADO.** O jogo agora percorre um ciclo contínuo de iluminação e possui noite, neblina e gelo com leitura visual e efeito real sobre a jogabilidade. Nenhum asset raster do Marco 4 foi introduzido.

## Comportamentos verificados

- As sete fases internas formam amanhecer, manhã, dia, entardecer, anoitecer, noite, madrugada e o novo amanhecer do próximo dia.
- As paletas são interpoladas continuamente, incluindo exposição, céu, terreno, pista e neblina.
- A noite escurece os veículos e enfatiza lanternas traseiras; faróis, postes refletivos e pontos no horizonte preservam a leitura.
- A neblina reduz a distância visível de 280 para 104 unidades e dissolve progressivamente o contraste distante.
- O gelo reduz a resposta lateral a 46% no pico e reduz o amortecimento, prolongando o deslizamento sem remover o controle arcade.
- Quick Race possui janelas fixas de neblina e gelo dentro dos 90 segundos.
- Authentic Endurance usa agenda climática derivada de seed e dia; duração e quantidade de eventos crescem até limites configurados.

## Verificações automáticas

### `npm run check`

- Exit code: 0.
- ESLint: sem erros ou avisos.
- Vitest: 7 arquivos e 27 testes aprovados.
- TypeScript strict e build Vite/PWA: aprovados.

### `npm run test:e2e -- --reporter=line`

- Exit code final: 0.
- Playwright: 14 testes aprovados em desktop 1280 × 720 e celular horizontal.
- Regressões dos Marcos 1 e 2, ciclo completo, neblina, gelo e direção alterada aprovados.
- Uma expectativa inicial exigia o chip ambiental visível no celular, embora o layout compacto o oculte intencionalmente; a expectativa foi corrigida e a matriz completa passou.

### `npm run build:public`

- Exit code: 0.
- Varredura de `dist/` por `Enduro`, `Activision` e `fan remake`: limpa.
- Manifesto público permaneceu identificado como `ROAD ENDURANCE`.
- A build privada padrão foi regenerada após a verificação.

## Validação manual no navegador

- Quick Race foi iniciada pela interface normal, fora de `?test=1`.
- F3 apresentou 56–57 FPS, 17,5–17,9 ms, 1280 × 720, perfil HIGH e 10 veículos ativos.
- A transição natural chegou ao gelo e atualizou HUD/F3 sem recarregar a corrida.
- Pausa por `Escape` e reinício por `R` continuaram funcionando e restauraram amanhecer/clima limpo.
- A condução contínua e a diferença lateral foram verificadas de forma determinística pelo Playwright, pois o controle remoto do navegador não mantém teclas pressionadas.

## Inspeção visual

- `dawn`, `day` e `sunset`: iluminação distinta, HUD legível e câmera preservada.
- `night`: faróis delimitam a pista e lanternas traseiras identificam o tráfego sem deixar a tela preta.
- `fog`: o horizonte e veículos distantes desaparecem gradualmente, com a pista próxima legível.
- `ice`: pista fria, reflexos discretos e contraste suficiente para dirigir.
- A primeira captura de neblina revelou uma divisão horizontal no céu; a entrada do gradiente foi suavizada e a captura final foi reinspecionada sem a emenda.
- Evidências salvas em `screenshots/milestone-3/`.

## Itens intencionalmente pendentes

- Marco 4: assets raster originais com ImageGen, paisagens e passe visual final.
- Marco 5: áudio, gamepad e transição Legacy completa.
- Marco 6: matriz canônica de dez screenshots e otimização final.
