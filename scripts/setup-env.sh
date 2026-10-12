#!/bin/sh
# Creates .env from .env.example with freshly generated secrets, so that
# `make` works on a clean clone. An existing .env is never modified.
set -e

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

if [ -f "$ENV_FILE" ]; then
    echo "[*] $ENV_FILE already exists, keeping it"
    exit 0
fi

if [ ! -f "$EXAMPLE_FILE" ]; then
    echo "[!] $EXAMPLE_FILE not found" >&2
    exit 1
fi

# Random hex string of $1 bytes
rand() {
    openssl rand -hex "$1" 2>/dev/null || od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'
}

# Copy every line of .env.example, replacing the values of the secrets.
while IFS= read -r line || [ -n "$line" ]; do
    key="${line%%=*}"
    case "$key" in
        GF_SECURITY_ADMIN_USER)                   value="admin" ;;
        GF_SECURITY_ADMIN_PASSWORD)               value="$(rand 12)" ;;
        POSTGRES_PASSWORD|REDIS_PASSWORD)         value="$(rand 16)" ;;
        ADMIN_PASSWORD)                           value="Admin$(rand 6)" ;;
        ADMIN_API_KEY|ELASTIC_PASSWORD|KIBANA_PASSWORD) value="$(rand 24)" ;;
        JWT_SECRET|XPACK_ENCRYPTEDSAVEDOBJECTS_ENCRYPTIONKEY) value="$(rand 32)" ;;
        *)                                        echo "$line"; continue ;;
    esac
    echo "$key=$value"
done < "$EXAMPLE_FILE" > "$ENV_FILE"

chmod 600 "$ENV_FILE"

echo "[+] Generated $ENV_FILE with random secrets"
echo "    Website admin login : $(grep '^ADMIN_EMAIL=' "$ENV_FILE" | cut -d= -f2) / $(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
echo "    Grafana login       : $(grep '^GF_SECURITY_ADMIN_USER=' "$ENV_FILE" | cut -d= -f2) / $(grep '^GF_SECURITY_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
