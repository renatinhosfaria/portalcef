# Landing Mãe por Inteiro V3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar a terceira versão completa da landing page do evento "Mãe por Inteiro: amor, propósito e vida real".

**Architecture:** A landing será uma página estática isolada em `landing-mae-por-inteiro-v3`, seguindo o padrão das versões anteriores do projeto. O deploy será feito por container Nginx próprio e rota dedicada `/evento-mae-por-inteiro-v3`, preservando as versões anteriores.

**Tech Stack:** HTML semântico, CSS moderno com variáveis e animações responsivas, JavaScript progressivo, GSAP, Lenis, Lucide Icons, Nginx Alpine.

---

### Task 1: Teste de contrato da landing

**Files:**
- Create: `landing-mae-por-inteiro-v3/test/landing.test.mjs`

**Step 1: Write the failing test**

Criar testes com `node:test` que validem:
- arquivos obrigatórios (`index.html`, `style.css`, `script.js`, `Dockerfile`);
- título, descrição, detalhes do evento e inscrição gratuita;
- cinco profissionais;
- rota Docker `/evento-mae-por-inteiro-v3`.

**Step 2: Run test to verify it fails**

Run: `node --test landing-mae-por-inteiro-v3/test/landing.test.mjs`

Expected: FAIL porque os arquivos da v3 ainda não existem.

### Task 2: Implementar landing estática

**Files:**
- Create: `landing-mae-por-inteiro-v3/index.html`
- Create: `landing-mae-por-inteiro-v3/style.css`
- Create: `landing-mae-por-inteiro-v3/script.js`
- Copy: `landing-mae-por-inteiro-v3/assets/img/*`

**Step 1: Write minimal implementation**

Construir página completa com hero full-bleed, navegação fixa, temas, público, profissionais, agenda, detalhes, CTA, countdown, FAQ e rodapé.

**Step 2: Run test to verify it passes**

Run: `node --test landing-mae-por-inteiro-v3/test/landing.test.mjs`

Expected: PASS.

### Task 3: Integrar deploy

**Files:**
- Create: `landing-mae-por-inteiro-v3/Dockerfile`
- Modify: `docker-compose.prod.yml`
- Modify: `nginx.conf`

**Step 1: Add v3 container**

Adicionar serviço `landing-mae-v3` com healthcheck na rota `/evento-mae-por-inteiro-v3/`.

**Step 2: Add Nginx route**

Adicionar location `^~ /evento-mae-por-inteiro-v3` antes do fallback de assets.

**Step 3: Run focused checks**

Run:
- `node --test landing-mae-por-inteiro-v3/test/landing.test.mjs`
- `docker compose -f docker-compose.prod.yml config --quiet`

Expected: PASS sem erros.
