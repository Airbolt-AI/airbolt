#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HTML_FILE = path.join(__dirname, 'standalone-demo.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(HTML_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading demo file');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`
🚀 React SDK Demo Server Running!

1. Make sure the API is running:
   pnpm dev

2. Open the demo:
   http://localhost:${PORT}

3. The demo will now work without CORS issues!

Press Ctrl+C to stop the server.
`);
});
