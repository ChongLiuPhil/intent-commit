# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个面向 **AI 中介的反思式人类交流** 的开放协议与参考客户端。AI 不替人发言，而是在私人草稿与公共表达之间提供一个反思层：帮助说者展开、检查、澄清自己的意思，只有经过本人明确确认的版本才会真正进入公共交流。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 公共交流

## v0.4：协议层 + 房间治理 + 可部署结构

v0.4 不再只是一个具体聊天客户端，而开始形成“开放协议 + 参考实现”的结构：

- 新增独立的 `packages/protocol` 协议模块；
- 协议版本 `1.0`；
- 消息状态迁移变成可执行、可测试的代码；
- Intent Card 和 committed message 都有 JSON Schema；
- 为外部 adapter 提供标准 committed-message envelope；
- room 角色扩展为 `owner / moderator / member`；
- Owner 可以任命或撤销 Moderator；
- 支持 ownership transfer；
- Moderator 只能移除普通 member，不能管理 owner 或其他 moderator；
- 加入 Docker 与 Docker Compose 部署结构；
- SQLite 继续持久化账户、room、membership、role、session 与 committed history；
- reference client 继续通过 SSE 实时同步公共 room state。

## 最重要的协议约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

协议明确禁止：

```text
DRAFT → COMMITTED
```

Reflective Agent 的核心约束仍然是：

> **Expand without inventing —— 可以展开，但不能擅自替用户创造理由、事实、立场或承诺。**

如果信息缺失，Agent 应当暴露不确定性或提出问题，而不是偷偷替表达者补完立场。

## 独立 Protocol Package

可复用的协议实现位于：

```text
packages/protocol/
```

它提供：

- 状态迁移规则；
- room role 权限规则；
- Intent Card normalization / validation；
- committed-message envelope 创建与验证。

JSON Schema：

- `packages/protocol/schemas/intent-card.schema.json`
- `packages/protocol/schemas/committed-message.schema.json`

参考服务端还提供一个给 adapter 使用的标准协议出口：

```text
GET /api/rooms/:code/protocol/messages
```

详情见 `docs/protocol-package.md`。

## Room Governance

角色权限刻意保持简单：

- **owner**：可以任命/撤销 moderator、移除非 owner 成员、转移 ownership；
- **moderator**：只能移除普通 member；
- **member**：可以参与讨论，但没有 moderation 权限。

如果房间还有其他成员，Owner 不能直接离开，必须先转移 ownership。

这些治理动作只作用于公共 room membership，不允许读取或修改其他人的私人 draft、clarification 或 Intent Card。

## 本地运行

需要 Node.js **22.13+**。

```bash
cp .env.example .env
npm start
```

打开：`http://localhost:3000`

首次启动会自动创建：

```text
data/intent-commit.sqlite
```

`data/` 已加入 `.gitignore`。

不配置 API Key 时使用 deterministic demo reflector。若要使用 OpenAI：

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
DATABASE_PATH=./data/intent-commit.sqlite
SESSION_TTL_DAYS=30
COOKIE_SECURE=false
```

正式 HTTPS 部署时应设置：

```text
COOKIE_SECURE=true
```

## Docker 部署

```bash
docker compose up --build
```

SQLite 数据保存在 `intent_commit_data` volume 中。生产 `Dockerfile` 默认把数据库放在 `/app/data`，并默认启用 secure cookie。

详情见 `docs/deployment.md`。

## API

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

协议 adapter：

- `GET /api/rooms/:code/protocol/messages`

私人反思：

- `POST /api/reflect`

## 数据与隐私边界

SQLite 中保存：

- 用户账户；
- 密码 salt / hash；
- 哈希后的 session token；
- room；
- room membership 与 role；
- 最终 committed statement。

不会作为 room 公共历史保存：

- raw draft；
- clarification；
- Intent Card；
- 尚未确认的 proposed statement。

如果启用了外部 LLM，那么私人草稿与澄清会由模型提供商处理，但这仍然不同于把它们发布给 room 中的其他参与者。

## 测试

```bash
npm test
```

测试现在覆盖：

- 协议状态迁移；
- `DRAFT → COMMITTED` 禁止规则；
- committed-message interoperability；
- 密码哈希与 session 撤销；
- account-based membership；
- explicit approval；
- Moderator 权限边界；
- ownership transfer；
- SQLite 重启后的持久化恢复。

## 当前边界

v0.4 已经可以部署，但还不是面向不受信任公众的大规模生产平台。目前仍缺少密码找回、rate limiting、moderation audit log、更完整的 CSRF 防护、多进程 realtime fan-out，以及正式数据库 migration tooling。

更多说明：

- `docs/protocol-package.md`
- `docs/deployment.md`
- `docs/persistence.md`
- `docs/privacy.md`
- `docs/multi-user.md`
- `docs/protocol.md`
- `docs/philosophy.md`

## License

MIT
