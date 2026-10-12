#!/bin/bash
set -e

# TLS certificates for nginx (HTTPS) and Vault (internal TLS), signed by a
# local CA whose certificate is copied to vault/certs/ca.pem so the backend
# and vault_init trust it.
#
# - With mkcert installed: certificates are trusted by the browser.
# - Without mkcert: openssl creates a local CA (no sudo needed). The browser
#   shows a warning the first time; accept it or import vault/certs/ca.pem.
#
# Existing certificates are kept. Delete nginx/certs and vault/certs (or run
# `make fclean`) to generate new ones.

if [ -f nginx/certs/nginx.cert ] && [ -f vault/certs/vault.cert ] && [ -f vault/certs/ca.pem ]; then
    echo "[*] Certificates already exist, keeping them"
    exit 0
fi

mkdir -p nginx/certs vault/certs

if command -v mkcert &>/dev/null; then
    # Instalar CA local
    mkcert -install

    # Gerar certs do nginx
    cd nginx/certs
    mkcert localhost 127.0.0.1 ::1
    mv localhost+2.pem nginx.cert
    mv localhost+2-key.pem nginx.key
    chmod 644 nginx.key
    cd ../..

    echo "[+] Certs generated at nginx/certs/"

    # Gerar cert do Vault, para TLS interno (mesma CA local do mkcert)
    cd vault/certs
    mkcert vault localhost 127.0.0.1 ::1
    mv vault+3.pem vault.cert
    mv vault+3-key.pem vault.key
    chmod 644 vault.key
    cd ../..

    # Copiar a CA root do mkcert, para o backend/vault_init confiarem nela
    cp "$(mkcert -CAROOT)/rootCA.pem" vault/certs/ca.pem

    echo "[+] Certs generated at vault/certs/"
    exit 0
fi

if ! command -v openssl &>/dev/null; then
    echo "[!] Neither mkcert nor openssl is installed: cannot create TLS certificates" >&2
    exit 1
fi

echo "[*] mkcert not found, creating a local CA with openssl"

CA_KEY=vault/certs/ca.key
CA_CERT=vault/certs/ca.pem
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
    -keyout "$CA_KEY" -out "$CA_CERT" \
    -subj "/CN=Transcendence Local CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" 2>/dev/null

# sign_cert <output name> <key path> <cert path> <subjectAltName>
sign_cert() {
    openssl req -newkey rsa:2048 -nodes -sha256 \
        -keyout "$2" -out "$TMP_DIR/$1.csr" -subj "/CN=$1" 2>/dev/null
    printf 'subjectAltName=%s\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n' "$4" > "$TMP_DIR/$1.ext"
    openssl x509 -req -sha256 -days 825 -in "$TMP_DIR/$1.csr" \
        -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial -CAserial "$TMP_DIR/ca.srl" \
        -extfile "$TMP_DIR/$1.ext" -out "$3" 2>/dev/null
    chmod 644 "$2"
}

sign_cert localhost nginx/certs/nginx.key nginx/certs/nginx.cert "DNS:localhost,IP:127.0.0.1,IP:::1"
echo "[+] Certs generated at nginx/certs/"

sign_cert vault vault/certs/vault.key vault/certs/vault.cert "DNS:vault,DNS:localhost,IP:127.0.0.1,IP:::1"
echo "[+] Certs generated at vault/certs/"

echo "[i] To remove the browser warning, import $CA_CERT as a trusted authority"
