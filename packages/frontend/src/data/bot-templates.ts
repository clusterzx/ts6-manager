import { Clock, Users, Shield, Globe, Zap, MessageSquare, Moon, Timer, Megaphone, Award, FolderPlus, Eye, Webhook, Sparkles } from 'lucide-react';

export interface TemplateConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  defaultValue?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  category: 'info-channels' | 'moderation' | 'automation' | 'integration';
  icon: React.ElementType;
  configFields: TemplateConfigField[];
  flowDataFactory: (config: Record<string, string>) => { nodes: any[]; edges: any[] };
}

let _id = 0;
const nid = () => `tpl_${++_id}`;
const eid = () => `tpl_e${_id}`;

function resetIds() { _id = 0; }

// Helper to build a simple linear flow
function makeNode(id: string, type: string, label: string, config: Record<string, any>, x: number, y: number) {
  return { id, type, label, config, x, y };
}
function makeEdge(id: string, source: string, target: string, sourcePort = 'out', targetPort = 'in') {
  return { id, source, sourcePort, target, targetPort };
}

export const BOT_TEMPLATES: BotTemplate[] = [
  // ===== INFO CHANNELS =====
  {
    id: 'clock-channel',
    name: 'Clock Channel',
    description: 'Updates a channel name with the current time every minute.',
    category: 'info-channels',
    icon: Clock,
    configFields: [
      { key: 'channelId', label: 'Channel ID', type: 'number', placeholder: '42', required: true },
      { key: 'timezone', label: 'Timezone', type: 'select', defaultValue: 'Europe/Berlin', options: [
        { label: 'Europe/Berlin (CET/CEST)', value: 'Europe/Berlin' },
        { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
        { label: 'Europe/Paris (CET/CEST)', value: 'Europe/Paris' },
        { label: 'Europe/Moscow (MSK)', value: 'Europe/Moscow' },
        { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
        { label: 'America/Chicago (CST/CDT)', value: 'America/Chicago' },
        { label: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
        { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
        { label: 'UTC', value: 'UTC' },
      ] },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_cron', 'Every Minute', { cron: '* * * * *', timezone: cfg.timezone || 'Europe/Berlin' }, 60, 80),
          makeNode(n2, 'action_channelEdit', 'Update Clock', { channelId: cfg.channelId, channel_name: '[cspacer]{{time.time}}' }, 300, 80),
        ],
        edges: [makeEdge(eid(), n1, n2)],
      };
    },
  },
  {
    id: 'online-counter',
    name: 'Online Counter',
    description: 'Shows the current online client count in a channel name.',
    category: 'info-channels',
    icon: Users,
    configFields: [
      { key: 'channelId', label: 'Channel ID', type: 'number', placeholder: '43', required: true },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_cron', 'Every Minute', { cron: '* * * * *' }, 60, 80),
          makeNode(n2, 'action_webquery', 'Get Server Info', { command: 'serverinfo', storeAs: 'server' }, 300, 80),
          makeNode(n3, 'action_channelEdit', 'Update Counter', { channelId: cfg.channelId, channel_name: '[cspacer]Online: {{temp.server.virtualserver_clientsonline}}/{{temp.server.virtualserver_maxclients}}' }, 540, 80),
        ],
        edges: [makeEdge(eid(), n1, n2), makeEdge(eid(), n2, n3)],
      };
    },
  },
  {
    id: 'server-stats',
    name: 'Server Stats',
    description: 'Displays uptime, online clients, and channel count in three info channels.',
    category: 'info-channels',
    icon: Eye,
    configFields: [
      { key: 'uptimeChannelId', label: 'Uptime Channel ID', type: 'number', placeholder: '44', required: true },
      { key: 'clientsChannelId', label: 'Clients Channel ID', type: 'number', placeholder: '45', required: true },
      { key: 'channelCountChannelId', label: 'Channel Count Channel ID', type: 'number', placeholder: '46', required: true },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid(), n5 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_cron', 'Every 5 Min', { cron: '*/5 * * * *' }, 60, 150),
          makeNode(n2, 'action_webquery', 'Get Server Info', { command: 'serverinfo', storeAs: 'server' }, 300, 150),
          makeNode(n3, 'action_channelEdit', 'Uptime', { channelId: cfg.uptimeChannelId, channel_name: '[cspacer]Uptime: {{temp.server.virtualserver_uptime|uptime}}' }, 540, 60),
          makeNode(n4, 'action_channelEdit', 'Clients', { channelId: cfg.clientsChannelId, channel_name: '[cspacer]Clients: {{temp.server.virtualserver_clientsonline}}/{{temp.server.virtualserver_maxclients}}' }, 540, 150),
          makeNode(n5, 'action_channelEdit', 'Channels', { channelId: cfg.channelCountChannelId, channel_name: '[cspacer]Channels: {{temp.server.virtualserver_channelsonline}}' }, 540, 240),
        ],
        edges: [
          makeEdge(eid(), n1, n2),
          makeEdge(eid(), n2, n3),
          makeEdge(eid(), n2, n4),
          makeEdge(eid(), n2, n5),
        ],
      };
    },
  },

  {
    id: 'animated-channel',
    name: 'Animated Channel Name',
    description: 'Animates a channel name with visual effects like scrolling marquee, typewriter, bounce, and more. Updates every 2-5 seconds.',
    category: 'info-channels',
    icon: Sparkles,
    configFields: [
      { key: 'channelId', label: 'Channel ID', type: 'number', placeholder: '42', required: true },
      { key: 'text', label: 'Display Text', type: 'text', placeholder: 'Welcome to MyServer', required: true },
      { key: 'style', label: 'Animation Style', type: 'select', defaultValue: 'scroll', options: [
        { label: 'Scroll Left (Marquee)', value: 'scroll' },
        { label: 'Typewriter', value: 'typewriter' },
        { label: 'Bounce', value: 'bounce' },
        { label: 'Blink', value: 'blink' },
        { label: 'Wave (Decorative)', value: 'wave' },
        { label: 'Alternate Case', value: 'alternateCase' },
      ] },
      { key: 'intervalSeconds', label: 'Speed', type: 'select', defaultValue: '3', options: [
        { label: 'Slow (5s)', value: '5' },
        { label: 'Medium (3s)', value: '3' },
        { label: 'Fast (2s)', value: '2' },
        { label: 'Very Fast (1s)', value: '1' },
        { label: 'Ultra (0.5s)', value: '0.5' },
        { label: 'Insane (0.25s)', value: '0.25' },
      ] },
      { key: 'prefix', label: 'Channel Name Prefix', type: 'text', placeholder: '[cspacer]', defaultValue: '[cspacer]' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid();
      return {
        nodes: [
          makeNode(n1, 'action_animatedChannel', 'Animated Channel', {
            channelId: cfg.channelId,
            text: cfg.text || 'Welcome to MyServer',
            style: cfg.style || 'scroll',
            intervalSeconds: cfg.intervalSeconds || '3',
            prefix: cfg.prefix || '[cspacer]',
          }, 200, 100),
        ],
        edges: [],
      };
    },
  },

  // ===== AUTOMATION =====
  {
    id: 'welcome-message',
    name: 'Welcome Message',
    description: 'Sends a welcome message or poke when a client joins the server.',
    category: 'automation',
    icon: MessageSquare,
    configFields: [
      { key: 'message', label: 'Welcome Message', type: 'text', placeholder: 'Welcome {{event.client_nickname}}!', required: true },
      { key: 'usePokeInstead', label: 'Delivery Method', type: 'select', defaultValue: 'message', options: [{ label: 'Private Message', value: 'message' }, { label: 'Poke', value: 'poke' }] },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid();
      const usePoke = cfg.usePokeInstead === 'poke';
      return {
        nodes: [
          makeNode(n1, 'trigger_event', 'Client Enter', { eventName: 'notifycliententerview' }, 60, 80),
          makeNode(n2, 'condition', 'Is Human?', { expression: 'event.client_type == 0' }, 300, 80),
          usePoke
            ? makeNode(n3, 'action_poke', 'Welcome Poke', { message: cfg.message || 'Welcome!' }, 540, 40)
            : makeNode(n3, 'action_message', 'Welcome Msg', { targetMode: 'client', message: cfg.message || 'Welcome!' }, 540, 40),
        ],
        edges: [
          makeEdge(eid(), n1, n2),
          makeEdge(eid(), n2, n3, 'true', 'in'),
        ],
      };
    },
  },
  {
    id: 'support-system',
    name: 'Support System',
    description: 'Notifies admins when a client joins the support channel.',
    category: 'automation',
    icon: Megaphone,
    configFields: [
      { key: 'supportChannelId', label: 'Support Channel ID', type: 'number', placeholder: '15', required: true },
      { key: 'adminGroupId', label: 'Admin Group ID', type: 'number', placeholder: '6', required: true },
      { key: 'message', label: 'Notification Message', type: 'text', placeholder: 'Support needed by {{event.client_nickname}}!' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_event', 'Client Moved', { eventName: 'notifyclientmoved' }, 60, 80),
          makeNode(n2, 'condition', 'Joined Support?', { expression: `event.ctid == ${cfg.supportChannelId}` }, 300, 80),
          makeNode(n3, 'action_webquery', 'Get Client Info', { command: 'clientinfo clid={{event.clid}}', storeAs: 'client' }, 540, 40),
          makeNode(n4, 'action_pokeGroup', 'Notify Admins', { groupId: cfg.adminGroupId, message: cfg.message || 'Support needed by {{temp.client.client_nickname}}!' }, 780, 40),
        ],
        edges: [
          makeEdge(eid(), n1, n2),
          makeEdge(eid(), n2, n3, 'true', 'in'),
          makeEdge(eid(), n3, n4),
        ],
      };
    },
  },
  {
    id: 'temp-channel-creator',
    name: 'Temp Channel Creator',
    description: 'Creates a temporary channel when a client joins a lobby channel, then moves them in. Channel is auto-deleted when empty.',
    category: 'automation',
    icon: FolderPlus,
    configFields: [
      { key: 'lobbyChannelId', label: 'Lobby Channel ID', type: 'number', placeholder: '20', required: true },
      { key: 'parentChannelId', label: 'Parent Channel ID', type: 'number', placeholder: '19', required: true },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid(), n5 = nid();
      const n6 = nid(), n7 = nid();
      return {
        nodes: [
          // Create channel when user joins lobby
          makeNode(n1, 'trigger_event', 'Client Moved', { eventName: 'notifyclientmoved' }, 60, 80),
          makeNode(n2, 'condition', 'Joined Lobby?', { expression: `event.ctid == ${cfg.lobbyChannelId}` }, 300, 80),
          makeNode(n3, 'action_webquery', 'Get Client Info', { command: 'clientinfo clid={{event.clid}}', storeAs: 'client' }, 540, 80),
          makeNode(n4, 'action_channelCreate', 'Create Channel', { channel_name: "{{temp.client.client_nickname}}'s Channel", cpid: cfg.parentChannelId, channel_flag_semi_permanent: '1' }, 780, 80),
          makeNode(n5, 'action_move', 'Move to Channel', { cid: '{{temp.lastCreatedChannelId}}' }, 1020, 80),
          // Cron cleanup: delete empty channels under parent every minute
          makeNode(n6, 'trigger_cron', 'Cleanup Timer', { cron: '* * * * *' }, 60, 220),
          makeNode(n7, 'action_tempChannelCleanup', 'Delete Empty Channels', { parentChannelId: cfg.parentChannelId, protectedChannelIds: cfg.lobbyChannelId }, 300, 220),
        ],
        edges: [
          makeEdge(eid(), n1, n2),
          makeEdge(eid(), n2, n3, 'true', 'in'),
          makeEdge(eid(), n3, n4),
          makeEdge(eid(), n4, n5),
          makeEdge(eid(), n6, n7),
        ],
      };
    },
  },
  {
    id: 'auto-rank',
    name: 'Auto-Rank',
    description: 'Automatically assigns server groups based on cumulative online time.',
    category: 'automation',
    icon: Award,
    configFields: [
      { key: 'ranks', label: 'Ranks (JSON)', type: 'text', placeholder: '[{"hours":10,"groupId":"7"},{"hours":50,"groupId":"8"}]', required: true },
      { key: 'pollInterval', label: 'Check Interval', type: 'select', defaultValue: '*/5 * * * *', options: [{ label: 'Every 5 min', value: '*/5 * * * *' }, { label: 'Every 15 min', value: '*/15 * * * *' }, { label: 'Every hour', value: '0 * * * *' }] },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_cron', 'Rank Timer', { cron: cfg.pollInterval || '*/5 * * * *' }, 60, 80),
          makeNode(n2, 'action_rankCheck', 'Check Ranks', { ranks: cfg.ranks || '[]' }, 300, 80),
        ],
        edges: [makeEdge(eid(), n1, n2)],
      };
    },
  },
  {
    id: 'last-seen-tracker',
    name: 'Last-Seen Tracker',
    description: 'Records the last-seen timestamp when a client disconnects.',
    category: 'automation',
    icon: Clock,
    configFields: [],
    flowDataFactory: () => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_event', 'Client Leave', { eventName: 'notifyclientleftview' }, 60, 80),
          makeNode(n2, 'variable', 'Store Timestamp', { operation: 'set', name: 'lastseen_{{event.client_database_id}}', value: '{{time.timestamp}}' }, 300, 80),
          makeNode(n3, 'log', 'Log Leave', { level: 'info', message: '{{event.client_nickname}} left (dbid={{event.client_database_id}})' }, 540, 80),
        ],
        edges: [makeEdge(eid(), n1, n2), makeEdge(eid(), n2, n3)],
      };
    },
  },

  // ===== MODERATION =====
  {
    id: 'afk-mover',
    name: 'AFK Mover',
    description: 'Moves idle clients to an AFK channel after a configurable timeout.',
    category: 'moderation',
    icon: Moon,
    configFields: [
      { key: 'afkChannelId', label: 'AFK Channel ID', type: 'number', placeholder: '10', required: true },
      { key: 'idleThresholdSeconds', label: 'Idle Threshold (seconds)', type: 'number', placeholder: '300', required: true },
      { key: 'exemptGroupIds', label: 'Exempt Group IDs (comma-separated)', type: 'text', placeholder: '6,7' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_cron', 'AFK Check', { cron: '* * * * *' }, 60, 80),
          makeNode(n2, 'action_afkMover', 'Move AFK', { afkChannelId: cfg.afkChannelId, idleThresholdSeconds: cfg.idleThresholdSeconds || '300', exemptGroupIds: cfg.exemptGroupIds || '' }, 300, 80),
        ],
        edges: [makeEdge(eid(), n1, n2)],
      };
    },
  },
  {
    id: 'idle-kicker',
    name: 'Idle Kicker',
    description: 'Kicks clients that have been idle for too long.',
    category: 'moderation',
    icon: Timer,
    configFields: [
      { key: 'idleThresholdSeconds', label: 'Idle Threshold (seconds)', type: 'number', placeholder: '1800', required: true },
      { key: 'reason', label: 'Kick Reason', type: 'text', placeholder: 'Idle timeout' },
      { key: 'exemptGroupIds', label: 'Exempt Group IDs (comma-separated)', type: 'text', placeholder: '6,7' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_cron', 'Idle Check', { cron: '* * * * *' }, 60, 80),
          makeNode(n2, 'action_idleKicker', 'Kick Idle', { idleThresholdSeconds: cfg.idleThresholdSeconds || '1800', reason: cfg.reason || 'Idle timeout', exemptGroupIds: cfg.exemptGroupIds || '' }, 300, 80),
        ],
        edges: [makeEdge(eid(), n1, n2)],
      };
    },
  },
  {
    id: 'bad-name-checker',
    name: 'Bad Name Checker',
    description: 'Kicks clients whose nickname contains forbidden words.',
    category: 'moderation',
    icon: Shield,
    configFields: [
      { key: 'badWords', label: 'Bad Words (comma-separated)', type: 'text', placeholder: 'admin,moderator,test', required: true },
      { key: 'reason', label: 'Kick Reason', type: 'text', placeholder: 'Forbidden nickname' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const words = (cfg.badWords || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      // Build expression: contains(lower(event.client_nickname),'word1') or contains(...)
      const expr = words.length > 0
        ? words.map(w => `contains(lower(event.client_nickname),'${w}')`).join(' or ')
        : "contains(lower(event.client_nickname),'admin')";

      const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_event', 'Client Enter', { eventName: 'notifycliententerview' }, 60, 80),
          makeNode(n2, 'condition', 'Is Human?', { expression: 'event.client_type == 0' }, 300, 80),
          makeNode(n3, 'condition', 'Bad Name?', { expression: expr }, 540, 40),
          makeNode(n4, 'action_kick', 'Kick Bad Name', { reasonid: '5', reason: cfg.reason || 'Forbidden nickname' }, 780, 0),
        ],
        edges: [
          makeEdge(eid(), n1, n2),
          makeEdge(eid(), n2, n3, 'true', 'in'),
          makeEdge(eid(), n3, n4, 'true', 'in'),
        ],
      };
    },
  },
  {
    id: 'group-protector',
    name: 'Group Protector',
    description: 'Kicks clients who have a protected group but lack the required authorization group.',
    category: 'moderation',
    icon: Shield,
    configFields: [
      { key: 'protectedGroupId', label: 'Protected Group ID', type: 'number', placeholder: '8', required: true },
      { key: 'allowedGroupId', label: 'Authorized Group ID', type: 'number', placeholder: '10', required: true },
      { key: 'action', label: 'Action', type: 'select', defaultValue: 'kick', options: [{ label: 'Kick', value: 'kick' }, { label: 'Remove Group', value: 'remove' }] },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid();
      const actionNode = cfg.action === 'remove'
        ? makeNode(n4, 'action_groupRemove', 'Remove Group', { groupId: cfg.protectedGroupId }, 780, 0)
        : makeNode(n4, 'action_kick', 'Kick Intruder', { reasonid: '5', reason: 'Unauthorized group' }, 780, 0);

      return {
        nodes: [
          makeNode(n1, 'trigger_event', 'Client Enter', { eventName: 'notifycliententerview' }, 60, 80),
          makeNode(n2, 'condition', 'Has Protected?', { expression: `contains(event.client_servergroups,'${cfg.protectedGroupId}')` }, 300, 80),
          makeNode(n3, 'condition', 'Missing Auth?', { expression: `contains(event.client_servergroups,'${cfg.allowedGroupId}') == 0` }, 540, 40),
          actionNode,
        ],
        edges: [
          makeEdge(eid(), n1, n2),
          makeEdge(eid(), n2, n3, 'true', 'in'),
          makeEdge(eid(), n3, n4, 'true', 'in'),
        ],
      };
    },
  },

  // ===== INTEGRATION =====
  {
    id: 'webhook-server-message',
    name: 'Webhook → Server Message',
    description: 'Receives a webhook POST and broadcasts the message to the TeamSpeak server. Great for monitoring alerts, CI/CD notifications, or Discord bridges.',
    category: 'integration',
    icon: Webhook,
    configFields: [
      { key: 'path', label: 'Webhook Path', type: 'text', placeholder: 'server-notify', required: true },
      { key: 'secret', label: 'Secret (optional)', type: 'text', placeholder: 'my-secret-key' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_webhook', 'Incoming Webhook', { path: cfg.path || 'server-notify', method: 'POST', secret: cfg.secret || '' }, 60, 80),
          makeNode(n2, 'action_message', 'Broadcast Message', { targetMode: '3', message: '[Webhook] {{event.webhook_body}}' }, 340, 80),
        ],
        edges: [makeEdge(eid(), n1, n2)],
      };
    },
  },
  {
    id: 'webhook-group-assign',
    name: 'Webhook → Assign Group',
    description: 'External system (e.g. website verification) sends a webhook with a client database ID to assign a server group. Use for website-to-TS3 user verification.',
    category: 'integration',
    icon: Webhook,
    configFields: [
      { key: 'path', label: 'Webhook Path', type: 'text', placeholder: 'verify-user', required: true },
      { key: 'groupId', label: 'Server Group ID to assign', type: 'text', placeholder: '42', required: true },
      { key: 'secret', label: 'Secret (optional)', type: 'text', placeholder: 'my-secret-key' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_webhook', 'Verification Webhook', { path: cfg.path || 'verify-user', method: 'POST', secret: cfg.secret || '' }, 60, 80),
          makeNode(n2, 'action_webquery', 'Add to Group', { command: 'servergroupaddclient', params: { sgid: cfg.groupId, cldbid: '{{event.webhook_body.cldbid}}' } }, 340, 80),
          makeNode(n3, 'log', 'Log Result', { level: 'info', message: 'Assigned group {{groupId}} to cldbid {{event.webhook_body.cldbid}}' }, 600, 80),
        ],
        edges: [makeEdge(eid(), n1, n2), makeEdge(eid(), n2, n3)],
      };
    },
  },
  {
    id: 'webhook-channel-rename',
    name: 'Webhook → Update Channel',
    description: 'Receives a webhook and updates a channel name. Use for external status displays like game server status, stream status, or monitoring dashboards.',
    category: 'integration',
    icon: Webhook,
    configFields: [
      { key: 'path', label: 'Webhook Path', type: 'text', placeholder: 'update-status', required: true },
      { key: 'channelId', label: 'Channel ID to update', type: 'text', placeholder: '42', required: true },
      { key: 'nameTemplate', label: 'Channel Name Template', type: 'text', placeholder: '[STATUS] {{event.webhook_body.status}}', required: true },
      { key: 'secret', label: 'Secret (optional)', type: 'text', placeholder: 'my-secret-key' },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid();
      return {
        nodes: [
          makeNode(n1, 'trigger_webhook', 'Status Webhook', { path: cfg.path || 'update-status', method: 'POST', secret: cfg.secret || '' }, 60, 80),
          makeNode(n2, 'action_channelEdit', 'Update Channel', { channelId: cfg.channelId, params: { channel_name: cfg.nameTemplate || '[STATUS] {{event.webhook_body.status}}' } }, 340, 80),
        ],
        edges: [makeEdge(eid(), n1, n2)],
      };
    },
  },
  {
    id: 'anti-vpn',
    name: 'Anti-VPN',
    description: 'Checks connecting clients against a VPN detection API and kicks/bans VPN users.',
    category: 'integration',
    icon: Globe,
    configFields: [
      { key: 'apiUrl', label: 'API URL (use {{ip}} placeholder)', type: 'text', placeholder: 'https://vpnapi.io/api/{{ip}}?key=YOUR_KEY', required: true },
      { key: 'action', label: 'Action for VPN', type: 'select', defaultValue: 'kick', options: [{ label: 'Kick', value: 'kick' }, { label: 'Ban (1h)', value: 'ban' }] },
    ],
    flowDataFactory: (cfg) => {
      resetIds();
      const n1 = nid(), n2 = nid(), n3 = nid(), n4 = nid(), n5 = nid();
      const url = (cfg.apiUrl || '').replace('{{ip}}', '{{event.connection_client_ip}}');
      const actionNode = cfg.action === 'ban'
        ? makeNode(n5, 'action_ban', 'Ban VPN', { time: 3600, reason: 'VPN detected' }, 780, 0)
        : makeNode(n5, 'action_kick', 'Kick VPN', { reasonid: '5', reason: 'VPN detected' }, 780, 0);

      return {
        nodes: [
          makeNode(n1, 'trigger_event', 'Client Enter', { eventName: 'notifycliententerview' }, 60, 80),
          makeNode(n2, 'condition', 'Is Human?', { expression: 'event.client_type == 0' }, 300, 80),
          makeNode(n3, 'action_httpRequest', 'Check VPN API', { url, method: 'GET', storeAs: 'vpn' }, 540, 40),
          makeNode(n4, 'condition', 'Is VPN?', { expression: "temp.vpn.security.vpn == 1 or temp.vpn.security.proxy == 1" }, 540, 120),
          actionNode,
        ],
        edges: [
          makeEdge(eid(), n1, n2),
          makeEdge(eid(), n2, n3, 'true', 'in'),
          makeEdge(eid(), n3, n4),
          makeEdge(eid(), n4, n5, 'true', 'in'),
        ],
      };
    },
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'info-channels', label: 'Info Channels', description: 'Dynamic channel names with live data' },
  { id: 'moderation', label: 'Moderation', description: 'Automated moderation and protection' },
  { id: 'automation', label: 'Automation', description: 'Welcome messages, temp channels, ranking' },
  { id: 'integration', label: 'Integration', description: 'External APIs and webhooks' },
] as const;
