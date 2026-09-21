from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

required = [
    "AHICP_MANIFEST.yaml",
    "AHICP_CONTEXT_INTERFACE.yaml",
    "AHICP_ADOPTION.md",
    "SESSION_CONTEXT_BOOTSTRAP.md",
    "START_HERE.md",
    "START_HERE.zh-CN.md",
    "AGENTS.md",
    "AGENTS.zh-CN.md",
    "PROJECT_STATUS.md",
    "project-stack.yaml",
    "project-stack.lock.yaml",
    "publishing.yaml",
    "project.yaml",
    "website.yaml",
    "README.md",
    "README.zh-CN.md",
    "docs/spec-v1.0.md",
    "docs/agent-spec.md",
    "docs/deployment.md",
    "SECURITY.md",
    "package.json",
    ".github/workflows/ci.yml",
]
errors = []
for rel in required:
    if not (ROOT / rel).exists():
        errors.append(f"missing required file: {rel}")

def read(rel):
    p = ROOT / rel
    return p.read_text(encoding="utf-8") if p.exists() else ""

manifest = read("AHICP_MANIFEST.yaml")
stack = read("project-stack.yaml")
lock = read("project-stack.lock.yaml")
publishing = read("publishing.yaml")
website = read("website.yaml")
status = read("PROJECT_STATUS.md")
spec = read("docs/spec-v1.0.md")
package = read("package.json")

template_pins = {
    "AHICP": "02d0b3c02ca23073c760b6e0f761a468e0235a1c",
    "PPF": "9a6005de85f032095e36eea03fda317e73126538",
    "Vault": "592c6e2e938f995b7b3e7df07a72f7f1e2c50c5a",
    "Starter": "05857086e240cbd269eae91af8419ea0921c01fa",
}
adopted_pins = {
    "AHICP": "ed5a60b1016497472072db108072ace59bcdb65d",
    "PPF": "e660b48fb216c28c8faa1f0fe2d0816401e1de2c",
    "Vault": "79d64b12275a5cc7c09236b144bf4213fa7afc5e",
}
for label, sha in template_pins.items():
    if sha not in stack or sha not in lock:
        errors.append(f"{label} template/lock pin mismatch: {sha}")
for label, sha in adopted_pins.items():
    if sha not in stack:
        errors.append(f"{label} semantic adopted pin missing: {sha}")
if template_pins["AHICP"] not in manifest:
    errors.append("AHICP template pin missing from manifest")
if adopted_pins["AHICP"] not in manifest:
    errors.append("AHICP adopted pin missing from manifest")

for marker in (
    "profile: project-native-protocol-governance",
    "adoption_mode: functional-map-protocol-agent-federation-security",
    "profile: public-source-no-standalone-provider",
):
    if marker not in stack:
        errors.append(f"Stack functional mapping drift: {marker}")

for marker in (
    "repository_source:",
    "authorization_state: existing-public-source",
    "enabled: false",
    "authorization_state: not-authorized",
    "provider: null",
    "status: no-observed-production-provider",
    "guide_is_actual_state: false",
    'current_package_version: "1.0.0"',
    "github_release_observed: false",
    "require_explicit_release: true",
    "repository_visibility_is_release_authorization: false",
):
    if marker not in publishing:
        errors.append(f"PPF lifecycle boundary drift: {marker}")

if "publish: false" not in website:
    errors.append("website.yaml must remain publish=false")
if '"version": "1.0.0"' not in package:
    errors.append("package/workspace version drift from audited 1.0.0 state")

for marker in (
    "Status: **Stable**",
    "DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED",
    "DRAFT → COMMITTED",
    "Each public act requires its own explicit authorization",
):
    if marker not in spec:
        errors.append(f"Protocol 1.0 invariant missing: {marker}")

if "SECURITY-DOCUMENTATION-DRIFT" not in status:
    errors.append("known security-documentation drift must remain explicit until reviewed")
if "no authentication/database" not in status and "no authentication/database" not in read("AHICP_ADOPTION.md"):
    errors.append("security documentation mismatch is no longer described precisely enough for handoff")

for unexpected in (
    "_quarto.yml",
    "wrangler.jsonc",
    "cloudflare-builds.yaml",
    ".github/workflows/pages.yml",
):
    if (ROOT / unexpected).exists():
        errors.append(f"unexpected Web deployment toolchain under no-provider state: {unexpected}")

if errors:
    print("Intent Commit Stack validation FAILED")
    for err in errors:
        print(f"- {err}")
    sys.exit(1)

print("Intent Commit Stack validation PASSED")
print("Protocol 1.0 authority preserved; public source remains distinct from standalone Web deployment; security-documentation drift remains explicit.")
