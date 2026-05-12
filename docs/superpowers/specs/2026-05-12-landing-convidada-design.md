# Landing Page para Convidadas — Mãe por Inteiro

**Data:** 2026-05-12  
**Evento:** Mãe por Inteiro (16/05/2026)  
**Status:** Aprovado

---

## Contexto

A landing page principal (`index.html`) é destinada a mães de alunos do Colégio Essência Feliz e contém mensagens que explicitamente excluem convidadas externas. A diretoria/gerência convida individualmente algumas mães externas ao colégio e precisa enviar uma landing page adequada a esse público — acolhedora, sem as restrições de acesso do texto original.

---

## Escopo

Criar `landing-mae-por-inteiro/convidada.html` — cópia do `index.html` com 4 ajustes cirúrgicos de conteúdo. A página original **não é alterada**.

---

## Arquivo e URL

| Item | Valor |
|------|-------|
| Arquivo | `landing-mae-por-inteiro/convidada.html` |
| URL de produção | `https://www.portalcef.com.br/evento-mae-por-inteiro/convidada.html` |

---

## Ajustes em relação ao `index.html`

### 1. Meta tags

Atualizar para refletir o convite, sem mencionar "mães do Colégio Essência Feliz" como critério de acesso:

```html
<meta name="description" content="🌷 Mãe por Inteiro — 16 de Maio, 09h, no Auditório do Parque Una (Uberlândia). Você foi convidada para um encontro especial. Vagas exclusivas.">

<meta property="og:description" content="16 de Maio · 09h · Auditório do Parque Una, Uberlândia. Você recebeu um convite especial para este encontro.">

<meta name="twitter:description" content="16 de Maio · 09h · Auditório do Parque Una, Uberlândia. Você foi convidada para este encontro especial.">
```

---

### 2. Seção `#publico` — "Para quem é esse evento?"

**Remover** todo o conteúdo atual da `.audience-card-inner` (que lista turmas e critério de matrícula).

**Substituir** por:

```html
<div class="audience-card-inner">
  <p class="audience-intro">
    Você recebeu um <strong>convite especial</strong> para participar do Mãe por Inteiro.
  </p>
  <p class="audience-cta-text" style="margin-top: 20px;">
    Este encontro foi pensado com carinho e temos a honra de tê-la conosco neste dia especial 💛
  </p>
</div>
```

---

### 3. Caixa `.exclusive-box` (dentro de `#porque`)

**Remover** a caixa atual (`exclusive-box`) que contém:
> *"Este é um evento fechado e exclusivo para mães do Colégio Essência Feliz. Não será aberto a outros públicos, convidados externos ou terceiros."*

**Substituir** por:

```html
<div class="exclusive-box">
  <h3 class="exclusive-title">💛 Convite Especial</h3>
  <p class="exclusive-text">
    Você foi convidada especialmente pela equipe do Colégio Essência Feliz.
  </p>
  <p class="exclusive-text" style="margin-top:10px;">
    Sua presença é muito especial para nós e estamos felizes em compartilhar esse momento com você 💛
  </p>
</div>
```

---

### 4. Seção CTA (`#inscricao`) — botão e aviso

**Alterar** o `href` do botão:
```html
<!-- Antes -->
<a href="inscricao.html" ...>

<!-- Depois -->
<a href="inscricao-convidada.html" ...>
```

**Remover** o bloco de aviso abaixo do botão:
```html
<!-- Remover este bloco inteiro -->
<div style="margin-top: 30px; padding-top: 20px; border-top: ...">
  <p class="cta-note">
    ⚠️ Importante: Evento exclusivo para mães do Colégio Essência Feliz...
  </p>
</div>
```

---

## Fora do Escopo

- Alterações no `index.html` original
- Alterações no `inscricao-convidada.html`
- Controle de acesso ou autenticação
- Qualquer outro conteúdo além dos 4 ajustes listados acima
