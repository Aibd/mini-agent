# Mini Agent

这个目录里放的是一个简化版的多轮 Agent 示例：

- `mini-agent.mjs`：对话主循环、本地工具、终端输出
- `anthropic-call-model.mjs`：兼容 Anthropic 接口格式的模型调用封装

## 运行要求

- Node.js 18 或更高版本
- 可用的 API Key

## 推荐运行方式

建议先进入当前目录再运行，这样工作目录和 `.env` 的读取位置都更明确。

Windows PowerShell：

```powershell
cd "D:\codex workspace\mini-agent"
node .\mini-agent.mjs "请简单介绍一下自己。"
```

Mac 或 Linux：

```bash
cd "/path/to/codex workspace/mini-agent"
node ./mini-agent.mjs "请简单介绍一下自己。"
```

## 配置项说明

脚本会读取下面这些环境变量：

- `API_KEY`：必填
- `BASE_URL`：选填，默认值是 `https://api.minimaxi.com/anthropic`
- `MODEL`：选填，默认值是 `MiniMax-M2.7`

同时也兼容 Anthropic 风格的变量名：

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_MODEL`

## API_KEY 配置方法

### Windows PowerShell

只在当前终端窗口内生效：

```powershell
$env:API_KEY = "your_api_key_here"
node .\mini-agent.mjs "请简单介绍一下自己。"
```

如果你还想同时指定接口地址或模型：

```powershell
$env:API_KEY = "your_api_key_here"
$env:BASE_URL = "https://api.minimaxi.com/anthropic"
$env:MODEL = "MiniMax-M2.7"
node .\mini-agent.mjs "请简单介绍一下自己。"
```

### Windows CMD

```cmd
set API_KEY=your_api_key_here
node .\mini-agent.mjs "请简单介绍一下自己。"
```

### Mac / Linux（zsh 或 bash）

只在当前终端窗口内生效：

```bash
export API_KEY="your_api_key_here"
node ./mini-agent.mjs "请简单介绍一下自己。"
```

如果你还想同时指定接口地址或模型：

```bash
export API_KEY="your_api_key_here"
export BASE_URL="https://api.minimaxi.com/anthropic"
export MODEL="MiniMax-M2.7"
node ./mini-agent.mjs "请简单介绍一下自己。"
```

## 可选的 .env 文件

脚本里调用了 `process.loadEnvFile()`，所以如果你在当前目录下创建 `.env` 文件，并且从当前目录运行命令，Node 会自动加载它。

示例：

```dotenv
API_KEY=your_api_key_here
BASE_URL=https://api.minimaxi.com/anthropic
MODEL=MiniMax-M2.7
```

## 多轮工具调用示例

触发 `turn 2`：

```bash
node ./mini-agent.mjs "先调用 get_current_time 查询 Asia/Shanghai 当前时间，再调用 add_numbers 计算 18、24、36 的和，最后把两个结果一起告诉我。"
```

触发 `turn 3`：

```bash
node ./mini-agent.mjs "先调用 get_current_time 获取 Asia/Shanghai 当前时间。拿到结果后，取出其中的小时数，再调用 add_numbers 把这个小时数和 10 相加，最后告诉我最终结果。"
```
