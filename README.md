# EasyAPI

轻量、精致的桌面 API 调试工具 —— 类 Postman，**无需登录，数据 100% 本地存储**。

基于 `Electron + Vue 3 + TypeScript + Vite` 构建。

![Electron](https://img.shields.io/badge/Electron-33-47848f) ![Vue](https://img.shields.io/badge/Vue-3-42b883) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能总览

### 请求构建
- 全方法支持：`GET / POST / PUT / DELETE / PATCH / HEAD / OPTIONS`
- **参数**（与 URL 查询串双向实时同步）、**请求头**、**授权**（Bearer / Basic / API Key）、**Body** 编辑区
- Body 类型：`none` / `form-data`（文本 + 文件上传）/ `x-www-form-urlencoded` / `raw`（JSON·Text·XML·HTML·JavaScript，语法高亮 + 一键格式化）/ `binary`
- **自动请求头可视化**：按 Body 类型自动附加的 `Content-Type`、按授权生成的 `Authorization` 会以「自动」标记显式展示；手动添加同名头即可覆盖
- 行级启用/停用勾选、**批量编辑**（保留描述与启用状态）、**拖拽排序**（参数/请求头行）

### 前置脚本 & 测试断言
- **前置脚本**：发送前执行，支持 `await`；`pm.environment / pm.globals / pm.variables` 读写变量，`pm.request` 修改方法、URL 与请求头
- **测试脚本（断言）**：响应返回后执行
  ```js
  pm.test('状态码为 200', () => {
    pm.response.to.have.status(200)
  })
  pm.test('返回了用户名', () => {
    const data = pm.response.json()
    pm.expect(data.name).to.eql('EasyAPI')
  })
  ```
  - `pm.response` 提供 `code / status / responseTime / headers.get() / text() / json()`
  - `pm.expect` 提供 `to.equal / eql / match / include / be.above / be.below / be.oneOf / have.property` 等链式断言
  - 断言结果在编辑器下方展示（通过 x/y），标签页徽标同步显示
- `console.log` 统一输出到**网络控制台**
- 脚本出错时前置脚本阻断发送、测试脚本标红提示

### 响应查看
- 状态码 · 耗时 · 大小一目了然；**JSON 自动格式化 + 语法高亮**（不依赖服务端 Content-Type 声明）
- **美化 / 原始 / 预览**（HTML 沙箱渲染、图片预览）/** 请求**（查看变量解析、鉴权、脚本处理后的实际发送内容）/** 响应头 / Cookie**
- 一键复制、保存响应到文件、**复制为 cURL**（变量已解析为实际值）
- 网络错误友好化中文提示（DNS、连接拒绝、超时、证书错误等，附排查建议）

### 集合管理
- 树形集合 / 文件夹 / 请求，支持**拖拽排序**（拖到文件夹上变子项、拖到条目上下变顺序）
- 右键菜单完成新建、重命名（同步已打开标签页）、复制、删除（联动关闭相关标签页）、导出
- **导入**：Postman Collection v2.x（含前置/测试脚本、集合级变量自动转环境）、cURL 命令
- **导出**：Postman v2.1 兼容格式，与 Postman 用户互通
- 标签页与集合双向同步：保存、重命名、脏状态标记

### 环境变量
- 左侧栏三入口（集合 / 环境 / 历史），多环境一键切换，作用域：**环境变量 > 全局变量**
- URL / 参数 / 请求头 / Body 中使用 `{{变量名}}`，支持多层嵌套引用
- 内置动态变量：`{{$timestamp}}` `{{$uuid}}` `{{$randomInt}}` `{{$randomEmail}}` `{{$randomIP}}` 等
- 环境变量支持 JSON 文件导入；Postman 集合变量导入时自动创建环境

### Cookie 自动管理
- 响应中的 `Set-Cookie` 自动保存（支持 Domain / Path / Max-Age / Expires）
- 后续请求自动附带对应域名的 Cookie（手动添加 `Cookie` 头时不覆盖），过期自动清理
- **Cookie 管理**弹窗按域名分组查看、单条删除、一键清空（菜单：工具 → Cookie 管理）

### 界面与效率
- **三栏布局**：左侧图标栏（集合/环境/历史）→ 侧边面板（可拖宽）→ 主工作区
- **多标签页**：双击重命名、未保存红点、标题跟随 URL 自动命名、会话恢复（重启还原）
- **网络控制台**：与响应区 tab 切换，记录每次请求的收发细节与脚本输出，支持 URL 过滤
- **代码生成**：cURL / Fetch / Axios / Python Requests（菜单：工具 → 生成代码）
- **经典菜单栏**：文件 / 视图 / 工具 / 窗口 / 帮助，含保存、另存为、导入导出、退出等
- 深色 / 浅色主题、无边框标题栏、全键盘快捷键、欢迎页快速开始

## 🚀 快速开始

```bash
npm install     # 安装依赖
npm run dev     # 开发模式启动
```

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式（Vite HMR + Electron） |
| `npm run build` | 生产构建到 `out/` |
| `npm run typecheck` | 渲染层 + 主进程类型检查 |
| `npm run dist` | 构建并打包 Windows 安装包（NSIS） |
| `npm run dist:dir` | 构建免安装目录版 |

### 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + Enter` | 发送请求 |
| `Ctrl + S` | 保存请求（`另存为…` 在菜单/保存旁的下拉里） |
| `Ctrl + T` / `Ctrl + N` | 新建标签页 |
| `Ctrl + W` | 关闭标签页 |
| `Ctrl + Tab` | 切换标签页 |
| `Ctrl + Shift + C` | 响应区/控制台切换 |
| `Ctrl + ,` | 设置 |
| `F12` | 开发者工具 |

## 📂 数据存储

所有数据（集合 / 环境 / 历史 / Cookie / 设置 / 标签页会话）以 JSON 保存在本机：

```
%APPDATA%/easyapi/easyapi-data.json     # 开发模式
%APPDATA%/EasyAPI/easyapi-data.json     # 安装版
```

单文件原子写入（临时文件 + 重命名），不连接任何账号服务；可在「设置 → 数据」或菜单「文件 → 导出全部数据」随时备份。

> 存储选型说明：集合/环境为文档型小数据，JSON 足够且便于备份与人工检查；若未来需要万级历史检索/响应体归档，可单独将历史迁移至 SQLite（better-sqlite3），配置仍保留 JSON。

## 🏗️ 项目结构

```
src/
├── main/            # Electron 主进程
│   ├── index.ts         # 窗口、无边框标题栏、快捷键、右键菜单
│   ├── store.ts         # JSON 数据持久化（原子写入 + 防抖）
│   ├── requestEngine.ts # axios 请求引擎（取消/超时/重定向/SSL/字符集解码）
│   └── ipc.ts           # 文件对话框、窗口控制等 IPC
├── preload/         # contextBridge 暴露 window.api
├── shared/          # 主/渲染进程共享类型
└── renderer/src/
    ├── lib/          # 变量引擎、请求构建、脚本运行器（前置/断言）、
    │                 # Cookie 管理、cURL 解析、Postman 导入导出、代码生成
    ├── stores/       # Pinia：tabs / collections / envs / history / app
    ├── components/   # 标签页、请求栏、KV 网格表、响应面板、集合树、
    │                 # 菜单栏、脚本编辑器、各类弹窗
    └── styles/       # 设计令牌 + 深浅双主题
```

## 🗺️ 路线图

- [ ] 批量运行集合（一键跑全部断言）
- [ ] WebSocket / GraphQL 请求类型
- [ ] 代理配置与系统代理跟随
- [ ] Mock 服务与接口文档导出
- [ ] 历史记录全文字段搜索（SQLite）
- [ ] 应用图标与自动更新
