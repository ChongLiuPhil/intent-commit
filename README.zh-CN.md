# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个开源的 AI 辅助反思式交流协议与参考客户端。AI 不替人发言，而是在私人草稿与公共表达之间提供一个反思层：帮助说者展开、检查、澄清自己的意思，只有经过本人明确确认的版本才会真正进入公共交流。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 公共交流

## v0.3：持久化多用户系统

这一版把 v0.2 的临时房间升级成了真正可以跨重启保存的账户系统：

- 用户名 / 密码账户；
- 密码使用随机 salt + `scrypt` 哈希保存，不保存明文密码；
- 登录使用可撤销的服务端 session；
- session token 通过 HttpOnly cookie 发送，前端 JavaScript 不直接读取；
- 使用 Node 自带的 `node:sqlite` 持久化 SQLite 数据库；
- room、成员关系和 committed history 在服务重启后仍然存在；
- 登录后可以看到长期加入的 “Your rooms”；
- room 内的 committed state 继续通过 SSE 实时同步；
- 私人 draft、clarification 和 Intent Card 不进入公共 room 数据库；
- 服务端仍强制要求 `approved === true` 才允许 Commit。

## 最重要的协议约束

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → COMMITTED
```

不能直接：

```text
DRAFT → COMMITTED
```

Reflective Agent 的基本原则仍然是：

> **Expand without inventing —— 可以展开，但不能擅自替用户创造理由、事实、立场或承诺。**

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

`data/` 已加入 `.gitignore`，不会把真实用户数据库提交到 GitHub。

不配置 API Key 时，会使用 deterministic demo reflector。若要使用 OpenAI，在 `.env` 中设置：

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
DATABASE_PATH=./data/intent-commit.sqlite
SESSION_TTL_DAYS=30
COOKIE_SECURE=false
```

正式 HTTPS 部署时应设置 `COOKIE_SECURE=true`。

## v0.3 中保存什么

SQLite 中保存：

- 用户账户；
- 密码 salt / hash；
- 哈希后的 session token；
- room；
- room membership；
- 最终 committed statement。

不会作为 room 公共历史保存：

- raw draft；
- clarification；
- Intent Card；
- 尚未确认的 proposed statement。

如果启用了外部 LLM，那么私人草稿与澄清仍然需要发送给该模型提供商进行反思处理。这一点属于模型处理边界，而不是 room 公共传播。

## 当前边界

v0.3 已经是可持续保存的多用户参考实现，但还不是完整生产级身份平台。目前没有 email verification、找回密码、rate limiting、正式 moderation role、横向扩容的多进程 realtime fan-out 等功能。

更多说明见：

- `docs/persistence.md`
- `docs/privacy.md`
- `docs/multi-user.md`
- `docs/protocol.md`
- `docs/philosophy.md`

## 测试

```bash
npm test
```

测试覆盖密码哈希、session 撤销、账户级 room membership、明确 approval 约束，以及关闭并重新打开 SQLite 后历史仍然存在。

## License

MIT
