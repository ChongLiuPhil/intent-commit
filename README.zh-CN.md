# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 不替人发言，而是在私人草稿与公共表达之间提供一个反思层：帮助说者展开、检查、澄清自己的意思，只有经过本人明确确认的版本才会真正进入公共交流。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 公共交流

## v0.7：签名撤回与修订

v0.7 解决的是一个更接近项目核心的问题：**一个人已经公开承诺过一句话，后来改变了立场，系统应当如何表示这种变化？**

Intent Commit 不会偷偷修改旧记录。已经 federate 的 utterance 仍然保持为不可变、可验签的历史对象。原作者之后可以再发布一个新的签名关系事件：

```text
Federated utterance U1
        ↓
        ├── RETRACTION(U1)
        └── REVISION(U1 → U2)
```

其中 `U2` 不能由 revision 操作直接生成。它必须先独立经过：

```text
私人草稿
  ↓
Reflect
  ↓
本人确认
  ↓
COMMITTED
  ↓
再次同意 Federation Publication
  ↓
新的签名 utterance U2
```

然后才能建立 `U1 → U2` 的 signed revision relation。

## 核心约束

- 只有原作者本人可以撤回或修订自己的 federated utterance；
- Owner / Moderator 不能替别人完成撤回或修订；
- 原来的 signed utterance 永远不会被就地修改；
- 一条 utterance 最多只有一个直接的 retraction 或 revision relation；
- revision 不能指向自己；
- revision 不能指向已经被 retract 的 replacement；
- revision chain 不能形成循环；
- retraction / revision event 本身也使用实例 Ed25519 身份签名；
- Federation v1.1 仍然兼容验证 v0.6 产生的 federation v1.0 utterance。

## 最重要的交流协议约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议继续禁止：

```text
DRAFT → COMMITTED
```

Reflective Agent 的核心原则仍然是：

> **Expand without inventing —— 可以展开，但不能擅自替用户创造理由、事实、立场或承诺。**

## 不同层次的 Commitment

Intent Commit 现在明确区分：

```text
Room Commit
    ≠
External Adapter Publication
    ≠
Federation Publication
    ≠
Federation Retraction / Revision
```

每一次扩大受众，或者改变已经公开的承诺，都必须是新的、明确的人类动作。

## Protocol 与 Federation Package

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
```

详细说明：

- `docs/protocol-package.md`
- `docs/federation.md`

## Federation v1.1 API

实例发现：

```text
GET /.well-known/intent-commit
```

公开签名 utterance：

```text
GET /federation/utterances/:messageId
```

查看某条 utterance 后续是否有 retraction / revision：

```text
GET /federation/utterances/:messageId/relations
```

读取某个公开签名关系事件：

```text
GET /federation/events/:eventId
```

查看当前 room 的 federation 状态：

```text
GET /api/rooms/:code/federation
```

发布一条 committed message 到 federation：

```text
POST /api/rooms/:code/federation/publish
```

撤回：

```text
POST /api/rooms/:code/federation/retract
```

请求示例：

```json
{
  "messageId": "old-message-id",
  "approved": true,
  "reason": "可选的公开撤回理由"
}
```

修订：

```text
POST /api/rooms/:code/federation/revise
```

请求示例：

```json
{
  "messageId": "old-message-id",
  "replacementMessageId": "new-message-id",
  "approved": true,
  "reason": "可选的公开修订理由"
}
```

Reference client 现在会区分 **Federated / Retracted / Revised**。当前登录用户自己的 federated message，如果还没有直接 relation，会出现 `Retract` 与 `Revise…` 操作。

## 为什么不是直接“编辑旧消息”

如果一个公开发言已经被别人引用、保存、验证，那么后来把服务器上的旧文本偷偷替换掉，会破坏可验证性，也会混淆历史责任。

因此 v0.7 采用：

```text
U1 保持原样
+
新的签名关系事件
```

而不是：

```text
偷偷把 U1 改写成 U2
```

在这个模型里，撤回表示：

> 我承认我曾公开说过 U1，但我现在公开声明不再认可它。

修订表示：

> 我承认 U1 是之前的公开表达，但现在请以我后来独立确认并公开的 U2 作为新的表述。

## Revision Chain

合法的线性历史可以是：

```text
U1 → U2 → U3
```

每一步都对应一个新的 signed revision event。

系统拒绝：

```text
U1 → U2 → U1
```

因为这会形成循环，使“当前版本”无法确定。

同样，一条 utterance 不能同时出现两个直接后继：

```text
U1 → retract
U1 → revise
```

二者只能选择一个。

## Federation 配置

Federation 默认关闭，主动开启：

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

生产环境应使用 HTTPS 和稳定的 `PUBLIC_BASE_URL`。私钥代表部署实例的长期 federation identity，应当备份并妥善保护。

## GitHub Issues Adapter

v0.5 的 GitHub adapter 继续保留：

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

外部发布审计：

```text
GET /api/rooms/:code/exports
```

## Room Governance

角色仍保持简单：

- **owner**：可任命/撤销 moderator、移除非 owner 成员、转移 ownership；
- **moderator**：只能移除普通 member；
- **member**：参与讨论，没有治理权限。

治理权不能读取或修改别人的私人 draft、clarification 或 Intent Card，也不能替别人 retract/revise federation publication。

## 本地运行

需要 Node.js **22.13+**。

```bash
cp .env.example .env
npm start
```

打开：`http://localhost:3000`

默认 SQLite：

```text
data/intent-commit.sqlite
```

Federation 开启时还会持久化：

```text
data/federation-private.pem
data/federation-public.pem
```

`data/` 已加入 `.gitignore`。

## Docker

```bash
docker compose up --build
```

SQLite 和 federation identity key 都保存在 `intent_commit_data` volume 中。

## 数据与隐私边界

普通 room persistence 保存：账户、密码 hash、session hash、room、membership、role 与 committed statement。

不会作为 room discourse 保存：raw draft、clarification、Intent Card、尚未确认的 proposed statement。

公开 federation artifact 分开持久化：

```text
federation_publications  已签名的公开 utterance
federation_events        已签名的 retraction / revision
```

因此删除本地 room 不能保证删除其他服务器已经保存的公开副本。Retraction 的含义是“公开撤回认可”，而不是声称历史记录从未存在。

## 测试

```bash
npm test
```

测试会先检查 server 与 browser JavaScript 语法，再运行完整测试，包括：

- 协议状态迁移；
- `DRAFT → COMMITTED` 禁止规则；
- Federation Ed25519 签名与 tamper detection；
- signed retraction；
- signed revision；
- 同一 subject 的 relation uniqueness；
- revision self-reference 禁止；
- account / session；
- room governance；
- SQLite persistence；
- GitHub adapter 与 external publication audit。

## 当前边界

v0.7 仍然是 **verifiable outbound federation**，不是完整 federated social network。

目前仍没有：remote inbox、following、ActivityPub compatibility、inbound federation、跨实例 identity binding、remote delivery replay protection、正式 database migration、rate limiting、password recovery、多进程 realtime fan-out。

## License

MIT
