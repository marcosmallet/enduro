# AGENTS.md

## Missão do repositório

Construir uma POC local, offline e totalmente original de uma corrida arcade de resistência inspirada na estrutura de jogabilidade de clássicos do gênero, sem reutilizar propriedade protegida.

## Regras de implementação

- Use TypeScript strict, Canvas 2D e APIs nativas do navegador.
- Mantenha regras em `src/game/` e renderização em `src/rendering/`.
- Não adicione bibliotecas de jogo ou física sem necessidade comprovada.
- Não use marcas, fabricantes, ROMs ou assets de terceiros.
- Não introduza voltas, posição de corrida, minimapa, nitro, moedas ou garagem.
- Preserve a câmera traseira fixa, o contador decrescente e a progressão por dias.
- Centralize textos e identidade em `src/config/branding.ts`.
- Qualquer aleatoriedade da simulação deve aceitar seed.
- O modo de testes (`?test=1`) pode expor comandos e estado serializado, mas não deve existir na build normal.

## Comandos esperados

- `npm run dev` — servidor local.
- `npm run build` — TypeScript e build de produção.
- `npm run lint` — lint sem correções automáticas.
- `npm run test` — testes unitários.
- `npm run test:e2e` — testes Playwright.
- `npm run check` — lint, testes e build.

## Validação por marco

Antes de avançar, execute build, lint, Vitest e Playwright; abra o jogo, interaja com ele, capture screenshots, inspecione-os e registre evidências em `.logs/`. Não avance com regressões de identidade, erros, testes falhando ou problemas visuais graves.
