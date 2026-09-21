# START HERE — Intent Commit 仓库接管入口

[English](START_HERE.md) | [中文](START_HERE.zh-CN.md)

这是维护 Intent Commit 协议与参考实现的零上下文入口。

## 最小读取顺序

1. `AHICP_MANIFEST.yaml`
2. `AHICP_CONTEXT_INTERFACE.yaml`
3. `PROJECT_STATUS.md`
4. `AGENTS.md`
5. 先分类任务，再只读取相关 protocol、agent、federation、implementation、security 或 publication 权威

## 权威映射

- 稳定 Protocol 1.0 契约：`docs/spec-v1.0.md`
- 互操作 / 冻结测试向量：`docs/interoperability.md` + `test-vectors/v1.0.json`
- reflective-agent 行为：`docs/agent-spec.md`
- federation：`docs/federation.md`
- author-approved argument structure：`docs/argument-structure.md`
- 参考 packages / implementation：`packages/`、`server.js`、`src/`
- 部署说明：`docs/deployment.md`
- 仓库 operational resume：`PROJECT_STATUS.md`

协议授权边界高于实现便利。

## 发布边界

源码仓库已经公开。仓库实际状态中没有观察到 GitHub Pages 或 active hosted provider。部署文档说明参考客户端**可以怎样部署**，不能据此推断某个 provider 当前已经上线。

`website.yaml publish=false` 不撤销项目既有的 Academic Vault legacy representation，但也不授予新的独立站点或未来主页变更授权。
