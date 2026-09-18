# Intent Commit

[English](README.md) | [中文](README.zh-CN.md)

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 可以帮助用户检查和澄清意义，但只有用户本人明确批准，内容才会成为正式的公共表达。

> 私人草稿 → 反思 → 澄清 → 批准 → Commit → 可选的公开发布

## v1.0：协议稳定化

v1.0 不再继续增加新的社交功能，而是冻结核心互操作契约。

稳定协议现在包括：

- 带有人类批准状态不变量的 Protocol `1.0`；
- `@intent-commit/protocol` 版本 `1.0.0`；
- 确定性的 canonical JSON：`IC-C14N/1`；
- 冻结的跨实现测试向量；
- 不依赖 Intent Commit 服务器的独立验证器；
- Federation 1.0–1.3 验证兼容性；
- 面向未来协议变更的书面稳定性政策。

规范见 `docs/spec-v1.0.md`，互操作说明见 `docs/interoperability.md`。

## 核心不变量

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议拒绝直接的 `DRAFT → COMMITTED` 转换。反思式 Agent 遵循 **Expand without inventing**：缺失的理由或承诺应被显式呈现为不确定性或问题，而不能由 AI 悄然替用户写入。

## 独立验证

Canonicalization 已成为协议的一部分，而不再只是某个实现的内部细节：

```text
object → IC-C14N/1 → UTF-8 bytes → Ed25519 verify
```

运行独立验证器：

```bash
npm run verify -- object.json public-key.pem
```

冻结的一致性测试向量位于 `test-vectors/v1.0.json`。

## 公共对象层

Intent Commit 明确区分不同的行为：

```text
Room Commit
External Publication
Federation Publication
Retraction / Revision
Provenance Relation
Argument-Map Publication
```

一种授权绝不会静默授予另一种授权。

Federation 1.3 对象族继续保持为：

```text
federated-committed-utterance
federated-retraction
federated-revision
federated-provenance-edge
federated-argument-map
```

## Packages

```text
packages/protocol/        稳定的 Protocol 1.0 基础组件 + IC-C14N/1
packages/federation/      Ed25519 Federation 1.0–1.3 基础组件
packages/verifier/        独立对象验证器
packages/adapters-github/ GitHub Issues 出站适配器
```

## 本地运行

需要 Node.js 22.13+。

```bash
cp .env.example .env
npm start
```

可选的 AI 反思功能使用 `OPENAI_API_KEY`。Federation 仍为可选功能，并要求稳定的 `PUBLIC_BASE_URL` 与持久 Ed25519 身份。

## 开发

```bash
npm test
```

测试覆盖服务器／浏览器／验证器语法、协议状态转换、持久化、治理、Federation 签名、生命周期关系、provenance、argument map、不虚构行为，以及 v1.0 互操作测试向量。

## 规范

- `docs/spec-v1.0.md` — 规范性的 Protocol 1.0 契约
- `docs/interoperability.md` — 验证器与不同语言实现的指导
- `docs/federation.md` — Federation 1.3
- `docs/argument-structure.md` — 经作者批准的主张结构

## 当前范围

v1.0 稳定的是协议与 outbound verification 模型，而不是一个完整的联邦社交网络。Inbound federation、remote delivery、跨实例身份绑定、replay protection、正式迁移、rate limiting、密码恢复与多进程 realtime fan-out 仍属于未来工作。

## License

MIT
