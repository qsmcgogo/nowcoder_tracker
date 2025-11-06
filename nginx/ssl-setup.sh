#!/bin/bash

# SSL证书设置脚本
# 用于配置Let's Encrypt SSL证书

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "请不要使用root用户运行此脚本"
        exit 1
    fi
}

# 检查系统类型
check_system() {
    if [[ -f /etc/debian_version ]]; then
        OS="debian"
        print_message "检测到Debian/Ubuntu系统"
    elif [[ -f /etc/redhat-release ]]; then
        OS="redhat"
        print_message "检测到RedHat/CentOS系统"
    else
        print_error "不支持的操作系统"
        exit 1
    fi
}

# 安装Certbot
install_certbot() {
    print_message "安装Certbot..."
    
    if [[ $OS == "debian" ]]; then
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    elif [[ $OS == "redhat" ]]; then
        sudo yum install -y epel-release
        sudo yum install -y certbot python3-certbot-nginx
    fi
    
    print_message "Certbot安装完成"
}

# 配置防火墙
configure_firewall() {
    print_message "配置防火墙..."
    
    if command -v ufw &> /dev/null; then
        sudo ufw allow 80/tcp
        sudo ufw allow 443/tcp
        print_message "UFW防火墙配置完成"
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --permanent --add-service=http
        sudo firewall-cmd --permanent --add-service=https
        sudo firewall-cmd --reload
        print_message "Firewalld防火墙配置完成"
    else
        print_warning "未检测到防火墙，请手动开放80和443端口"
    fi
}

# 获取SSL证书
get_ssl_certificate() {
    print_message "开始获取SSL证书..."
    
    read -p "请输入你的域名: " domain
    
    if [[ -z "$domain" ]]; then
        print_error "域名不能为空"
        exit 1
    fi
    
    print_message "为域名 $domain 获取SSL证书..."
    
    # 使用certbot获取证书
    sudo certbot --nginx -d "$domain" --non-interactive --agree-tos --email admin@"$domain"
    
    if [[ $? -eq 0 ]]; then
        print_message "SSL证书获取成功！"
    else
        print_error "SSL证书获取失败"
        exit 1
    fi
}

# 设置自动续期
setup_auto_renewal() {
    print_message "设置SSL证书自动续期..."
    
    # 测试自动续期
    sudo certbot renew --dry-run
    
    if [[ $? -eq 0 ]]; then
        print_message "自动续期测试成功"
        
        # 添加定时任务
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        print_message "已添加自动续期定时任务"
    else
        print_warning "自动续期测试失败，请手动检查"
    fi
}

# 更新nginx配置
update_nginx_config() {
    print_message "更新nginx配置以支持HTTPS..."
    
    # 备份原配置
    sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S)
    
    # 创建HTTPS重定向配置
    cat > /tmp/https_redirect.conf << EOF
# HTTP重定向到HTTPS
server {
    listen 80;
    server_name $domain;
    return 301 https://\$server_name\$request_uri;
}
EOF
    
    # 将重定向配置添加到nginx配置
    sudo cp /tmp/https_redirect.conf /etc/nginx/conf.d/https_redirect.conf
    
    # 测试配置
    sudo nginx -t
    
    if [[ $? -eq 0 ]]; then
        sudo systemctl reload nginx
        print_message "nginx配置更新成功"
    else
        print_error "nginx配置测试失败"
        exit 1
    fi
}

# 验证SSL配置
verify_ssl() {
    print_message "验证SSL配置..."
    
    # 检查证书状态
    sudo certbot certificates
    
    # 测试HTTPS连接
    if command -v curl &> /dev/null; then
        print_message "测试HTTPS连接..."
        curl -I "https://$domain"
    fi
    
    print_message "SSL配置验证完成"
}

# 显示完成信息
show_completion_info() {
    print_message "SSL配置完成！"
    echo ""
    echo "访问你的网站:"
    echo "  HTTP:  http://$domain"
    echo "  HTTPS: https://$domain"
    echo ""
    echo "证书信息:"
    sudo certbot certificates
    echo ""
    echo "自动续期已设置，证书将在到期前自动续期"
    echo ""
    print_warning "请确保你的域名DNS已正确解析到此服务器"
}

# 主函数
main() {
    print_message "开始SSL证书配置..."
    
    check_root
    check_system
    
    # 检查是否已安装nginx
    if ! command -v nginx &> /dev/null; then
        print_error "请先安装nginx"
        exit 1
    fi
    
    # 检查是否已安装certbot
    if ! command -v certbot &> /dev/null; then
        install_certbot
    else
        print_message "Certbot已安装"
    fi
    
    configure_firewall
    get_ssl_certificate
    setup_auto_renewal
    update_nginx_config
    verify_ssl
    show_completion_info
}

# 运行主函数
main "$@"

