const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;

function contentType(file) {
  if (file.endsWith('.css')) return 'text/css';
  if (file.endsWith('.js')) return 'application/javascript';
  return 'text/html';
}

const server = http.createServer((req, res) => {
  const reqPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(__dirname, reqPath);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});