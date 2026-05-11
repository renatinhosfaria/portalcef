# Formulário de Inscrição para Convidadas — Mãe por Inteiro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `inscricao-convidada.html` para mães convidadas externas ao colégio, sem campo de filhos, usando o mesmo endpoint de inscrição.

**Architecture:** Dois ajustes na API (DTO + service) para aceitar `filhos: []`, seguidos da criação da página HTML estática. Nenhuma alteração no formulário existente (`inscricao.html`).

**Tech Stack:** NestJS + Zod (API), HTML/CSS/JS vanilla (landing page)

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.ts` |
| Modificar | `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts` |
| Criar | `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts` |
| Criar | `landing-mae-por-inteiro/inscricao-convidada.html` |

---

## Task 1: Ajustar DTO para aceitar `filhos: []`

**Files:**
- Criar: `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts`
- Modificar: `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar o arquivo `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts`:

```typescript
import { criarInscricaoSchema } from "./evento-inscricoes.dto";

const baseValido = {
  nome: "Maria Convidada Silva",
  cpf: "123.456.789-00",
  dataNascimento: "1990-01-15",
  email: "maria@exemplo.com",
  telefone: "(34) 99999-9999",
};

describe("criarInscricaoSchema", () => {
  it("aceita filhos: [] para convidadas externas", () => {
    const result = criarInscricaoSchema.safeParse({ ...baseValido, filhos: [] });
    expect(result.success).toBe(true);
  });

  it("continua exigindo filhos válidos quando informados", () => {
    const result = criarInscricaoSchema.safeParse({
      ...baseValido,
      filhos: [{ nome: "João", turma: "Berçário" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita filho com turma inválida", () => {
    const result = criarInscricaoSchema.safeParse({
      ...baseValido,
      filhos: [{ nome: "João", turma: "Turma Inexistente" }],
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
cd /var/www/essencia
pnpm --filter api test -- --testPathPattern="evento-inscricoes.dto.spec" --no-coverage
```

Esperado: FAIL — `"Informe pelo menos um filho"` (o primeiro `it` falha).

- [ ] **Step 3: Corrigir o DTO — trocar `.min(1)` por `.min(0)`**

Em `services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.ts`, linha 54, alterar:

```typescript
// Antes
    .min(1, "Informe pelo menos um filho")
    .max(10, "Limite de filhos por inscrição: 10"),
```

Para:

```typescript
// Depois
    .min(0)
    .max(10, "Limite de filhos por inscrição: 10"),
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
cd /var/www/essencia
pnpm --filter api test -- --testPathPattern="evento-inscricoes.dto.spec" --no-coverage
```

Esperado: 3 testes PASS.

- [ ] **Step 5: Rodar lint e typecheck**

```bash
cd /var/www/essencia
pnpm turbo lint --filter=api && pnpm turbo typecheck --filter=api
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.ts \
        services/api/src/modules/evento-inscricoes/dto/evento-inscricoes.dto.spec.ts
git commit -m "feat(eventos): aceitar filhos vazios no schema de inscrição (convidadas externas)"
```

---

## Task 2: Ajustar service para não inserir filhos quando array vazio

**Files:**
- Modificar: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts` (linhas 187–197)

- [ ] **Step 1: Substituir o bloco de inserção de filhos**

Em `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts`, localizar o bloco:

```typescript
    // Inserir filhos
    const filhosInseridos = await this.db
      .insert(eventoInscricaoFilhos)
      .values(
        dto.filhos.map((f) => ({
          inscricaoId: inscricao.id,
          nomeFilho: f.nome,
          turmaFilho: f.turma,
        })),
      )
      .returning();
```

Substituir por:

```typescript
    // Inserir filhos (array pode ser vazio para convidadas externas)
    const filhosInseridos =
      dto.filhos.length > 0
        ? await this.db
            .insert(eventoInscricaoFilhos)
            .values(
              dto.filhos.map((f) => ({
                inscricaoId: inscricao!.id,
                nomeFilho: f.nome,
                turmaFilho: f.turma,
              })),
            )
            .returning()
        : [];
```

- [ ] **Step 2: Rodar typecheck para confirmar sem erros de tipo**

```bash
cd /var/www/essencia
pnpm turbo typecheck --filter=api
```

Esperado: sem erros.

- [ ] **Step 3: Rodar os testes existentes**

```bash
cd /var/www/essencia
pnpm --filter api test -- --no-coverage
```

Esperado: todos os testes PASS (incluindo os da Task 1).

- [ ] **Step 4: Commit**

```bash
git add services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts
git commit -m "fix(eventos): não inserir filhos quando array vazio (inscrição de convidadas)"
```

---

## Task 3: Criar `inscricao-convidada.html`

**Files:**
- Criar: `landing-mae-por-inteiro/inscricao-convidada.html`

- [ ] **Step 1: Criar o arquivo**

Criar `landing-mae-por-inteiro/inscricao-convidada.html` com o conteúdo abaixo (idêntico ao `inscricao.html`, sem o bloco de filhos):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <title>Inscrição (Convidada) | Mãe por Inteiro - Colégio Essência Feliz</title>
  <meta name="description" content="Página de inscrição para convidadas do evento Mãe por Inteiro.">
  
  <!-- Estilos e Fontes -->
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    .btn-submit {
      width: 100%;
      justify-content: center;
      margin-top: 16px;
    }
  </style>
</head>
<body>

  <!-- NAVBAR SIMPLIFICADA -->
  <nav class="navbar" id="navbar" style="background: rgba(255, 249, 243, 0.9);">
    <div class="container nav-container">
      <a href="index.html" class="nav-brand">
        Colégio Essência Feliz
      </a>
      <a href="index.html" class="btn btn-outline nav-cta" style="font-size: 0.9rem; padding: 10px 20px;">
        Voltar
      </a>
    </div>
  </nav>

  <!-- CABEÇALHO -->
  <header class="page-header">
    <div class="container" data-animate="fade-up">
      <h1 class="title-script" style="font-size: clamp(2.5rem, 8vw, 4rem);">Inscreva-se</h1>
      <p style="color: var(--text-light); margin-top: 10px; font-size: 1.1rem;">Preencha seus dados para garantir sua vaga neste encontro especial.</p>
      <p id="deadlineNote" style="margin-top: 12px; font-size: .9rem; color: var(--rose-deep); font-weight: 500;">
        ⏳ As inscrições encerram em <strong>13/05/2026 às 23h59</strong> (horário de Brasília).
      </p>
    </div>
  </header>

  <!-- BANNER DE INSCRIÇÕES ENCERRADAS (visível só após o deadline) -->
  <div id="inscricoesEncerradasBanner" style="display:none; background:#FEE2E2; border:1px solid #FCA5A5; color:#7F1D1D; padding:20px; max-width:600px; margin:24px auto; border-radius:12px; text-align:center;">
    <strong style="display:block; margin-bottom:6px;">⚠️ Inscrições encerradas</strong>
    <span style="font-size:.95rem;">O prazo para inscrição neste evento já se encerrou. Em caso de dúvidas, entre em contato com a secretaria do Colégio Essência Feliz.</span>
  </div>

  <!-- FORMULÁRIO -->
  <section class="section" style="padding-top: 0;">
    <div class="container">
      <div class="form-card" data-animate="fade-up" data-delay="0.2">
        <form id="inscricaoForm" onsubmit="return redirecionar(event)">

          <div class="form-group">
            <label for="nome" class="form-label">Nome Completo</label>
            <input type="text" id="nome" class="form-input" placeholder="Digite seu nome completo" required>
          </div>

          <div class="form-group">
            <label for="cpf" class="form-label">CPF</label>
            <input type="text" id="cpf" class="form-input" placeholder="000.000.000-00" maxlength="14" oninput="maskCPF(this)" required>
          </div>

          <div class="form-group">
            <label for="dataNascimento" class="form-label">Data de Nascimento</label>
            <input type="date" id="dataNascimento" class="form-input" required>
          </div>

          <div class="form-group">
            <label for="email" class="form-label">E-mail</label>
            <input type="email" id="email" class="form-input" placeholder="seu.email@exemplo.com" required>
          </div>

          <div class="form-group">
            <label for="telefone" class="form-label">Telefone (WhatsApp)</label>
            <input type="text" id="telefone" class="form-input" placeholder="(00) 00000-0000" maxlength="15" oninput="maskPhone(this)" required>
          </div>

          <button type="submit" class="btn btn-primary btn-glow btn-large btn-submit">
            <span>Confirmar Inscrição</span>
            <i data-lucide="check"></i>
          </button>
        </form>
      </div>
    </div>
  </section>

  <!-- RODAPÉ -->
  <footer class="footer">
    <div class="container footer-content">
      <div class="footer-brand">
        Mãe por Inteiro
      </div>
      <p class="footer-tagline">Um evento exclusivo do Colégio Essência Feliz.</p>
      <div class="footer-divider"></div>
      <p class="footer-copy">&copy; 2026 Colégio Essência Feliz. Todos os direitos reservados.</p>
    </div>
  </footer>

  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="script.js"></script>

  <script>
    // Verifica se as inscrições estão abertas
    (async function checarStatus() {
      try {
        const r = await fetch('/api/eventos/mae-por-inteiro/status', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (data && data.inscricoesAbertas === false) {
          const banner = document.getElementById('inscricoesEncerradasBanner');
          const formCard = document.querySelector('.form-card');
          const deadlineNote = document.getElementById('deadlineNote');
          if (banner) banner.style.display = 'block';
          if (formCard) formCard.style.display = 'none';
          if (deadlineNote) deadlineNote.style.display = 'none';
        }
      } catch (_e) {
        // Em caso de falha, deixamos a API rejeitar no submit (403)
      }
    })();

    function maskCPF(input) {
      let v = input.value.replace(/\D/g, "");
      if (v.length > 11) v = v.substring(0, 11);
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      input.value = v;
    }

    function maskPhone(input) {
      let v = input.value.replace(/\D/g, "");
      if (v.length > 11) v = v.substring(0, 11);
      v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
      v = v.replace(/(\d{5})(\d)/, "$1-$2");
      input.value = v;
    }

    async function redirecionar(event) {
      event.preventDefault();

      const btn = document.querySelector('.btn-submit');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span>Enviando...</span> <i data-lucide="loader" class="spin"></i>';
      lucide.createIcons();

      const payload = {
        nome: document.getElementById('nome').value.trim(),
        cpf: document.getElementById('cpf').value.trim(),
        dataNascimento: document.getElementById('dataNascimento').value,
        email: document.getElementById('email').value.trim(),
        telefone: document.getElementById('telefone').value.trim(),
        filhos: [],
      };

      try {
        const resp = await fetch('/api/eventos/mae-por-inteiro/inscricoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (resp.status === 201) {
          window.location.href = 'confirmacao.html';
          return false;
        }

        const data = await resp.json().catch(() => ({}));
        const apiMsg =
          (data && (data.message || (data.error && data.error.message))) || '';
        if (resp.status === 409) {
          alert('Já existe uma inscrição com este CPF para este evento.');
        } else if (resp.status === 403) {
          alert('As inscrições para este evento estão encerradas.');
          window.location.href = 'index.html';
          return false;
        } else if (resp.status === 400 && apiMsg) {
          alert('Não foi possível enviar a inscrição:\n' + apiMsg);
        } else {
          alert('Não foi possível enviar a inscrição. Tente novamente em instantes.');
        }
      } catch (err) {
        alert('Erro de conexão. Verifique sua internet e tente novamente.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        lucide.createIcons();
      }

      return false;
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: Rodar lint global**

```bash
cd /var/www/essencia
pnpm turbo lint && pnpm turbo typecheck
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add landing-mae-por-inteiro/inscricao-convidada.html
git commit -m "feat(landing): formulário de inscrição para convidadas externas — Mãe por Inteiro"
```
