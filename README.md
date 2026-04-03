# Mini Agent

基于 Claude Code 相关泄露源码里 `query.ts` 的核心文件删减为一个最小可运行示例。

它保留了最关键的 Agent 主循环：

`用户输入 -> 模型调用 -> tool_use -> 执行工具 -> tool_result -> 下一轮 -> 最终答案`

这个仓库不是 Claude Code 的完整复刻，而是把核心流程拆出来，做成一个方便阅读理解Agent的核心原理，方便实验和后续自己扩展的小项目。

## 文件

- `mini-agent.mjs`
  对话主循环、turn 管理、工具执行。
- `anthropic-call-model.mjs`
  模型请求、错误处理、重试。
- `.env.example`
  配置示例。

## 已实现

- 多轮 turn
- `tool_use / tool_result`
- 两个演示工具：`get_current_time`、`add_numbers`
- 基础错误提示
- 简单重试

## 配置

必填：

- `API_KEY`

选填：

- `BASE_URL`，默认 `https://api.minimaxi.com/anthropic`
- `MODEL`，默认 `MiniMax-M2.7`

也兼容：

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_MODEL`

环境变量示例：

```bash
export API_KEY="your_api_key_here"
export BASE_URL="https://api.minimaxi.com/anthropic"
export MODEL="MiniMax-M2.7"
```

`.env` 示例：

```dotenv
API_KEY=your_api_key_here
BASE_URL=https://api.minimaxi.com/anthropic
MODEL=MiniMax-M2.7
```

代码里调用了 `process.loadEnvFile()`，所以当前目录下的 `.env` 会自动加载到环境变量里。

## 运行示例

```bash
cd ./mini-agent
node ./mini-agent.mjs "请简单介绍一下自己。"
```

触发 `turn 2`：

```bash
node ./mini-agent.mjs "先调用 get_current_time 查询 Asia/Shanghai 当前时间，再调用 add_numbers 计算 18、24、36 的和，最后把两个结果一起告诉我。"
```

触发 `turn 3`：

```bash
node ./mini-agent.mjs "先调用 get_current_time 获取 Asia/Shanghai 当前时间。拿到结果后，取出小时数，再调用 add_numbers 把这个小时数和 10 相加，最后告诉我结果。"
```

## 相比 query.ts 删了哪些

为了做成最小示例，这里把很多完整工程能力都删掉了，只保留多轮对话和工具调用这条主线。

当前删掉或没有实现的部分主要包括：

- 更复杂的状态机和中断恢复
- 更完整的消息事件体系
- 流式输出
- 文件系统相关工具
- 命令执行相关工具
- 编辑类工具
- 会话持久化
- 更细的日志、监控、诊断能力
- 更复杂的工具注册和调度机制

所以这个项目更适合拿来理解“主循环是怎么跑起来的”，而不是直接当成 Claude Code 完整替代品。

## 后续怎么扩充

如果要继续往上补，可以按下面这个顺序加：

1. 把内置工具拆成独立 `tools/` 目录，做成可注册结构。
2. 给模型输出加流式处理，让终端能边生成边显示。
3. 增加文件读取、文件写入、命令执行等工具。
4. 把消息历史持久化，支持连续会话。
5. 增加更明确的状态、日志和错误分层。
6. 再往上做更完整的 Agent 编排逻辑。

如果你是从 Claude Code 那批泄露源码一路看到这里，这个仓库最值得看的就是这个最小闭环：先把 loop 看懂，再逐步把能力补回去。
