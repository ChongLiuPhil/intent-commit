# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 不替人发言，而是在私人草稿与公共表达之间提供一个反思层：帮助说者展开、检查、澄清自己的意思，只有经过本人明确确认的版本才会真正进入公共交流。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 公共交流

## v0.5：第一个真正的外部 Adapter

v0.5 开始验证一个关键问题：Intent Commit Protocol 能否离开自己的网页客户端，进入别的交流平台，同时仍然保留“由人确认并承担发言责任”的原则。

第一版外部 adapter 支持把一个已经 `COMMITTED` 的消息发布为 GitHub Issue / Pull Request 的 conversation comment。

核心约束：

- 只有符合协议的 `COMMITTED` message 才能进入 adapter；
- 在 room 中 Commit **不等于** 同意向更大的外部受众公开；
- 原消息作者必须再次明确确认 external publication；
- Owner / Moderator 不能替别人把消息发布到 GitHub；
- GitHub token 只保存在服务端；
- 成功发布后会把目标、message id、外部 URL 和时间写入 SQLite 审计记录；
- 同一消息向同一目标重复发布会被拒绝；
- raw draft、clarification 和 Intent Card 永远不会进入 adapter。

仓库中的 Issue `#1` 已保留为后续端到端 dogfooding 测试目标。

## 最重要的协议约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议明确禁止：

```text
DRAFT → COMMITTED
```

Reflective Agent 的核心原则仍然是：

> **Expand without inventing —— 可以展开，但不能擅自替用户创造理由、事实、立场或承诺。**

## 独立 Protocol Package

协议实现位于：

```text
packages/protocol/
```

它提供：

- 状态迁移规则；
- room role 权限规则；
- Intent Card validation；
- committed-message envelope 创建与验证。

标准协议出口：

```text
GET /api/rooms/:code/protocol/messages
```

## GitHub Issues Adapter

可复用 adapter 包：

```text
packages/adapters-github/
```

服务端配置：

```env
GITHUB_TOKEN=...
```

Token 不会发送给浏览器，也不应提交到 Git。

发布接口：

```text
POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish
```

请求体：

```json
{
  "repository": "owner/repo",
  "messageId": "committed-message-id",
  "approved": true
}
```

外部发布审计：

```text
GET /api/rooms/:code/exports
```

详情见：

- `docs/adapters/github-issues.md`
- `docs/adapters/consent-model.md`
- `docs/adapters/security.md`

## 为什么外部发布需要第二次确认

Intent Commit 现在明确区分两种 commitment：

```text
Room Commit
```

表示：

> 我愿意让这句话在当前 room 中代表我。

而：

```text
External Publication Approval
```

表示：

> 我愿意让这条已经确认过的表达进入一个新的外部受众环境。

因为受众改变会改变一句话的实际语用后果，所以第二步不能由系统、Moderator 或 Owner 自动推断。

## Room Governance

角色保持简单：

- **owner**：可任命/撤销 moderator、移除非 owner 成员、转移 ownership；
- **moderator**：只能移除普通 member；
- **member**：参与讨论，没有治理权限。

治理权仍然不能读取或修改别人的私人反思空间。

## 本地运行

需要 Node.js **22.13+**。

```bash
cp .env.example .env
npm start
```

打开：`http://localhost:3000`

首次启动自动创建：

```text
data/intent-commit.sqlite
```

可选配置：

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
DATABASE_PATH=./data/intent-commit.sqlite
SESSION_TTL_DAYS=30
COOKIE_SECURE=false
GITHUB_TOKEN=
```

正式 HTTPS 部署应设置：

```text
COOKIE_SECURE=true
```

## Docker

```bash
docker compose up --build
```

SQLite 数据保存在 `intent_commit_data` volume 中。

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

协议与 Adapter：

- `GET /api/rooms/:code/protocol/messages`
- `POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish`
- `GET /api/rooms/:code/exports`

私人反思：

- `POST /api/reflect`

## 数据与隐私边界

SQLite 保存：账户、密码 hash、session hash、room、membership、role、committed statement，以及成功的 external publication audit records。

不会作为 room discourse 保存：raw draft、clarification、Intent Card、尚未确认的 proposed statement。

外部发布本身也被设计成一个独立 consent event，而不是 room Commit 的自动延伸。

## 测试

```bash
npm test
```

测试现在覆盖：

- 协议状态迁移；
- `DRAFT → COMMITTED` 禁止规则；
- committed-message interoperability；
- 密码哈希与 session 撤销；
- room membership 与治理权限；
- explicit approval；
- SQLite persistence；
- GitHub adapter comment formatting 与 REST request 构造；
- external publication audit；
- 同一 message / target 的重复发布保护。

## 当前边界

v0.5 仍然是 reference implementation。GitHub bridge 当前只支持 outbound，并要求服务端配置 token。暂时还没有 inbound webhook federation、per-room provider credential、password recovery、rate limiting、正式 database migration、以及多进程 realtime fan-out。

## License

MIT
