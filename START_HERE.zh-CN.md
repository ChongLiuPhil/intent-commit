# START HERE — Intent Commit 仓库接管入口

[English](START_HERE.md) | [中文](START_HERE.zh-CN.md)

这是面向 Intent Commit 仓库维护者与零上下文 AI Agent 的入口。

## 强制读取顺序

1. `AHICP_MANIFEST.yaml`
2. `AHICP_CONTEXT_INTERFACE.yaml`
3. `PROJECT_STATUS.md`
4. `AGENTS.md`
5. 先将任务分类为 PROTOCOL、AGENT、FEDERATION、SECURITY、IMPLEMENTATION、GOVERNANCE 或 PUBLICATION
6. 只读取 context interface 声明的当前任务相关权威

## 权威映射

- 稳定互操作契约：`docs/spec-v1.0.md` + `packages/protocol/`
- 反思式 Agent 行为：`docs/agent-spec.md`
- 互操作/验证器：`docs/interoperability.md` + `packages/verifier/`
- Federation：`docs/federation.md` + `packages/federation/`
- Argument structure：`docs/argument-structure.md`
- Security / trust boundary：`SECURITY.md` 与当前实现/部署事实
- 部署说明：`docs/deployment.md`
- 当前 operational resume：`PROJECT_STATUS.md`

不得再创建一份复制稳定协议或产品文档的第二 Content Core。

## 发布边界

源码仓库已经公开，但当前没有观察到独立 Web provider 或 GitHub Pages deployment。`docs/deployment.md` 说明参考实现“如何部署”，不能当作“已经存在生产环境”的证据。`website.yaml publish=false` 表示 metadata 本身不能授权新的独立站点或未来 Academic Vault / 学术主页变更。

## 已知安全文档漂移

`SECURITY.md` 与 `docs/deployment.md` 目前描述了不同阶段的产品状态。该同步缺陷由 `PROJECT_STATUS.md` 持久记录；在有明确维护者审查前，不得静默把其中任一文件视为完整的当前 threat model。
