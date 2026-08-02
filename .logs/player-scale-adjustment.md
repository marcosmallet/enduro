# Ajuste de escala do carro do jogador

Data: 2026-08-02

## Resultado

- Largura visual reduzida de 218 px para 160 px (-26,6%).
- Altura visual calibrada em 94 px, preservando a silhueta e a leitura da câmera traseira.
- Limites laterais de colisão alinhados à nova escala: 0,20 para carros e 0,23 para veículos grandes.
- A telemetria de teste limita a razão entre o carro do jogador e o tráfego próximo a menos de 2,1 em desktop, paisagem móvel e retrato móvel.

## Evidências visuais inspecionadas

- `.logs/player-scale-desktop-720p.png`
- `.logs/player-scale-mobile-landscape.png`
- `.logs/player-scale-mobile-portrait.png`
- `screenshots/milestone-6/02-day-1920x1080.png`
- `screenshots/milestone-6/04-night-1920x1080.png`
- `screenshots/milestone-6/07-collision-1920x1080.png`

Em uma corrida rápida aberta manualmente em `http://127.0.0.1:5173/`, o carro permaneceu centralizado, liberou mais visão útil da pista e não apresentou avisos ou erros no console.

## Validação automatizada

- `npm run check`: aprovado.
- Vitest: 12 arquivos, 41 testes aprovados.
- Playwright: 44 testes aprovados em quatro perfis de viewport.
- Build de produção: aprovado, incluindo geração do service worker offline.
