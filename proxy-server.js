const express = require('express');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// 环境切换: 'www', 'pre', 或 'd'
const CURRENT_ENV = 'pre';

// 自动生成 env-config.json 文件
const battleDomainMap = {
    'd': 'dac.nowcoder.com',
    'pre': 'preac.nowcoder.com',
    'www': 'ac.nowcoder.com'
};
const battleDomain = battleDomainMap[CURRENT_ENV] || battleDomainMap['d'];
const envConfig = {
    env: CURRENT_ENV,
    battleDomain: battleDomain
};
const envConfigPath = path.join(__dirname, 'env-config.json');
fs.writeFileSync(envConfigPath, JSON.stringify(envConfig, null, 2), 'utf8');
console.log(`[Env Config] Generated env-config.json: env=${CURRENT_ENV}, battleDomain=${battleDomain}`); 

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
// Admin endpoint for updating all topic badges
app.use('/problem/tracker/badge/update-all-topic-badges', manualProxyHandler('/problem/tracker/badge/update-all-topic-badges'));

// Endpoints for Skill Tree
app.use('/problem/tracker/skill-tree/tagInfo', manualProxyHandler('/problem/tracker/skill-tree/tagInfo'));
app.use('/problem/tracker/skill-tree/progress', manualProxyHandler('/problem/tracker/skill-tree/progress'));
app.use('/problem/tracker/skill-tree/update', manualProxyHandler('/problem/tracker/skill-tree/update'));

// Admin endpoints for Skill Tree question management
app.use('/problem/tracker/skill-tree/add-question', manualProxyHandler('/problem/tracker/skill-tree/add-question'));
app.use('/problem/tracker/skill-tree/update-question', manualProxyHandler('/problem/tracker/skill-tree/update-question'));
app.use('/problem/tracker/skill-tree/delete-question', manualProxyHandler('/problem/tracker/skill-tree/delete-question'));
// Batch replace questions for a tag
app.use('/problem/tracker/skill-tree/batch-replace', manualProxyHandler('/problem/tracker/skill-tree/batch-replace'));

// Admin endpoint for Rankings
app.use('/problem/tracker/rank/update-accept-count', manualProxyHandler('/problem/tracker/rank/update-accept-count'));
app.use('/problem/tracker/rank/update-submission-count', manualProxyHandler('/problem/tracker/rank/update-submission-count'));

// Team endpoints
app.use('/problem/tracker/team/my', manualProxyHandler('/problem/tracker/team/my'));
app.use('/problem/tracker/team/create', manualProxyHandler('/problem/tracker/team/create'));
app.use('/problem/tracker/team/update', manualProxyHandler('/problem/tracker/team/update'));
app.use('/problem/tracker/team/members', manualProxyHandler('/problem/tracker/team/members'));
app.use('/problem/tracker/team/member/check', manualProxyHandler('/problem/tracker/team/member/check'));
app.use('/problem/tracker/team/member/check/uid', manualProxyHandler('/problem/tracker/team/member/check/uid'));
app.use('/problem/tracker/team/member/add', manualProxyHandler('/problem/tracker/team/member/add'));
app.use('/problem/tracker/team/member/delete', manualProxyHandler('/problem/tracker/team/member/delete'));
app.use('/problem/tracker/team/member/nickname', manualProxyHandler('/problem/tracker/team/member/nickname'));
app.use('/problem/tracker/team/member/my/nickname', manualProxyHandler('/problem/tracker/team/member/my/nickname'));
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
app.use('/problem/tracker/team/leaderboard/clock', manualProxyHandler('/problem/tracker/team/leaderboard/clock'));
app.use('/problem/tracker/team/leaderboard/skill', manualProxyHandler('/problem/tracker/team/leaderboard/skill'));
app.use('/problem/tracker/team/leaderboard/topic', manualProxyHandler('/problem/tracker/team/leaderboard/topic'));
app.use('/problem/tracker/team/leaderboard', manualProxyHandler('/problem/tracker/team/leaderboard'));
app.use('/problem/tracker/team/rank/rebuild', manualProxyHandler('/problem/tracker/team/rank/rebuild'));
app.use('/problem/tracker/team/apply/list', manualProxyHandler('/problem/tracker/team/apply/list'));
app.use('/problem/tracker/team/invite/list', manualProxyHandler('/problem/tracker/team/invite/list'));
app.use('/problem/tracker/team/my/apply', manualProxyHandler('/problem/tracker/team/my/apply'));
app.use('/problem/tracker/team/my/invite', manualProxyHandler('/problem/tracker/team/my/invite'));
app.use('/problem/tracker/team/quit', manualProxyHandler('/problem/tracker/team/quit'));
app.use('/problem/tracker/team/disband', manualProxyHandler('/problem/tracker/team/disband'));

// Team activity endpoints
app.use('/problem/tracker/team/activity/clock-total', manualProxyHandler('/problem/tracker/team/activity/clock-total'));
app.use('/problem/tracker/team/activity/clock-days-users', manualProxyHandler('/problem/tracker/team/activity/clock-days-users'));
app.use('/problem/tracker/team/activity/topic-finished-users', manualProxyHandler('/problem/tracker/team/activity/topic-finished-users'));
app.use('/problem/tracker/team/activity/skill-finished-users', manualProxyHandler('/problem/tracker/team/activity/skill-finished-users'));
app.use('/problem/tracker/team/activity/teams/leaderboard', manualProxyHandler('/problem/tracker/team/activity/teams/leaderboard'));

// Battle routes
app.use('/problem/tracker/battle/match', manualProxyHandler('/problem/tracker/battle/match'));
app.use('/problem/tracker/battle/match-ai', manualProxyHandler('/problem/tracker/battle/match-ai'));
app.use('/problem/tracker/battle/match-mirror', manualProxyHandler('/problem/tracker/battle/match-mirror'));
app.use('/problem/tracker/battle/poll', manualProxyHandler('/problem/tracker/battle/poll'));
app.use('/problem/tracker/battle/cancel', manualProxyHandler('/problem/tracker/battle/cancel'));
app.use('/problem/tracker/battle/info', manualProxyHandler('/problem/tracker/battle/info'));
app.use('/problem/tracker/battle/records', manualProxyHandler('/problem/tracker/battle/records'));
app.use('/problem/tracker/battle/leaderboard', manualProxyHandler('/problem/tracker/battle/leaderboard'));
app.use('/problem/tracker/battle/template', manualProxyHandler('/problem/tracker/battle/template'));
app.use('/problem/tracker/battle/create-room', manualProxyHandler('/problem/tracker/battle/create-room'));
app.use('/problem/tracker/battle/join-room', manualProxyHandler('/problem/tracker/battle/join-room'));
app.use('/problem/tracker/battle/disband-room', manualProxyHandler('/problem/tracker/battle/disband-room'));
app.use('/problem/tracker/battle/force-abandon', manualProxyHandler('/problem/tracker/battle/force-abandon'));
// Mirror mode endpoints
app.use('/problem/tracker/battle/create-mirror', manualProxyHandler('/problem/tracker/battle/create-mirror'));
app.use('/problem/tracker/battle/create-mirror-room', manualProxyHandler('/problem/tracker/battle/create-mirror-room'));
app.use('/problem/tracker/battle/challenge-mirror-room', manualProxyHandler('/problem/tracker/battle/challenge-mirror-room'));
app.use('/problem/tracker/battle/remove-mirror', manualProxyHandler('/problem/tracker/battle/remove-mirror'));
app.use('/problem/tracker/battle/check-mirrors', manualProxyHandler('/problem/tracker/battle/check-mirrors'));
app.use('/problem/tracker/battle/my-mirrors', manualProxyHandler('/problem/tracker/battle/my-mirrors'));
// Admin endpoints
app.use('/problem/tracker/battle/batch-process-room-status', manualProxyHandler('/problem/tracker/battle/batch-process-room-status'));
app.use('/problem/tracker/battle/set-score', manualProxyHandler('/problem/tracker/battle/set-score'));
app.use('/problem/tracker/battle/rebuild-leaderboard', manualProxyHandler('/problem/tracker/battle/rebuild-leaderboard'));
// Admin: Clear a user's mirrors (Redis only)
app.use('/problem/tracker/battle/clear-user-mirrors', manualProxyHandler('/problem/tracker/battle/clear-user-mirrors'));

// Admin: Clock Question Management (每日一题管理)
app.use('/problem/tracker/clock/question/add', manualProxyHandler('/problem/tracker/clock/question/add'));
app.use('/problem/tracker/clock/question/update', manualProxyHandler('/problem/tracker/clock/question/update'));
app.use('/problem/tracker/clock/question/update-by-id', manualProxyHandler('/problem/tracker/clock/question/update-by-id'));
app.use('/problem/tracker/clock/question/delete', manualProxyHandler('/problem/tracker/clock/question/delete'));
app.use('/problem/tracker/clock/question/delete-by-id', manualProxyHandler('/problem/tracker/clock/question/delete-by-id'));
app.use('/problem/tracker/clock/question/get', manualProxyHandler('/problem/tracker/clock/question/get'));
app.use('/problem/tracker/clock/question/list', manualProxyHandler('/problem/tracker/clock/question/list'));
app.use('/problem/tracker/clock/question/list-by-date-range', manualProxyHandler('/problem/tracker/clock/question/list-by-date-range'));

// Admin: Battle Problem Management (对战题目管理)
app.use('/problem/tracker/battle/problem/admin/add', manualProxyHandler('/problem/tracker/battle/problem/admin/add'));
app.use('/problem/tracker/battle/problem/admin/update', manualProxyHandler('/problem/tracker/battle/problem/admin/update'));
app.use('/problem/tracker/battle/problem/admin/delete', manualProxyHandler('/problem/tracker/battle/problem/admin/delete'));
app.use('/problem/tracker/battle/problem/admin/get', manualProxyHandler('/problem/tracker/battle/problem/admin/get'));
app.use('/problem/tracker/battle/problem/admin/get-by-problem-id', manualProxyHandler('/problem/tracker/battle/problem/admin/get-by-problem-id'));
app.use('/problem/tracker/battle/problem/admin/list', manualProxyHandler('/problem/tracker/battle/problem/admin/list'));
app.use('/problem/tracker/battle/problem/admin/batch-add', manualProxyHandler('/problem/tracker/battle/problem/admin/batch-add'));
app.use('/problem/tracker/battle/problem/admin/batch-delete', manualProxyHandler('/problem/tracker/battle/problem/admin/batch-delete'));
app.use('/problem/tracker/battle/problem/admin/check-delete', manualProxyHandler('/problem/tracker/battle/problem/admin/check-delete'));
app.use('/problem/tracker/battle/problem/admin/reset-stats', manualProxyHandler('/problem/tracker/battle/problem/admin/reset-stats'));

// Admin: Batch import Tracker problems into acm_problem_open
// POST /acm-problem-open/batch-import-tracker
app.use('/acm-problem-open/batch-import-tracker', manualProxyHandler('/acm-problem-open/batch-import-tracker'));
// 正确路径：在 /problem/tracker 路由空间下
app.use('/problem/tracker/acm-problem-open/batch-import-tracker', manualProxyHandler('/problem/tracker/acm-problem-open/batch-import-tracker'));

// Admin: Check Permission (管理员权限检查)
app.use('/problem/tracker/admin/check', manualProxyHandler('/problem/tracker/admin/check'));
// Admin: Year report (验数，不走缓存)
app.use('/problem/tracker/admin/year-report', manualProxyHandler('/problem/tracker/admin/year-report'));


// Endpoint to get current environment config
app.get('/api/env-config', (req, res) => {
    const battleDomainMap = {
        'd': 'dac.nowcoder.com',
        'pre': 'preac.nowcoder.com',
        'www': 'ac.nowcoder.com'
    };
    const battleDomain = battleDomainMap[CURRENT_ENV] || battleDomainMap['d'];
    res.json({
        env: CURRENT_ENV,
        battleDomain: battleDomain
    });
});

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
