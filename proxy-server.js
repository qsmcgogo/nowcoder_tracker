const express = require('express');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const { URL } = require('url');

const app = express();
const port = 3000;

// 环境切换: 'www', 'pre', 或 'd'
const CURRENT_ENV = 'pre'; 

const HOST_MAP = {
    'www': 'https://www.nowcoder.com',
    'pre': 'https://pre.nowcoder.com',
    'd': 'https://d.nowcoder.com'
};

const targetHost = HOST_MAP[CURRENT_ENV] || HOST_MAP['www']; // 默认指向 www

// A generic, robust manual proxy handler
const manualProxyHandler = (basePath) => (clientReq, clientRes) => {
    // Construct the path by combining the fixed base path and the client's query string.
    const queryString = clientReq.url.includes('?') ? clientReq.url.substring(clientReq.url.indexOf('?')) : '';
    const correctPath = `${basePath}${queryString}`;
    console.log(`[Manual Proxy] Intercepted request for '${clientReq.url}'. Corrected path to: '${correctPath}'`);

    const targetUrl = new URL(`${targetHost}${correctPath}`);

    // 透传客户端 Cookie，并从中提取 csrfToken
    const cookieHeader = clientReq.headers['cookie'] || '';
    const csrfMatch = cookieHeader.match(/csrfToken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1].trim() : '';

    const options = {
        hostname: targetUrl.hostname,
        port: 443,
        path: targetUrl.pathname + targetUrl.search,
        method: clientReq.method,
        headers: {
            'Accept': clientReq.headers['accept'] || 'application/json, text/plain, */*',
            'Accept-Encoding': clientReq.headers['accept-encoding'],
            'Accept-Language': clientReq.headers['accept-language'],
            'Connection': 'keep-alive',
            'Cookie': cookieHeader,
            'Host': targetUrl.hostname,
            'Referer': `https://${targetUrl.hostname}/problem/tracker/list`,
            'User-Agent': clientReq.headers['user-agent'],
            'X-CSRF-TOKEN': csrfToken
        }
    };

    // For POST/PUT requests, it's crucial to forward the body-related headers.
    if (clientReq.method === 'POST' || clientReq.method === 'PUT') {
        const contentType = clientReq.headers['content-type'];
        const contentLength = clientReq.headers['content-length'];
        if (contentType) {
            options.headers['Content-Type'] = contentType;
        }
        if (contentLength && contentLength !== '0') {
            options.headers['Content-Length'] = contentLength;
        }
    }
    
    const proxyReq = https.request(options, (targetRes) => {
        console.log(`[Manual Proxy] Received response from Nowcoder. Status: ${targetRes.statusCode}`);
        clientRes.writeHead(targetRes.statusCode, targetRes.headers);
        targetRes.pipe(clientRes, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error('[Manual Proxy] Error connecting to Nowcoder:', err);
        clientRes.status(500).send('Proxy error.');
    });

    // For POST/PUT requests, we need to manually pipe the request body.
    if (clientReq.method === 'POST' || clientReq.method === 'PUT') {
        clientReq.pipe(proxyReq, { end: true });
    } else {
        proxyReq.end(); // For GET/DELETE etc., just end the request.
    }
};

// Apply the manual proxy handler with the correct, hardcoded base path for each route
app.use('/problem/tracker/list', manualProxyHandler('/problem/tracker/list'));
app.use('/problem/tracker/diff', manualProxyHandler('/problem/tracker/diff'));
app.use('/problem/tracker/ranks/problem', manualProxyHandler('/problem/tracker/ranks/problem'));
app.use('/problem/tracker/ranks/checkin', manualProxyHandler('/problem/tracker/ranks/checkin'));
app.use('/problem/tracker/clock/todayinfo', manualProxyHandler('/problem/tracker/clock/todayinfo'));
app.use('/problem/tracker/clock/add', manualProxyHandler('/problem/tracker/clock/add'));
app.use('/problem/tracker/clock/list', manualProxyHandler('/problem/tracker/clock/list'));
app.use('/problem/tracker/clock/monthinfo', manualProxyHandler('/problem/tracker/clock/monthinfo'));
app.use('/problem/tracker/addcheckin', manualProxyHandler('/problem/tracker/addcheckin'));

// Endpoints for Skill Tree
app.use('/problem/tracker/skill-tree/tagInfo', manualProxyHandler('/problem/tracker/skill-tree/tagInfo'));
app.use('/problem/tracker/skill-tree/progress', manualProxyHandler('/problem/tracker/skill-tree/progress'));
app.use('/problem/tracker/skill-tree/update', manualProxyHandler('/problem/tracker/skill-tree/update'));


// New endpoint to proxy avatars and bypass CORS for canvas
app.get('/avatar-proxy', (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) {
        return res.status(400).send('Image URL is required');
    }

    const options = {
        hostname: new URL(imageUrl).hostname,
        path: new URL(imageUrl).pathname,
        method: 'GET',
        headers: {
            'User-Agent': 'Node.js Proxy'
        }
    };

    const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy request error:', err);
        res.status(500).send('Failed to fetch image');
    });

    proxyReq.end();
});

// Serve static files like index.html, script.js from the root directory
app.use(express.static(__dirname));

// Fallback for any other request - THIS MUST BE AFTER STATIC anD SPECIFIC ROUTES
app.use(manualProxyHandler());


app.listen(port, () => {
    console.log(`Proxy server listening at http://localhost:${port}`);
    console.log(`Frontend running at http://localhost:8080`);
});
