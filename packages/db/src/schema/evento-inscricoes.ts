import { relations, sql } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { users } from "./users.js";

// ============================================
// Table: evento_inscricoes
// Inscrições para eventos abertos da escola (ex: "Mãe por Inteiro").
// Endpoint público — não há tenant context obrigatório.
// ============================================
export const eventoInscricoes = pgTable(
  "evento_inscricoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Slug do evento (permite múltiplos eventos compartilhando a tabela)
    eventoSlug: varchar("evento_slug", { length: 80 }).notNull(),

    // Número de inscrição amigável (formato "XXX-XXX", único por evento)
    numeroInscricao: varchar("numero_inscricao", { length: 7 }).notNull(),

    // Dados pessoais da mãe
    nome: varchar("nome", { length: 200 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(), // formato 000.000.000-00
    dataNascimento: date("data_nascimento").notNull(),
    email: varchar("email", { length: 200 }).notNull(),
    telefone: varchar("telefone", { length: 20 }).notNull(),

    // Presença no dia do evento
    presencaConfirmadaEm: timestamp("presenca_confirmada_em", {
      withTimezone: true,
    }),
    presencaConfirmadaPor: uuid("presenca_confirmada_por").references(
      () => users.id,
      { onDelete: "set null" },
    ),

    // Metadata opcional para auditoria
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Uma mesma mãe (CPF) só pode se inscrever uma vez por evento
    eventoCpfUnique: uniqueIndex("uq_evento_inscricoes_evento_cpf").on(
      table.eventoSlug,
      table.cpf,
    ),
    // Número de inscrição é único por evento
    eventoNumeroUnique: uniqueIndex("uq_evento_inscricoes_evento_numero").on(
      table.eventoSlug,
      table.numeroInscricao,
    ),
    eventoSlugIdx: index("idx_evento_inscricoes_evento_slug").on(
      table.eventoSlug,
    ),
    presencaIdx: index("idx_evento_inscricoes_presenca").on(
      table.eventoSlug,
      table.presencaConfirmadaEm,
    ),
    createdAtIdx: index("idx_evento_inscricoes_created_at").on(table.createdAt),
  }),
);

export type EventoInscricao = typeof eventoInscricoes.$inferSelect;
export type NewEventoInscricao = typeof eventoInscricoes.$inferInsert;

// ============================================
// Table: evento_inscricao_filhos
// Cada inscrição pode ter 1+ filhos, com nome e turma.
// ============================================
export const eventoInscricaoFilhos = pgTable(
  "evento_inscricao_filhos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    inscricaoId: uuid("inscricao_id")
      .notNull()
      .references(() => eventoInscricoes.id, { onDelete: "cascade" }),

    nomeFilho: varchar("nome_filho", { length: 200 }).notNull(),
    turmaFilho: varchar("turma_filho", { length: 80 }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    inscricaoIdIdx: index("idx_evento_filhos_inscricao_id").on(
      table.inscricaoId,
    ),
    turmaIdx: index("idx_evento_filhos_turma").on(table.turmaFilho),
  }),
);

export type EventoInscricaoFilho = typeof eventoInscricaoFilhos.$inferSelect;
export type NewEventoInscricaoFilho = typeof eventoInscricaoFilhos.$inferInsert;

// ============================================
// Table: evento_sorteios
// Histórico de brindes sorteados por evento.
// ============================================
export const eventoSorteios = pgTable(
  "evento_sorteios",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    eventoSlug: varchar("evento_slug", { length: 80 }).notNull(),
    brinde: varchar("brinde", { length: 200 }).notNull(),

    inscricaoId: uuid("inscricao_id")
      .notNull()
      .references(() => eventoInscricoes.id, { onDelete: "restrict" }),

    // Snapshot do número no momento do sorteio para facilitar auditoria/export.
    numeroInscricao: varchar("numero_inscricao", { length: 7 }).notNull(),

    sorteadoEm: timestamp("sorteado_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sorteadoPor: uuid("sorteado_por").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    eventoInscricaoUnique: uniqueIndex(
      "uq_evento_sorteios_evento_inscricao",
    ).on(table.eventoSlug, table.inscricaoId),
    eventoBrindeUnique: uniqueIndex("uq_evento_sorteios_evento_brinde").on(
      table.eventoSlug,
      sql`lower(btrim(${table.brinde}))`,
    ),
    eventoSlugIdx: index("idx_evento_sorteios_evento_slug").on(
      table.eventoSlug,
    ),
    sorteadoEmIdx: index("idx_evento_sorteios_sorteado_em").on(
      table.sorteadoEm,
    ),
  }),
);

export type EventoSorteio = typeof eventoSorteios.$inferSelect;
export type NewEventoSorteio = typeof eventoSorteios.$inferInsert;

// ============================================
// Drizzle Relations
// ============================================
export const eventoInscricoesRelations = relations(
  eventoInscricoes,
  ({ many }) => ({
    filhos: many(eventoInscricaoFilhos),
    sorteios: many(eventoSorteios),
  }),
);

export const eventoInscricaoFilhosRelations = relations(
  eventoInscricaoFilhos,
  ({ one }) => ({
    inscricao: one(eventoInscricoes, {
      fields: [eventoInscricaoFilhos.inscricaoId],
      references: [eventoInscricoes.id],
    }),
  }),
);

export const eventoSorteiosRelations = relations(eventoSorteios, ({ one }) => ({
  inscricao: one(eventoInscricoes, {
    fields: [eventoSorteios.inscricaoId],
    references: [eventoInscricoes.id],
  }),
}));

// ============================================
// Zod Schemas (drizzle-zod)
// ============================================
export const insertEventoInscricaoSchema = createInsertSchema(eventoInscricoes);
export const selectEventoInscricaoSchema = createSelectSchema(eventoInscricoes);

export const insertEventoInscricaoFilhoSchema = createInsertSchema(
  eventoInscricaoFilhos,
);
export const selectEventoInscricaoFilhoSchema = createSelectSchema(
  eventoInscricaoFilhos,
);

export const insertEventoSorteioSchema = createInsertSchema(eventoSorteios);
export const selectEventoSorteioSchema = createSelectSchema(eventoSorteios);
