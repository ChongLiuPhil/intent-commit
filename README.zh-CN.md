# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 可以帮助用户检查、展开和澄清意义，但只有用户本人明确确认，内容才成为公共 commitment。

## v1.0：协议稳定化

v1.0 不再继续堆叠社交功能，而是冻结核心互操作契约：

- Intent Commit Protocol `1.0`；
- `@intent-commit/protocol` 包升级为 `1.0.0`；
- 确定性 canonical JSON：`IC-C14N/1`；
- 固定的跨语言 test vector；
- 不依赖服务器的独立 verifier；
- 继续兼容验证 Federation `1.0–1.3`；
- 正式的协议稳定性规则。

规范见 `docs/spec-v1.0.md`，互操作说明见 `docs/interoperability.md`。

## 核心约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议禁止 `DRAFT → COMMITTED`。Reflective Agent 继续遵守 **Expand without inventing**：AI 可以暴露缺失理由、歧义与不确定性，但不能偷偷替用户创造事实、立场或承诺。

## Canonicalization 与独立验签

v1.0 把签名输入的字节定义从“某个 JavaScript 实现细节”提升为正式协议：

```text
协议对象 → IC-C14N/1 → UTF-8 bytes → Ed25519 verify
```

独立验证：

```bash
npm run verify -- object.json public-key.pem
```

冻结测试向量：`test-vectors/v1.0.json`。

因此未来 Python、Rust、Go 等实现不需要运行我们的 Node 服务器，只要实现同一 canonicalization 和对象语义，并通过测试向量，就能与 Intent Commit 互操作。

## 不同授权仍然分离

```text
Room Commit
External Publication
Federation Publication
Retraction / Revision
Provenance Relation
Argument-Map Publication
```

前一个授权不会自动推出后一个授权。

## Packages

```text
packages/protocol/        稳定的 Protocol 1.0 + IC-C14N/1
packages/federation/      Federation 1.0–1.3 Ed25519 对象
packages/verifier/        独立 verifier
packages/adapters-github/ GitHub Issues adapter
```

## 开发

需要 Node.js 22.13+：

```bash
npm test
```

测试覆盖协议状态、持久化、治理、Federation 签名、撤回/修订、provenance、argument map，以及 v1.0 互操作测试向量。

## 当前边界

v1.0 稳定的是协议和 outbound verification，而不是完整 federated social network。Inbound federation、remote delivery、跨实例身份绑定、replay protection、正式数据库迁移、rate limiting、密码恢复和多进程 realtime fan-out 仍属于后续版本。

## License

MIT
