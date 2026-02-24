// TeamSpeak ServerQuery string escaping/unescaping
// The query protocol requires special character encoding

const ESCAPE_MAP: [string, string][] = [
  ['\\', '\\\\'],
  ['/', '\\/'],
  [' ', '\\s'],
  ['|', '\\p'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
  ['\b', '\\b'],
  ['\f', '\\f'],
];

export function tsEscape(str: string): string {
  let result = str;
  for (const [char, escaped] of ESCAPE_MAP) {
    result = result.split(char).join(escaped);
  }
  return result;
}

export function tsUnescape(str: string): string {
  let result = str;
  for (const [char, escaped] of [...ESCAPE_MAP].reverse()) {
    result = result.split(escaped).join(char);
  }
  return result;
}

// Parse a ServerQuery response line into key-value pairs
export function parseQueryResponse(line: string): Record<string, string>[] {
  return line.split('|').map((entry) => {
    const params: Record<string, string> = {};
    for (const part of entry.split(' ')) {
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1) {
        params[part] = '';
      } else {
        const key = part.substring(0, eqIndex);
        const value = tsUnescape(part.substring(eqIndex + 1));
        params[key] = value;
      }
    }
    return params;
  });
}
