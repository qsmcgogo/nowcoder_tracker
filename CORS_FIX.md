# CORS问题修复说明

## 🐛 问题描述

当你通过域名 `qsmcgogo.nowcoder.com:8000` 访问应用时，出现以下错误：

```
Access to fetch at 'http://localhost:3000/problem/tracker/ranks?page=1&limit=20' 
from origin 'http://qsmcgogo.nowcoder.com:8000' has been blocked by CORS policy
```

这是因为：
1. 前端通过域名访问（`qsmcgogo.nowcoder.com:8000`）
2. 但API请求指向 `localhost:3000`
3. 浏览器阻止了跨域请求

## ✅ 修复方案

### 方案一：使用修复后的simple-server.js（推荐）

我已经修复了 `simple-server.js`，现在它包含API代理功能：

1. **修改了前端配置**：
   ```javascript
   // js/config.js
   API_BASE: window.location.origin, // 使用当前域名
   ```

2. **增强了simple-server.js**：
   - 添加了API代理功能
   - 将 `/problem/*` 请求转发到 `localhost:3000`
   - 改进了CORS头设置

### 方案二：同时运行两个服务器

如果你需要完整的API功能，需要同时运行两个服务器：

```bash
# 终端1：启动API代理服务器
node proxy-server.js

# 终端2：启动静态服务器
node simple-server.js
```

或者使用启动脚本：

```bash
# Windows批处理
start-dev.bat

# PowerShell
.\start-dev.ps1
```

## 🚀 使用方法

### 方法一：仅使用simple-server.js（适合基础功能）

```bash
node simple-server.js
```

访问：http://qsmcgogo.nowcoder.com:8000

**注意：** 这种方法需要 `proxy-server.js` 在后台运行才能获得完整API功能。

### 方法二：完整开发环境

```bash
# 启动两个服务器
.\start-dev.ps1
```

或者手动启动：

```bash
# 终端1
node proxy-server.js

# 终端2  
node simple-server.js
```

## 🔧 配置说明

### 前端配置（已修复）

```javascript
// js/config.js
export const APP_CONFIG = {
    API_BASE: window.location.origin, // 自动使用当前域名
    // ... 其他配置
};
```

### 服务器配置（已增强）

```javascript
// simple-server.js
// 添加了API代理
app.use('/problem', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    onError: (err, req, res) => {
        // 友好的错误提示
    }
}));
```

## 📋 测试步骤

1. **启动服务器**：
   ```bash
   node simple-server.js
   ```

2. **配置域名**（可选）：
   ```powershell
   cd nginx
   .\setup-local-domain.ps1
   ```

3. **测试访问**：
   - http://localhost:8000
   - http://qsmcgogo.nowcoder.com:8000

4. **检查功能**：
   - 排行榜应该能正常加载
   - 其他API功能也应该正常工作

## 🐛 故障排除

### 问题1：API请求仍然失败

**原因：** `proxy-server.js` 没有运行

**解决：**
```bash
# 启动API代理服务器
node proxy-server.js
```

### 问题2：CORS错误仍然存在

**原因：** 浏览器缓存了旧的配置

**解决：**
1. 硬刷新页面（Ctrl+F5）
2. 清除浏览器缓存
3. 重启服务器

### 问题3：域名解析失败

**原因：** hosts文件没有正确配置

**解决：**
```powershell
cd nginx
.\setup-local-domain.ps1
.\test-domain.ps1
```

## 📞 需要帮助？

如果问题仍然存在：

1. 检查控制台错误信息
2. 确认两个服务器都在运行
3. 验证域名解析是否正确
4. 在GitHub Issues中提交问题

## 🎯 总结

现在你可以：
- ✅ 通过 `localhost:8000` 访问（基础功能）
- ✅ 通过 `qsmcgogo.nowcoder.com:8000` 访问（完整功能）
- ✅ 避免CORS跨域问题
- ✅ 获得友好的错误提示
