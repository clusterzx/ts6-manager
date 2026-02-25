import { lookup } from 'dns/promises';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
]);

const CLOUD_METADATA_IPS = new Set([
  '169.254.169.254',  // AWS, GCP, Azure
  'fd00:ec2::254',    // AWS IPv6
]);

/**
 * Check if an IP address is in a private/reserved range.
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    const [a, b] = parts.map(Number);
    if (a === 10) return true;                           // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12
    if (a === 192 && b === 168) return true;              // 192.168.0.0/16
    if (a === 127) return true;                           // 127.0.0.0/8
    if (a === 169 && b === 254) return true;              // 169.254.0.0/16 (link-local)
    if (a === 0) return true;                             // 0.0.0.0/8
  }

  // IPv6
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;                       // loopback
  if (lower.startsWith('fe80:')) return true;              // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('::ffff:')) {                      // IPv4-mapped IPv6
    const mapped = lower.slice(7);
    return isPrivateIP(mapped);
  }

  return false;
}

export interface ValidateUrlOptions {
  allowedProtocols?: string[];
  skipDnsCheck?: boolean;
}

export interface ValidateUrlResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a URL for safety against SSRF attacks.
 * Blocks private IPs, cloud metadata endpoints, and non-HTTP protocols.
 */
export async function validateUrl(
  url: string,
  options: ValidateUrlOptions = {},
): Promise<ValidateUrlResult> {
  const allowedProtocols = options.allowedProtocols || ['http:', 'https:'];

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Protocol check
  if (!allowedProtocols.includes(parsed.protocol)) {
    return { valid: false, error: `Protocol "${parsed.protocol}" is not allowed. Use: ${allowedProtocols.join(', ')}` };
  }

  // Hostname checks
  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { valid: false, error: `Hostname "${hostname}" is blocked` };
  }

  if (CLOUD_METADATA_IPS.has(hostname)) {
    return { valid: false, error: 'Cloud metadata endpoint is blocked' };
  }

  // Check if hostname is a literal IP
  if (isPrivateIP(hostname)) {
    return { valid: false, error: 'Private/reserved IP addresses are blocked' };
  }

  // DNS resolution check (prevents DNS rebinding)
  if (!options.skipDnsCheck) {
    try {
      const { address } = await lookup(hostname);
      if (isPrivateIP(address)) {
        return { valid: false, error: `Hostname "${hostname}" resolves to a private IP (${address})` };
      }
      if (CLOUD_METADATA_IPS.has(address)) {
        return { valid: false, error: `Hostname "${hostname}" resolves to a cloud metadata IP` };
      }
    } catch {
      // DNS resolution failed — allow the request to proceed and let axios/ffmpeg handle the error
    }
  }

  return { valid: true };
}
