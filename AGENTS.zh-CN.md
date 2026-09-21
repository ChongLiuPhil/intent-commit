# AGENTS — Intent Commit 仓库协作契约

[English](AGENTS.md) | [中文](AGENTS.zh-CN.md)

## 权威

仓库状态高于聊天或模型记忆。使用 `START_HERE.md` 与 `AHICP_CONTEXT_INTERFACE.yaml` 进行选择性路由。

Intent Commit 采用分层产品权威：

- `docs/spec-v1.0.md` + `packages/protocol/`：稳定 Protocol 1.0 互操作契约；
- `docs/agent-spec.md`：反思式 Agent 行为；
- `docs/federation.md` + `packages/federation/`：Federation contracts；
- `docs/argument-structure.md`：经作者批准的 argument-map semantics；
- `SECURITY.md` 与当前实现/部署事实：security / trust boundary；
- 代码/测试：受协议契约约束的参考实现行为。

不得让实现行为静默重定义 Protocol 1.0，也不得让反思式 Agent 的措辞越过“显式人类批准”而替用户制造承诺。

## 人类/维护者决定

AI 可以分析、起草、测试并准备 PR。Protocol 1.0 语义、approval/commit 不变量、公共行为授权边界、Federation object contract、安全/信任边界、publication state、仓库可见性或 release policy 的变化都需要明确 maintainer authority。

## 发布

源码仓库已经公开。当前没有记录独立 Web provider 或 Pages deployment。`docs/deployment.md` 是部署说明，不是 provider actual state。`website.yaml publish=false` 不撤销公开源码或 legacy homepage 表示；它阻止从 metadata 推导新的独立站点或未来主页发布变更。

## Stack

AHICP 使用轻量 product-protocol functional mapping；PPF 只记录生命周期边界。不得为了模板对称安装研究论文式 Core/Framework 文件树。

## 已知同步缺陷

`SECURITY.md` 相对当前 deployment/server 概念可能已经滞后。在明确安全审查完成前，必须保留这个差异，而不是静默重写。
