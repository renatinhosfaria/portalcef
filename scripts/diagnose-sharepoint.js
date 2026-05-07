#!/usr/bin/env node
/**
 * Script de Diagnóstico - Políticas de Compartilhamento do SharePoint
 *
 * Verifica quais restrições impedem o compartilhamento anônimo
 *
 * Uso:
 *   node scripts/diagnose-sharepoint.js
 *   ou
 *   chmod +x scripts/diagnose-sharepoint.js && ./scripts/diagnose-sharepoint.js
 */

const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};

  content.split('\n').forEach(line => {
    // Pular comentários e linhas vazias
    if (!line.trim() || line.trim().startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      // Remover aspas
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key] = value;
    }
  });

  return env;
}

// Carregar .env.docker
const envFile = path.join(__dirname, '..', '.env.docker');
const env = loadEnv(envFile);

Object.assign(process.env, env);

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const siteId = process.env.SHAREPOINT_SITE_ID;

if (!tenantId || !clientId || !clientSecret || !siteId) {
  console.error('❌ Variáveis de ambiente ausentes:');
  console.error(`   AZURE_TENANT_ID: ${tenantId ? '✓' : '✗'}`);
  console.error(`   AZURE_CLIENT_ID: ${clientId ? '✓' : '✗'}`);
  console.error(`   AZURE_CLIENT_SECRET: ${clientSecret ? '✓' : '✗'}`);
  console.error(`   SHAREPOINT_SITE_ID: ${siteId ? '✓' : '✗'}`);
  process.exit(1);
}

// Importar dependências
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

require('isomorphic-fetch');

async function main() {
  console.log('🔍 Iniciando diagnóstico de compartilhamento do SharePoint...\n');

  const credential = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret,
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  const client = Client.initWithMiddleware({ authProvider });

  try {
    // 1. Verificar informações do site
    console.log('📋 Informações do Site:');
    console.log('━'.repeat(60));

    const site = await client.api(`/sites/${siteId}`)
      .select('id,displayName,webUrl,sharingCapabilities')
      .get();

    console.log(`   Nome: ${site.displayName}`);
    console.log(`   URL: ${site.webUrl}`);
    console.log(`   ID: ${site.id}`);
    console.log(`   Capacidades: ${site.sharingCapabilities}`);
    console.log();

    // 2. Teste de compartilhamento
    console.log('🧪 Teste de Criação de Link Anônimo:');
    console.log('━'.repeat(60));

    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    if (!driveId) {
      console.log('   ⚠️  SHAREPOINT_DRIVE_ID não configurada');
    } else {
      const testFileName = `teste-${Date.now()}.txt`;

      try {
        // Criar arquivo de teste
        console.log(`   Criando arquivo: ${testFileName}`);
        const uploadResponse = await client
          .api(`/sites/${siteId}/drives/${driveId}/root:/${testFileName}:/content`)
          .putStream(Buffer.from('teste'));

        const itemId = uploadResponse.id;
        console.log(`   ✓ Arquivo criado: ${itemId}`);
        console.log();

        // Tentar criar link anônimo
        console.log(`   Tentando criar link anônimo...`);
        try {
          const linkResponse = await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}/createLink`)
            .post({
              type: 'edit',
              scope: 'anonymous',
              expirationDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            });

          console.log(`   ✓ ✅ Link anônimo criado com sucesso!`);
          console.log(`   URL: ${linkResponse.link.webUrl}`);
          console.log();
          console.log('   🎉 Compartilhamento anônimo ESTÁ FUNCIONANDO!');
          console.log('   O erro 403 que você viu antes pode ter sido corrigido.');

        } catch (linkError) {
          console.log(`   ✗ Erro ao criar link anônimo:`);
          const errorMsg = linkError.body?.error?.message || linkError.message;
          const errorCode = linkError.body?.error?.code || linkError.statusCode;

          console.log(`     Código: ${errorCode}`);
          console.log(`     Mensagem: ${errorMsg}`);
          console.log();

          if (errorMsg && errorMsg.toLowerCase().includes('sharing')) {
            console.log('   ⚠️  O problema é uma política de compartilhamento do SharePoint');
          }
        }

        // Limpar
        console.log(`   Removendo arquivo de teste...`);
        try {
          await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${itemId}`)
            .delete();
          console.log(`   ✓ Arquivo removido`);
        } catch (e) {
          console.log(`   ⚠️  Não foi possível remover arquivo`);
        }

      } catch (testError) {
        console.log(`   ✗ Erro: ${testError.message}`);
      }
    }

    console.log();
    console.log('📝 Próximos passos:');
    console.log('━'.repeat(60));
    console.log();

    if (driveId) {
      console.log('✓ Credenciais de Graph API estão corretas');
      console.log('✓ Acesso ao SharePoint foi bem-sucedido');
      console.log();
      console.log('Se o teste acima falhou com "sharing", siga:');
      console.log();
      console.log('1️⃣  Acesse o Admin Center:');
      console.log(`    https://${tenantId.split('-')[0]}-admin.sharepoint.com`);
      console.log();
      console.log('2️⃣  Clique em "Active sites" (na lateral)');
      console.log();
      console.log(`3️⃣  Clique em "${site.displayName}" (nome do site)`);
      console.log();
      console.log('4️⃣  Clique em "Policies" ou "Configurações"');
      console.log();
      console.log('5️⃣  Em "Sharing", selecione:');
      console.log('    → "Most permissive" OU "Anyone"');
      console.log();
      console.log('6️⃣  Salve e aguarde 1 hora para propagar');
      console.log();
      console.log('⏳ Após 1 hora, execute novamente:');
      console.log('   node scripts/diagnose-sharepoint.js');
    }

  } catch (error) {
    console.error('❌ Erro durante diagnóstico:');
    console.error(error.message || error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
