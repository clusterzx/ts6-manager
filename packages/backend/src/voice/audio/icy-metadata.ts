import net from 'net';
import tls from 'tls';

/**
 * Fetch the current StreamTitle from an ICY/Shoutcast/Icecast radio stream.
 *
 * Uses a raw TCP socket to handle both standard HTTP and the non-standard
 * ICY protocol (which responds with "ICY 200 OK" instead of "HTTP/1.x 200 OK").
 * Node.js http module cannot parse ICY responses.
 *
 * Follows HTTP redirects (301/302/303/307/308) up to 5 hops.
 *
 * Protocol:
 * 1. Send HTTP GET with `Icy-MetaData: 1` header
 * 2. Read `icy-metaint` from response headers
 * 3. Skip metaInt bytes of audio data
 * 4. Read 1 byte (metadata length = byte * 16)
 * 5. Read metadata string, parse StreamTitle
 * 6. Close connection
 */
export async function fetchIcyMetadata(streamUrl: string, timeoutMs = 10000): Promise<string | null> {
  let currentUrl = streamUrl;
  const maxRedirects = 5;

  for (let i = 0; i <= maxRedirects; i++) {
    const result = await fetchIcySingle(currentUrl, timeoutMs);
    if (result.redirect) {
      currentUrl = result.redirect;
      continue;
    }
    return result.title;
  }
  return null; // Too many redirects
}

interface IcyResult {
  title: string | null;
  redirect?: string;
}

function fetchIcySingle(streamUrl: string, timeoutMs: number): Promise<IcyResult> {
  return new Promise((resolve) => {
    let resolved = false;
    const url = new URL(streamUrl);
    const isHttps = url.protocol === 'https:';
    const host = url.hostname;
    const port = parseInt(url.port) || (isHttps ? 443 : 80);
    const path = url.pathname + url.search;

    // Build raw HTTP request
    const request =
      `GET ${path || '/'} HTTP/1.0\r\n` +
      `Host: ${host}\r\n` +
      `User-Agent: TS6-MusicBot/1.0\r\n` +
      `Icy-MetaData: 1\r\n` +
      `Connection: close\r\n` +
      `\r\n`;

    let socket: net.Socket;
    if (isHttps) {
      socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
        socket.write(request);
      });
    } else {
      socket = net.connect({ host, port }, () => {
        socket.write(request);
      });
    }

    let buffer = Buffer.alloc(0);
    let headersParsed = false;
    let metaInt = 0;
    let headersEndOffset = 0;

    const timer = setTimeout(() => done({ title: null }), timeoutMs);

    socket.on('data', (chunk: Buffer) => {
      if (resolved) return;
      buffer = Buffer.concat([buffer, chunk]);

      // Phase 1: Parse response headers
      if (!headersParsed) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) return; // Need more data

        const headersRaw = buffer.subarray(0, headerEnd).toString('latin1');
        const headersLower = headersRaw.toLowerCase();
        headersParsed = true;
        headersEndOffset = headerEnd + 4;

        // Check for redirect (301, 302, 303, 307, 308)
        const statusLine = headersRaw.split('\r\n')[0];
        if (/\b30[12378]\b/.test(statusLine)) {
          const locMatch = headersRaw.match(/[Ll]ocation:\s*(.+)/);
          if (locMatch) {
            return done({ title: null, redirect: locMatch[1].trim() });
          }
        }

        // Extract icy-metaint
        const metaIntMatch = headersLower.match(/icy-metaint\s*:\s*(\d+)/);
        if (!metaIntMatch) {
          return done({ title: null }); // No ICY metadata support
        }
        metaInt = parseInt(metaIntMatch[1]);
        if (!metaInt || metaInt <= 0) {
          return done({ title: null });
        }
      }

      // Phase 2: Read audio data + metadata block
      const bodyStart = headersEndOffset;
      const bodyLen = buffer.length - bodyStart;

      // Need at least metaInt bytes of audio + 1 byte metadata length
      if (bodyLen <= metaInt) return;

      const metaLenByte = buffer[bodyStart + metaInt];
      const metaLen = metaLenByte * 16;

      if (metaLen === 0) {
        // No metadata at this position — could mean empty title
        return done({ title: null });
      }

      // Need the full metadata block
      if (bodyLen < metaInt + 1 + metaLen) return;

      const metaStr = buffer.subarray(bodyStart + metaInt + 1, bodyStart + metaInt + 1 + metaLen).toString('utf-8');
      const match = metaStr.match(/StreamTitle='([^']*?)'/);
      done({ title: match ? match[1].trim() || null : null });
    });

    socket.on('error', () => done({ title: null }));
    socket.on('end', () => done({ title: null }));

    function done(result: IcyResult) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try { socket.destroy(); } catch {}
      resolve(result);
    }
  });
}
