# Registro de validação — Marco 4

Data: 2026-08-02  
Escopo: Passe Visual.

## Resultado

**APROVADO.** O jogo substitui os principais placeholders visuais por sete assets raster originais, preserva as regras e assinaturas ambientais dos marcos anteriores, mantém fallback procedural e encerra deliberadamente antes do Marco 5.

## Assets gerados e integrados

- Três poses transparentes do carro do jogador: centro, esquerda e direita.
- Um sedã e um caminhão-baú de tráfego, sem marcas, com colorização e iluminação em runtime.
- Um panorama montanhoso transparente para a camada de parallax.
- Uma microtextura de asfalto repetível recortada pela pista pseudo-3D.
- Geração realizada pelo ImageGen integrado; prompts e critérios de aceitação preservados em `.prompts/assets/`.
- Remoção de chroma key realizada com o helper oficial do ImageGen e otimização final em WebP.
- Conjunto final: 7 arquivos, 310.590 bytes codificados e aproximadamente 7,9 MiB decodificados.
- PNGs intermediários e cópias temporárias foram removidos após validação dos WebP.

## Integração visual verificada

- O carro alterna entre as três poses de acordo com a velocidade lateral e conserva sombra, balanço e reação de colisão.
- Sedãs e caminhões preservam proporção por profundidade, recebem sombras, variações de cor e lanternas noturnas.
- O panorama usa deslocamento contínuo de baixa amplitude sobre a montanha procedural distante.
- A textura de asfalto é recortada pela geometria projetada da estrada, sem cobrir acostamentos ou terreno.
- Noite, faróis, lanternas, neblina, gelo, reflexos e faíscas continuam combinados pelo Canvas.
- Se um asset falhar, os veículos e a paisagem retornam às formas procedurais dos marcos anteriores.
- F3 apresenta `7/7 · 303 KB · 7.9 MB RAM`.

## Verificações automáticas

### `npm run check`

- Exit code: 0.
- ESLint: sem erros ou avisos.
- Vitest: 8 arquivos e 29 testes aprovados.
- TypeScript strict e build Vite/PWA: aprovados.
- Precache privado final: 14 entradas, 369,14 KiB.

### `npm run test:e2e -- --workers=2`

- Exit code final: 0.
- Playwright: 20 testes aprovados em desktop 1280 × 720 e celular horizontal.
- Os testes do Marco 4 confirmam carregamento e tamanho exato dos sete WebP, diagnóstico 7/7, menu final e renderização em dia, noite e colisão.
- Todas as regressões dos Marcos 1, 2 e 3 permaneceram aprovadas.
- A primeira execução completa expôs apenas um seletor novo com texto mal codificado; o teste passou a usar o contrato estável `data-mode` e a matriz completa foi repetida com sucesso.

### `npm run build:public`

- Exit code: 0.
- Precache público: 14 entradas, 368,99 KiB.
- Varredura de `dist/` por `Enduro`, `Activision` e `fan remake`: sem ocorrências.
- Manifesto público confirmado como `ROAD ENDURANCE`.
- A build privada padrão foi regenerada depois da inspeção pública.

## Validação manual no navegador

- A aba existente em `http://127.0.0.1:5173/` foi atualizada e deixada aberta para o usuário.
- Quick Race foi iniciada pela interface normal, fora de `?test=1`.
- HUD, contador e cronômetro apareceram corretamente.
- F3 confirmou perfil HIGH, 10 veículos ativos, clima/fase coerentes e os sete assets carregados.
- Pausa por `Escape` abriu o modal; `REINICIAR` fechou o modal e restaurou o cronômetro para `01:30`.
- Console do navegador: nenhum erro ou aviso.
- A medição no painel estreito do navegador embutido oscilou por captura/visibilidade; desempenho de 1280 × 720 permanece reservado ao passe dedicado do Marco 6.

## Inspeção visual

- `menu-1280x720.png`: identidade, hierarquia, panorama e modos permanecem legíveis.
- `gameplay-day-1280x720.png`: poses, veículos, textura e profundidade estão claras em dois segundos.
- `gameplay-night-1280x720.png`: lanternas, faróis e pista continuam legíveis sem exposição excessiva.
- `collision-sparks-1280x720.png`: impacto, redução de velocidade e faíscas são visíveis sem bloquear a estrada.
- A primeira inspeção revelou uma emenda vertical no panorama repetido; a camada passou a usar uma faixa contínua com parallax limitado, e todas as capturas foram regeneradas e reinspecionadas.
- Evidências finais salvas em `screenshots/milestone-4/`.

## Itens intencionalmente pendentes

- Marco 5: áudio original, gamepad e transição Legacy completa.
- Marco 6: otimização dedicada, matriz canônica de dez screenshots e documentação final.
