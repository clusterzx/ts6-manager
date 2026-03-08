import type { WidgetChannelNode, WidgetClient } from '@ts6/common';

// Parse TS spacer channel names: [*spacer0]=, [cspacer0]Center Text, [rspacer]Right, etc.
function parseSpacerInfo(name: string): { isSpacer: boolean; spacerType: WidgetChannelNode['spacerType']; spacerText: string } {
  const match = name.match(/^\[([lcr]?\*?)spacer\d*\](.*)$/i);
  if (!match) return { isSpacer: false, spacerType: 'none', spacerText: '' };

  const prefix = match[1].toLowerCase();
  const text = match[2];

  let spacerType: WidgetChannelNode['spacerType'] = 'left';
  if (text === '---') spacerType = 'dashline';
  else if (text === '...') spacerType = 'dotline';
  else if (text === '___' || text === '===' || text === '---' || text === '___') spacerType = 'line';
  else if (prefix === 'c') spacerType = 'center';
  else if (prefix === 'r') spacerType = 'right';
  else if (prefix === '*' || prefix === 'l*' || prefix === '') {
    if (!text || text === '=' || text.match(/^[=\-_.]+$/)) spacerType = 'line';
    else spacerType = 'left';
  }

  return { isSpacer: true, spacerType, spacerText: text };
}

function hasClients(node: WidgetChannelNode): boolean {
  if (node.clients.length > 0) return true;
  return node.children.some(hasClients);
}

export function buildWidgetTree(
  channels: any[],
  clients: any[],
  maxDepth: number,
  showClients: boolean,
  hideEmptyChannels: boolean = false,
): WidgetChannelNode[] {
  // Group human clients by channel
  const clientsByChannel = new Map<number, WidgetClient[]>();
  if (showClients) {
    for (const c of clients) {
      if (String(c.client_type) !== '0') continue;
      const cid = Number(c.cid);
      if (!clientsByChannel.has(cid)) clientsByChannel.set(cid, []);
      clientsByChannel.get(cid)!.push({
        clid: Number(c.clid),
        nickname: String(c.client_nickname || '?'),
        isAway: Number(c.client_away) === 1,
        isMuted: Number(c.client_input_muted) === 1,
      });
    }
  }

  // Build flat map
  const map = new Map<number, WidgetChannelNode>();
  const roots: WidgetChannelNode[] = [];

  for (const ch of channels) {
    const cid = Number(ch.cid);
    const name = String(ch.channel_name || '');
    const spacer = parseSpacerInfo(name);

    map.set(cid, {
      cid,
      name,
      hasPassword: Number(ch.channel_flag_password) === 1,
      isspacer: spacer.isSpacer,
      spacerType: spacer.spacerType,
      spacerText: spacer.spacerText,
      clients: clientsByChannel.get(cid) ?? [],
      children: [],
    });
  }

  // Link parents
  for (const ch of channels) {
    const cid = Number(ch.cid);
    const pid = Number(ch.pid);
    const node = map.get(cid)!;
    if (pid === 0) {
      roots.push(node);
    } else {
      map.get(pid)?.children.push(node);
    }
  }

  // Prune depth
  function pruneDepth(nodes: WidgetChannelNode[], depth: number): WidgetChannelNode[] {
    if (depth >= maxDepth) return nodes.map(n => ({ ...n, children: [] }));
    return nodes.map(n => ({ ...n, children: pruneDepth(n.children, depth + 1) }));
  }

  let result = pruneDepth(roots, 0);

  // Filter empty channels (keep spacers always visible)
  if (hideEmptyChannels) {
    function filterEmpty(nodes: WidgetChannelNode[]): WidgetChannelNode[] {
      return nodes
        .map(n => ({ ...n, children: filterEmpty(n.children) }))
        .filter(n => n.isspacer || hasClients(n));
    }
    result = filterEmpty(result);
  }

  return result;
}
