# Intent Commit

**Think before you commit —— 在表达成为公共话语之前，先确认它真正代表你。**

Intent Commit 是一个开源的 AI 辅助交流协议与参考客户端。它的目标不是让 AI 代替人发言，而是在“私人草稿”和“公共表达”之间建立一个反思层：AI 帮助说者展开、澄清和检查自己的表达，只有经过本人明确确认的版本才会发送给其他参与者。

> 私人草稿 → AI 反思 → 本人澄清 → 本人确认 → Commit → 公共交流

## v0.2：真正的多用户房间

现在不同用户可以从不同浏览器或设备进入同一个 room：

- 创建房间并分享 room code / 邀请链接；
- 每位参与者拥有独立的私人 session；
- 每位参与者拥有独立的私人反思工作区；
- 原始草稿、澄清内容和 Intent Card 不广播给其他人；
- 只有本人确认后的 committed statement 才进入房间公共历史；
- 通过 Server-Sent Events（SSE）实时同步公共消息；
- 公共消息记录真正的人类作者，而不是 AI Agent；
- 不同房间的历史相互隔离。

### v0.2 的重要限制

当前房间、参与者和消息只保存在**服务端内存**中。Node 进程重启后房间会消失。这是第一版多用户 MVP 的有意设计；数据库持久化、正式账户系统和更强认证将在后续版本加入。

## 核心原则

普通即时聊天通常是：

```text
随手输入 → Send → 公共消息
```

Intent Commit 改成：

```text
随手输入
  ↓
AI 对意图的解释
  ↓
说者检查 / 澄清
  ↓
说者明确确认
  ↓
Committed Message
```

Reflective Agent 的核心约束是：

> **Expand without inventing —— 可以展开，但不能擅自替用户增加理由、事实、立场或承诺。**

如果信息缺失，Agent 应该提出问题或指出不确定性，而不是替用户把论证“补完整”。

## 多用户交流过程

1. A 创建房间，把邀请链接发给 B、C 等参与者。
2. A 在自己的私人区域写草稿。
3. Agent 生成 Intent Card，对核心判断、意图、理由、假设、歧义和潜在误解进行展开。
4. A 对 Agent 的理解进行纠正或补充。
5. A 确认最终表达确实代表自己，并点击 **Commit & Send**。
6. 只有最终确认版本进入公共房间。
7. B、C 实时看到该 committed statement，但看不到 A 的原始草稿和反思过程。
8. B、C 回应时也分别经历自己的私人反思流程。

## 本地运行

需要 Node.js 20+：

```bash
npm start
```

浏览器打开：

```text
http://localhost:3000
```

没有 API Key 时会使用 deterministic demo reflector。若要启用 OpenAI：

```bash
cp .env.example .env
```

填写：

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

启用外部 AI 后，私人草稿会由服务端发送给配置的模型提供方进行反思，但仍不会广播给房间中的其他用户。

## v0.2 API

- `POST /api/rooms`：创建房间
- `POST /api/rooms/:code/join`：加入房间
- `GET /api/rooms/:code?token=...`：获取经过身份验证的房间快照
- `GET /api/rooms/:code/events?token=...`：SSE 实时同步
- `POST /api/rooms/:code/commit`：发布本人明确确认后的表达
- `POST /api/rooms/:code/leave`：离开房间并使 session 失效
- `POST /api/reflect`：对当前用户的私人草稿执行反思

## 公共与私人边界

房间参与者可以看到：

- 显示名称
- 公共 participant id
- committed statement
- commit 时间

默认不向其他参与者公开：

- raw draft
- clarification
- Intent Card
- session token

进一步隐私边界见 [`docs/privacy.md`](docs/privacy.md)。

## 下一步

v0.3 最值得做的是持久化与真实身份层：数据库、账户认证、可撤销 session；之后再加入 WebSocket presence、房间权限、协议 npm package，以及 Discord/论坛/GitHub Issues 等外部适配器。

## License

MIT
