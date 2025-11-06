# 快速开始指南

## 🚀 最简单的使用方法

### 1. 启动开发服务器

```bash
# 在项目根目录运行
node simple-server.js
```

访问：http://localhost:8000

### 2. 配置域名访问（可选）

如果你想通过 `qsmcgogo.nowcoder.com` 访问：

#### Windows用户：

1. **以管理员身份运行PowerShell**
2. **进入nginx文件夹：**
   ```powershell
   cd nginx
   ```
3. **设置域名：**
   ```powershell
   .\setup-local-domain.ps1
   ```
4. **测试配置：**
   ```powershell
   .\test-domain.ps1
   ```

#### 恢复原始配置：
```powershell
.\restore-hosts.ps1
```

## 📋 测试结果说明

运行 `test-domain.ps1` 后，你会看到类似这样的结果：

```
✅ localhost:8000 - 连接成功
✅ 健康检查 - 通过  
✅ 静态文件 - 访问成功
❌ 域名解析 - 需要先配置hosts文件
```

这是正常的！说明：
- ✅ 你的Node.js服务器运行正常
- ❌ 需要先运行 `setup-local-domain.ps1` 配置域名

## 🌐 访问地址

配置完成后，你可以通过以下地址访问：

- **开发环境：** http://localhost:8000
- **域名访问：** http://qsmcgogo.nowcoder.com:8000

## 🔧 故障排除

### 问题1：PowerShell脚本无法运行

**解决方案：**
```powershell
# 设置执行策略
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 问题2：权限不足

**解决方案：**
- 右键点击PowerShell
- 选择"以管理员身份运行"
- 重新执行脚本

### 问题3：端口被占用

**解决方案：**
```bash
# 查看端口占用
netstat -ano | findstr :8000

# 杀死占用进程
taskkill /PID <进程ID> /F
```

## 📞 需要帮助？

如果遇到问题：
1. 查看 [README.md](README.md) 详细文档
2. 检查 [DEPLOYMENT.md](DEPLOYMENT.md) 部署指南
3. 在GitHub Issues中提交问题
