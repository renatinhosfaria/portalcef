CREATE TABLE "eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(240) NOT NULL,
	"summary" varchar(500),
	"description" text,
	"image_url" varchar(500),
	"category" varchar(120),
	"default_location_id" uuid,
	"default_map_id" uuid,
	"status" text DEFAULT 'RASCUNHO' NOT NULL,
	"planned_publication_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"cancellation_policy" text,
	"contact_email" varchar(320),
	"contact_phone" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_locais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" text NOT NULL,
	"room" varchar(160),
	"instructions" text,
	"accessibility" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_mapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"original_file_key" varchar(500) NOT NULL,
	"original_file_name" varchar(255),
	"original_mime_type" varchar(120),
	"status" text DEFAULT 'ENVIADO' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_mapa_assentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"map_id" uuid NOT NULL,
	"row_label" varchar(30) NOT NULL,
	"seat_number" varchar(30) NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"width" integer DEFAULT 1 NOT NULL,
	"height" integer DEFAULT 1 NOT NULL,
	"category" varchar(80),
	"accessible" boolean DEFAULT false NOT NULL,
	"sellable" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_mapa_assentos_positive_dimensions" CHECK ("evento_mapa_assentos"."width" > 0 AND "evento_mapa_assentos"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "evento_sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location_id" uuid,
	"map_id" uuid,
	"sales_starts_at" timestamp with time zone,
	"sales_ends_at" timestamp with time zone,
	"capacity" integer NOT NULL,
	"status" text DEFAULT 'RASCUNHO' NOT NULL,
	"published_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_sessoes_positive_capacity" CHECK ("evento_sessoes"."capacity" > 0),
	CONSTRAINT "evento_sessoes_valid_times" CHECK ("evento_sessoes"."ends_at" > "evento_sessoes"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "evento_inventario_assentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"status" text DEFAULT 'DISPONIVEL' NOT NULL,
	"reservation_expires_at" timestamp with time zone,
	"reserved_by_order_id" uuid,
	"sold_at" timestamp with time zone,
	"blocked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_tipos_ingresso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"eligibility" text,
	"max_per_order" integer,
	"sales_lot" varchar(100),
	"rules" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_tipos_ingresso_non_negative_price" CHECK ("evento_tipos_ingresso"."price_cents" >= 0),
	CONSTRAINT "evento_tipos_ingresso_positive_limit" CHECK ("evento_tipos_ingresso"."max_per_order" IS NULL OR "evento_tipos_ingresso"."max_per_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "evento_ofertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"min_quantity" integer NOT NULL,
	"max_quantity" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"compatible_ticket_type_ids" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_ofertas_positive_quantity" CHECK ("evento_ofertas"."min_quantity" > 0 AND "evento_ofertas"."max_quantity" >= "evento_ofertas"."min_quantity"),
	CONSTRAINT "evento_ofertas_non_negative_price" CHECK ("evento_ofertas"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "evento_pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"order_number" varchar(32) NOT NULL,
	"buyer_name" varchar(200) NOT NULL,
	"buyer_email" varchar(320) NOT NULL,
	"buyer_phone" varchar(30) NOT NULL,
	"status" text DEFAULT 'INICIADO' NOT NULL,
	"total_cents" integer NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"expires_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_pedidos_non_negative_total" CHECK ("evento_pedidos"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "evento_itens_pedido" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"inventory_seat_id" uuid NOT NULL,
	"ticket_type_id" uuid NOT NULL,
	"participant_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"total_price_cents" integer NOT NULL,
	"pricing_evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_itens_pedido_positive_quantity" CHECK ("evento_itens_pedido"."quantity" > 0),
	CONSTRAINT "evento_itens_pedido_non_negative_prices" CHECK ("evento_itens_pedido"."unit_price_cents" >= 0 AND "evento_itens_pedido"."total_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "evento_participantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"order_id" uuid,
	"type" text NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"class_name" varchar(120),
	"email" varchar(320),
	"phone" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"inventory_seat_id" uuid NOT NULL,
	"idempotency_key" varchar(180) NOT NULL,
	"status" text DEFAULT 'ATIVA' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_operacoes_administrativas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"inventory_seat_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'ATIVA' NOT NULL,
	"participant_id" uuid,
	"order_id" uuid,
	"reason" text NOT NULL,
	"valid_until" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_pagamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"stripe_checkout_session_id" varchar(255),
	"stripe_payment_intent_id" varchar(255),
	"method" text NOT NULL,
	"expected_amount_cents" integer NOT NULL,
	"received_amount_cents" integer,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"last_webhook_event_id" varchar(255),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_pagamentos_non_negative_amounts" CHECK ("evento_pagamentos"."expected_amount_cents" >= 0 AND ("evento_pagamentos"."received_amount_cents" IS NULL OR "evento_pagamentos"."received_amount_cents" >= 0))
);
--> statement-breakpoint
CREATE TABLE "evento_reembolsos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"stripe_refund_id" varchar(255),
	"requested_by" uuid NOT NULL,
	"processed_at" timestamp with time zone,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_reembolsos_positive_amount" CHECK ("evento_reembolsos"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "evento_ingressos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"inventory_seat_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"status" text DEFAULT 'EMITIDO' NOT NULL,
	"signed_token" text NOT NULL,
	"qr_payload" text NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"reissued_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"result" text NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_in_by" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_transferencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"from_participant_id" uuid NOT NULL,
	"to_participant_id" uuid NOT NULL,
	"from_seat_id" uuid NOT NULL,
	"to_seat_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"performed_by" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_importacoes_mapa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"map_id" uuid,
	"file_key" varchar(500) NOT NULL,
	"detector" varchar(100) NOT NULL,
	"detector_version" varchar(80),
	"status" text DEFAULT 'ENVIADA' NOT NULL,
	"proposal_count" integer DEFAULT 0 NOT NULL,
	"conflict_count" integer DEFAULT 0 NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_importacoes_non_negative_counts" CHECK ("evento_importacoes_mapa"."proposal_count" >= 0 AND "evento_importacoes_mapa"."conflict_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "evento_deteccoes_mapa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"detector" varchar(100) NOT NULL,
	"confidence" integer NOT NULL,
	"proposed_row_label" varchar(30),
	"proposed_seat_number" varchar(30),
	"proposed_x" integer,
	"proposed_y" integer,
	"proposed_category" varchar(80),
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"conflict_reason" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evento_deteccoes_confidence_range" CHECK ("evento_deteccoes_mapa"."confidence" >= 0 AND "evento_deteccoes_mapa"."confidence" <= 100)
);
--> statement-breakpoint
CREATE TABLE "evento_politicas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"type" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"effective_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_aceites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"policy_id" uuid NOT NULL,
	"policy_version" integer NOT NULL,
	"accepted_by_name" varchar(200) NOT NULL,
	"accepted_by_email" varchar(320) NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_tokens_consulta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evento_auditorias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid,
	"actor_id" uuid,
	"actor_role" varchar(100),
	"action" text NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" uuid,
	"version" integer,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_default_location_id_evento_locais_id_fk" FOREIGN KEY ("default_location_id") REFERENCES "public"."evento_locais"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_default_map_id_evento_mapas_id_fk" FOREIGN KEY ("default_map_id") REFERENCES "public"."evento_mapas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_locais" ADD CONSTRAINT "evento_locais_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_mapas" ADD CONSTRAINT "evento_mapas_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_mapas" ADD CONSTRAINT "evento_mapas_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_mapa_assentos" ADD CONSTRAINT "evento_mapa_assentos_map_id_evento_mapas_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."evento_mapas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_sessoes" ADD CONSTRAINT "evento_sessoes_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_sessoes" ADD CONSTRAINT "evento_sessoes_location_id_evento_locais_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."evento_locais"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_sessoes" ADD CONSTRAINT "evento_sessoes_map_id_evento_mapas_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."evento_mapas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_inventario_assentos" ADD CONSTRAINT "evento_inventario_assentos_session_id_evento_sessoes_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."evento_sessoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_inventario_assentos" ADD CONSTRAINT "evento_inventario_assentos_seat_id_evento_mapa_assentos_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."evento_mapa_assentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_inventario_assentos" ADD CONSTRAINT "evento_inventario_assentos_reserved_by_order_id_evento_pedidos_id_fk" FOREIGN KEY ("reserved_by_order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_tipos_ingresso" ADD CONSTRAINT "evento_tipos_ingresso_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ofertas" ADD CONSTRAINT "evento_ofertas_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_pedidos" ADD CONSTRAINT "evento_pedidos_session_id_evento_sessoes_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."evento_sessoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens_pedido" ADD CONSTRAINT "evento_itens_pedido_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens_pedido" ADD CONSTRAINT "evento_itens_pedido_inventory_seat_id_evento_inventario_assentos_id_fk" FOREIGN KEY ("inventory_seat_id") REFERENCES "public"."evento_inventario_assentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens_pedido" ADD CONSTRAINT "evento_itens_pedido_ticket_type_id_evento_tipos_ingresso_id_fk" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."evento_tipos_ingresso"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_itens_pedido" ADD CONSTRAINT "evento_itens_pedido_participant_id_evento_participantes_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."evento_participantes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_participantes" ADD CONSTRAINT "evento_participantes_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_participantes" ADD CONSTRAINT "evento_participantes_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_reservas" ADD CONSTRAINT "evento_reservas_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_reservas" ADD CONSTRAINT "evento_reservas_inventory_seat_id_evento_inventario_assentos_id_fk" FOREIGN KEY ("inventory_seat_id") REFERENCES "public"."evento_inventario_assentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_operacoes_administrativas" ADD CONSTRAINT "evento_operacoes_administrativas_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_operacoes_administrativas" ADD CONSTRAINT "evento_operacoes_administrativas_session_id_evento_sessoes_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."evento_sessoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_operacoes_administrativas" ADD CONSTRAINT "evento_operacoes_administrativas_inventory_seat_id_evento_inventario_assentos_id_fk" FOREIGN KEY ("inventory_seat_id") REFERENCES "public"."evento_inventario_assentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_operacoes_administrativas" ADD CONSTRAINT "evento_operacoes_administrativas_participant_id_evento_participantes_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."evento_participantes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_operacoes_administrativas" ADD CONSTRAINT "evento_operacoes_administrativas_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_operacoes_administrativas" ADD CONSTRAINT "evento_operacoes_administrativas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_pagamentos" ADD CONSTRAINT "evento_pagamentos_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_reembolsos" ADD CONSTRAINT "evento_reembolsos_payment_id_evento_pagamentos_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."evento_pagamentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_reembolsos" ADD CONSTRAINT "evento_reembolsos_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_reembolsos" ADD CONSTRAINT "evento_reembolsos_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ADD CONSTRAINT "evento_ingressos_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ADD CONSTRAINT "evento_ingressos_item_id_evento_itens_pedido_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."evento_itens_pedido"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ADD CONSTRAINT "evento_ingressos_session_id_evento_sessoes_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."evento_sessoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ADD CONSTRAINT "evento_ingressos_inventory_seat_id_evento_inventario_assentos_id_fk" FOREIGN KEY ("inventory_seat_id") REFERENCES "public"."evento_inventario_assentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ADD CONSTRAINT "evento_ingressos_participant_id_evento_participantes_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."evento_participantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_ingressos" ADD CONSTRAINT "evento_ingressos_reissued_from_id_evento_ingressos_id_fk" FOREIGN KEY ("reissued_from_id") REFERENCES "public"."evento_ingressos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_checkins" ADD CONSTRAINT "evento_checkins_ticket_id_evento_ingressos_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."evento_ingressos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_checkins" ADD CONSTRAINT "evento_checkins_session_id_evento_sessoes_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."evento_sessoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_checkins" ADD CONSTRAINT "evento_checkins_checked_in_by_users_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_transferencias" ADD CONSTRAINT "evento_transferencias_ticket_id_evento_ingressos_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."evento_ingressos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_transferencias" ADD CONSTRAINT "evento_transferencias_from_participant_id_evento_participantes_id_fk" FOREIGN KEY ("from_participant_id") REFERENCES "public"."evento_participantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_transferencias" ADD CONSTRAINT "evento_transferencias_to_participant_id_evento_participantes_id_fk" FOREIGN KEY ("to_participant_id") REFERENCES "public"."evento_participantes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_transferencias" ADD CONSTRAINT "evento_transferencias_from_seat_id_evento_inventario_assentos_id_fk" FOREIGN KEY ("from_seat_id") REFERENCES "public"."evento_inventario_assentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_transferencias" ADD CONSTRAINT "evento_transferencias_to_seat_id_evento_inventario_assentos_id_fk" FOREIGN KEY ("to_seat_id") REFERENCES "public"."evento_inventario_assentos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_transferencias" ADD CONSTRAINT "evento_transferencias_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_importacoes_mapa" ADD CONSTRAINT "evento_importacoes_mapa_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_importacoes_mapa" ADD CONSTRAINT "evento_importacoes_mapa_map_id_evento_mapas_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."evento_mapas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_importacoes_mapa" ADD CONSTRAINT "evento_importacoes_mapa_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_deteccoes_mapa" ADD CONSTRAINT "evento_deteccoes_mapa_import_id_evento_importacoes_mapa_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."evento_importacoes_mapa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_deteccoes_mapa" ADD CONSTRAINT "evento_deteccoes_mapa_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_politicas" ADD CONSTRAINT "evento_politicas_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_politicas" ADD CONSTRAINT "evento_politicas_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_aceites" ADD CONSTRAINT "evento_aceites_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_aceites" ADD CONSTRAINT "evento_aceites_policy_id_evento_politicas_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."evento_politicas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_tokens_consulta" ADD CONSTRAINT "evento_tokens_consulta_order_id_evento_pedidos_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."evento_pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_auditorias" ADD CONSTRAINT "evento_auditorias_event_id_eventos_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."eventos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_auditorias" ADD CONSTRAINT "evento_auditorias_session_id_evento_sessoes_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."evento_sessoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_auditorias" ADD CONSTRAINT "evento_auditorias_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_eventos_school_slug" ON "eventos" USING btree ("school_id","slug");--> statement-breakpoint
CREATE INDEX "idx_eventos_school_status" ON "eventos" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "idx_eventos_planned_publication" ON "eventos" USING btree ("planned_publication_at");--> statement-breakpoint
CREATE INDEX "idx_evento_locais_school" ON "evento_locais" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_mapas_event_version" ON "evento_mapas" USING btree ("event_id","version");--> statement-breakpoint
CREATE INDEX "idx_evento_mapas_event_status" ON "evento_mapas" USING btree ("event_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_mapa_assentos_map_seat" ON "evento_mapa_assentos" USING btree ("map_id","row_label","seat_number");--> statement-breakpoint
CREATE INDEX "idx_evento_mapa_assentos_map" ON "evento_mapa_assentos" USING btree ("map_id");--> statement-breakpoint
CREATE INDEX "idx_evento_sessoes_event_starts" ON "evento_sessoes" USING btree ("event_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_evento_sessoes_event_status" ON "evento_sessoes" USING btree ("event_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_inventario_session_seat" ON "evento_inventario_assentos" USING btree ("session_id","seat_id");--> statement-breakpoint
CREATE INDEX "idx_evento_inventario_session_status" ON "evento_inventario_assentos" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "idx_evento_inventario_reservation_expiry" ON "evento_inventario_assentos" USING btree ("reservation_expires_at");--> statement-breakpoint
CREATE INDEX "idx_evento_tipos_ingresso_event" ON "evento_tipos_ingresso" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_evento_ofertas_event" ON "evento_ofertas" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_pedidos_order_number" ON "evento_pedidos" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_pedidos_idempotency_key" ON "evento_pedidos" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_evento_pedidos_event_status" ON "evento_pedidos" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "idx_evento_pedidos_buyer_email" ON "evento_pedidos" USING btree ("buyer_email");--> statement-breakpoint
CREATE INDEX "idx_evento_itens_pedido_order" ON "evento_itens_pedido" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_evento_itens_pedido_inventory_seat" ON "evento_itens_pedido" USING btree ("inventory_seat_id");--> statement-breakpoint
CREATE INDEX "idx_evento_participantes_event" ON "evento_participantes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_evento_participantes_order" ON "evento_participantes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_evento_participantes_email" ON "evento_participantes" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_reservas_idempotency" ON "evento_reservas" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_evento_reservas_order" ON "evento_reservas" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_evento_reservas_expiry" ON "evento_reservas" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_evento_reservas_seat" ON "evento_reservas" USING btree ("inventory_seat_id");--> statement-breakpoint
CREATE INDEX "idx_evento_operacoes_session_status" ON "evento_operacoes_administrativas" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "idx_evento_operacoes_event" ON "evento_operacoes_administrativas" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_evento_pagamentos_order" ON "evento_pagamentos" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_pagamentos_stripe_checkout" ON "evento_pagamentos" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_pagamentos_stripe_intent" ON "evento_pagamentos" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "idx_evento_reembolsos_order" ON "evento_reembolsos" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_reembolsos_stripe_refund" ON "evento_reembolsos" USING btree ("stripe_refund_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_ingressos_signed_token" ON "evento_ingressos" USING btree ("signed_token");--> statement-breakpoint
CREATE INDEX "idx_evento_ingressos_order" ON "evento_ingressos" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_evento_ingressos_session" ON "evento_ingressos" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_evento_ingressos_participant" ON "evento_ingressos" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "idx_evento_checkins_ticket" ON "evento_checkins" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_evento_checkins_session_result" ON "evento_checkins" USING btree ("session_id","result");--> statement-breakpoint
CREATE INDEX "idx_evento_transferencias_ticket" ON "evento_transferencias" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_evento_importacoes_event_status" ON "evento_importacoes_mapa" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "idx_evento_deteccoes_import" ON "evento_deteccoes_mapa" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_politicas_event_type_version" ON "evento_politicas" USING btree ("event_id","type","version");--> statement-breakpoint
CREATE INDEX "idx_evento_politicas_event_type" ON "evento_politicas" USING btree ("event_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_aceites_order_type" ON "evento_aceites" USING btree ("order_id","type");--> statement-breakpoint
CREATE INDEX "idx_evento_aceites_order" ON "evento_aceites" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evento_tokens_consulta_hash" ON "evento_tokens_consulta" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_evento_tokens_consulta_order" ON "evento_tokens_consulta" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_evento_tokens_consulta_email" ON "evento_tokens_consulta" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_evento_auditorias_event_created" ON "evento_auditorias" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_evento_auditorias_resource" ON "evento_auditorias" USING btree ("resource_type","resource_id");