# Nowcoder Problems Tracker

这是一个用于牛客网（Nowcoder）刷题进度追踪的前端工具，旨在帮助用户更方便地查看和管理他们在牛客网上的刷题记录、竞赛表现，并与他人进行对比。

## ✨ 核心功能

- **题目状态查询**：输入用户 ID，即可高亮显示已通过（AC）的题目，支持与另一名用户进行对比。
- **多维度题目分类**：
    - **竞赛/笔试**：收录了牛客网的周赛、月赛、练习赛、挑战赛以及各大公司的校招笔试真题。
    - **练习**：整合了从新手入门到算法登峰的系统性练习题，以及面试高频题和模板题。
- **动态排行榜**：
    - 展示全站解题数排名前 1000 的用户榜单。
    - 支持分页浏览。
    - 支持通过用户 ID 查询自己在榜单中的具体位置（包括 1000 名以外的用户），并能自动跳转和高亮显示。
- **流量来源追踪**：支持通过 URL 中的 `channelPut` 参数来标记和追踪流量来源。
- **环境切换配置**：代码中预留了环境变量，可以方便地在生产环境（`www`）和测试环境（`pre`）之间切换。

## 🛠️ 技术栈

- **前端**：HTML, CSS, JavaScript (ES6+ Class)
- **后端 (代理)**：Node.js, Express
- **数据**：JSON

## 🚀 快速开始

### 方法一：简单开发服务器（推荐）

```bash
# 启动Node.js开发服务器
node simple-server.js
```

访问：http://localhost:8000

### 方法二：完整代理服务器

1. **安装依赖**
   ```bash
   npm install
   ```

2. **配置Cookie**
   更新 `proxy-server.js` 中的cookie变量（详见下方说明）

3. **启动代理服务器**
   ```bash
   node proxy-server.js
   ```

访问：http://localhost:3001

### 方法三：生产环境部署

详见 [nginx/README.md](nginx/README.md) 文件夹中的部署指南。

## 📁 项目结构

```
nowcoder_tracker/
├── js/                          # 前端JavaScript模块
├── nginx/                       # Nginx部署配置
│   ├── README.md               # 部署指南
│   ├── nginx.conf              # 基础nginx配置
│   ├── nginx-domain.conf       # 域名配置
│   ├── docker-compose.yml      # Docker部署
│   └── ...                     # 其他部署相关文件
├── 每日一题相关/                 # 算法题解
├── index.html                  # 主页面
├── simple-server.js            # 简单开发服务器
├── proxy-server.js             # 完整代理服务器
└── ...
```

## 🔧 配置说明

### Cookie配置（仅代理服务器需要）

为了使后端代理能成功请求到牛客网的数据，您需要手动更新 `proxy-server.js` 文件中的 `cookie` 变量：
- 登录牛客网
- 打开浏览器开发者工具（F12），切换到"网络"(Network) 标签页
- 刷新页面，找到任意一个对牛客网 API 的请求
- 在请求头中找到 `Cookie` 字段，复制其完整的字符串值
- 将这个值粘贴到 `proxy-server.js` 文件中第 21 行的 `cookie` 常量里

4.  **访问应用**
    在浏览器中打开 `http://localhost:3001/index.html` 即可开始使用。

## ❓ 常见问题

关于工具的具体使用方法，例如如何获取 User ID、不同颜色代表什么等，请直接查看应用页面右上角的 **FAQ** 标签页。
