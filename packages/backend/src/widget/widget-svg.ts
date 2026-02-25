import type { WidgetData, WidgetChannelNode, WidgetTheme, WidgetThemePalette } from '@ts6/common';
import { WIDGET_THEMES } from '@ts6/common';

const WIDTH = 400;
const PADDING = 14;
const HEADER_HEIGHT = 72;
const CHANNEL_ROW = 22;
const CLIENT_ROW = 18;
const FOOTER_HEIGHT = 28;
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function countTreeRows(nodes: WidgetChannelNode[], showClients: boolean): number {
  let count = 0;
  for (const node of nodes) {
    count += 1; // channel row
    if (showClients) count += node.clients.length;
    count += countTreeRows(node.children, showClients);
  }
  return count;
}

export function renderWidgetSvg(data: WidgetData): string {
  const theme = WIDGET_THEMES[data.theme] || WIDGET_THEMES.dark;
  const treeRows = data.showChannelTree
    ? countTreeRows(data.channelTree, data.showClients)
    : 0;
  const treeHeight = treeRows * CHANNEL_ROW;
  const totalHeight = HEADER_HEIGHT + treeHeight + FOOTER_HEIGHT + PADDING * 2;

  const lines: string[] = [];
  let y = PADDING;

  // --- SVG open ---
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${totalHeight}" viewBox="0 0 ${WIDTH} ${totalHeight}">`);

  // --- Defs (rounded clip) ---
  lines.push(`<defs>`);
  lines.push(`<clipPath id="rc"><rect x="0" y="0" width="${WIDTH}" height="${totalHeight}" rx="10"/></clipPath>`);
  lines.push(`</defs>`);
  lines.push(`<g clip-path="url(#rc)">`);

  // --- Background ---
  lines.push(`<rect width="${WIDTH}" height="${totalHeight}" fill="${theme.background}"/>`);

  // --- Header background ---
  lines.push(`<rect x="0" y="0" width="${WIDTH}" height="${HEADER_HEIGHT}" fill="${theme.headerBg}"/>`);

  // --- Server name ---
  y += 28;
  const serverName = escapeXml(truncate(data.serverName, 38));
  lines.push(`<text x="${PADDING}" y="${y}" fill="${theme.accent}" font-family="${FONT}" font-size="15" font-weight="700">${serverName}</text>`);

  // --- ONLINE badge ---
  const badgeX = WIDTH - PADDING - 52;
  lines.push(`<rect x="${badgeX}" y="${y - 13}" width="52" height="18" rx="9" fill="${theme.clientColor}"/>`);
  lines.push(`<text x="${badgeX + 26}" y="${y}" fill="#fff" font-family="${FONT}" font-size="10" font-weight="600" text-anchor="middle">ONLINE</text>`);

  // --- Stats row ---
  y += 22;
  const stats = `${data.onlineUsers} / ${data.maxClients} users  •  ${formatUptime(data.uptime)} uptime`;
  lines.push(`<text x="${PADDING}" y="${y}" fill="${theme.textSecondary}" font-family="${FONT}" font-size="11">${escapeXml(stats)}</text>`);

  // --- Separator ---
  y += 14;
  lines.push(`<line x1="${PADDING}" y1="${y}" x2="${WIDTH - PADDING}" y2="${y}" stroke="${theme.border}" stroke-width="1"/>`);
  y += 8;

  // --- Channel tree ---
  if (data.showChannelTree) {
    y = renderTreeNodes(lines, data.channelTree, data.showClients, theme, y, 0);
  }

  // --- Footer ---
  const footerY = totalHeight - 10;
  lines.push(`<line x1="${PADDING}" y1="${footerY - 14}" x2="${WIDTH - PADDING}" y2="${footerY - 14}" stroke="${theme.border}" stroke-width="1"/>`);
  lines.push(`<text x="${WIDTH / 2}" y="${footerY}" fill="${theme.textSecondary}" font-family="${FONT}" font-size="9" text-anchor="middle" opacity="0.6">TS6 WebUI Widget</text>`);

  lines.push(`</g></svg>`);
  return lines.join('\n');
}

function renderTreeNodes(
  lines: string[],
  nodes: WidgetChannelNode[],
  showClients: boolean,
  theme: WidgetThemePalette,
  y: number,
  depth: number,
): number {
  const indent = PADDING + depth * 16;

  for (const node of nodes) {
    // Channel row
    const channelName = escapeXml(truncate(node.name, 36 - depth * 2));
    const hashX = indent;
    const textX = indent + 14;

    // Channel icon (#)
    lines.push(`<text x="${hashX}" y="${y + 14}" fill="${theme.accent}" font-family="${FONT}" font-size="12" font-weight="700">#</text>`);
    lines.push(`<text x="${textX}" y="${y + 14}" fill="${theme.textPrimary}" font-family="${FONT}" font-size="12">${channelName}</text>`);

    // Password lock
    if (node.hasPassword) {
      lines.push(`<text x="${WIDTH - PADDING - 12}" y="${y + 14}" fill="${theme.textSecondary}" font-family="${FONT}" font-size="10">🔒</text>`);
    }

    // Client count badge
    if (node.clients.length > 0) {
      const badgeX2 = node.hasPassword ? WIDTH - PADDING - 36 : WIDTH - PADDING - 18;
      lines.push(`<text x="${badgeX2}" y="${y + 14}" fill="${theme.textSecondary}" font-family="${FONT}" font-size="10" text-anchor="end">${node.clients.length}</text>`);
    }

    y += CHANNEL_ROW;

    // Client entries
    if (showClients) {
      for (const client of node.clients) {
        const clientX = indent + 18;
        let displayName = escapeXml(truncate(client.nickname, 32 - depth * 2));
        if (client.isAway) displayName += ' [away]';
        if (client.isMuted) displayName += ' [muted]';

        // Small dot indicator
        lines.push(`<circle cx="${indent + 10}" cy="${y + 10}" r="3" fill="${theme.clientColor}"/>`);
        lines.push(`<text x="${clientX}" y="${y + 13}" fill="${theme.clientColor}" font-family="${FONT}" font-size="11">${displayName}</text>`);
        y += CLIENT_ROW;
      }
    }

    // Recurse children
    y = renderTreeNodes(lines, node.children, showClients, theme, y, depth + 1);
  }

  return y;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
