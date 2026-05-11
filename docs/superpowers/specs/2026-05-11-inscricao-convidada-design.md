# Formulário de Inscrição para Convidadas — Mãe por Inteiro

**Data:** 2026-05-11  
**Evento:** Mãe por Inteiro (16/05/2026)  
**Status:** Aprovado

---

## Contexto

O evento Mãe por Inteiro possui um formulário de inscrição destinado a mães de alunos do Colégio Essência Feliz (`inscricao.html`). A gerência/diretoria precisa convidar individualmente algumas mães externas ao colégio. Essas convidadas precisam de um formulário separado, sem os campos de filhos matriculados.

---

## Escopo

Criar `landing-mae-por-inteiro/inscricao-convidada.html` — página estática, sem controle de acesso, enviada manualmente pela gerente/diretoria via WhatsApp para cada convidada.

O formulário atual (`inscricao.html`) **não é alterado**.

---

## Arquivo e URL

| Item | Valor |
|------|-------|
| Arquivo | `landing-mae-por-inteiro/inscricao-convidada.html` |
| URL de produção | `https://www.portalcef.com.br/evento-mae-por-inteiro/inscricao-convidada.html` |
| Controle de acesso | Nenhum — quem tiver o link pode se inscrever |

---

## Visual

Idêntico ao `inscricao.html`:
- Mesma navbar simplificada (logo "Colégio Essência Feliz" + botão "Voltar" para `index.html`)
- Mesmo cabeçalho (`page-header`) com título "Inscreva-se" e subtítulo padrão
- Mesmo aviso de prazo: *"⏳ As inscrições encerram em 13/05/2026 às 23h59 (horário de Brasília)."*
- Mesmo banner de inscrições encerradas (`#inscricoesEncerradasBanner`)
- Mesma estrutura de `form-card` dentro de `section.section`
- Mesmo footer
- Mesmos estilos (`style.css`) e fontes

---

## Formulário

Campos obrigatórios, na ordem:

1. **Nome Completo** — `input[type=text]`
2. **CPF** — `input[type=text]` com máscara `000.000.000-00`
3. **Data de Nascimento** — `input[type=date]`
4. **E-mail** — `input[type=email]`
5. **Telefone (WhatsApp)** — `input[type=text]` com máscara `(00) 00000-0000`

O bloco de filhos matriculados é **completamente omitido** (sem renderização, sem JavaScript relacionado).

---

## Integração com a API

**Endpoint:** `POST /api/eventos/mae-por-inteiro/inscricoes`

**Payload enviado:**
```json
{
  "nome": "...",
  "cpf": "...",
  "dataNascimento": "...",
  "email": "...",
  "telefone": "...",
  "filhos": []
}
```

**Verificação de deadline:**  
`GET /api/eventos/mae-por-inteiro/status` — mesma lógica do formulário atual: se `inscricoesAbertas === false`, exibe o banner e oculta o formulário.

**Tratamento de erros (idêntico ao formulário atual):**

| Status | Comportamento |
|--------|--------------|
| 201 | Redireciona para `confirmacao.html` |
| 409 | Alert: "Já existe uma inscrição com este CPF para este evento." |
| 403 | Alert: "As inscrições para este evento estão encerradas." + redirect para `index.html` |
| 400 | Alert com `data.message` |
| Erro de rede | Alert: "Erro de conexão. Verifique sua internet e tente novamente." |

---

## Ponto de Atenção — API

O endpoint atual pode ter validação que exige pelo menos 1 filho no array. Antes de finalizar, verificar o módulo de eventos na API (`services/api/src/modules/eventos`) e, se necessário, tornar `filhos` opcional (array vazio aceito).

---

## Fora do Escopo

- Controle de acesso por token
- Campos adicionais específicos para convidadas (ex: "quem convidou")
- Separação das inscrições de convidadas no backend/relatórios
- Alterações no `inscricao.html` existente
