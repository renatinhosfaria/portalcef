# Plano de seguranca e hardening (2026-01-23)

## Contexto
Sistema em producao (portalcef.com.br) com evidencias de varredura automatizada e tentativas de exploracao. Ja existem bloqueios e rate limit no Nginx, headers basicos de seguranca e CSP em modo Report-Only. Este documento consolida um plano em fases para elevar a seguranca sem quebrar o funcionamento atual.

## Objetivos
- Reduzir superficie de ataque e impactos de varredura.
- Eliminar exposicao de dados sensiveis em logs.
- Fechar configuracoes inseguras (CORS, MinIO, imagens latest).
- Identificar causa raiz dos erros da loja e possivel execucao de comandos.
- Estabelecer monitoramento e resposta a incidentes.

## Escopo
- Nginx (headers, CSP, limitacao de abuso, logs de CSP).
- API e apps (validacao, logs, CORS).
- Infra (MinIO, imagens, permissoes de container).
- Observabilidade (alertas e banimento automatizado).

## Fora de escopo
- Mudancas grandes de arquitetura.
- Migroes de identidade/autenticacao.
- Refactor amplo de frontends.

## Arquitetura (visao geral)
- Nginx como reverse proxy para apps Next.js e API Nest.
- Loja roda em subdominio dedicado (loja.portalcef.com.br).
- API centralizada em essencia-api (3002).
- Storage via MinIO.

## Componentes afetados
- `nginx.conf`: headers de seguranca, CSP Report-Only, limites e bloqueios.
- `services/api`: configuracao de CORS e logs.
- `apps/loja` e `apps/loja-admin`: logs e possiveis vetores de entrada.
- `docker-compose.prod.yml`: versoes de imagens e ajustes de MinIO.

## Fluxo de dados (pontos criticos)
1) Cliente -> Nginx -> Apps -> API.
2) Loja recebe `POST /` (root) e route handlers internos fazem proxy para API.
3) Relatorios de CSP sao enviados para `/csp-report` no Nginx.

## Tratamento de erros
- CSP em Report-Only nao bloqueia, apenas registra.
- Rate limit devolve 429 para abuso.
- Bloqueios Nginx retornam 444 para varreduras comuns.

## Plano por fases

### Fase 0 (baixo risco, 1-2 dias)
- Logs sem PII no `loja-admin` (mascarar telefone/email).
- CORS no backend com origens da loja e loja-admin (sem wildcard).
- MinIO: fixar versao da imagem e revisar bucket publico.
- CSP Report-Only em coleta por 24-48h.

### Fase 1 (causa raiz, 2-4 dias)
- Inventariar uso de `exec/spawn/eval` e entradas que chegam ao app da loja.
- Mapear handler de `POST /` e fluxo de dados.
- Confirmar onde a execucao de comandos pode ocorrer e corrigir na origem.

### Fase 2 (monitoramento e resposta, 1-2 dias)
- Alertas para picos de 4xx/5xx e relatorios CSP.
- Banimento automatico de IPs agressivos (fail2ban/WAF).

### Fase 3 (endurecimento extra)
- CSP em modo enforce com lista final de dominios.
- Permissoes de container mais restritas (read-only, drop caps).

## Testes e verificacoes
- `curl -I` para conferir headers e CSP Report-Only.
- Verificacao de logs do Nginx para relatorios CSP.
- Testes de CORS nas rotas da loja e loja-admin.
- Teste de acesso anonimo ao MinIO (publico apenas quando esperado).
- Monitorar 429/444 e ajustar limites se necessario.

## Riscos e mitigacoes
- CSP restritiva pode quebrar frontend: usar Report-Only primeiro.
- Rate limit pode afetar usuarios atras de NAT: limites conservadores e ajuste por observacao.
- MinIO publico pode expor arquivos: separar buckets por tipo e revisar uploads.

## Entregaveis
- Documento de plano (este arquivo).
- Ajustes pontuais em Nginx e backend conforme fases.
- Evidencias de monitoramento e reducao de erros.
