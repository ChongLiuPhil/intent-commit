#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { verifyJsonWithPublicKeyPem } from "./index.js";

const [objectPath, publicKeyPath] = process.argv.slice(2);
if (!objectPath || !publicKeyPath) {
  console.error("Usage: intent-commit-verify <object.json> <public-key.pem>");
  process.exit(2);
}

try {
  const [rawObject, pem] = await Promise.all([readFile(objectPath, "utf8"), readFile(publicKeyPath, "utf8")]);
  const result = verifyJsonWithPublicKeyPem(JSON.parse(rawObject), pem);
  if (result.ok) {
    console.log("VALID");
    process.exit(0);
  }
  console.error(`INVALID: ${result.errors.join("; ")}`);
  process.exit(1);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exit(2);
}
