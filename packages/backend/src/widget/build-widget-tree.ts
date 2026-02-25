import type { WidgetChannelNode, WidgetClient } from '@ts6/common';

export function buildWidgetTree(
  channels: any[],
  clients: any[],
  maxDepth: number,
  showClients: boolean,
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
    map.set(cid, {
      cid,
      name: String(ch.channel_name || ''),
      hasPassword: Number(ch.channel_flag_password) === 1,
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

  return pruneDepth(roots, 0);
}
