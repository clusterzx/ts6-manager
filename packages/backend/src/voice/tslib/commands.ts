// TS3 command format: "commandname key=value key=value|key=value"

const ESCAPE_MAP: Record<string, string> = {
  "\\": "\\\\",
  "/": "\\/",
  " ": "\\s",
  "|": "\\p",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\v": "\\v",
};

const UNESCAPE_MAP: Record<string, string> = {
  "\\": "\\",
  "/": "/",
  s: " ",
  p: "|",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
};

export function tsEscape(str: string): string {
  let result = "";
  for (const ch of str) {
    result += ESCAPE_MAP[ch] ?? ch;
  }
  return result;
}

export function tsUnescape(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      i++;
      if (i >= str.length) throw new Error("Invalid escape sequence");
      const mapped = UNESCAPE_MAP[str[i]];
      if (mapped === undefined)
        throw new Error(`Unknown escape: \\${str[i]}`);
      result += mapped;
    } else {
      result += str[i];
    }
  }
  return result;
}

export interface ParsedCommand {
  name: string;
  params: Record<string, string>;
  groups?: Record<string, string>[]; // For pipe-separated multi-params
}

export function buildCommand(
  name: string,
  params: Record<string, string | number | boolean | undefined>
): string {
  let cmd = tsEscape(name);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const strVal =
      typeof value === "boolean"
        ? value
          ? "1"
          : "0"
        : String(value);
    cmd += ` ${key}=${tsEscape(strVal)}`;
  }
  return cmd;
}

export function parseCommand(raw: string): ParsedCommand {
  const parts = raw.split("|");
  const firstPart = parts[0].trim();
  const tokens = firstPart.split(" ");
  const name = tsUnescape(tokens[0]);
  const params: Record<string, string> = {};

  for (let i = 1; i < tokens.length; i++) {
    const eqIdx = tokens[i].indexOf("=");
    if (eqIdx >= 0) {
      const key = tokens[i].substring(0, eqIdx);
      const value = tsUnescape(tokens[i].substring(eqIdx + 1));
      params[key] = value;
    } else {
      params[tokens[i]] = "";
    }
  }

  let groups: Record<string, string>[] | undefined;
  if (parts.length > 1) {
    groups = [params];
    for (let g = 1; g < parts.length; g++) {
      const gTokens = parts[g].trim().split(" ");
      const gParams: Record<string, string> = {};
      for (const token of gTokens) {
        const eqIdx = token.indexOf("=");
        if (eqIdx >= 0) {
          gParams[token.substring(0, eqIdx)] = tsUnescape(
            token.substring(eqIdx + 1)
          );
        } else {
          gParams[token] = "";
        }
      }
      groups.push(gParams);
    }
  }

  return { name, params, groups };
}
