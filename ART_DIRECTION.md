# Direção Artística

## Visão

Uma estrada de resistência solitária, veloz e legível, apresentada como realismo cinematográfico 2.5D. A composição moderna mantém a clareza imediata de um arcade clássico: horizonte distante, estrada trapezoidal, tráfego vindo do centro e carro do jogador ancorado próximo à base.

## Linguagem visual

- Formato: 16:9 com área segura de 5% para TV.
- Resolução lógica: 1280 × 720.
- Perspectiva: câmera fixa, baixa e central; horizonte em aproximadamente 31% da altura.
- Paleta inicial: azul-petróleo, âmbar solar, asfalto grafite, sinalização marfim e ciano elétrico no HUD.
- Tipografia: condensada, técnica e própria, usando fontes de sistema sem copiar bitmaps clássicos.
- HUD: vidro fumê discreto, números tabulares e poucos blocos.
- Movimento: parallax moderado; vibração breve e controlada; nenhum corte de câmera.

## Marco 1

Os recursos são procedurais e deliberadamente provisórios, mas já devem comunicar materiais e volumes:

- carro do jogador com silhueta esportiva traseira, lanternas e vidro;
- tráfego com classes visualmente distintas;
- estrada com faixas projetadas, acostamento e postes;
- montanhas em camadas e massa de árvores;
- feedback de velocidade por linhas e deslocamento do cenário.

## Recursos finais do Marco 4 com ImageGen

Os prompts finais estão em `.prompts/assets/` e seguem estas invariantes:

- nenhum nome, logotipo ou desenho identificável de fabricante real;
- mesma câmera traseira elevada e lente aparente entre veículos;
- iluminação base neutra, com variações de composição por código;
- leitura a 64–160 px de altura;
- sombra separável e margens generosas;
- fundo cromático uniforme para remoção e validação local de transparência;
- três poses do carro do jogador: esquerda, centro e direita.

### Conjunto aprovado

- `public/assets/vehicles/player-car-{left,center,right}.webp`: cupê esportivo azul-petróleo original, traseira consistente e poses de esterço discretas.
- `public/assets/vehicles/traffic-sedan.webp`: sedã civil neutro, sem marca, usado com filtros de cor do Canvas.
- `public/assets/vehicles/traffic-truck.webp`: caminhão-baú neutro, sem marca, com silhueta claramente distinta.
- `public/assets/landscape/mountain-panorama.webp`: faixa atmosférica contínua usada com parallax suave sobre a camada procedural distante.
- `public/assets/textures/asphalt.webp`: microtextura neutra repetível, recortada pela geometria projetada da pista.

Todos os veículos tiveram o chroma key removido localmente e conservam transparência. A iluminação noturna, sombras, lanternas, variação de cor e resposta climática continuam sendo compostas em tempo real, evitando multiplicar arquivos por fase. O conjunto final ocupa 310.590 bytes codificados e aproximadamente 8,0 MiB depois de decodificado.

## Modos visuais

- **Hyper Realistic:** contraste, atmosfera, detalhes e partículas completos.
- **Cinematic:** contraste mais suave, granulação discreta e gradação quente/fria.
- **Legacy:** buffer real de 320 × 180, pixels amplos, paleta comprimida, CRT leve, paisagem e veículos procedurais simplificados, sem alterar a simulação.

## Transformação Legacy → Hyper

Ao abrir o menu no modo Hyper, a mesma cena e a mesma câmera começam na apresentação Legacy. Em 4,2 segundos, o buffer interno cresce suavemente até 1280 × 720, os scanlines desaparecem, o panorama, a textura e os veículos raster voltam e a exposição moderna assume a cena. O carro já se move no modo de demonstração, comunicando aceleração sem introduzir uma tela de carregamento ou um corte de perspectiva.

## Critérios de validação visual

- A estrada e o tráfego são compreendidos em uma observação de dois segundos.
- O carro não encobre rotas de fuga.
- O HUD é legível a três metros em uma TV 1080p.
- Veículos próximos e distantes não se confundem com o cenário.
- A perspectiva não muda entre modos visuais.
- Efeitos nunca tornam uma colisão inevitável por falta de informação.
