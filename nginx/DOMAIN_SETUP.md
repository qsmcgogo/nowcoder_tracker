# 域名配置指南 - qsmcgogo.nowcoder.com

本指南将帮助你将nowcoder_tracker应用配置为通过域名 `qsmcgogo.nowcoder.com` 访问。

## 配置步骤

### 1. DNS解析配置

#### 方案A：使用免费DNS服务

**推荐使用Cloudflare（免费）：**

1. 注册Cloudflare账号：https://www.cloudflare.com
2. 添加域名：`nowcoder.com`
3. 添加A记录：
   - 名称：`qsmcgogo`
   - 类型：`A`
   - 内容：`你的服务器IP地址`
   - TTL：`Auto`

**其他免费DNS服务：**
- DNSPod（腾讯）
- 阿里云DNS
- 华为云DNS

#### 方案B：使用本地hosts文件（测试用）

**Windows系统：**
```bash
# 编辑hosts文件（需要管理员权限）
notepad C:\Windows\System32\drivers\etc\hosts

# 添加以下行（替换为你的实际IP）
127.0.0.1 qsmcgogo.nowcoder.com
```

**Linux/Mac系统：**
```bash
# 编辑hosts文件
sudo nano /etc/hosts

# 添加以下行（替换为你的实际IP）
127.0.0.1 qsmcgogo.nowcoder.com
```

### 2. nginx配置

#### 使用域名专用配置

```bash
# 复制域名配置文件
sudo cp nginx-domain.conf /etc/nginx/nginx.conf

# 测试配置
sudo nginx -t

# 重启nginx
sudo systemctl restart nginx
```

#### 或者修改现有配置

在 `nginx.conf` 中修改：
```nginx
server {
    listen 80;
    server_name qsmcgogo.nowcoder.com localhost;
    # ... 其他配置
}
```

### 3. 测试域名解析

```bash
# 测试DNS解析
nslookup qsmcgogo.nowcoder.com

# 或者使用dig
dig qsmcgogo.nowcoder.com

# 测试HTTP访问
curl http://qsmcgogo.nowcoder.com
```

### 4. SSL证书配置（可选）

#### 使用Let's Encrypt免费证书

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d qsmcgogo.nowcoder.com

# 自动续期
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

#### 手动配置SSL证书

1. 将证书文件放在 `/etc/nginx/ssl/` 目录
2. 修改 `nginx-domain.conf` 中的证书路径
3. 取消注释HTTPS server块

## 部署方案

### 方案一：Docker部署

```bash
# 使用域名配置启动
docker run -d \
  --name nowcoder-tracker \
  -p 80:80 \
  -p 443:443 \
  -v $(pwd)/nginx-domain.conf:/etc/nginx/nginx.conf:ro \
  -v $(pwd):/usr/share/nginx/html:ro \
  nginx:alpine
```

### 方案二：直接nginx部署

```bash
# 1. 安装nginx
sudo apt install nginx

# 2. 配置nginx
sudo cp nginx-domain.conf /etc/nginx/nginx.conf

# 3. 创建网站目录
sudo mkdir -p /usr/share/nginx/html

# 4. 复制项目文件
sudo cp -r . /usr/share/nginx/html/

# 5. 设置权限
sudo chown -R nginx:nginx /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html

# 6. 启动nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 方案三：使用Docker Compose

```yaml
# docker-compose-domain.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: nowcoder-tracker-domain
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-domain.conf:/etc/nginx/nginx.conf:ro
      - .:/usr/share/nginx/html:ro
      - ./ssl:/etc/nginx/ssl:ro
    restart: unless-stopped
    networks:
      - nowcoder-network

networks:
  nowcoder-network:
    driver: bridge
```

启动：
```bash
docker-compose -f docker-compose-domain.yml up -d
```

## 测试访问

### 1. 本地测试

```bash
# 使用curl测试
curl http://qsmcgogo.nowcoder.com

# 使用浏览器访问
# http://qsmcgogo.nowcoder.com
```

### 2. 健康检查

```bash
curl http://qsmcgogo.nowcoder.com/health
```

### 3. 静态文件测试

```bash
curl http://qsmcgogo.nowcoder.com/styles.css
```

## 常见问题

### 1. DNS解析失败

**问题：** 域名无法解析
**解决：**
- 检查DNS配置是否正确
- 等待DNS传播（最多24小时）
- 使用 `nslookup` 或 `dig` 检查解析

### 2. 403 Forbidden

**问题：** 访问被拒绝
**解决：**
```bash
# 检查文件权限
sudo chown -R nginx:nginx /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html
```

### 3. 502 Bad Gateway

**问题：** 网关错误
**解决：**
- 检查nginx配置语法：`sudo nginx -t`
- 检查nginx日志：`sudo tail -f /var/log/nginx/error.log`

### 4. SSL证书问题

**问题：** HTTPS无法访问
**解决：**
- 检查证书文件是否存在
- 检查证书是否过期
- 检查nginx SSL配置

## 监控和维护

### 1. 日志监控

```bash
# 查看访问日志
sudo tail -f /var/log/nginx/access.log

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 2. 性能监控

```bash
# 查看nginx状态
sudo systemctl status nginx

# 查看连接数
sudo netstat -an | grep :80 | wc -l
```

### 3. 自动备份

```bash
# 创建备份脚本
cat > /backup/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backup/nowcoder_tracker_$DATE.tar.gz /usr/share/nginx/html/
cp /etc/nginx/nginx.conf /backup/nginx.conf.$DATE
find /backup -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /backup/backup.sh

# 设置定时任务
crontab -e
# 添加：0 2 * * * /backup/backup.sh
```

## 总结

通过以上配置，你的nowcoder_tracker应用就可以通过 `qsmcgogo.nowcoder.com` 域名访问了！

**访问地址：**
- HTTP: http://qsmcgogo.nowcoder.com
- HTTPS: https://qsmcgogo.nowcoder.com（配置SSL后）

**下一步：**
1. 配置SSL证书
2. 设置CDN加速
3. 配置监控告警
4. 优化性能
