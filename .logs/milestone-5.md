# Registro de validação — Marco 5

Data: 2026-08-02  
Escopo: Áudio e Acabamento.

## Resultado

**APROVADO.** O jogo agora possui áudio procedural original, controles persistentes, suporte a gamepad, tela cheia com fallback, instalação PWA e uma transformação real de Legacy para Hyper. A jogabilidade, a câmera e as regras dos marcos anteriores foram preservadas. A execução encerra antes do Marco 6.

## Áudio original

- Grafo criado somente depois de gesto do usuário pela Web Audio API.
- Motor com fundamental e harmônico variando por velocidade.
- Camadas de ruído filtrado para vento e pneus; o gelo altera ganho e frequência de corte.
- Música ambiente discreta sintetizada por dois osciladores e filtro por período.
- Sinais curtos originais para colisão, ultrapassagem, mudança de período, meta diária, novo dia, fim de jogo e menus.
- Compressor final evita picos; fontes contínuas são compartilhadas para reduzir custo.
- Controles de volume geral, música, efeitos e silenciamento persistem em `localStorage`.
- Bloqueio ou rejeição do áudio não impede menus, controles nem jogabilidade.

## Controles e plataforma

- Gamepad API normaliza analógico, direcional, gatilhos, botões principais e Start.
- Dead zone de 0,18 evita deriva; pausa e confirmação usam detecção por borda para não repetir enquanto o botão está pressionado.
- Teclado, toque e gamepad coexistem; o contrato `?test=1` usa entrada virtual separada sem entrar na build normal.
- Em dispositivos de toque, escolher um modo solicita fullscreen no mesmo gesto; rejeições mantêm o layout normal funcional.
- Botão de fullscreen apresenta estado acessível e alterna entrada/saída.
- `beforeinstallprompt` revela o botão de instalação apenas quando o navegador oferece a PWA.
- O F3 informa AUDIO, GAMEPAD e PWA além dos diagnósticos existentes.

## Legacy → Hyper

- Legacy renderiza a cena em um buffer real de 320 × 180 e amplia sem suavização.
- A apresentação comprime cor/contraste, aplica scanlines e troca panorama, textura e veículos raster por equivalentes procedurais simplificados.
- O modo Hyper restaura progressivamente a resolução lógica de 1280 × 720 em 4,2 segundos.
- Câmera, estado e simulação permanecem idênticos durante a transformação.
- O menu inicia a demonstração automaticamente sem tela de carregamento.

## Verificações automáticas

### `npm run check`

- Exit code final: 0.
- ESLint: sem erros ou avisos.
- Vitest: 11 arquivos e 36 testes aprovados.
- TypeScript strict e build Vite/PWA: aprovados.

### `npm run test:e2e -- --workers=2`

- Exit code final: 0.
- Playwright: 28 testes aprovados em desktop 1280 × 720 e celular horizontal.
- Marco 5: Legacy/Hyper, áudio persistente, gamepad, fullscreen e superfície PWA aprovados.
- Marcos 1 a 4: todas as regressões aprovadas.
- A primeira matriz completa revelou que o polling novo sobrescrevia apenas o comando virtual do contrato de testes antigo; uma camada determinística separada foi adicionada e a matriz inteira foi repetida com sucesso.

### `npm run build:public`

- Exit code: 0.
- Precache público: 14 entradas, 388,75 KiB.
- Manifesto confirmado como `ROAD ENDURANCE`, fullscreen e orientação horizontal.
- Os sete WebP e a navegação offline estão presentes no service worker.
- Varredura de `dist/` por `Enduro`, `Activision` e `fan remake`: sem ocorrências.
- A build privada padrão foi regenerada depois da inspeção pública.

## Validação manual no navegador

- A aba existente em `http://127.0.0.1:5173/` foi atualizada e mantida aberta.
- A transformação automática apresentou LEGACY e HYPER REALISTIC na mesma composição.
- O painel de áudio abriu com Geral 78%, Música 24% e Efeitos 82%; iniciar Quick Race ativou o AudioContext.
- F3 confirmou `AUDIO ACTIVE`, `GAMEPAD NONE`, `PWA AVAILABLE`, perfil HIGH, 10 veículos e 7/7 assets.
- Depois de estabilizar, a leitura manual ficou em 57 FPS / 17,5 ms no navegador embutido.
- Pausa por Escape e retorno ao menu funcionaram com áudio ativo.
- O navegador embutido recusou a entrada fullscreen e o fallback permaneceu utilizável; o Playwright desktop confirmou entrada e saída reais pela mesma interface.
- Console: nenhum erro ou aviso.

## Inspeção visual

- `menu-legacy-1280x720.png`: pixels grandes, scanlines, paleta restrita e silhuetas procedurais legíveis.
- `menu-hyper-1280x720.png`: resolução, panorama, textura e veículos raster restaurados sem mudança de câmera.
- `audio-controls-1280x720.png`: controles compactos, percentuais legíveis e estado de silenciamento claro.
- `gamepad-drive-1280x720.png`: direção analógica, meta autêntica e diagnóstico `CONNECTED · TEST PAD` visíveis.
- Evidências finais salvas em `screenshots/milestone-5/`.

## Itens intencionalmente pendentes

- Marco 6: perfis gráficos ajustáveis, medição dedicada, matriz canônica de dez screenshots, otimização final e documentação de entrega.
- Validação tátil de um gamepad físico não foi executada; o mapeamento foi validado deterministicamente pelo contrato e pelo Playwright.
- A reprodução sonora foi validada pelo grafo ativo, parâmetros e eventos; percepção auditiva humana permanece uma checagem recomendada no dispositivo final.
