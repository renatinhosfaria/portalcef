#!/usr/bin/env node
/**
 * Script de Diagnóstico - Políticas de Compartilhamento do SharePoint
 *
 * Verifica quais restrições impedem o compartilhamento anônimo
 *
 * Uso:
 *   cd services/api
 *   npx ts-node ../../scripts/diagnose-sharepoint-sharing.ts
 */

import { config } from "dotenv";
import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import "isomorphic-fetch";

// Carregar .env.docker (ou .env.local se existir)
config({ path: ".env.docker" });
config({ path: ".env.local" }); // Sobrescreve com .env.local se existir

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const siteId = process.env.SHAREPOINT_SITE_ID;

if (!tenantId || !clientId || !clientSecret || !siteId) {
  console.error("❌ Variáveis de ambiente ausentes:");
  console.error(`   AZURE_TENANT_ID: ${tenantId ? "✓" : "✗"}`);
  console.error(`   AZURE_CLIENT_ID: ${clientId ? "✓" : "✗"}`);
  console.error(`   AZURE_CLIENT_SECRET: ${clientSecret ? "✓" : "✗"}`);
  console.error(`   SHAREPOINT_SITE_ID: ${siteId ? "✓" : "✗"}`);
  process.exit(1);
}

async function main() {
  console.log("🔍 Iniciando diagnóstico de compartilhamento do SharePoint...\n");

  const credential = new ClientSecretCredential(
    tenantId!,
    clientId!,
    clientSecret!,
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  const client = Client.initWithMiddleware({ authProvider });

  try {
    // 1. Verificar informações do site
    console.log("📋 Informações do Site:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const site = await client.api(`/sites/${siteId}`).select("id,displayName,webUrl,sharingCapabilities").get();
    console.log(`   Nome: ${site.displayName}`);
    console.log(`   URL: ${site.webUrl}`);
    console.log(`   ID: ${site.id}`);
    console.log(`   Capacidades de Compartilhamento: ${site.sharingCapabilities}`);
    console.log();

    // 2. Verificar políticas de compartilhamento
    console.log("🔐 Políticas de Compartilhamento do Site:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const siteSettings = await client
        .api(`/sites/${siteId}`)
        .select("sharingCapabilities,isAnonymousLinkSharing")
        .get();

      console.log(`   Compartilhamento Anônimo: ${siteSettings.isAnonymousLinkSharing ? "✓ Habilitado" : "✗ Desabilitado"}`);
    } catch (e) {
      console.log("   ⚠️  Não foi possível ler sharingCapabilities (propriedade pode não existir)");
    }
    console.log();

    // 3. Tentar criar um link de compartilhamento anônimo em um arquivo de teste
    console.log("🧪 Teste de Criação de Link Anônimo:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      const driveId = process.env.SHAREPOINT_DRIVE_ID;
      if (!driveId) {
        console.log("   ⚠️  SHAREPOINT_DRIVE_ID não configurada");
      } else {
        const testFileName = `teste-compartilhamento-${Date.now()}.txt`;

        // Criar arquivo de teste
        console.log(`   Criando arquivo de teste: ${testFileName}`);
        const uploadResponse = await client
          .api(`/sites/${siteId}/drives/${driveId}/root:/${testFileName}:/content`)
          .putStream(Buffer.from("teste"));

        const itemId = uploadResponse.id;
        console.log(`   ✓ Arquivo criado: ${itemId}`);
        console.log();

        // Tentar criar link anônimo
        console.log(`   Tentando criar link anônimo...`);
        try {
          const linkResponse = await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}/createLink`)
            .post({
              type: "edit",
              scope: "anonymous",
              expirationDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            });

          console.log(`   ✓ Link anônimo criado com sucesso!`);
          console.log(`   URL: ${linkResponse.link.webUrl}`);
        } catch (linkError: any) {
          console.log(`   ✗ Erro ao criar link anônimo:`);
          console.log(`     Código: ${linkError.statusCode}`);
          console.log(`     Mensagem: ${linkError.body?.error?.message || linkError.message}`);

          if (linkError.body?.error?.code) {
            console.log(`     Error Code: ${linkError.body.error.code}`);
          }
        }

        // Limpar arquivo de teste
        console.log(`   Removendo arquivo de teste...`);
        try {
          await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`)
            .delete();
          console.log(`   ✓ Arquivo removido`);
        } catch (e) {
          console.log(`   ⚠️  Não foi possível remover arquivo de teste`);
        }
      }
    } catch (testError: any) {
      console.log(`   ✗ Erro no teste:`);
      console.log(`     ${testError.message}`);
    }
    console.log();

    // 4. Recomendações
    console.log("📝 Recomendações:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();
    console.log("Se o teste acima falhou com 'sharingDisabled', siga estes passos:");
    console.log();
    console.log("1️⃣  Acesse o SharePoint Admin Center:");
    console.log(`    https://${tenantId?.split("-")[0]}-admin.sharepoint.com/_layouts/15/online/AdminHome.aspx`);
    console.log();
    console.log("2️⃣  Na lateral esquerda, clique em 'Active sites'");
    console.log();
    console.log("3️⃣  Procure por '${site.displayName}' e clique NO NOME do site (não na checkbox)");
    console.log();
    console.log("4️⃣  No painel que abre, clique na aba 'Policies' ou 'Settings'");
    console.log();
    console.log("5️⃣  Encontre 'Sharing' e mude para:");
    console.log("    • Most permissive (Mais permissivo)");
    console.log("    OU");
    console.log("    • Anyone (Qualquer pessoa)");
    console.log();
    console.log("6️⃣  Salve as mudanças");
    console.log();
    console.log("⏳ IMPORTANTE: Pode levar até 1 hora para as mudanças se propagarem.");
    console.log("   Se não funcionar após 1 hora, teste novamente com este script.");
    console.log();

  } catch (error: any) {
    console.error("❌ Erro durante diagnóstico:");
    console.error(error.message || error);
    if (error.body) {
      console.error("Detalhes:", error.body);
    }
    process.exit(1);
  }
}

main();
