# Plano — Enduro Hyper-Realistic Fan Remake POC

## Escopo desta entrega

Esta execução cobre o planejamento e os **Marcos 1 a 6**, encerrando a POC com otimização, matriz completa de testes, capturas canônicas e documentação final.

## Princípios inegociáveis

- Todo código, visual e áudio é original e produzido do zero.
- Nenhum ROM, sprite, logotipo, som ou outro arquivo do jogo original será usado.
- A câmera permanece fixa atrás do carro e a progressão acontece por ultrapassagens e dias.
- A identidade é configurável sem alterar a jogabilidade.
- A simulação é independente da renderização para permitir testes determinísticos.
- Não haverá backend, login, telemetria, anúncios nem dependências obrigatórias em runtime.

## Arquitetura

### Fluxo principal

1. `Game` mantém o estado e executa a simulação em passos limitados.
2. `InputController` consolida teclado, toque e gamepad.
3. `RoadRenderer` projeta segmentos pseudo-3D do horizonte à base da tela.
4. `TrafficSystem` cria, move, recicla e contabiliza veículos com identificadores únicos.
5. `HudRenderer` apresenta dia, carros restantes, velocidade, distância e clima.
6. `BrandingConfig` concentra as duas identidades sem contaminar as regras.
7. Um contrato `window.__roadEnduranceTest` só existe com `?test=1`, permitindo testes de estado sem depender apenas de pixels.
8. `EnvironmentSystem` deriva fase, intensidade climática, visibilidade e resposta lateral a partir de progresso, dia e seed.

### Camadas de renderização atuais

1. Gradiente do céu e sol.
2. Panorama raster original sobre montanhas procedurais de profundidade.
3. Estrada pseudo-3D, microtextura WebP, acostamentos, linhas e postes.
4. Tráfego raster original ordenado por profundidade, com classes sedã e caminhão.
5. Faróis, lanternas, neblina por profundidade, reflexos e partículas leves de gelo.
6. Três poses raster originais do carro do jogador e faíscas de colisão.
7. HUD, feedback e telas de menu/pausa.

### Estratégia de recursos visuais

- Marco 1: formas procedurais originais em Canvas para provar enquadramento e leitura.
- Marco 4: sete recursos raster originais gerados com ImageGen, com prompts versionados em `.prompts/assets/` e arquivos finais em `public/assets/`.
- Cada recurso futuro será validado em perspectiva traseira, escala reduzida, iluminação coerente, ausência de marcas e separação limpa do fundo.
- Bitmaps finais foram convertidos para WebP, preservando transparência onde necessária; o conjunto completo ocupa 310.590 bytes codificados.

## Critérios objetivos de conclusão do Marco 1

- [x] Planejamento, `AGENTS.md`, direção de arte e checklist de fidelidade criados.
- [x] Projeto Vite/TypeScript strict executa localmente.
- [x] Menu permite iniciar `POC QUICK RACE` e `AUTHENTIC ENDURANCE`.
- [x] Estrada pseudo-3D converge para o horizonte e mantém câmera fixa traseira.
- [x] Jogador acelera, freia e se move lateralmente por teclado e toque.
- [x] Tráfego nasce à frente, aproxima-se em perspectiva e pode ser ultrapassado.
- [x] Cada ultrapassagem válida reduz exatamente uma unidade da meta.
- [x] Primeiro dia autêntico começa com 200 veículos; Quick Race começa com 20.
- [x] Colisão reduz velocidade e fornece feedback curto.
- [x] HUD mostra dia, carros restantes, velocidade, distância, melhor resultado e clima.
- [x] `build`, `lint`, Vitest e Playwright passam sem erros.
- [x] A aplicação é aberta e jogada no navegador em 1280 × 720.
- [x] Screenshots do menu e da jogabilidade são inspecionados visualmente.
- [x] Evidências ficam registradas em `.logs/`.

## Critérios objetivos de conclusão do Marco 2

- [x] O primeiro dia autêntico exige 200 ultrapassagens e os seguintes exigem 300.
- [x] A meta concluída mantém a corrida ativa até o novo amanhecer.
- [x] O amanhecer encerra a corrida quando a meta diária está incompleta.
- [x] Não existe limite máximo de dias nem linha de chegada definitiva.
- [x] O odômetro e o total de ultrapassagens continuam entre dias.
- [x] O melhor número de dias concluídos é persistido localmente.
- [x] A dificuldade cresce por velocidade, espaçamento, agrupamentos e variação lateral.
- [x] A curva de dificuldade possui teto configurável para preservar situações superáveis.
- [x] HUD e F3 apresentam dia, contador, relógio, recorde e nível de dificuldade coerentes.
- [x] Testes unitários, Playwright, build pública e inspeção visual passam sem regressões.

## Critérios objetivos de conclusão do Marco 3

- [x] O ciclo percorre amanhecer, manhã, dia, entardecer, anoitecer, noite e madrugada sem cortes de paleta.
- [x] A noite escurece silhuetas, enfatiza lanternas traseiras e mantém faróis e sinalização legíveis.
- [x] A neblina entra e sai progressivamente, reduz distância visível e contraste do tráfego distante.
- [x] O gelo altera a pista e reduz a resposta de direção enquanto preserva maior inércia lateral.
- [x] A Quick Race contém uma seção fixa de neblina e uma seção fixa de gelo.
- [x] O modo autêntico usa janelas climáticas com seed; duração e frequência crescem com teto configurável.
- [x] HUD, estado serializado e F3 apresentam fase, clima, intensidade e visibilidade coerentes.
- [x] Vitest, Playwright desktop/celular, build pública, interação manual e seis capturas ambientais passam sem regressões.

## Critérios objetivos de conclusão do Marco 4

- [x] Prompts finais de geração e critérios de aprovação estão versionados em `.prompts/assets/`.
- [x] Carro do jogador possui poses traseiras coerentes para centro, curva à esquerda e curva à direita.
- [x] Tráfego usa famílias originais e sem marca de sedã e caminhão, com cor e iluminação compostas pelo Canvas.
- [x] Panorama montanhoso e microtextura de asfalto integram o cenário sem alterar a projeção pseudo-3D.
- [x] Iluminação por fase, lanternas, faróis, neblina, gelo e faíscas continuam legíveis com os novos bitmaps.
- [x] O F3 informa quantidade, peso codificado e memória decodificada dos assets.
- [x] O fallback procedural permanece funcional caso algum bitmap não carregue.
- [x] Os sete arquivos finais são WebP, somam 310.590 bytes e estão incluídos no cache offline.
- [x] Vitest, Playwright desktop/celular, build pública, interação manual e capturas do Marco 4 passam sem regressões.

## Critérios objetivos de conclusão do Marco 5

- [x] Motor, vento, pneus secos e pneus no gelo são sintetizados em tempo real pela Web Audio API.
- [x] Colisão, ultrapassagem, período do dia, meta, novo dia, fim de jogo e menus possuem sinais sonoros originais.
- [x] Volume geral, música, efeitos e silenciamento são controláveis e persistidos localmente.
- [x] O áudio só é ativado depois de gesto do usuário e mantém fallback silencioso quando bloqueado.
- [x] Analógico/direcional, gatilhos/botões, Start e confirmação de gamepad funcionam sem remover teclado ou toque.
- [x] O modo Legacy renderiza em 320 × 180, simplifica veículos e textura, limita a imagem e preserva a simulação.
- [x] O menu demonstra a transformação Legacy → Hyper na mesma câmera, sem tela de carregamento.
- [x] Tela cheia possui botão, estado acessível e solicitação opcional por gesto em dispositivos de toque.
- [x] PWA mantém manifesto por identidade, instalação oferecida quando suportada e cache offline dos recursos.
- [x] F3 apresenta áudio, gamepad e situação da PWA.
- [x] Vitest, Playwright desktop/celular, build pública, interação manual e capturas do Marco 5 passam sem regressões.

## Critérios objetivos de conclusão do Marco 6

- [x] Perfis Low, Medium e High aplicam orçamentos distintos de tráfego, partículas, textura e sombras.
- [x] O modo Auto escolhe um teto inicial, reduz efeitos após queda sustentada e recupera qualidade gradualmente.
- [x] A seleção manual é persistente e impede adaptação automática inesperada.
- [x] A resolução lógica permanece em 1280 × 720, com no máximo 8 veículos visíveis e 3 próximos em alta qualidade.
- [x] O F3 apresenta FPS, frame time, resolução, perfil, efeitos, tráfego, clima, fase, velocidade, distância, meta e memória aproximada de recursos.
- [x] A interface cabe e a câmera traseira permanece jogável em 1280 × 720, 1920 × 1080, celular horizontal e celular vertical.
- [x] As dez cenas canônicas foram capturadas automaticamente em 1920 × 1080 e inspecionadas visualmente.
- [x] Lint, Vitest, Playwright, builds privada e pública e inspeção manual no navegador passam sem regressões.

## Riscos de desempenho e mitigação

| Risco | Sinal | Mitigação |
| --- | --- | --- |
| Preenchimento excessivo do Canvas | frame time acima de 16,7 ms | limitar DPR e desenhar na resolução lógica |
| Excesso de tráfego | mais objetos ativos que o perfil permite | pool e limite por perfil |
| Gradientes/partículas caros | queda em GPU integrada | cache futuro em offscreen canvas e redução dinâmica |
| Layout forçado | picos ao redimensionar | atualizar métricas somente em resize/visualViewport |
| Testes instáveis | screenshots/estado divergentes ou servidor que não encerra | seed fixa, relógio controlável em `?test=1` e executor que abre/fecha o Vite no mesmo processo |
| Assets raster pesados | inicialização lenta/memória alta | WebP, preload e orçamento validado por teste |
| Grafo de áudio excessivo | CPU alta ou clipping | fontes contínuas compartilhadas, compressor e sinais curtos |
| Gamepad inconsistente | controles presos ou duplos | dead zone, normalização e ações por borda |

## Marcos

### MARCO 1 — Protótipo de Identidade (concluído em 2026-08-01; revalidado em 2026-08-02)

- Estrada pseudo-3D, câmera fixa, carro e tráfego provisórios.
- Aceleração, frenagem e direção arcade.
- Contador decrescente e meta configurável do primeiro dia.
- Menu com as duas modalidades e identidades centralizadas.

### MARCO 2 — Regras Autênticas (concluído em 2026-08-02)

- Meta 200/300, dias contínuos, falha por meta incompleta, dificuldade progressiva, odômetro e recordes.

### MARCO 3 — Assinaturas Ambientais (concluído em 2026-08-02)

- Ciclo contínuo, noite e lanternas, neblina com visibilidade reduzida e gelo com impacto jogável.

### MARCO 4 — Passe Visual (concluído em 2026-08-02)

- ImageGen, poses coerentes, paisagem, pista, iluminação, partículas e interface final.

### MARCO 5 — Áudio e Acabamento (concluído em 2026-08-02)

- Web Audio original, gamepad, tela cheia, PWA e transição Legacy → Hyper Realistic.

### MARCO 6 — Otimização e Testes (concluído em 2026-08-02)

- Perfis automáticos e manuais, redução dinâmica, F3 completo, matriz em quatro viewports, dez screenshots canônicos, builds e documentação finais.

## Registro de execução

Os resultados estão registrados em `.logs/milestone-1.md` até `.logs/milestone-6.md`. O Marco 6 encerra a POC após validação dos perfis gráficos, adaptação de efeitos, painel F3, matriz automatizada, dez cenas canônicas, builds finais e inspeção manual no navegador.
