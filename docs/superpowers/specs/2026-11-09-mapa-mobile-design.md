# Enquadramento mobile do mapa público de assentos

## Intenção

No celular, o mapa público deve iniciar focado na área real dos assentos para que fileiras e lugares sejam legíveis sem exigir vários toques no zoom. O enquadramento desktop atual deve permanecer igual.

## Abordagem aprovada

O componente público calculará a caixa que envolve os lugares e passará esse foco inicial ao componente SVG somente quando a viewport for mobile. O mapa continuará usando `preserveAspectRatio="xMidYMid meet"`, os controles de zoom permanecerão ativos e o botão “Ver tudo” continuará restaurando a visão completa.

## Limites

- Não alterar dados, coordenadas ou geração do mapa.
- Não cortar palco, entrada ou fileiras ao aplicar o foco inicial.
- Não mudar o comportamento inicial em desktop.
- Manter navegação por toque, acessibilidade e testes existentes.

## Critério de sucesso

Em viewport mobile, o mapa renderiza com transformação inicial maior que 1 quando houver assentos, mostrando a área dos lugares de forma legível; em viewport desktop, a transformação inicial permanece identidade.
