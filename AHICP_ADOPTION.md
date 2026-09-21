# Current AHICP / Inquiry Publishing Stack Adoption — Intent Commit

Intent Commit adopts current AHICP through a lightweight functional mapping that preserves the project's protocol-first authority model.

## Stack v2 revisions

- AHICP template: `02d0b3c02ca23073c760b6e0f761a468e0235a1c`; project adopted: `ed5a60b1016497472072db108072ace59bcdb65d`
- PPF template: `9a6005de85f032095e36eea03fda317e73126538`; project adopted: `e660b48fb216c28c8faa1f0fe2d0816401e1de2c`
- Vault template: `592c6e2e938f995b7b3e7df07a72f7f1e2c50c5a`; project adopted: `79d64b12275a5cc7c09236b144bf4213fa7afc5e`
- Starter source revision: `05857086e240cbd269eae91af8419ea0921c01fa`

## Functional mapping

| Stack role | Project-native authority |
| --- | --- |
| Stable protocol contract | `docs/spec-v1.0.md` + `packages/protocol/` |
| Interoperability / verifier | `docs/interoperability.md` + `packages/verifier/` |
| Reflective Agent behavior | `docs/agent-spec.md` |
| Federation | `docs/federation.md` + `packages/federation/` |
| Argument structure | `docs/argument-structure.md` |
| Security / trust boundary | `SECURITY.md` + implementation/deployment facts |
| Deployment guidance | `docs/deployment.md` |
| Operational resume | `PROJECT_STATUS.md` |

No duplicate Content Core, Form Core, research Framework Status, Argument Map, or full Working Memory tree is introduced.

## Publication lifecycle

Observed state during adoption:

- source repository: public
- package/workspace version: 1.0.0
- GitHub Releases: none observed
- standalone Web provider: none observed
- GitHub Pages: inactive
- `docs/deployment.md`: deployment instructions only, not evidence of a currently running production provider
- `website.yaml publish=false`: no new standalone Web or future Academic Vault/homepage publication change is authorized by metadata alone
- legacy Academic Vault homepage representation is not revoked by this flag

## Known synchronization defect

`SECURITY.md` currently describes an older MVP state (including no authentication/database), while `docs/deployment.md` and current server behavior describe account/session and SQLite persistence concepts. This Stack adoption does **not** silently choose which security claims should replace the other. The inconsistency remains a maintainer-review item until deliberately reconciled against current implementation and threat assumptions.
