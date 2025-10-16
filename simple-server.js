// 简单的静态服务器，用于测试模块化代码
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = 8000;

// 静态文件服务
app.use(express.static('.'));

// 添加CORS头
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
});

// API代理 - 将API请求转发到proxy-server
app.use('/problem', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    logLevel: 'debug',
    onError: (err, req, res) => {
        console.log('Proxy error:', err.message);
        console.log('Request URL:', req.url);
        console.log('Request method:', req.method);
        res.status(500).json({ 
            error: 'API服务不可用', 
            message: '请确保proxy-server.js正在运行 (node proxy-server.js)',
            details: err.message 
        });
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request to:', proxyReq.path);
    }
}));

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Static server is running' });
});

app.listen(port, () => {
    console.log(`📁 Static server listening at http://localhost:${port}`);
    // console.log(`🧪 Test page: http://localhost:${port}/test-refactoring.html`); // 已被删除
    console.log(`🏠 Main app: http://localhost:${port}/index.html`);
    console.log(`\n📝 Note: This is a static server for testing modules.`);
    console.log(`   For full API functionality, use: node proxy-server.js`);
});

