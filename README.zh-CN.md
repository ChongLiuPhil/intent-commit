# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 不替人发言，而是在私人草稿与公共表达之间提供反思层；只有经过本人明确确认的内容才会成为公共话语。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 可选的公开 Federation

## v0.9：Claims & Argument Structure

v0.9 为已经 federate 的 utterance 加入了**由原作者本人确认的细粒度论证结构**。

一条公开发言现在可以有这样的内部结构：

```text
reason-1 --------supports-------> claim-1
objection-1 -----challenges-----> claim-1
qualification-1 -qualifies------> claim-1
```

节点类型：

- `claim`：说者提出的主张或立场；
- `reason`：说者明确作为支持理由的内容；
- `objection`：说者明确作为反对或挑战的内容；
- `qualification`：对另一节点进行限制、条件化或范围缩小的内容。

内部关系：

- `supports`
- `challenges`
- `qualifies`

最重要的边界是：**AI 生成的 argument structure 只是私人建议，不是公共事实，也不是说者的新承诺。**

完整流程是：

```text
已经 Federate 的 utterance
        ↓
私人 AI structure suggestion
        ↓
原作者检查 / 编辑
        ↓
再次明确确认
        ↓
Signed public argument map
```

如果没有配置 OpenAI API key，demo 模式不会猜测隐藏理由：它只把原始 committed statement 原样放进一个 `claim` 节点，并返回空 edges。

## 最核心的交流协议约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议继续禁止：

```text
DRAFT → COMMITTED
```

Reflective Agent 的核心原则仍然是：

> **Expand without inventing —— 可以展开，但不能擅自替用户创造理由、事实、立场或承诺。**

## 不同层次的公共动作

Intent Commit 现在明确区分：

```text
Room Commit
    ≠
External Adapter Publication
    ≠
Federation Publication
    ≠
Retraction / Revision
    ≠
Provenance Relation
    ≠
Argument-Map Publication
```

扩大受众、改变旧立场、声明自己与另一公开 utterance 的关系、或者公开一条 utterance 的内部论证结构，都必须是新的明确人类动作。

## Federation v1.3

Federation 使用持久化 Ed25519 实例身份。当前实现可以验证 federation `1.0` 到 `1.3` 的对象。

公共对象类型现在包括：

```text
federated-committed-utterance
federated-retraction
federated-revision
federated-provenance-edge
federated-argument-map
```

JSON Schema：

```text
packages/federation/schemas/federated-utterance.schema.json
packages/federation/schemas/federation-relation.schema.json
packages/federation/schemas/provenance-edge.schema.json
packages/federation/schemas/argument-map.schema.json
```

详细说明：

- `docs/federation.md`
- `docs/argument-structure.md`
- `docs/protocol-package.md`

## 三种不同的 Graph 语义

Intent Commit 刻意把三种关系分开。

生命周期：

```text
U1 → RETRACTION(U1)
U1 → REVISION(U1 → U2)
```

不同公开 utterance 之间的 provenance：

```text
U1 --cites------> U2
U1 --supports---> U2
U1 --challenges-> U2
```

一条 utterance 内部的 argument structure：

```text
reason-1 --supports--> claim-1
```

因此，“我后来撤回这句话”“我的这句话支持你的那句话”和“这句话里的 A 是 B 的理由”不会被实现层混成同一种 edge。

## Argument Map 的约束

服务端会独立检查：

- 只有原作者本人可以发布；
- subject 必须已经单独 Federate；
- 必须有 `approved: true`；
- 至少包含一个 `claim`；
- 1–32 个节点，最多 64 条内部 edge；
- node ID 必须唯一；
- edge 必须引用存在且不同的节点；
- `reason` 只能产生 `supports`；
- `objection` 只能产生 `challenges`；
- `qualification` 只能产生 `qualifies`；
- 完全重复的内部 edge 会被拒绝；
- v0.9 中每条 federated utterance 最多一个公开 argument map。

Signed argument map 发布后不可就地修改。如果说者的实质立场发生变化，应当使用已有 revision 机制产生新的 committed / federated utterance，再为新 utterance 建立新的 map。

## Federation API

实例发现：

```text
GET /.well-known/intent-commit
```

公开 graph：

```text
GET /federation/graph
```

公开 utterance 与关系：

```text
GET /federation/utterances/:messageId
GET /federation/utterances/:messageId/relations
```

独立读取 signed object：

```text
GET /federation/events/:eventId
GET /federation/provenance/:edgeId
GET /federation/arguments/:mapId
```

私人 structure suggestion：

```text
POST /api/rooms/:code/arguments/suggest
```

作者确认后的公开 argument map：

```text
POST /api/rooms/:code/federation/arguments
```

请求示例：

```json
{
  "messageId": "message-id",
  "nodes": [
    { "id": "claim-1", "kind": "claim", "text": "..." },
    { "id": "reason-1", "kind": "reason", "text": "..." }
  ],
  "edges": [
    { "source": "reason-1", "target": "claim-1", "predicate": "supports" }
  ],
  "approved": true
}
```

## Reference Client

当前登录用户自己的 federated utterance 会出现：

```text
Structure…
Cite…
Support…
Challenge…
Retract
Revise…
```

`Structure…` 是两阶段流程：

1. 服务器返回一个私人 AI/demo 建议；
2. 用户检查并可以修改 JSON，然后进行独立的公开确认。

真正发布后，消息会显示稳定的 **Argument map · signed** URI，而不是继续把 map 当作可随意编辑的数据。

## 数据与隐私边界

普通 room persistence 保存：账户、密码 hash、session hash、room、membership、role 与 committed statement。

不会作为公共 discourse 保存：raw draft、clarification、Intent Card、尚未确认的 reformulation、私人 AI argument suggestion。

公开 federation artifact 独立保存：

```text
federation_publications  signed utterances
federation_events        signed retractions / revisions
provenance_edges          signed cross-utterance relations
argument_maps             signed intra-utterance structures
```

## 本地运行

需要 Node.js **22.13+**。

```bash
cp .env.example .env
npm start
```

打开：`http://localhost:3000`

可选配置：

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
DATABASE_PATH=./data/intent-commit.sqlite
SESSION_TTL_DAYS=30
COOKIE_SECURE=false
GITHUB_TOKEN=
FEDERATION_ENABLED=false
PUBLIC_BASE_URL=
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

Docker：

```bash
docker compose up --build
```

SQLite 与 federation identity keys 会保存在 `intent_commit_data` volume 中。

## 测试

```bash
npm test
```

测试会先检查 server 与 browser JavaScript 语法，再验证：协议状态迁移、账户/session persistence、room governance、Federation 签名与 tamper detection、retraction/revision、provenance、argument-map validation/signature/uniqueness、demo suggestion 的 non-invention、GitHub adapter 与 external publication audit。

## 当前边界

v0.9 仍然是 **verifiable outbound federation**，还不是完整 federated social network。

目前没有：remote inbox、following、ActivityPub compatibility、inbound federation、跨实例 identity binding、remote delivery replay protection、argument-map correction event、正式 database migrations、rate limiting、password recovery、多进程 realtime fan-out。

## License

MIT
