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
    // Preserve sub-path after the mounted prefix; include query string
    // Example: mount '/problem/tracker/team/my' and request '/apply' ->
    // final path should be '/problem/tracker/team/my/apply'
    const subPathWithQuery = clientReq.url || '';
    const prefix = basePath || '';
    const correctPath = `${prefix}${subPathWithQuery}`;
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
app.use('/problem/tracker/clock/add-share-link', manualProxyHandler('/problem/tracker/clock/add-share-link'));
app.use('/problem/tracker/clock/list', manualProxyHandler('/problem/tracker/clock/list'));
app.use('/problem/tracker/clock/monthinfo', manualProxyHandler('/problem/tracker/clock/monthinfo'));
app.use('/problem/tracker/clock/daylink', manualProxyHandler('/problem/tracker/clock/daylink'));
app.use('/problem/tracker/addcheckin', manualProxyHandler('/problem/tracker/addcheckin'));
app.use('/problem/tracker/badge/userInfo', manualProxyHandler('/problem/tracker/badge/userInfo'));
app.use('/problem/tracker/badge/list', manualProxyHandler('/problem/tracker/badge/list'));

// Endpoints for Skill Tree
app.use('/problem/tracker/skill-tree/tagInfo', manualProxyHandler('/problem/tracker/skill-tree/tagInfo'));
app.use('/problem/tracker/skill-tree/progress', manualProxyHandler('/problem/tracker/skill-tree/progress'));
app.use('/problem/tracker/skill-tree/update', manualProxyHandler('/problem/tracker/skill-tree/update'));

// Admin endpoints for Skill Tree question management
app.use('/problem/tracker/skill-tree/add-question', manualProxyHandler('/problem/tracker/skill-tree/add-question'));
app.use('/problem/tracker/skill-tree/update-question', manualProxyHandler('/problem/tracker/skill-tree/update-question'));
app.use('/problem/tracker/skill-tree/delete-question', manualProxyHandler('/problem/tracker/skill-tree/delete-question'));

// Admin endpoint for Rankings
app.use('/problem/tracker/rank/update-accept-count', manualProxyHandler('/problem/tracker/rank/update-accept-count'));

// Team endpoints
app.use('/problem/tracker/team/my', manualProxyHandler('/problem/tracker/team/my'));
app.use('/problem/tracker/team/create', manualProxyHandler('/problem/tracker/team/create'));
app.use('/problem/tracker/team/update', manualProxyHandler('/problem/tracker/team/update'));
app.use('/problem/tracker/team/members', manualProxyHandler('/problem/tracker/team/members'));
app.use('/problem/tracker/team/member/check', manualProxyHandler('/problem/tracker/team/member/check'));
app.use('/problem/tracker/team/member/check/uid', manualProxyHandler('/problem/tracker/team/member/check/uid'));
app.use('/problem/tracker/team/member/add', manualProxyHandler('/problem/tracker/team/member/add'));
app.use('/problem/tracker/team/member/delete', manualProxyHandler('/problem/tracker/team/member/delete'));
app.use('/problem/tracker/team/transfer', manualProxyHandler('/problem/tracker/team/transfer'));
app.use('/problem/tracker/team/invite/create', manualProxyHandler('/problem/tracker/team/invite/create'));
app.use('/problem/tracker/team/invite', manualProxyHandler('/problem/tracker/team/invite'));
app.use('/problem/tracker/team/apply', manualProxyHandler('/problem/tracker/team/apply'));
app.use('/problem/tracker/team/apply/approve', manualProxyHandler('/problem/tracker/team/apply/approve'));
app.use('/problem/tracker/team/apply/reject', manualProxyHandler('/problem/tracker/team/apply/reject'));
app.use('/problem/tracker/team/apply/approve-all', manualProxyHandler('/problem/tracker/team/apply/approve-all'));
app.use('/problem/tracker/team/apply/reject-all', manualProxyHandler('/problem/tracker/team/apply/reject-all'));
app.use('/problem/tracker/team/invite/user', manualProxyHandler('/problem/tracker/team/invite/user'));
app.use('/problem/tracker/team/invite/accept', manualProxyHandler('/problem/tracker/team/invite/accept'));
app.use('/problem/tracker/team/invite/decline', manualProxyHandler('/problem/tracker/team/invite/decline'));
app.use('/problem/tracker/team/invite/cancel', manualProxyHandler('/problem/tracker/team/invite/cancel'));
app.use('/problem/tracker/team/stats/summary', manualProxyHandler('/problem/tracker/team/stats/summary'));
app.use('/problem/tracker/team/leaderboard', manualProxyHandler('/problem/tracker/team/leaderboard'));
app.use('/problem/tracker/team/apply/list', manualProxyHandler('/problem/tracker/team/apply/list'));
app.use('/problem/tracker/team/invite/list', manualProxyHandler('/problem/tracker/team/invite/list'));
app.use('/problem/tracker/team/my/apply', manualProxyHandler('/problem/tracker/team/my/apply'));
app.use('/problem/tracker/team/my/invite', manualProxyHandler('/problem/tracker/team/my/invite'));
app.use('/problem/tracker/team/quit', manualProxyHandler('/problem/tracker/team/quit'));
app.use('/problem/tracker/team/disband', manualProxyHandler('/problem/tracker/team/disband'));


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
