'use strict';
// One HTTP call to a node's server on 127.0.0.1, bounded by a deadline. Resolves
// {status, body} or {down: <why>}; never rejects, so every caller names what it
// waited for when the answer does not come.

const http = require('node:http');

function call(port, method, route, { token, body, timeoutMs }) {
  return new Promise((resolve) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = data.length; }
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const req = http.request({ host: '127.0.0.1', port, method, path: route, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { parsed = null; }
        finish({ status: res.statusCode, body: parsed });
      });
      res.on('error', (e) => finish({ down: e.code || e.message }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); finish({ down: `no answer within ${timeoutMs} ms` }); });
    req.on('error', (e) => finish({ down: e.code || e.message }));
    if (data) req.write(data);
    req.end();
  });
}

module.exports = { call };
