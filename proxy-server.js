const express = require('express');
const https = require('https');
const HttpsProxyAgent = require('https-proxy-agent');
const { URL } = require('url');

const app = express();
const port = 3000;

// 环境切换: 'pre' 或 'production'
const CURRENT_ENV = 'production'; 

const targetHost = CURRENT_ENV === 'pre' 
    ? 'https://pre.nowcoder.com' 
    : 'https://www.nowcoder.com';

// A generic, robust manual proxy handler
const manualProxyHandler = (basePath) => (clientReq, clientRes) => {
    // Construct the path by combining the fixed base path and the client's query string.
    const queryString = clientReq.url.includes('?') ? clientReq.url.substring(clientReq.url.indexOf('?')) : '';
    const correctPath = `${basePath}${queryString}`;
    console.log(`[Manual Proxy] Intercepted request for '${clientReq.url}'. Corrected path to: '${correctPath}'`);

    const targetUrl = new URL(`${targetHost}${correctPath}`);
    
    // Hardcode the user's provided cookie for local testing to bypass login issues
    const cookie = 'gr_user_id=35418a8f-6b2d-4008-a304-a905224d8b62; NOWCODERCLINETID=55C554C3C078CD41F0A4CBD85DE0EB34; NOWCODERUID=ECD816392E855C695FAD8117FCAC4024; isAgreementChecked=true; _bl_uid=qtm8Cf48xbnm87aq8pgzryCrIkhL; __snaker__id=UO9uChZ0pu3CnGMn; c196c3667d214851b11233f5c17f99d5_gr_last_sent_cs1=919247; acw_tc=0a03836a17590422272418997e708208c70e195a65e23bba2cc86d2aad0165; c196c3667d214851b11233f5c17f99d5_gr_session_id=e59316f8-1cb5-4bde-b8f5-6362c82963b1; Hm_lvt_a808a1326b6c06c437de769d1b85b870=1758866442,1759027627,1759032588,1759042227; HMACCOUNT=E3F6F106D778B1E4; callBack=%2F; gdxidpyhxdE=T734aS5WzL3NA8RqlCTZyeJ%5CiIwJX%5CXd9ttykED6J67G90R%5C%2BTvw6UGN75%2FKqTDnbWvBtmZ3n%2BnCGygLfzO0v1NktlDxKRKoxYepyXow%2FU4X223P%2FG%2Fd0Kz8qsU0xnE1OJz2vgHkK%5CrTgzu64JfSOc9iwJh%2FjSRH%2BoQvD8PikGsU%5COnc%3A1759043187236; t=1F693D8034DBCB84BF84022431994C81; c196c3667d214851b11233f5c17f99d5_gr_last_sent_sid_with_cs1=e59316f8-1cb5-4bde-b8f5-6362c82963b1; c196c3667d214851b11233f5c17f99d5_gr_cs1=919247; Hm_lpvt_a808a1326b6c06c437de769d1b85b870=1759042293; c196c3667d214851b11233f5c17f99d5_gr_session_id_sent_vst=e59316f8-1cb5-4bde-b8f5-6362c82963b1';
    const csrfMatch = cookie.match(/csrfToken=([^;]+)/);
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
            'Cookie': cookie,
            'Host': targetUrl.hostname, // Use the actual hostname from targetUrl
            'Referer': `https://${targetUrl.hostname}/problem/tracker/list`, // Use the actual hostname from targetUrl
            'User-Agent': clientReq.headers['user-agent'],
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
app.use('/problem/tracker/clock/todayinfo', manualProxyHandler('/problem/tracker/clock/todayinfo'));
app.use('/problem/tracker/clock/add', manualProxyHandler('/problem/tracker/clock/add'));
app.use('/problem/tracker/clock/list', manualProxyHandler('/problem/tracker/clock/list'));


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
