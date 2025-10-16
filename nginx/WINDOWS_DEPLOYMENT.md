# Windows环境部署指南

由于当前环境是Windows，我们提供几种部署方案：

## 方案一：使用现有的Node.js服务器（推荐）

你的项目已经有一个简单的Node.js服务器，可以直接使用：

```bash
# 启动简单服务器
node simple-server.js
```

访问：http://localhost:8000

## 方案二：安装nginx for Windows

### 1. 下载nginx

1. 访问 http://nginx.org/en/download.html
2. 下载Windows版本的nginx（如 nginx-1.24.0.zip）
3. 解压到 `C:\nginx\`

### 2. 配置nginx

```bash
# 复制我们的配置文件
copy nginx.conf C:\nginx\conf\nginx.conf

# 创建网站目录
mkdir C:\nginx\html

# 复制项目文件
xcopy /E /I . C:\nginx\html\
```

### 3. 启动nginx

```bash
# 进入nginx目录
cd C:\nginx

# 启动nginx
nginx.exe

# 或者作为Windows服务启动
nginx.exe -s install
net start nginx
```

### 4. 访问网站

- 主站：http://localhost
- 健康检查：http://localhost/health

## 方案三：使用Docker Desktop

### 1. 安装Docker Desktop

1. 下载Docker Desktop for Windows
2. 安装并启动Docker Desktop
3. 确保WSL2已启用

### 2. 使用Docker Compose

```bash
# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f nginx
```

## 方案四：使用IIS（Windows自带）

### 1. 启用IIS

1. 控制面板 → 程序 → 启用或关闭Windows功能
2. 勾选"Internet Information Services"
3. 展开并勾选"万维网服务"下的所有选项

### 2. 配置IIS

1. 打开IIS管理器
2. 右键"网站" → 添加网站
3. 设置：
   - 网站名称：nowcoder-tracker
   - 物理路径：你的项目路径
   - 端口：80

### 3. 配置URL重写（可选）

如果需要单页应用支持，安装URL重写模块：
1. 下载IIS URL重写模块
2. 安装后在IIS中配置重写规则

## 方案五：使用Python内置服务器

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

访问：http://localhost:8000

## 推荐方案

对于开发环境，推荐使用**方案一**（Node.js服务器），因为：
1. 无需额外安装
2. 支持CORS
3. 配置简单
4. 适合开发调试

对于生产环境，推荐使用**方案二**（nginx）或**方案三**（Docker），因为：
1. 性能更好
2. 功能更完整
3. 支持SSL
4. 适合生产部署

## 测试部署

无论使用哪种方案，都可以通过以下方式测试：

```bash
# 测试主页面
curl http://localhost:8000

# 测试健康检查（如果支持）
curl http://localhost:8000/health

# 测试静态文件
curl http://localhost:8000/styles.css
```

## 故障排除

### 端口被占用

```bash
# 查看端口占用
netstat -ano | findstr :8000

# 杀死占用进程
taskkill /PID <进程ID> /F
```

### 权限问题

```bash
# 以管理员身份运行PowerShell
# 或者修改文件权限
icacls C:\nginx /grant Everyone:F /T
```

### 防火墙问题

```bash
# 添加防火墙规则
netsh advfirewall firewall add rule name="nginx" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="nginx-ssl" dir=in action=allow protocol=TCP localport=443
```

## 下一步

选择一种方案后，我们可以：
1. 测试部署效果
2. 配置SSL证书
3. 设置域名
4. 优化性能
5. 配置监控

你想使用哪种方案？
