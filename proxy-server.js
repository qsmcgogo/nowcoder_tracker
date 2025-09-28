const express = require('express');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const { URL } = require('url');

const app = express();
const port = 3001;

// --- Environment Configuration ---
const HOST_CONFIG = {
    production: 'www.nowcoder.com',
    pre: 'pre.nowcoder.com'
};
const CURRENT_ENV = 'production'; // Change this to 'pre' for testing
const NOWCODER_HOST = HOST_CONFIG[CURRENT_ENV];
// --------------------------------

// A generic, robust manual proxy handler
const manualProxyHandler = (basePath) => (clientReq, clientRes) => {
    // Construct the path by combining the fixed base path and the client's query string.
    const queryString = clientReq.url.includes('?') ? clientReq.url.substring(clientReq.url.indexOf('?')) : '';
    const correctPath = `${basePath}${queryString}`;
    console.log(`[Manual Proxy] Intercepted request for '${clientReq.url}'. Corrected path to: '${correctPath}'`);

    const targetUrl = new URL(`https://${NOWCODER_HOST}${correctPath}`);

    const cookie = 'NOWCODERUID=D362DA4DD6A3B232A58A7EDF803C22F6; NOWCODERCLINETID=2AE46B759CF3AB5585E0006E67145367; gr_user_id=ccf8ef1c-50d1-4dc9-b4b0-130711676476; Hm_lvt_a808a1326b6c06c437de769d1b85b870=1758512217,1758592277,1758679783; t=27E6EB1C592061228195BBF7531CE4A5; c196c3667d214851b11233f5c17f99d5_gr_last_sent_cs1=8582211; channelPut=w251acm; csrfToken=IW-NRlDbVmJJoUuxcjRIrzHs; SERVERID=14799a1b7de57723e3899dc089a978c0|1758687236|1758687236; SERVERCORSID=14799a1b7de57723e3899dc089a978c0|1758687236|1758687236; Hm_lpvt_a808a1326b6c06c437de769d1b85b870=1758687248; HMACCOUNT=65ADCFB251A31F03; _clck=1tzkek2%5E2%5Efzl%5E0%5E2093; _clsk=raw431%5E1758680321123%5E2%5E1%5Eb.clarity.ms%2Fcollect; acw_tc=0a15e15b17586872360011839e460c0203e2952008963351cceffba8b8e653; c196c3667d214851b11233f5c17f99d5_gr_session_id_cb236fdc-5427-4065-b953-4486e83dafa3=true; c196c3667d214851b11233f5c17f99d5_gr_session_id=cb236fdc-5427-4065-b953-4486e83dafa3; c196c3667d214851b11233f5c17f99d5_gr_last_sent_sid_with_cs1=cb236fdc-5427-4065-b953-4486e83dafa3; c196c3667d214851b11233f5c17f99d5_gr_cs1=8582211';
    const csrfMatch = cookie.match(/csrfToken=([^;]+)/);
    const csrfToken = csrfMatch ? csrfMatch[1].trim() : '';

    const options = {
        hostname: targetUrl.hostname,
        port: 443,
        path: targetUrl.pathname + targetUrl.search,
        method: clientReq.method,
        headers: {
            ...clientReq.headers,
            'Accept': 'application/json, text/plain, */*',
            'Cookie': cookie,
            'Host': NOWCODER_HOST,
            'Referer': `https://${NOWCODER_HOST}/problem/tracker/list`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
            'X-CSRF-TOKEN': csrfToken
        }
    };
    
    const proxyReq = https.request(options, (targetRes) => {
        console.log(`[Manual Proxy] Received response from Nowcoder. Status: ${targetRes.statusCode}`);
        clientRes.writeHead(targetRes.statusCode, targetRes.headers);
        targetRes.pipe(clientRes, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error('[Manual Proxy] Error connecting to Nowcoder:', err);
        clientRes.status(500).send('Proxy error.');
    });

    clientReq.pipe(proxyReq, { end: true });
};

// Apply the manual proxy handler with the correct, hardcoded base path for each route
app.use('/problem/tracker/list', manualProxyHandler('/problem/tracker/list'));
app.use('/problem/tracker/diff', manualProxyHandler('/problem/tracker/diff'));
app.use('/problem/tracker/ranks', manualProxyHandler('/problem/tracker/ranks'));

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
    console.log(`Your application is now available at http://localhost:${port}/index.html`);
});
