const http = require('http');
const fs = require('fs');
const path = require('path');

let requestCount = 0;

const server = http.createServer((req, res) => {

  // Prometheus metrics endpoint
  if (req.url === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(
      `# HELP http_requests_total Total HTTP requests\n` +
      `# TYPE http_requests_total counter\n` +
      `http_requests_total ${requestCount}\n`
    );
    return;
  }

  // Kubernetes health probe endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Serve the HTML page for all other routes
  requestCount++;
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading page');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(data);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
