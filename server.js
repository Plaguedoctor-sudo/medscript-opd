#!/usr/bin/env node

/**
 * MedScript OPD - Production & LAN HTTPS Server
 *
 * Provides out-of-the-box TLS/HTTPS encryption for localhost and LAN clients
 * (Tablets, Receptionist PCs, iPads) with automatic HTTP-to-HTTPS upgrade on
 * the same port via TCP stream multiplexing.
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const https = require('https');
const os = require('os');
const { execSync } = require('child_process');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 3000;

const CERT_DIR = path.join(__dirname, 'certificates');
const KEY_FILE = path.join(CERT_DIR, 'localhost-key.pem');
const CERT_FILE = path.join(CERT_DIR, 'localhost.pem');

// 1. Ensure SSL certificates exist; auto-generate if missing
function ensureCertificates() {
  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    return;
  }

  console.log('[HTTPS] SSL certificates not found. Generating self-signed clinic certificates...');
  const scriptPath = path.join(__dirname, 'scripts', 'generate-ssl.sh');
  if (fs.existsSync(scriptPath)) {
    try {
      execSync(`bash "${scriptPath}"`, { stdio: 'inherit' });
      return;
    } catch (err) {
      console.warn('[HTTPS] generate-ssl.sh failed, falling back to direct openssl call:', err.message);
    }
  }

  fs.mkdirSync(CERT_DIR, { recursive: true });
  const ips = ['127.0.0.1'];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const netIf of ifaces[name] || []) {
      if (netIf.family === 'IPv4' && !netIf.internal) {
        ips.push(netIf.address);
      }
    }
  }

  const san = ['DNS:localhost', ...ips.map((ip) => `IP:${ip}`)].join(',');
  execSync(
    `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 ` +
      `-subj "/CN=localhost/O=MedScript OPD Clinic" ` +
      `-addext "subjectAltName=${san}" ` +
      `-keyout "${KEY_FILE}" -out "${CERT_FILE}"`,
    { stdio: 'inherit' }
  );
  fs.chmodSync(KEY_FILE, 0o600);
  fs.chmodSync(CERT_FILE, 0o644);
}

ensureCertificates();

const httpsOptions = {
  key: fs.readFileSync(KEY_FILE),
  cert: fs.readFileSync(CERT_FILE),
};

// 2. Initialize Next.js Application
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    // Internal HTTPS Server (serves TLS encrypted clients)
    const httpsServer = https.createServer(httpsOptions, (req, res) => {
      req.headers['x-forwarded-proto'] = 'https';
      handle(req, res);
    });

    // Internal HTTP Server (serves plain HTTP clients directly with zero SSL warnings)
    const httpServer = http.createServer((req, res) => {
      req.headers['x-forwarded-proto'] = 'http';
      handle(req, res);
    });

    // Bind internal listeners to random loopback ports
    httpsServer.listen(0, '127.0.0.1', () => {
      const httpsPort = httpsServer.address().port;

      httpServer.listen(0, '127.0.0.1', () => {
        const httpPort = httpServer.address().port;

        // Front-Facing TCP Multiplexer Gateway on configured port
        const gateway = net.createServer((socket) => {
          socket.once('data', (chunk) => {
            socket.pause();
            // 0x16 (22) = TLS Handshake ClientHello
            const isTls = chunk.length > 0 && chunk[0] === 0x16;
            const targetPort = isTls ? httpsPort : httpPort;

            const client = net.connect(targetPort, '127.0.0.1', () => {
              client.write(chunk);
              socket.pipe(client);
              client.pipe(socket);
              socket.resume();
            });

            client.on('error', () => socket.destroy());
            socket.on('error', () => client.destroy());
          });
        });

        gateway.listen(port, hostname, () => {
          const ifaces = os.networkInterfaces();
          const lanIps = [];
          for (const name of Object.keys(ifaces)) {
            for (const netIf of ifaces[name] || []) {
              if (netIf.family === 'IPv4' && !netIf.internal) {
                lanIps.push(netIf.address);
              }
            }
          }

          console.log('');
          console.log('=================================================================');
          console.log('         MEDSCRIPT OPD - SECURE HTTPS SERVER ACTIVE             ');
          console.log('=================================================================');
          console.log(` • Secure Consultation Desk:  https://localhost:${port}`);
          lanIps.forEach((ip) => {
            console.log(` • Multi-Device / Tablet LAN:  https://${ip}:${port}`);
          });
          console.log(' • Smart Protocol Switcher:   Plain http:// calls auto-redirect to https://');
          console.log('=================================================================');
          console.log('');
        });

        // Graceful termination
        const shutdown = () => {
          console.log('\n[HTTPS] Shutting down MedScript OPD servers...');
          gateway.close();
          httpsServer.close();
          httpServer.close();
          process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
      });
    });
  })
  .catch((err) => {
    console.error('[HTTPS] Failed to start server:', err);
    process.exit(1);
  });
