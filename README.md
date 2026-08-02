# Enduro Hyper-Realistic Fan Remake — POC

POC local de uma corrida arcade de resistência criada integralmente do zero em Canvas 2D. A entrega final contém os Marcos 1 a 6: estrada pseudo-3D, câmera fixa, condução, tráfego, ultrapassagens, regras autênticas por dias, assinaturas ambientais, passe visual raster original, áudio procedural, controles completos, perfis gráficos adaptativos e validação canônica.

> Projeto de fã não oficial para estudo e experimentação. Não afiliado ou endossado pela Activision. Nenhuma ROM, imagem, logotipo, música, efeito ou código original foi usado.

## Como executar

1. Instale o Node.js 20 ou superior.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm run dev`.
4. Abra o endereço mostrado no terminal, normalmente `http://localhost:5173`.

Para gerar e testar a build de produção:

```text
npm run check
npm run build
npm run preview
```

## Controles

- `W` ou seta para cima: acelerar.
- `S` ou seta para baixo: frear.
- `A`/seta esquerda e `D`/seta direita: mover o carro.
- `Escape`: pausar/continuar.
- `R`: reiniciar a modalidade atual.
- `F3`: abrir o painel de diagnóstico.
- `M`: silenciar ou reativar o áudio.
- `F11`: tela cheia pelo navegador; o botão `⛶` também solicita tela cheia após o clique.
- Celular/tablet: controles de toque aparecem durante a corrida.
- Gamepad: analógico ou direcional para mover; gatilho direito ou botão principal para acelerar; gatilho esquerdo ou botão secundário para frear; `Start` pausa; botão principal confirma.

Em dispositivos de toque, escolher um modo solicita tela cheia a partir desse gesto. Se o navegador recusar, o jogo continua normalmente sem tela cheia.

## Modos de jogo

- **Resistência Autêntica:** o primeiro dia exige 200 ultrapassagens e cada dia seguinte exige 300. A meta deve ser concluída dentro do ciclo de 180 segundos; ao cumprir, a corrida continua até o novo amanhecer. Falhar encerra a corrida. Dias concluídos e distância permanecem acumulados, e o melhor número de dias é salvo localmente.
- **POC Corrida Rápida:** 90 segundos, meta de 20 ultrapassagens, ciclo completo de iluminação, uma seção de neblina e uma seção de gelo.

## Ambiente e clima

- Amanhecer, manhã, dia, entardecer, anoitecer, noite e madrugada se misturam continuamente.
- Durante a noite, os veículos ficam escuros e suas lanternas traseiras se tornam a principal referência; faróis, placas refletivas e pontos no horizonte mantêm a pista legível.
- A neblina aparece e desaparece gradualmente, reduzindo a distância visível e o contraste do tráfego distante.
- O gelo clareia a pista, adiciona reflexos econômicos e reduz a resposta lateral enquanto prolonga o deslizamento.
- No modo autêntico, a duração e a frequência das janelas climáticas aumentam de forma determinística com o dia, respeitando limites configuráveis.

## Passe visual original

- Três poses transparentes e coerentes do carro do jogador acompanham a resposta lateral.
- Sedã e caminhão sem marcas recebem variações de cor, profundidade, sombra e iluminação pelo Canvas.
- Panorama montanhoso, asfalto, faróis, lanternas, reflexos e partículas são combinados sem alterar as regras.
- Os sete bitmaps finais são WebP, somam cerca de 303 KiB e possuem fallback procedural.
- Prompts e critérios de geração estão documentados em `.prompts/assets/`.

## Áudio e modos visuais

- Motor, vento, pneus, gelo e todos os sinais de evento são sintetizados em runtime pela Web Audio API; não existem músicas ou efeitos copiados.
- Abra **Áudio** no menu para ajustar volume geral, música e efeitos ou silenciar. As escolhas ficam salvas no navegador.
- **Hyper Realistic** usa o passe visual completo; **Cinematic** aplica gradação mais suave; **Legacy** reduz de fato a renderização para 320 × 180, simplifica os veículos e adiciona CRT leve sem mudar a jogabilidade.
- Ao abrir o menu em Hyper, uma demonstração automática transforma a mesma cena de Legacy para Hyper em 4,2 segundos.

## Desempenho e perfis gráficos

- **Auto** escolhe o perfil inicial pelas capacidades do dispositivo, reduz efeitos depois de queda sustentada e recupera qualidade gradualmente quando a taxa de quadros estabiliza.
- **Low:** até 6 veículos visíveis, 1 próximo em alta qualidade, 42% das partículas e desenho simplificado de pista e sombras.
- **Medium:** até 8 veículos visíveis, 2 próximos em alta qualidade, 72% das partículas e microtextura de pista.
- **High:** até 10 veículos ativos, com orçamento rígido de 8 visíveis e 3 próximos em alta qualidade, partículas e efeitos completos.
- A escolha manual `Low`/`Medium`/`High` fica salva no navegador e não é alterada automaticamente.
- A resolução lógica permanece em 1280 × 720 em todos os perfis. Pressione `F3` para conferir FPS, frame time, resolução, perfil, efeitos, tráfego, ambiente, recursos, áudio, gamepad e PWA.

## Modos de identidade

O padrão é `PRIVATE_FAN_REMAKE`. A identidade está centralizada em `src/config/branding.ts`.

Para executar a identidade publicável no PowerShell:

```powershell
$env:VITE_BRAND_MODE='ORIGINAL_PUBLIC_BUILD'
npm run dev
```

Para gerar a build publicável:

```powershell
npm run build:public
```

Essa configuração troca nome, subtítulo, aviso, cores, metadados e manifest, sem alterar as regras do jogo.

## Testes

- `npm run lint` — ESLint.
- `npm run test` — Vitest.
- `npm run test:e2e` — Playwright em desktop 1280 × 720, desktop 1920 × 1080, celular horizontal e celular vertical; o servidor de teste abre e fecha automaticamente.
- `npm run check` — lint, testes unitários e build.

## PWA e uso offline

A build registra um service worker automaticamente. Depois de abrir a build de produção uma vez, use o botão **Instalar** quando ele aparecer ou a opção **Instalar aplicativo** do navegador. Os arquivos essenciais ficam em cache para inicialização offline.

## Publicação no GitHub Pages

O projeto já inclui um workflow em `.github/workflows/deploy-pages.yml` que:

- instala dependências com `npm ci`;
- gera a build pública com `VITE_BRAND_MODE=ORIGINAL_PUBLIC_BUILD`;
- publica a pasta `dist/` para o GitHub Pages.

Para ativar, basta:

1. subir o workflow para o repositório;
2. habilitar o GitHub Pages em `Settings > Pages` com o modo `GitHub Actions`;
3. confirmar que a branch padrão é `main` ou `master`.

## Estado do projeto

Consulte `PLAN.md`, `ART_DIRECTION.md` e `FIDELITY_CHECKLIST.md`. A POC está concluída até o Marco 6. As dez capturas finais em 1920 × 1080 ficam em `screenshots/milestone-6/`, e o registro consolidado de validação fica em `.logs/milestone-6.md`.
