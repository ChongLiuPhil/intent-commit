import { createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function ensureParent(filePath) {
  mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
}

export function ensureFederationIdentity({ privateKeyPath, publicKeyPath }) {
  if (!privateKeyPath || !publicKeyPath) throw new Error("Federation key paths are required.");
  ensureParent(privateKeyPath);
  ensureParent(publicKeyPath);

  let privateKey;
  let publicKey;
  if (existsSync(privateKeyPath)) {
    privateKey = createPrivateKey(readFileSync(privateKeyPath, "utf8"));
    publicKey = createPublicKey(privateKey);
  } else {
    const pair = generateKeyPairSync("ed25519");
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
    const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    writeFileSync(privateKeyPath, privatePem, { mode: 0o600 });
  }

  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  writeFileSync(publicKeyPath, publicPem, { mode: 0o644 });
  try { chmodSync(privateKeyPath, 0o600); } catch {}
  try { chmodSync(publicKeyPath, 0o644); } catch {}

  return { privateKey, publicKey, publicKeyPem: publicPem };
}
