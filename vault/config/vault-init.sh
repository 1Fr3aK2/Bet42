#!/bin/sh
set -e

KEYS_FILE="/vault/keys/init.json"
APPROLE_DIR="/vault/approle"

# 1. Initialize Vault — only runs once, the first time the container starts.
#    On later runs the keys file already exists and this step is skipped.
if [ ! -f "$KEYS_FILE" ]; then
  echo "[*] Vault ainda não inicializado — a correr vault operator init"
  vault operator init -key-shares=5 -key-threshold=3 -format=json > "$KEYS_FILE"
  chmod 600 "$KEYS_FILE"
else
  echo "[*] Ficheiro de chaves já existe, a saltar vault operator init"
fi

# Extract the root token without jq (grep/cut, already available in Alpine)
ROOT_TOKEN=$(grep -Eo '"root_token": *"[^"]*"' "$KEYS_FILE" | cut -d'"' -f4)
export VAULT_TOKEN="$ROOT_TOKEN"

# 2. Unseal Vault if it is sealed (happens on every Vault container restart)
SEALED=$(vault status -format=json | grep -Eo '"sealed": *(true|false)' | grep -Eo 'true|false')
if [ "$SEALED" = "true" ]; then
  echo "[*] Vault selado — a destrancar com 3 das 5 chaves"
  # Extract the base64 strings inside the unseal_keys_b64 block (no jq)
  UNSEAL_KEYS=$(sed -n '/"unseal_keys_b64"/,/\]/p' "$KEYS_FILE" | grep -Eo '"[A-Za-z0-9+/=]+"' | tr -d '"')
  i=0
  for KEY in $UNSEAL_KEYS; do
    i=$((i + 1))
    vault operator unseal "$KEY"
    [ "$i" -ge 3 ] && break
  done
else
  echo "[*] Vault já estava destrancado"
fi

# 2b. Já configurado num arranque anterior: no fim desse arranque o root token
#     foi revogado (passo 10), por isso já não pode escrever secrets. Secrets,
#     policy e AppRole estão no storage persistente do Vault e o role_id /
#     secret_id do backend continuam no volume partilhado: basta destrancar
#     (passo 2) e terminar com sucesso. Sem isto, um segundo `make` / `up`
#     falhava aqui em loop e o backend nunca arrancava.
if [ -s "$APPROLE_DIR/role_id" ] && [ -s "$APPROLE_DIR/secret_id" ] && ! vault token lookup >/dev/null 2>&1; then
  echo "[*] Vault já configurado num arranque anterior (root token revogado) — nada mais a fazer"
  exit 0
fi

# 3. Ativar o motor de secrets KV v2 em "secret/" — em dev-mode isto é automático,
#    fora de dev-mode tem de ser feito explicitamente (idempotente: ignora erro se já existir)
vault secrets enable -path=secret -version=2 kv 2>/dev/null || true

# 4. Store secrets (idempotent — vault kv put overwrites without failing)
vault kv put secret/postgres user="${POSTGRES_USER}" password="${POSTGRES_PASSWORD}"
vault kv put secret/redis password="${REDIS_PASSWORD}"
vault kv put secret/admin-api key="${ADMIN_API_KEY}"
vault kv put secret/admin-account username="${ADMIN_USERNAME}" email="${ADMIN_EMAIL}" password="${ADMIN_PASSWORD}"
vault kv put secret/jwt secret="${JWT_SECRET}"

# 5. Load the policy
vault policy write backend-policy /etc/vault/config/backend-policy.hcl

# 6. Enable AppRole (idempotent — does not fail if already enabled)
vault auth enable approle || true

# 7. Create the role with explicit TTLs (secret_id_ttl=0 means the SecretID never expires)
vault write auth/approle/role/backend-role \
  token_policies="backend-policy" \
  token_ttl=1h \
  token_max_ttl=4h \
  secret_id_ttl=0

# 8. Get the RoleID (static) and expose it to the backend via the shared volume
mkdir -p "$APPROLE_DIR"
vault read -field=role_id auth/approle/role/backend-role/role-id > "$APPROLE_DIR/role_id"

# 9. Generate the SecretID (sensitive) and expose it the same way
vault write -f -field=secret_id auth/approle/role/backend-role/secret-id > "$APPROLE_DIR/secret_id"

chmod 600 "$APPROLE_DIR/role_id" "$APPROLE_DIR/secret_id"
echo "[*] role_id e secret_id gravados em $APPROLE_DIR"

# 10. Revoke the root token — it is no longer needed after bootstrap.
#     On re-runs, step 2.5 exits before reaching this point.
echo "[*] Revoking the root token..."
vault token revoke "$ROOT_TOKEN" \
  && echo "[*] Root token successfully revoked" \
  || echo "[!] Warning: root token was not revoked (might have already expired or been revoked)"