# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 不替人发言，而是在私人草稿与公共表达之间提供一个反思层：帮助说者展开、检查、澄清自己的意思，只有经过本人明确确认的版本才会真正进入公共交流。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 公共交流

## v0.8：签名 Provenance / Citation Graph

v0.8 开始把已经 federate 的公开 utterance 组织成一个**可验证的论证关系图**，但不让 AI 自动替说者判断“这句话支持什么、反驳什么”。

一个已经公开的 utterance 可以由其原作者主动声明：

```text
U1 --cites------> U2
U1 --supports---> U2
U1 --challenges-> U2
```

这些边本身也是新的、带 Ed25519 签名的公开 federation object。

核心约束：

- 只有 **source utterance 的原作者** 可以创建这条边；
- Owner、Moderator、target author 或 AI 都不能替 source author 声称这个关系；
- source 和 target 都必须已经分别完成 Federation Publication；
- 因而创建 graph edge 不会偷偷把 room-only 或私人内容公开出去；
- source 与 target 不能是同一条 utterance；
- 第一版只允许 `cites / supports / challenges` 三种 predicate；
- 相同 `(source, target, predicate)` 不允许重复发布；
- 可选 note 是公开内容，也会进入签名；
- 修改已签名 edge 会导致验签失败；
- Federation 1.2 仍兼容验证之前 1.0 / 1.1 的公开 artifact。

## 两类不同的关系

Intent Commit 现在区分：

### 1. Lifecycle relation

```text
U1 → RETRACTION(U1)
U1 → REVISION(U1 → U2)
```

它回答的是：**作者后来如何重新定位自己过去的公开承诺？**

### 2. Provenance / argumentative relation

```text
U1 --cites/supports/challenges--> U2
```

它回答的是：**source utterance 的作者公开把自己的这句话放在另一条公开 utterance 的什么关系中？**

两种 relation 都不会修改原来的 signed utterance。

## 核心交流协议约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议继续禁止：

```text
DRAFT → COMMITTED
```

Reflective Agent 的核心原则仍然是：

> **Expand without inventing —— 可以展开，但不能擅自替用户创造理由、事实、立场或承诺。**

## 不同层次的公开授权

```text
Room Commit
    ≠
External Adapter Publication
    ≠
Federation Publication
    ≠
Federation Retraction / Revision
    ≠
Provenance Assertion
```

扩大受众、修改自己对过去发言的立场、或公开声明论证关系，都需要新的明确人类动作。

## Protocol / Federation Package

基础协议：

```text
packages/protocol/
```

Federation 签名与验证：

```text
packages/federation/
```

JSON Schema：

```text
packages/federation/schemas/federated-utterance.schema.json
packages/federation/schemas/federation-relation.schema.json
packages/federation/schemas/provenance-edge.schema.json
```

详细说明：

- `docs/protocol-package.md`
- `docs/federation.md`
- `docs/provenance.md`

## Federation v1.2 公共 API

实例发现：

```text
GET /.well-known/intent-commit
```

公开签名 utterance：

```text
GET /federation/utterances/:messageId
```

查看 lifecycle + provenance relation：

```text
GET /federation/utterances/:messageId/relations
```

读取 signed retraction / revision event：

```text
GET /federation/events/:eventId
```

读取 signed provenance edge：

```text
GET /federation/provenance/:edgeId
```

读取当前实例全部公开 graph：

```text
GET /federation/graph
```

## 创建 Provenance Edge

作者在已登录状态下使用：

```text
POST /api/rooms/:code/federation/provenance
```

请求示例：

```json
{
  "sourceMessageId": "source-message-id",
  "targetMessageId": "target-message-id",
  "predicate": "challenges",
  "note": "这条发言质疑 target 中使用的一个前提。",
  "approved": true
}
```

服务端会重新检查：

```text
source 已 Federate
+
target 已 Federate
+
当前用户 = source 原作者
+
approved = true
```

Reference Client 中，符合条件的本人 federated message 会出现：

```text
Cite…
Support…
Challenge…
```

## 为什么不让 AI 自动生成这些边

AI 可以帮助用户理解可能存在的理由或关联，但 `supports` 或 `challenges` 本身是一种新的公共立场。

如果系统自动生成：

```text
U1 supports U2
```

这就不仅是在“分析”用户的话，而是在替用户新增一个可归责的公共承诺。

因此 v0.8 把 graph edge 当成新的 human-authorized speech act，而不是模型推断结果。

## Federation 配置

Federation 默认关闭：

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

生产环境应使用 HTTPS 和稳定的 `PUBLIC_BASE_URL`。私钥代表部署实例的长期 federation identity，应当备份并妥善保护。

## GitHub Issues Adapter

GitHub adapter 继续保留：

```text
packages/adapters-github/
```

服务端配置：

```env
GITHUB_TOKEN=...
```

发布接口：

```text
POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish
```

## 数据与隐私边界

普通 room persistence 保存：账户、密码 hash、session hash、room、membership、role 与 committed statement。

不会作为 room discourse 保存：raw draft、clarification、Intent Card、尚未确认的 proposed statement。

公开 federation artifact 分开保存：

```text
federation_publications  已签名公开 utterance
federation_events        已签名 retraction / revision
provenance_edges          已签名 cites / supports / challenges edge
```

创建 provenance edge 不会让任何用户获得别人私人 Reflective Workspace 的访问权。

## 本地运行

需要 Node.js **22.13+**。

```bash
cp .env.example .env
npm start
```

Docker：

```bash
docker compose up --build
```

## 测试

```bash
npm test
```

测试包括：协议状态迁移、Federation 签名与 tamper detection、retraction / revision、provenance edge 签名、self-edge 禁止、graph incoming/outgoing index、重复 edge 拒绝、账户/session、room governance、SQLite persistence 与 GitHub adapter。

## 当前边界

v0.8 仍然只支持**同一 Intent Commit 实例内部**的 provenance target。服务器不会主动抓取任意远程 URL，也还没有 remote inbox、following、ActivityPub compatibility、跨实例 identity binding、remote delivery replay protection、正式 database migration、rate limiting、password recovery 或多进程 realtime fan-out。

## License

MIT
