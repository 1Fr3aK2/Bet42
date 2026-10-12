import { readFileSync } from 'fs';

const APPROLE_DIR = '/vault/approle';

interface VaultKvResponse {
  data: { data: Record<string, string> };
}


const RETRY_DELAY_MS = 5000;

// Vault is sealed again after every restart of its container (e.g. after a
// reboot) until vault_init unseals it. Instead of crashing, wait and retry,
// so the backend recovers by itself as soon as `make` has unsealed Vault.
export async function loadSecretsFromVault(
  maxAttempts = Number.POSITIVE_INFINITY,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await loadSecretsOnce();
      if (attempt > 1) console.log('[vault] secrets loaded');
      return;
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      console.warn(
        `[vault] not ready (${error.message.split('\n')[0]}), retrying in ${RETRY_DELAY_MS / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

async function loadSecretsOnce(): Promise<void> {
  const vaultAddr = process.env.VAULT_ADDR; // ex: https://vault:8200

  if (!vaultAddr) {
    throw new Error('VAULT_ADDR not defined');
  }

  const roleId = readFileSync(`${APPROLE_DIR}/role_id`, 'utf-8').trim();
  const secretId = readFileSync(`${APPROLE_DIR}/secret_id`, 'utf-8').trim();

  const loginRes = await fetch(`${vaultAddr}/v1/auth/approle/login`, {
    method: 'POST',
    body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
  });

  if (!loginRes.ok) {
    throw new Error(
      `Error logging AppRole to Vault: ${loginRes.status} ${await loginRes.text()}`,
    );
  }

  const loginBody = await loginRes.json();
  const clientToken = loginBody.auth.client_token;

  const adminApiData = await readVaultSecret(vaultAddr, clientToken, 'admin-api');
  const adminApiKey = adminApiData.key;
  if (!adminApiKey) {
    throw new Error('secret/admin-api does not have "key" defined');
  }
  process.env.ADMIN_API_KEY = adminApiKey;

  const adminAccountData = await readVaultSecret(vaultAddr, clientToken, 'admin-account');
  const { username, email, password } = adminAccountData;
  if (!username || !email || !password) {
    throw new Error(
      'secret/admin-account needs the fields "username", "email" and "password" defined',
    );
  }
  process.env.ADMIN_USERNAME = username;
  process.env.ADMIN_EMAIL = email;
  process.env.ADMIN_PASSWORD = password;

  const jwtData = await readVaultSecret(vaultAddr, clientToken, 'jwt');
  const jwtSecret = jwtData.secret;
  if (!jwtSecret) {
    throw new Error('secret/jwt does not have "secret" field defined');
  }
  process.env.JWT_SECRET = jwtSecret;
}

async function readVaultSecret(
  vaultAddr: string,
  clientToken: string,
  path: string,
): Promise<Record<string, string>> {
  const res = await fetch(`${vaultAddr}/v1/secret/data/${path}`, {
    headers: { 'X-Vault-Token': clientToken },
  });

  if (!res.ok) {
    throw new Error(
      `Error reading secret/${path} from Vault: ${res.status} ${await res.text()}`,
    );
  }

  const body = (await res.json()) as VaultKvResponse;
  return body.data.data;
}