# AGENTS — Intent Commit 仓库协作契约

[English](AGENTS.md) | [中文](AGENTS.zh-CN.md)

## Canonical authority

仓库状态高于聊天/模型记忆。通过 `START_HERE.md` 与 AHICP context interface 按任务选择性读取。

Intent Commit 使用分域权威，而不是复制一份研究型 Content Core：

- `docs/spec-v1.0.md`：稳定 Protocol 1.0 互操作契约；
- `docs/interoperability.md` + frozen vectors：跨实现验证；
- `docs/agent-spec.md`：reflective-agent 契约；
- `docs/federation.md`：federation 语义；
- `docs/argument-structure.md`：author-approved public argument-map 语义；
- packages/tests：实现与 conformance 证据。

## 人类授权不变量

AI 可以辅助反思、澄清、测试或起草，但不得静默制造人类承诺。Room commitment、external publication、federation publication、retraction/revision、provenance assertion 与 argument-map publication 继续是彼此独立的人类授权行为。

Protocol 1.0 语义、canonicalization、作者/批准边界、公共行为语义、仓库可见性或 deployment/publication 状态变化需要明确 maintainer authority。

## Security 同步说明

`SECURITY.md` 仍包含早期 MVP 描述，与当前 `docs/deployment.md` 和 v1.0 实现文档并不完全一致。这是 synchronization defect，不得据此私自选择更方便的一版；应在独立审查中统一。

## 发布

源码仓库已经公开，但不能推断 active hosted provider。PPF 将 Web deployment 记录为 disabled/not-authorized，provider 为 `null`。部署说明不是 provider actual-state 证据。`website.yaml publish=false` 继续作为 Vault / 主页变更边界。
