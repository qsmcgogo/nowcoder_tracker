# 部署指南 - nowcoder_tracker

本指南将帮助你在生产环境中部署nowcoder_tracker应用。

## 部署方式

### 方式一：Docker部署（推荐）

#### 1. 准备工作

确保你的服务器已安装：
- Docker
- Docker Compose

#### 2. 部署步骤

```bash
# 1. 克隆项目到服务器
git clone https://github.com/qsmcgogo/nowcoder_tracker.git
cd nowcoder_tracker

# 2. 启动服务
docker-compose up -d

# 3. 查看服务状态
docker-compose ps

# 4. 查看日志
docker-compose logs -f nginx
```

#### 3. 访问应用

- HTTP: `http://your-server-ip`
- 健康检查: `http://your-server-ip/health`

### 方式二：直接Nginx部署

#### 1. 安装Nginx

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nginx
```

**CentOS/RHEL:**
```bash
sudo yum install nginx
# 或者
sudo dnf install nginx
```

#### 2. 配置Nginx

```bash
# 1. 复制配置文件
sudo cp nginx.conf /etc/nginx/nginx.conf

# 2. 创建网站目录
sudo mkdir -p /usr/share/nginx/html

# 3. 复制项目文件
sudo cp -r . /usr/share/nginx/html/

# 4. 设置权限
sudo chown -R nginx:nginx /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html

# 5. 测试配置
sudo nginx -t

# 6. 启动/重启Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
sudo systemctl restart nginx
```

#### 3. 防火墙配置

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## SSL/HTTPS配置

### 使用Let's Encrypt免费证书

#### 1. 安装Certbot

**Ubuntu/Debian:**
```bash
sudo apt install certbot python3-certbot-nginx
```

**CentOS/RHEL:**
```bash
sudo yum install certbot python3-certbot-nginx
```

#### 2. 获取SSL证书

```bash
# 替换your-domain.com为你的实际域名
sudo certbot --nginx -d your-domain.com
```

#### 3. 自动续期

```bash
# 测试自动续期
sudo certbot renew --dry-run

# 设置定时任务
sudo crontab -e
# 添加以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 手动SSL配置

如果你有自己的SSL证书：

1. 将证书文件放在 `/etc/nginx/ssl/` 目录
2. 修改 `nginx.conf` 中的SSL配置部分
3. 取消注释HTTPS server块
4. 更新证书路径

## 性能优化

### 1. 启用Gzip压缩

nginx.conf中已包含Gzip配置，确保以下文件类型被压缩：
- HTML, CSS, JavaScript
- JSON, XML
- 字体文件

### 2. 静态文件缓存

配置已设置：
- 静态资源（JS, CSS, 图片）缓存1年
- HTML文件不缓存，确保更新及时

### 3. 安全头设置

已配置的安全头：
- X-Frame-Options: 防止点击劫持
- X-Content-Type-Options: 防止MIME类型嗅探
- X-XSS-Protection: XSS保护
- Referrer-Policy: 控制referrer信息

## 监控和日志

### 1. 查看访问日志

```bash
# 实时查看访问日志
sudo tail -f /var/log/nginx/access.log

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 2. 日志分析

```bash
# 统计访问量最高的页面
sudo awk '{print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10

# 统计IP访问量
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10
```

### 3. 健康检查

应用提供健康检查端点：
```bash
curl http://your-server-ip/health
```

## 故障排除

### 1. 常见问题

**问题：Nginx启动失败**
```bash
# 检查配置文件语法
sudo nginx -t

# 查看错误日志
sudo journalctl -u nginx
```

**问题：403 Forbidden错误**
```bash
# 检查文件权限
ls -la /usr/share/nginx/html/

# 修复权限
sudo chown -R nginx:nginx /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html
```

**问题：静态文件404**
```bash
# 检查文件是否存在
ls -la /usr/share/nginx/html/js/
ls -la /usr/share/nginx/html/styles.css

# 检查nginx配置中的root路径
grep -n "root" /etc/nginx/nginx.conf
```

### 2. 性能问题

**问题：页面加载慢**
- 检查Gzip是否启用
- 检查静态文件缓存设置
- 考虑使用CDN

**问题：高并发问题**
- 调整worker_processes数量
- 增加worker_connections
- 考虑负载均衡

## 更新部署

### 1. 更新应用

```bash
# 拉取最新代码
git pull origin main

# 重新部署
docker-compose down
docker-compose up -d

# 或者直接Nginx部署
sudo cp -r . /usr/share/nginx/html/
sudo systemctl reload nginx
```

### 2. 回滚

```bash
# 回滚到上一个版本
git checkout HEAD~1

# 重新部署
docker-compose down
docker-compose up -d
```

## 备份

### 1. 配置文件备份

```bash
# 备份nginx配置
sudo cp /etc/nginx/nginx.conf /backup/nginx.conf.$(date +%Y%m%d)

# 备份项目文件
tar -czf /backup/nowcoder_tracker.$(date +%Y%m%d).tar.gz /usr/share/nginx/html/
```

### 2. 自动备份脚本

创建 `/backup/backup.sh`：
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup"

# 备份项目文件
tar -czf $BACKUP_DIR/nowcoder_tracker_$DATE.tar.gz /usr/share/nginx/html/

# 备份nginx配置
cp /etc/nginx/nginx.conf $BACKUP_DIR/nginx.conf.$DATE

# 删除7天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "nginx.conf.*" -mtime +7 -delete

echo "Backup completed: $DATE"
```

设置定时任务：
```bash
# 每天凌晨2点执行备份
0 2 * * * /backup/backup.sh
```

## 联系支持

如果遇到部署问题，请：
1. 查看本文档的故障排除部分
2. 检查nginx错误日志
3. 在GitHub Issues中提交问题

---

**注意：** 请根据你的实际环境和需求调整配置。生产环境部署前请充分测试。

