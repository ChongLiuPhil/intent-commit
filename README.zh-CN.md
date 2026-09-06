# Intent Commit

**在你把话变成公共发言之前，先确认你愿意让它代表什么。**

Intent Commit 是一个关于 **AI 辅助的人类反思式交流（reflective communication）** 的开源实验。

普通聊天软件往往把几个不同阶段压缩成一个动作：

```text
产生一个不完整的想法 → 输入一句话 → Send
```

Intent Commit 则明确插入一个私人反思层：

```text
草稿
  ↓
AI 解释与结构化
  ↓
说者检查自己的意图
  ↓
澄清 / 修正
  ↓
本人确认
  ↓
Commit & Send
```

## 最重要的原则

> **AI 可以帮助展开，但不能擅自发明。**

如果原始发言没有给出理由，AI 应当指出“理由尚未说明”，而不是自动替用户生成一个更强的理由。

如果用户表达的是不确定判断，AI 不能把它改写成确定判断。

如果 AI 对用户意图的理解不准确，用户应当能够直接纠正它，并再次运行反思流程。

最终进入公共聊天区的，不是原始草稿，也不是 AI 的解释，而是：

> **由表达者本人明确认可、并愿意承担归属责任的 committed statement（承诺性表达）。**

## MVP 已实现

当前版本包含：

- Speaker A / Speaker B 双人轮流发言；
- 私人的原始草稿区；
- AI Intent Card；
- 澄清与重新解释循环；
- 可编辑的最终表达；
- “This represents what I am willing to mean” 明确认可步骤；
- `Commit & Send`；
- 只展示确认后表达的公共聊天区；
- 浏览器本地保存已经提交的对话；
- OpenAI Responses API 接口；
- 无 API Key 时可运行的本地 demo reflector；
- 针对“AI 不得虚构理由”的基本测试。

## Intent Card

AI 会尝试把草稿拆成：

- Core claim：核心判断
- Communicative intention：交际意图
- Explicit reasons：明确给出的理由
- Possible assumptions：可能存在的前提
- Ambiguities：歧义或尚未确定的地方
- Possible misinterpretations：潜在误读
- Questions for speaker：需要说者进一步回答的问题
- Proposed statement：忠实重述建议

Intent Card 默认属于私人空间。

## 运行

要求 Node.js 20+。

```bash
cp .env.example .env
npm start
```

然后打开：

```text
http://localhost:3000
```

如果 `.env` 中没有 `OPENAI_API_KEY`，程序会自动进入 demo 模式。

如果希望调用 OpenAI：

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

API Key 只存在于 Node 服务端，不会发送到浏览器代码。

## 核心协议

```text
DRAFT → REFLECTED ↔ CLARIFYING → APPROVED → SENT
```

最重要的协议约束是：

```text
DRAFT ↛ SENT
```

也就是说，未经表达者明确确认，任何 AI 生成或修改后的语言都不应自动成为表达者的公共发言。

进一步说明见：

- [`docs/philosophy.md`](docs/philosophy.md)
- [`docs/protocol.md`](docs/protocol.md)
- [`docs/agent-spec.md`](docs/agent-spec.md)
- [`docs/privacy.md`](docs/privacy.md)

## 哲学上的核心问题

这个项目不假设人的“真实意图”总是作为一个完整对象预先存在于头脑中，等待 AI 把它读取出来。

更合理的模型可能是：人在看到自己的表达被解释、结构化、重新呈现之后，才能进一步决定自己究竟愿意承诺什么。

因此项目真正关心的不是：

> AI 能否读取一个已经存在的隐藏意图？

而是：

> AI 能否帮助表达者形成并确认一个 **reflectively endorsed communicative commitment（经反思认可的交际承诺）**？

这也是 Intent Commit 与普通 AI 润色工具之间最重要的区别。
