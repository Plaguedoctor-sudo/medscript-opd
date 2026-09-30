import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Lightweight in-proxy payload inspection heuristics (Edge/Proxy compliant)
const SQLI_REGEX = /(\b(UNION(\s+ALL)?\s+SELECT|SELECT\s+.+\s+FROM|INSERT\s+INTO.+VALUES|DELETE\s+FROM|DROP\s+(TABLE|DATABASE)|ALTER\s+TABLE|EXEC(\s|\+)+(SP_|XP_)|WAITFOR\s+DELAY|BENCHMARK\s*\(|SLEEP\s*\(|OR\s+['"]?1['"]?\s*=\s*['"]?1|AND\s+['"]?1['"]?\s*=\s*['"]?1|--|\/\*|\*\/)\b)/i;
const XSS_REGEX = /(<\s*script\b[^>]*>|javascript\s*:\s*|data\s*:\s*text\/html|<\s*iframe\b|on(error|load|click|mouseover)\s*=)/i;
const PATH_TRAVERSAL_REGEX = /(\.\.[\/\\]|\/etc\/(passwd|shadow)|boot\.ini|win\.ini|%2e%2e[\/\\]|\/proc\/self)/i;
const RCE_REGEX = /(\||;|`|\$\()\s*(cat|ls|whoami|id|curl|wget|nc|sh|bash|rm\s+-rf)/i;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Skip static assets, Next internal files, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') && !pathname.endsWith('.php') && !pathname.endsWith('.asp')
  ) {
    return NextResponse.next();
  }

  // 2. Honey-trap & Canary Probes Detection
  const decodedPath = decodeURIComponent(pathname).toLowerCase();
  const decodedSearch = decodeURIComponent(search).toLowerCase();

  const isCanaryProbe =
    decodedPath.includes('/api/admin/dump') ||
    decodedPath.includes('/wp-admin') ||
    decodedPath.includes('/.env') ||
    decodedSearch.includes('admin_debug_override=true') ||
    decodedSearch.includes('__honey_token__');

  if (isCanaryProbe) {
    return new NextResponse(
      JSON.stringify({
        error: 'ACCESS_DENIED_MILITARY_SENTINEL',
        message: 'Security Sentinel triggered: Perimeter canary tripwire activated.',
        status: 403,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Defense-Alert': 'CANARY_TRIPWIRE_TRIGGERED',
        },
      }
    );
  }

  // 3. Inspect Search Query Parameters for Web Exploit Signatures
  const fullTarget = `${decodedPath}?${decodedSearch}`;
  const isMalicious =
    SQLI_REGEX.test(fullTarget) ||
    XSS_REGEX.test(fullTarget) ||
    PATH_TRAVERSAL_REGEX.test(fullTarget) ||
    RCE_REGEX.test(fullTarget);

  if (isMalicious) {
    return new NextResponse(
      JSON.stringify({
        error: 'INTRUSION_DETECTED_BLOCKED',
        message: 'Request blocked by MedScript Military Threat Sentinel: Malicious payload signature detected.',
        status: 403,
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'X-Defense-Alert': 'INTRUSION_PAYLOAD_INTERCEPTED',
        },
      }
    );
  }

  // 4. Inject Military-Grade Defensive Headers
  const response = NextResponse.next();
  response.headers.set('X-Defense-Level', 'MILITARY-STIG-VERIFIED');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), vr=()'
  );
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
