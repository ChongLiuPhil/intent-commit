# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 不替人发言，而是在私人草稿与公共表达之间提供一个反思层：帮助说者展开、检查、澄清自己的意思，只有经过本人明确确认的版本才会真正进入公共交流。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 公共交流

## v0.6：可验证 Federation

v0.6 开始建立 **由作者控制、并且可以用密码学验证的 federation**。

一个 room 中已经 `COMMITTED` 的消息，并不会自动变成全网公开对象。只有原作者再次明确确认之后，服务器才会生成公开 canonical URI 与数字签名：

```text
Room 中 COMMITTED
        ↓
原作者明确同意 federation publication
        ↓
公开、带签名的 canonical utterance
```

核心约束：

- federation 默认关闭；
- 只有原作者本人可以 federate 自己的 committed statement；
- Owner / Moderator 不能替别人公开；
- 每个开启 federation 的部署实例拥有持久化 Ed25519 身份密钥；
- 公钥通过 `/.well-known/intent-commit` 暴露；
- 每条 federated utterance 有稳定 canonical URI；
- envelope 可以由外部系统独立验签；
- 签名后修改 statement 会导致验证失败；
- federation publication 与普通 room history 分开持久化；
- 删除本地 room 不能保证删除其他系统已经保存的公开副本；
- v0.6 不接受 inbound federation，也不会主动抓取任意远程 URL。

## 最重要的协议约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议仍然明确禁止：

```text
DRAFT → COMMITTED
```

Reflective Agent 的核心原则仍然是：

> **Expand without inventing —— 可以展开，但不能擅自替用户创造理由、事实、立场或承诺。**

## Protocol 与 Federation Package

基础协议：

```text
packages/protocol/
```

Federation 签名与验证：

```text
packages/federation/
```

Federated utterance JSON Schema：

```text
packages/federation/schemas/federated-utterance.schema.json
```

详细说明见：

- `docs/protocol-package.md`
- `docs/federation.md`

## Federation API

实例发现：

```text
GET /.well-known/intent-commit
```

公开签名发言：

```text
GET /federation/utterances/:messageId
```

查看当前 room 的 federation publication：

```text
GET /api/rooms/:code/federation
```

原作者发布：

```text
POST /api/rooms/:code/federation/publish
```

请求体：

```json
{
  "messageId": "committed-message-id",
  "approved": true
}
```

Reference client 中，只有当前登录用户自己的 committed message，在 federation 开启时才会出现 **Publish to federation** 按钮。

## Federation 配置

Federation 必须主动开启：

```env
FEDERATION_ENABLED=true
PUBLIC_BASE_URL=https://intent.example.org
FEDERATION_PRIVATE_KEY_PATH=./data/federation-private.pem
FEDERATION_PUBLIC_KEY_PATH=./data/federation-public.pem
```

生产环境应使用 HTTPS 和稳定的 `PUBLIC_BASE_URL`。

私钥代表这个 Intent Commit 实例的长期 federation identity，应当备份并保护好。如果私钥丢失，实例就无法继续以同一个身份签名。

## 为什么 federation 还需要一次确认

Intent Commit 现在至少区分三种不同的 audience commitment：

```text
Room Commit
External Adapter Publication
Federation Publication
```

它们对应不同的受众范围，因此不能互相自动推断。

一个人在当前 room 中愿意承担一句话，不意味着他已经同意：

- 发到 GitHub；
- 生成公开永久 URI；
- 被外部服务器抓取与保存。

所以 federation publication 是新的、独立的 consent event。

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

审计接口：

```text
GET /api/rooms/:code/exports
```

GitHub adapter 和 federation 遵循同一原则：

> **Room 中的 Commit 不等于自动同意扩大受众。**

## Room Governance

角色仍保持简单：

- **owner**：可任命/撤销 moderator、移除非 owner 成员、转移 ownership；
- **moderator**：只能移除普通 member；
- **member**：参与讨论，没有治理权限。

治理权不能读取或修改别人的私人 draft、clarification 或 Intent Card。

## 本地运行

需要 Node.js **22.13+**。

```bash
cp .env.example .env
npm start
```

打开：`http://localhost:3000`

默认 SQLite 位于：

```text
data/intent-commit.sqlite
```

如果开启 federation，还会创建：

```text
data/federation-private.pem
data/federation-public.pem
```

`data/` 已加入 `.gitignore`。

完整可选配置：

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

## Docker

```bash
docker compose up --build
```

SQLite 和 federation identity key 都保存在 `intent_commit_data` volume 中，因此容器重启不会更换实例身份。

## API 概览

认证：

- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`

Room：

- `POST /api/rooms`
- `POST /api/rooms/:code/join`
- `GET /api/rooms/:code`
- `GET /api/rooms/:code/events`
- `POST /api/rooms/:code/commit`
- `POST /api/rooms/:code/leave`

治理：

- `PATCH /api/rooms/:code/members/:userId/role`
- `DELETE /api/rooms/:code/members/:userId`
- `POST /api/rooms/:code/ownership`

协议与发布：

- `GET /api/rooms/:code/protocol/messages`
- `GET /api/rooms/:code/federation`
- `POST /api/rooms/:code/federation/publish`
- `POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish`
- `GET /api/rooms/:code/exports`

私人反思：

- `POST /api/reflect`

## 数据与隐私边界

普通 room persistence 保存：账户、密码 hash、session hash、room、membership、role 与 committed statement。

不会作为 room discourse 保存：raw draft、clarification、Intent Card、尚未确认的 proposed statement。

Federation publication 是一个单独的公开 artifact。只有作者主动发布后才创建，并独立保存签名 envelope，使 canonical URI 在本地 room 状态改变后仍可验证。

## 关于删除与撤回

已经被 federation 公开的 statement 不能因为删除本地 room 就保证从其他服务器消失。

未来如果加入 retraction，更合理的模型不是“旧内容从未存在”，而是：

```text
旧的 signed utterance
        ↓
新的 signed retraction statement
```

也就是用新的公开承诺说明自己撤回或修正之前的公开承诺。

## 测试

```bash
npm test
```

测试命令现在会先做 server 与 browser JavaScript syntax check，再运行完整测试。

覆盖内容包括：

- 协议状态迁移；
- `DRAFT → COMMITTED` 禁止规则；
- federation Ed25519 签名与验证；
- 被篡改后的验签失败；
- federation publication 去重；
- 密码 / session；
- room governance；
- SQLite persistence；
- GitHub adapter；
- external publication audit。

## 当前边界

v0.6 是 **verifiable outbound federation**，还不是完整 federated social network。

目前没有：remote inbox、following、ActivityPub compatibility、signed retraction、远程 delivery replay protection、inbound moderation、正式 database migrations、rate limiting、password recovery、多进程 realtime fan-out。

## License

MIT
