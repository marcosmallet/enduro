# Marco 6 — otimização e testes

Data: 2026-08-02

## Entrega

- Perfis `LOW`, `MEDIUM` e `HIGH` centralizados em `src/config/game.ts`.
- Seleção `AUTO` com redução após 4 segundos de FPS sustentadamente baixo e recuperação gradual após 12 segundos estáveis a 57 FPS ou mais, sem ultrapassar o teto detectado.
- Seleção manual persistida no navegador e imune à adaptação automática.
- Orçamento rígido de no máximo 8 veículos visíveis e 3 veículos próximos em alta qualidade.
- Escala de partículas, textura de pista e sombras reduzidas por perfil; assets continuam pré-carregados e possuem fallback procedural.
- F3 ampliado com resolução interna, perfil efetivo, intensidade dos efeitos e consumo dos orçamentos visível/HQ.
- Menu compacto em celular horizontal e layout completo em celular vertical.
- Contrato `?test=1` ampliado para perfis e amostras de desempenho; ele continua ausente na build normal.

## Perfis validados

| Perfil | Ativos | Visíveis | Próximos HQ | Partículas | Pista/sombras |
| --- | ---: | ---: | ---: | ---: | --- |
| Low | 6 | 6 | 1 | 42% | simplificadas |
| Medium | 8 | 8 | 2 | 72% | textura, sem sombra complexa |
| High | 10 | 8 | 3 | 100% | completas |

A resolução lógica permaneceu em 1280 × 720 nos três perfis.

## Validação automatizada final

- `npm run check`: aprovado.
  - ESLint: zero avisos e zero erros.
  - Vitest: 12 arquivos, 40 testes aprovados.
  - TypeScript strict e build privada: aprovados.
  - PWA privada: 14 entradas de precache, 393,92 KiB.
- `npm run build:public`: aprovado.
  - PWA pública: 14 entradas de precache, 393,76 KiB.
  - 15 arquivos, 420.299 bytes no diretório final.
  - Varredura da build pública por `Enduro`, `Activision` e `fan remake`: limpa.
- `npm run test:e2e`: 40 testes Playwright aprovados em 2,3 minutos.
  - Desktop 1280 × 720.
  - Desktop 1920 × 1080.
  - iPhone 13 horizontal.
  - iPhone 13 vertical.

## Capturas e inspeção visual

As dez imagens canônicas foram geradas automaticamente em 1920 × 1080 e conferidas individualmente:

1. `01-dawn-1920x1080.png`
2. `02-day-1920x1080.png`
3. `03-sunset-1920x1080.png`
4. `04-night-1920x1080.png`
5. `05-fog-1920x1080.png`
6. `06-ice-1920x1080.png`
7. `07-collision-1920x1080.png`
8. `08-goal-1920x1080.png`
9. `09-new-day-1920x1080.png`
10. `10-game-over-1920x1080.png`

Resultado da inspeção: câmera e escala coerentes, carro centralizado, HUD legível, silhuetas e lanternas preservadas à noite, redução clara de profundidade na neblina, superfície de gelo distinta, colisão com reação e faíscas, e feedbacks de meta, novo dia e falha sem bloquear o enquadramento. O primeiro amanhecer capturado revelou um resíduo da transformação Legacy → Hyper; a apresentação passou a ser sincronizada ao iniciar a corrida e a imagem foi recapturada sem o artefato.

As evidências móveis `.logs/milestone-6-mobile-landscape-menu.png` e `.logs/milestone-6-mobile-portrait-menu.png` confirmam que os dois modos, os seletores de visual/gráficos e a identificação M6 cabem na tela.

## Inspeção no navegador

- Aplicação aberta em `http://127.0.0.1:5173/`.
- Menu, início da Quick Race, resultado e F3 percorridos por interação real.
- F3 confirmou resolução 1280 × 720, 7/7 assets, aproximadamente 303 KiB codificados e 7,9 MB decodificados.
- Sob a sobrecarga do navegador controlado, as leituras ficaram entre 20 e 23 FPS e o modo Auto reduziu de High para Medium e depois Low conforme a duração da carga; isto valida a adaptação, mas não substitui benchmark sem instrumentação no hardware-alvo.
- Console: somente mensagens de conexão do Vite; nenhum erro ou aviso da aplicação.

## Conclusão

O Marco 6 e a POC completa estão aprovados. Não foram encontradas regressões de identidade, regras, clima, áudio, controles, PWA ou fidelidade visual.
