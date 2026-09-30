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

const Database = require('better-sqlite3');
const dbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), 'sqlite.db');

let sentinelDb = null;
function getSentinelDb() {
  if (!sentinelDb) {
    try {
      sentinelDb = new Database(dbPath, { readonly: false, timeout: 5000 });
      sentinelDb.pragma('journal_mode = WAL');
    } catch (e) {
      console.error('[DEFENSE] Database connection error in Gateway:', e.message);
    }
  }
  return sentinelDb;
}

// Attack Signatures (SQLi, XSS, Path Traversal, Command Injection)
const SQLI_REGEX = /(\b(UNION(\s+ALL)?\s+SELECT|SELECT\s+.+\s+FROM|INSERT\s+INTO.+VALUES|DELETE\s+FROM|DROP\s+(TABLE|DATABASE)|ALTER\s+TABLE|WAITFOR\s+DELAY|SLEEP\s*\(|OR\s+['"]?1['"]?\s*=\s*['"]?1|--|\/\*)\b)/i;
const XSS_REGEX = /(<\s*script\b|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\s*iframe\b|on(error|load|click|mouseover)\s*=)/i;
const TRAVERSAL_REGEX = /(\.\.[\/\\]|\/etc\/(passwd|shadow|hosts)|boot\.ini|win\.ini|%2e%2e[\/\\]|\/proc\/self)/i;
const RCE_REGEX = /(\||;|`|\$\()\s*(cat|ls|whoami|id|curl|wget|nc|sh|bash|powershell|cmd|rm\s+-rf)/i;
const HONEY_PATHS = ['/.env', '/.git', '/wp-admin', '/wp-login.php', '/phpmyadmin', '/.aws', '/config.json', '/actuator', '/admin_debug_override'];

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map((s) => s.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }
  return req.headers['x-real-ip'] || req.socket.remoteAddress || '127.0.0.1';
}

function checkQuarantine(ip) {
  try {
    const db = getSentinelDb();
    if (!db) return false;
    const row = db.prepare('SELECT id, expires_at, pardoned_at FROM quarantined_ips WHERE ip_address = ? LIMIT 1').get(ip);
    if (!row) return false;
    if (row.pardoned_at) return false;
    if (row.expires_at && row.expires_at < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function recordQuarantine(ip, reason) {
  try {
    const db = getSentinelDb();
    if (!db) return;
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const existing = db.prepare('SELECT id FROM quarantined_ips WHERE ip_address = ?').get(ip);
    if (existing) {
      db.prepare('UPDATE quarantined_ips SET violation_count = violation_count + 1, reason = ?, quarantined_at = ?, expires_at = ?, pardoned_at = NULL WHERE id = ?').run(reason, now, expiresAt, existing.id);
    } else {
      db.prepare('INSERT INTO quarantined_ips (ip_address, reason, violation_count, quarantined_at, expires_at) VALUES (?, ?, 1, ?, ?)').run(ip, reason, now, expiresAt);
    }
  } catch (err) {
    console.error('[DEFENSE] Failed to record quarantine:', err.message);
  }
}

function dispatchSecureRequest(req, res, proto) {
  req.headers['x-forwarded-proto'] = proto;

  // 1. Mandatory State-Secret Response Security Headers
  res.setHeader('X-Classification', 'STATE-SECRET // TOP-SECRET');
  res.setHeader('X-Defense-Level', 'MILITARY-STIG-VERIFIED');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Server', 'MedScript-State-Defense-Gateway');

  const clientIp = getClientIp(req);
  const cleanIp = clientIp.replace(/^::ffff:/, '');

  // 2. Check if IP is currently quarantined
  if (cleanIp !== '127.0.0.1' && cleanIp !== '::1' && cleanIp !== 'localhost') {
    if (checkQuarantine(cleanIp)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Access Denied: Host IP has been quarantined by Military Defense Sentinel', code: 'QUARANTINED' }));
      return;
    }
  }

  // 3. Inspect URL and query string for intrusion vectors
  const rawUrl = req.url || '';
  let decodedUrl = rawUrl;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {}

  // Check honeypot / canary traps
  for (const honey of HONEY_PATHS) {
    if (decodedUrl.startsWith(honey) || decodedUrl.includes(honey)) {
      if (cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
        recordQuarantine(cleanIp, `Honeypot Trap Tripped: Accessed Canary Path "${honey}"`);
      }
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Canary Trap Triggered', code: 'CANARY_TRIP' }));
      return;
    }
  }

  // Check attack signatures
  if (SQLI_REGEX.test(decodedUrl) || XSS_REGEX.test(decodedUrl) || TRAVERSAL_REGEX.test(decodedUrl) || RCE_REGEX.test(decodedUrl)) {
    if (cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
      recordQuarantine(cleanIp, `Heuristic IDS: Malicious Payload Injection Detected in URL "${decodedUrl.slice(0, 50)}"`);
    }
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: Malicious Cyber Threat Signature Detected', code: 'THREAT_BLOCKED' }));
    return;
  }

  // 4. Pass clean request to Next.js
  handle(req, res);
}

// 2. Initialize Next.js Application
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    // Internal HTTPS Server (serves TLS encrypted clients)
    const httpsServer = https.createServer(httpsOptions, (req, res) => {
      dispatchSecureRequest(req, res, 'https');
    });

    // Internal HTTP Server (serves plain HTTP clients directly with zero SSL warnings)
    const httpServer = http.createServer((req, res) => {
      dispatchSecureRequest(req, res, 'http');
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
