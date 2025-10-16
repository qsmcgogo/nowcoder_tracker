# Nginx 部署配置

这个文件夹包含了nowcoder_tracker项目的所有nginx相关配置文件。

## 📁 文件结构

```
nginx/
├── README.md                    # 本文件
├── nginx.conf                   # 基础nginx配置
├── nginx-domain.conf            # 域名专用nginx配置
├── docker-compose.yml           # Docker部署配置
├── DEPLOYMENT.md                # 详细部署指南
├── WINDOWS_DEPLOYMENT.md        # Windows环境部署指南
├── DOMAIN_SETUP.md              # 域名配置指南
├── ssl-setup.sh                 # SSL证书自动配置脚本
├── setup-local-domain.ps1       # PowerShell域名设置脚本
├── restore-hosts.ps1            # PowerShell恢复hosts脚本
├── test-domain.ps1              # PowerShell域名测试脚本
├── setup-local-domain.bat       # 批处理域名设置脚本
└── restore-hosts.bat            # 批处理恢复hosts脚本
```

## 🚀 快速开始

> **📖 详细指南：** 查看 [QUICK_START.md](QUICK_START.md) 获取最简单的使用方法

### 1. 本地开发（推荐）

```bash
# 启动Node.js开发服务器
node simple-server.js
```

访问：http://localhost:8000

### 2. 域名访问（本地测试）

```powershell
# 以管理员身份运行PowerShell
cd nginx
.\setup-local-domain.ps1
.\test-domain.ps1
```

访问：http://qsmcgogo.nowcoder.com:8000

### 3. Docker部署

```bash
cd nginx
docker-compose up -d
```

访问：http://localhost

### 4. 生产环境部署

```bash
# 复制配置文件
sudo cp nginx/nginx-domain.conf /etc/nginx/nginx.conf

# 创建网站目录
sudo mkdir -p /usr/share/nginx/html

# 复制项目文件
sudo cp -r .. /usr/share/nginx/html/

# 启动nginx
sudo systemctl start nginx
```

## 📋 配置说明

### nginx.conf
- 基础nginx配置
- 支持localhost访问
- 包含性能优化和安全配置

### nginx-domain.conf
- 域名专用配置
- 支持 `qsmcgogo.nowcoder.com` 访问
- 包含SSL/HTTPS配置模板

### docker-compose.yml
- Docker容器化部署
- 自动挂载配置文件
- 支持端口映射

## 🔧 常用命令

### 测试配置
```bash
# 测试nginx配置语法
sudo nginx -t

# 测试域名解析
nslookup qsmcgogo.nowcoder.com

# 测试HTTP连接
curl http://qsmcgogo.nowcoder.com
```

### 管理服务
```bash
# 启动nginx
sudo systemctl start nginx

# 重启nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx

# 查看日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Docker管理
```bash
# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f nginx

# 停止服务
docker-compose down
```

## 🌐 访问地址

- **开发环境：** http://localhost:8000
- **本地域名：** http://qsmcgogo.nowcoder.com:8000
- **生产环境：** http://qsmcgogo.nowcoder.com
- **HTTPS：** https://qsmcgogo.nowcoder.com（配置SSL后）

## 📚 详细文档

- [DEPLOYMENT.md](DEPLOYMENT.md) - 完整部署指南
- [WINDOWS_DEPLOYMENT.md](WINDOWS_DEPLOYMENT.md) - Windows环境部署
- [DOMAIN_SETUP.md](DOMAIN_SETUP.md) - 域名配置指南

## 🔍 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   netstat -ano | findstr :80
   taskkill /PID <进程ID> /F
   ```

2. **权限问题**
   ```bash
   sudo chown -R nginx:nginx /usr/share/nginx/html
   sudo chmod -R 755 /usr/share/nginx/html
   ```

3. **DNS解析失败**
   ```bash
   # Windows
   ipconfig /flushdns
   
   # Linux
   sudo systemctl restart systemd-resolved
   ```

### 日志查看

```bash
# nginx错误日志
sudo tail -f /var/log/nginx/error.log

# nginx访问日志
sudo tail -f /var/log/nginx/access.log

# Docker日志
docker-compose logs -f nginx
```

## 📞 支持

如果遇到问题，请：
1. 查看相关文档
2. 检查日志文件
3. 在GitHub Issues中提交问题
