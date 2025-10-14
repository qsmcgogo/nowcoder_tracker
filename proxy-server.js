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
    // Current user: 8582211 (test user), cookie stored in cookie.txt
    // Admin user cookie (919247) backed up in cookie_919247.txt
    const cookie = 'NOWCODERUID=786AB20219B63223D39FAC81152DD2F2; NOWCODERCLINETID=074D72E569097060FE7F07B95F256169; gr_user_id=78f2c3eb-24b9-43ec-8055-cff913010ac1; _bl_uid=evmhLgsU4q3h7edeCq4d30ys415O; isAgreementChecked=true; c196c3667d214851b11233f5c17f99d5_gr_last_sent_cs1=8582211; Hm_lvt_a808a1326b6c06c437de769d1b85b870=1760087823,1760148201,1760336132,1760347664; HMACCOUNT=7D5EE153506CD6D4; __snaker__id=bdIYBdWnuNezoYEB; gdxidpyhxdE=2ZwILyimH2N69oQf5OTROML0Apqi7nrCI3fTQ4%5C2wbdo91IhpMaaoJ6rK8fA%5CsRWmq8s6bpiNIsBclec%5CwcQSijpSb%5CCMgPJfHM%2FkUCPGS%2FG9nQm14MDhTDlKXbnMKOR57a7iuSsSErhqEV4%5CO5iB%5CTl5Nn4bTaMPcehbjkOsWpyaiaR%3A1760348581810; t=046D5FD665C14882B3AD9557B86D54B1; csrfToken=uAxnfbeRhONdCw_f8kub9hPB; channelPut.sig=Mq7dNzQZwzJtjLG9uoxBBGdPdqA2y3UUpm2jl7oBF70; username=%E7%A5%9E%E5%B4%8E%E5%85%B0%E5%AD%90; username.sig=iqc3LVmq_sCn7BOBL5WViifY74ivBw3CVMjjV6m1V64; uid=8582211; uid.sig=XtEBR9ABXjoleZeIFcoxSh3FLzfVlG2lenIOcGoSETw; channelPut=w251acm; _clck=78gf36%5E2%5Eg05%5E0%5E2108; _clsk=achgmv%5E1760412529051%5E3%5E1%5Eq.clarity.ms%2Fcollect; acw_tc=0a15e15917604302844846434e101508590f09435c30832185da144cd4dee0; c196c3667d214851b11233f5c17f99d5_gr_session_id=ac2594a5-da85-49df-9a13-21647139a782; c196c3667d214851b11233f5c17f99d5_gr_last_sent_sid_with_cs1=ac2594a5-da85-49df-9a13-21647139a782; SERVERID=de20f159569060dc47ac36b08320bf33|1760431525|1760431525; SERVERCORSID=de20f159569060dc47ac36b08320bf33|1760431525|1760431525; c196c3667d214851b11233f5c17f99d5_gr_cs1=8582211; c196c3667d214851b11233f5c17f99d5_gr_session_id_ac2594a5-da85-49df-9a13-21647139a782=true; Hm_lpvt_a808a1326b6c06c437de769d1b85b870=1760431529';
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
