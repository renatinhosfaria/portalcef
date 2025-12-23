# Scripts de Deploy

Scripts para configuração e deploy do Portal Digital no VPS Contabo.

## Scripts Disponíveis

| Script            | Descrição                            |
| ----------------- | ------------------------------------ |
| `setup-vps.sh`    | Configuração inicial completa do VPS |
| `deploy.sh`       | Deploy/atualização manual            |
| `migrate.sh`      | Execução de migrações de banco       |
| `health-check.sh` | Verificação de saúde dos serviços    |

## Uso

### 1. Setup Inicial (uma vez)

```bash
# No seu computador local
scp scripts/setup-vps.sh root@SEU_IP:/root/

# No VPS via SSH
ssh root@SEU_IP
chmod +x setup-vps.sh
./setup-vps.sh
```

### 2. Deploy Manual

```bash
# No VPS
cd /opt/essencia
./deploy.sh
```

### 3. Health Check

```bash
# No VPS
./health-check.sh
```

## GitHub Secrets Necessários

Configure em **Settings → Secrets → Actions**:

- `VPS_HOST` - IP do servidor
- `VPS_USER` - Usuário SSH (geralmente `root`)
- `VPS_SSH_KEY` - Chave SSH privada
- `POSTGRES_PASSWORD` - Senha do banco

## Deploy Automático

Após configurar os secrets, qualquer push para `main` dispara o deploy automático.
