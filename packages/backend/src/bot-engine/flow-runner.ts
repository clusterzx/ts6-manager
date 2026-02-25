import type { PrismaClient } from '../../generated/prisma/index.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';
import type { WebQueryClient } from '../ts-client/webquery-client.js';
import type { VoiceBotManager } from '../voice/voice-bot-manager.js';
import { ExecutionContext } from './context.js';
import type { WebSocketServer } from 'ws';
import type {
  FlowDefinition, FlowNode, FlowEdge, NodeData,
  KickActionData, BanActionData, MoveActionData, MessageActionData,
  PokeActionData, ChannelCreateActionData, ChannelEditActionData, ChannelDeleteActionData,
  GroupAddClientActionData, GroupRemoveClientActionData,
  WebQueryActionData, WebhookActionData, HttpRequestActionData,
  AfkMoverActionData, IdleKickerActionData, PokeGroupActionData, RankCheckActionData, TempChannelCleanupActionData,
  ConditionNodeData, DelayNodeData, VariableNodeData, LogNodeData,
} from '@ts6/common';
import axios from 'axios';
import { validateUrl } from '../utils/url-validator.js';
import { ALLOWED_WEBQUERY_COMMANDS } from './command-whitelist.js';

const MAX_NODE_VISITS = 100;
const MAX_DELAY_MS = 300000; // 5 minutes

interface FlowInfo {
  id: number;
  name: string;
  serverConfigId: number;
  virtualServerId: number;
  flowData: FlowDefinition;
}

export class FlowRunner {
  private voiceBotManager: VoiceBotManager | null = null;

  constructor(
    private prisma: PrismaClient,
    private connectionPool: ConnectionPool,
    private wss: WebSocketServer,
  ) {}

  setVoiceBotManager(manager: VoiceBotManager): void {
    this.voiceBotManager = manager;
  }

  async execute(
    flow: FlowInfo,
    triggerNodeId: string,
    triggerType: string,
    eventData: Record<string, string>,
    timezone?: string,
  ): Promise<void> {
    const execution = await this.prisma.botExecution.create({
      data: {
        flowId: flow.id,
        triggeredBy: triggerType,
        triggerData: JSON.stringify(eventData),
        status: 'running',
      },
    });

    const ctx = new ExecutionContext(
      this.prisma,
      flow.id,
      execution.id,
      flow.serverConfigId,
      flow.virtualServerId,
      triggerType,
      eventData,
      timezone,
    );

    this.broadcast('bot:execution:start', {
      flowId: flow.id,
      executionId: execution.id,
      triggeredBy: triggerType,
    });

    const startTime = Date.now();

    try {
      const client = this.connectionPool.getClient(flow.serverConfigId);
      const triggerNode = flow.flowData.nodes.find(n => n.id === triggerNodeId);

      if (!triggerNode) {
        throw new Error(`Trigger node ${triggerNodeId} not found in flow ${flow.id}`);
      }

      await this.log(ctx, triggerNode, 'info', `Flow '${flow.name}' triggered by ${triggerType}`);

      let nodeVisits = 0;
      const visitNode = async (node: FlowNode): Promise<void> => {
        nodeVisits++;
        if (nodeVisits > MAX_NODE_VISITS) {
          throw new Error(`Max node visits (${MAX_NODE_VISITS}) exceeded — possible infinite loop`);
        }
        await this.processNode(node, flow.flowData, ctx, client, visitNode);
      };

      await visitNode(triggerNode);

      await this.prisma.botExecution.update({
        where: { id: execution.id },
        data: { status: 'completed', endedAt: new Date() },
      });

      this.broadcast('bot:execution:complete', {
        flowId: flow.id,
        executionId: execution.id,
        duration: Date.now() - startTime,
      });
    } catch (err: any) {
      await this.log(ctx, null, 'error', `Flow execution failed: ${err.message}`);

      await this.prisma.botExecution.update({
        where: { id: execution.id },
        data: { status: 'failed', error: err.message, endedAt: new Date() },
      });

      this.broadcast('bot:execution:failed', {
        flowId: flow.id,
        executionId: execution.id,
        error: err.message,
      });
    }
  }

  private async processNode(
    node: FlowNode,
    flowDef: FlowDefinition,
    ctx: ExecutionContext,
    client: WebQueryClient,
    visitNode: (node: FlowNode) => Promise<void>,
  ): Promise<void> {
    await this.log(ctx, node, 'debug', `Processing node '${node.data.label}' (type=${node.type})`);

    switch (node.type) {
      case 'trigger': {
        const edges = this.getOutgoingEdges(node.id, flowDef);
        for (const edge of edges) {
          const target = this.findNode(edge.target, flowDef);
          if (target) await visitNode(target);
        }
        break;
      }

      case 'condition': {
        const condData = node.data as ConditionNodeData;
        const expression = await ctx.resolveTemplate(condData.expression);
        const result = await ctx.evaluateCondition(expression);
        await this.log(ctx, node, 'info', `Condition '${condData.expression}' → ${result}`);

        const handle = result ? 'true' : 'false';
        const edges = this.getOutgoingEdges(node.id, flowDef, handle);
        for (const edge of edges) {
          const target = this.findNode(edge.target, flowDef);
          if (target) await visitNode(target);
        }
        break;
      }

      case 'action': {
        await this.executeAction(node, ctx, client);
        const edges = this.getOutgoingEdges(node.id, flowDef);
        for (const edge of edges) {
          const target = this.findNode(edge.target, flowDef);
          if (target) await visitNode(target);
        }
        break;
      }

      case 'delay': {
        const delayData = node.data as DelayNodeData;
        const delayMs = Math.min(delayData.delayMs, MAX_DELAY_MS);
        await this.log(ctx, node, 'info', `Delaying ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        const edges = this.getOutgoingEdges(node.id, flowDef);
        for (const edge of edges) {
          const target = this.findNode(edge.target, flowDef);
          if (target) await visitNode(target);
        }
        break;
      }

      case 'variable': {
        const varData = node.data as VariableNodeData;
        const name = await ctx.resolveTemplate(varData.variableName);
        const value = await ctx.resolveTemplate(varData.value);

        switch (varData.operation) {
          case 'set': await ctx.setVariable(name, value); break;
          case 'increment': await ctx.incrementVariable(name, value); break;
          case 'append': await ctx.appendVariable(name, value); break;
        }

        await this.log(ctx, node, 'info', `Variable '${name}' ${varData.operation} = '${value}'`);
        const edges = this.getOutgoingEdges(node.id, flowDef);
        for (const edge of edges) {
          const target = this.findNode(edge.target, flowDef);
          if (target) await visitNode(target);
        }
        break;
      }

      case 'log': {
        const logData = node.data as LogNodeData;
        const message = await ctx.resolveTemplate(logData.message);
        await this.log(ctx, node, logData.level, message);
        const edges = this.getOutgoingEdges(node.id, flowDef);
        for (const edge of edges) {
          const target = this.findNode(edge.target, flowDef);
          if (target) await visitNode(target);
        }
        break;
      }
    }
  }

  private async executeAction(
    node: FlowNode,
    ctx: ExecutionContext,
    client: WebQueryClient,
  ): Promise<void> {
    const data = node.data as any;
    const actionType = data.actionType as string;

    await this.log(ctx, node, 'info', `Executing action: ${actionType}`);

    try {
      switch (actionType) {
        case 'kick': await this.executeKick(data as KickActionData, ctx, client); break;
        case 'ban': await this.executeBan(data as BanActionData, ctx, client); break;
        case 'move': await this.executeMove(data as MoveActionData, ctx, client); break;
        case 'message': await this.executeMessage(data as MessageActionData, ctx, client); break;
        case 'poke': await this.executePoke(data as PokeActionData, ctx, client); break;
        case 'channelCreate': await this.executeChannelCreate(data as ChannelCreateActionData, ctx, client); break;
        case 'groupAddClient': await this.executeGroupAddClient(data as GroupAddClientActionData, ctx, client); break;
        case 'groupRemoveClient': await this.executeGroupRemoveClient(data as GroupRemoveClientActionData, ctx, client); break;
        case 'webquery': await this.executeWebQuery(data as WebQueryActionData, ctx, client); break;
        case 'webhook': await this.executeWebhook(data as WebhookActionData, ctx); break;
        case 'channelEdit': await this.executeChannelEdit(data as ChannelEditActionData, ctx, client); break;
        case 'channelDelete': await this.executeChannelDelete(data as ChannelDeleteActionData, ctx, client); break;
        case 'httpRequest': await this.executeHttpRequest(data as HttpRequestActionData, ctx); break;
        case 'afkMover': await this.executeAfkMover(data as AfkMoverActionData, ctx, client); break;
        case 'idleKicker': await this.executeIdleKicker(data as IdleKickerActionData, ctx, client); break;
        case 'pokeGroup': await this.executePokeGroup(data as PokeGroupActionData, ctx, client); break;
        case 'rankCheck': await this.executeRankCheck(data as RankCheckActionData, ctx, client); break;
        case 'tempChannelCleanup': await this.executeTempChannelCleanup(data as TempChannelCleanupActionData, ctx, client); break;
        case 'voicePlay': await this.executeVoicePlay(data, ctx); break;
        case 'voiceStop': await this.executeVoiceStop(data, ctx); break;
        case 'voiceJoinChannel': await this.executeVoiceJoinChannel(data, ctx); break;
        case 'voiceLeaveChannel': await this.executeVoiceLeaveChannel(data, ctx); break;
        case 'voiceVolume': await this.executeVoiceVolume(data, ctx); break;
        case 'voicePauseResume': await this.executeVoicePauseResume(data, ctx); break;
        case 'voiceSkip': await this.executeVoiceSkip(data, ctx); break;
        case 'voiceSeek': await this.executeVoiceSeek(data, ctx); break;
        case 'voiceTts': await this.executeVoiceTts(data, ctx); break;
        case 'animatedChannel':
          // Animation lifecycle managed by BotEngine (not per-execution)
          await this.log(ctx, node, 'info', 'Animation managed by engine');
          break;
        default:
          await this.log(ctx, node, 'warn', `Unknown action type: ${actionType}`);
      }
    } catch (err: any) {
      await this.log(ctx, node, 'error', `Action '${actionType}' failed: ${err.message}`);
      throw err;
    }
  }

  private async executeKick(data: KickActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const clid = ctx.eventData.clid;
    const reasonMsg = await ctx.resolveTemplate(data.reasonMsg || '');
    await client.executePost(ctx.sid, 'clientkick', {
      clid,
      reasonid: data.reasonId,
      reasonmsg: reasonMsg || undefined,
    });
  }

  private async executeBan(data: BanActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const clid = ctx.eventData.clid;
    const reason = data.reason ? await ctx.resolveTemplate(data.reason) : undefined;
    await client.executePost(ctx.sid, 'banclient', {
      clid,
      time: data.duration || 0,
      banreason: reason,
    });
  }

  private async executeMove(data: MoveActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const clid = ctx.eventData.clid;
    const cid = await ctx.resolveTemplate(data.channelId);
    await client.executePost(ctx.sid, 'clientmove', { clid, cid });
  }

  private async executeMessage(data: MessageActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const msg = await ctx.resolveTemplate(data.message);
    const target = data.target ? await ctx.resolveTemplate(data.target) : ctx.eventData.clid;

    // TS3 channel messages always go to the query client's current channel.
    // If a specific channel is targeted, move the query client there first, then move back.
    if (data.targetMode === 2 && target) {
      const whoami = await client.execute(ctx.sid, 'whoami');
      const myClid = whoami?.[0]?.client_id;
      const myCid = whoami?.[0]?.client_channel_id;
      if (myClid) {
        await client.executePost(ctx.sid, 'clientmove', { clid: myClid, cid: target });
        await client.executePost(ctx.sid, 'sendtextmessage', { targetmode: 2, msg });
        // Move back to original channel
        if (myCid && String(myCid) !== String(target)) {
          await client.executePost(ctx.sid, 'clientmove', { clid: myClid, cid: myCid });
        }
        return;
      }
    }

    await client.executePost(ctx.sid, 'sendtextmessage', {
      targetmode: data.targetMode,
      target,
      msg,
    });
  }

  private async executePoke(data: PokeActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const clid = ctx.eventData.clid;
    const msg = await ctx.resolveTemplate(data.message);
    await client.executePost(ctx.sid, 'clientpoke', { clid, msg });
  }

  private async executeChannelCreate(data: ChannelCreateActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const resolved: Record<string, string> = {};
    for (const [key, val] of Object.entries(data.params || {})) {
      resolved[key] = await ctx.resolveTemplate(val);
    }
    const result = await client.executePost(ctx.sid, 'channelcreate', resolved);
    if (result?.[0]?.cid) {
      ctx.setTemp('lastCreatedChannelId', result[0].cid);
    }
  }

  private async executeGroupAddClient(data: GroupAddClientActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const cldbid = ctx.eventData.client_database_id;
    const sgid = await ctx.resolveTemplate(data.groupId);
    await client.executePost(ctx.sid, 'servergroupaddclient', { sgid, cldbid });
  }

  private async executeGroupRemoveClient(data: GroupRemoveClientActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const cldbid = ctx.eventData.client_database_id;
    const sgid = await ctx.resolveTemplate(data.groupId);
    await client.executePost(ctx.sid, 'servergroupdelclient', { sgid, cldbid });
  }

  private async executeWebQuery(data: WebQueryActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const resolved: Record<string, string> = {};
    for (const [key, val] of Object.entries(data.params || {})) {
      resolved[key] = await ctx.resolveTemplate(val);
    }

    // Support inline params in command string: "clientinfo clid=5" → command="clientinfo", params={clid:"5"}
    let command = await ctx.resolveTemplate(data.command);
    const spaceIdx = command.indexOf(' ');
    if (spaceIdx > 0) {
      const inlinePart = command.substring(spaceIdx + 1);
      command = command.substring(0, spaceIdx);
      for (const pair of inlinePart.split(/\s+/)) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          const k = pair.substring(0, eqIdx);
          const v = pair.substring(eqIdx + 1);
          if (!resolved[k]) resolved[k] = v;
        }
      }
    }

    // H7: WebQuery command whitelist
    if (!ALLOWED_WEBQUERY_COMMANDS.has(command.toLowerCase())) {
      throw new Error(`WebQuery command "${command}" is not allowed in bot flows`);
    }

    const result = await client.executePost(ctx.sid, command, resolved);
    ctx.setTemp('lastResult', JSON.stringify(result));
    if (data.storeAs && result?.[0]) {
      ctx.setTemp(data.storeAs, result[0]);
    }
  }

  private async executeWebhook(data: WebhookActionData, ctx: ExecutionContext): Promise<void> {
    const url = await ctx.resolveTemplate(data.url);

    // C3: SSRF protection
    const urlCheck = await validateUrl(url);
    if (!urlCheck.valid) {
      throw new Error(`Webhook URL blocked: ${urlCheck.error}`);
    }

    const body = data.body ? await ctx.resolveTemplate(data.body) : undefined;
    const headers: Record<string, string> = {};
    if (data.headers) {
      for (const [k, v] of Object.entries(data.headers)) {
        headers[k] = await ctx.resolveTemplate(v);
      }
    }
    const response = await axios({
      method: (data.method || 'POST') as any,
      url,
      headers,
      data: body ? JSON.parse(body) : undefined,
      timeout: 10000,
    });
    if (data.storeAs) {
      ctx.setTemp(data.storeAs, response.data);
    }
  }

  private async executeChannelEdit(data: ChannelEditActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const cid = await ctx.resolveTemplate(data.channelId);
    const resolved: Record<string, string> = { cid };
    for (const [key, val] of Object.entries(data.params || {})) {
      resolved[key] = await ctx.resolveTemplate(val);
    }
    await client.executePost(ctx.sid, 'channeledit', resolved);
  }

  private async executeChannelDelete(data: ChannelDeleteActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const cid = await ctx.resolveTemplate(data.channelId);
    await client.executePost(ctx.sid, 'channeldelete', { cid, force: data.force ? 1 : 0 });
  }

  private async executeHttpRequest(data: HttpRequestActionData, ctx: ExecutionContext): Promise<void> {
    const url = await ctx.resolveTemplate(data.url);

    // C3: SSRF protection
    const urlCheck = await validateUrl(url);
    if (!urlCheck.valid) {
      throw new Error(`HTTP request URL blocked: ${urlCheck.error}`);
    }

    const body = data.body ? await ctx.resolveTemplate(data.body) : undefined;
    const headers: Record<string, string> = {};
    if (data.headers) {
      for (const [k, v] of Object.entries(data.headers)) {
        headers[k] = await ctx.resolveTemplate(v);
      }
    }
    const response = await axios({
      method: (data.method || 'GET') as any,
      url,
      headers,
      data: body ? JSON.parse(body) : undefined,
      timeout: 15000,
    });
    if (data.storeAs) {
      ctx.setTemp(data.storeAs, response.data);
    }
  }

  private async executeAfkMover(data: AfkMoverActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const afkCid = await ctx.resolveTemplate(data.afkChannelId);
    const thresholdSec = data.idleThresholdSeconds || 300;
    const exemptIds = data.exemptGroupIds
      ? (await ctx.resolveTemplate(data.exemptGroupIds)).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const clients = await client.executePost(ctx.sid, 'clientlist', { '-times': '', '-groups': '' });
    if (!Array.isArray(clients)) return;

    let movedCount = 0;
    for (const cl of clients) {
      // Skip query clients
      if (String(cl.client_type) === '1') continue;
      // Skip clients already in the AFK channel
      if (String(cl.cid) === String(afkCid)) continue;
      // Check idle time
      const idleMs = parseInt(cl.client_idle_time) || 0;
      if (idleMs / 1000 < thresholdSec) continue;
      // Check exempt groups
      if (exemptIds.length > 0 && cl.client_servergroups) {
        const clientGroups = String(cl.client_servergroups).split(',');
        if (exemptIds.some(g => clientGroups.includes(g))) continue;
      }
      try {
        await client.executePost(ctx.sid, 'clientmove', { clid: cl.clid, cid: afkCid });
        movedCount++;
      } catch { /* skip clients that can't be moved */ }
    }
    ctx.setTemp('afkMovedCount', movedCount);
  }

  private async executeIdleKicker(data: IdleKickerActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const thresholdSec = data.idleThresholdSeconds || 1800;
    const reason = data.reason ? await ctx.resolveTemplate(data.reason) : 'Idle timeout';
    const exemptIds = data.exemptGroupIds
      ? (await ctx.resolveTemplate(data.exemptGroupIds)).split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const clients = await client.executePost(ctx.sid, 'clientlist', { '-times': '', '-groups': '' });
    if (!Array.isArray(clients)) return;

    let kickedCount = 0;
    for (const cl of clients) {
      if (String(cl.client_type) === '1') continue;
      const idleMs = parseInt(cl.client_idle_time) || 0;
      if (idleMs / 1000 < thresholdSec) continue;
      if (exemptIds.length > 0 && cl.client_servergroups) {
        const clientGroups = String(cl.client_servergroups).split(',');
        if (exemptIds.some(g => clientGroups.includes(g))) continue;
      }
      try {
        await client.executePost(ctx.sid, 'clientkick', { clid: cl.clid, reasonid: 5, reasonmsg: reason });
        kickedCount++;
      } catch { /* skip */ }
    }
    ctx.setTemp('idleKickedCount', kickedCount);
  }

  private async executePokeGroup(data: PokeGroupActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const sgid = await ctx.resolveTemplate(data.groupId);
    const msg = await ctx.resolveTemplate(data.message);

    // Get all members of the group
    const groupClients = await client.executePost(ctx.sid, 'servergroupclientlist', { sgid });
    if (!Array.isArray(groupClients) || groupClients.length === 0) return;
    const cldbids = new Set(groupClients.map((gc: any) => String(gc.cldbid)));

    // Get online clients to map cldbid → clid
    const onlineClients = await client.executePost(ctx.sid, 'clientlist', {});
    if (!Array.isArray(onlineClients)) return;

    let pokedCount = 0;
    for (const cl of onlineClients) {
      if (String(cl.client_type) === '1') continue;
      if (!cldbids.has(String(cl.client_database_id))) continue;
      try {
        await client.executePost(ctx.sid, 'clientpoke', { clid: cl.clid, msg });
        pokedCount++;
      } catch { /* skip */ }
    }
    ctx.setTemp('pokedCount', pokedCount);
  }

  private async executeRankCheck(data: RankCheckActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    // ranks is JSON: [{ "hours": 10, "groupId": "7" }, { "hours": 50, "groupId": "8" }]
    let ranks: Array<{ hours: number; groupId: string }>;
    try {
      ranks = JSON.parse(await ctx.resolveTemplate(data.ranks));
    } catch {
      throw new Error('Invalid ranks JSON in rankCheck action');
    }
    if (!Array.isArray(ranks) || ranks.length === 0) return;

    // Sort ranks descending by hours so highest rank is checked first
    ranks.sort((a, b) => b.hours - a.hours);

    const clients = await client.executePost(ctx.sid, 'clientlist', { '-times': '', '-groups': '' });
    if (!Array.isArray(clients)) return;

    let promoted = 0;
    for (const cl of clients) {
      if (String(cl.client_type) === '1') continue;
      const cldbid = String(cl.client_database_id);

      // Get total online time from BotVariable (accumulate via cron)
      const varName = `onlinetime_${cldbid}`;
      const storedStr = await ctx.getVariable(varName);
      const storedSeconds = parseFloat(storedStr) || 0;
      // Add current connection time
      const connectionTime = parseInt(cl.connection_connected_time) || 0;
      const totalSeconds = storedSeconds + connectionTime / 1000;
      const totalHours = totalSeconds / 3600;

      const clientGroups = String(cl.client_servergroups || '').split(',');

      for (const rank of ranks) {
        if (totalHours >= rank.hours && !clientGroups.includes(rank.groupId)) {
          try {
            await client.executePost(ctx.sid, 'servergroupaddclient', { sgid: rank.groupId, cldbid });
            promoted++;
          } catch { /* skip */ }
          break; // Only assign highest eligible rank
        }
      }
    }
    ctx.setTemp('rankPromotedCount', promoted);
  }

  private async executeTempChannelCleanup(data: TempChannelCleanupActionData, ctx: ExecutionContext, client: WebQueryClient): Promise<void> {
    const parentCid = await ctx.resolveTemplate(data.parentChannelId);
    const protectedStr = data.protectedChannelIds ? await ctx.resolveTemplate(data.protectedChannelIds) : '';
    const protectedSet = new Set(protectedStr.split(',').map(s => s.trim()).filter(Boolean));

    const channels = await client.execute(ctx.sid, 'channellist');
    if (!Array.isArray(channels)) return;

    let deleted = 0;
    for (const ch of channels) {
      const cid = String(ch.cid);
      const pid = String(ch.pid);
      const totalClients = parseInt(ch.total_clients) || 0;

      if (pid !== parentCid) continue;
      if (protectedSet.has(cid)) continue;
      if (totalClients > 0) continue;

      try {
        await client.executePost(ctx.sid, 'channeldelete', { cid, force: 1 });
        deleted++;
      } catch {
        // Channel might have clients that joined between list and delete — ignore
      }
    }
    ctx.setTemp('tempChannelsDeleted', deleted);
  }

  // --- Voice Action Methods ---

  private getVoiceBotManager(): VoiceBotManager {
    if (!this.voiceBotManager) throw new Error('VoiceBotManager not initialized');
    return this.voiceBotManager;
  }

  private async executeVoicePlay(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    if (!botId) throw new Error('Voice Play: botId is required');

    if (data.playlistId) {
      const playlistId = parseInt(await ctx.resolveTemplate(data.playlistId));
      if (playlistId) {
        const playlist = await this.prisma.playlist.findUnique({
          where: { id: playlistId },
          include: { songs: { include: { song: true }, orderBy: { position: 'asc' } } },
        });
        if (playlist) {
          const bot = mgr.getBot(botId);
          if (bot) {
            for (const ps of playlist.songs) {
              bot.queue.add({
                id: `song_${ps.song.id}`,
                title: ps.song.title,
                artist: ps.song.artist || undefined,
                duration: ps.song.duration || undefined,
                filePath: ps.song.filePath,
                source: (ps.song.source as 'local' | 'youtube' | 'url') || 'local',
                sourceUrl: ps.song.sourceUrl || undefined,
              });
            }
            if (bot.status === 'connected') {
              const first = bot.queue.next();
              if (first) bot.play(first);
            }
          }
        }
        return;
      }
    }

    if (data.songId) {
      const songId = parseInt(await ctx.resolveTemplate(data.songId));
      if (songId) {
        const song = await this.prisma.song.findUnique({ where: { id: songId } });
        if (song) {
          const bot = mgr.getBot(botId);
          if (bot) {
            bot.queue.add({
              id: `song_${song.id}`,
              title: song.title,
              artist: song.artist || undefined,
              duration: song.duration || undefined,
              filePath: song.filePath,
              source: (song.source as 'local' | 'youtube' | 'url') || 'local',
              sourceUrl: song.sourceUrl || undefined,
            });
            if (bot.status === 'connected') {
              const first = bot.queue.next();
              if (first) bot.play(first);
            }
          }
        }
      }
    }
  }

  private async executeVoiceStop(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    if (!botId) throw new Error('Voice Stop: botId is required');
    await mgr.stopBot(botId);
  }

  private async executeVoiceJoinChannel(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    const channelId = await ctx.resolveTemplate(data.channelId);
    const channelPassword = data.channelPassword ? await ctx.resolveTemplate(data.channelPassword) : undefined;
    if (!botId) throw new Error('Voice Join: botId is required');
    // Reconnect bot with the specified channel as default
    await mgr.stopBot(botId);
    const bot = mgr.getBot(botId);
    if (bot) {
      // Update the default channel before restart
      await this.prisma.musicBot.update({ where: { id: botId }, data: { defaultChannel: channelId, channelPassword: channelPassword ?? null } });
    }
    await mgr.startBot(botId);
  }

  private async executeVoiceLeaveChannel(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    if (!botId) throw new Error('Voice Leave: botId is required');
    await mgr.stopBot(botId);
  }

  private async executeVoiceVolume(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    const volume = parseInt(await ctx.resolveTemplate(data.volume));
    if (!botId) throw new Error('Voice Volume: botId is required');
    const bot = mgr.getBot(botId);
    if (bot) bot.setVolume(Math.max(0, Math.min(100, volume || 50)));
  }

  private async executeVoicePauseResume(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    if (!botId) throw new Error('Voice PauseResume: botId is required');
    const bot = mgr.getBot(botId);
    if (!bot) return;
    const action = data.action || 'toggle';
    if (action === 'pause') {
      bot.pause();
    } else if (action === 'resume') {
      bot.resume();
    } else {
      // toggle
      if (bot.status === 'paused') bot.resume(); else bot.pause();
    }
  }

  private async executeVoiceSkip(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    if (!botId) throw new Error('Voice Skip: botId is required');
    const bot = mgr.getBot(botId);
    if (!bot) return;
    if (data.direction === 'previous') {
      bot.previous();
    } else {
      bot.skip();
    }
  }

  private async executeVoiceSeek(data: any, ctx: ExecutionContext): Promise<void> {
    const mgr = this.getVoiceBotManager();
    const botId = parseInt(await ctx.resolveTemplate(data.botId));
    const position = parseInt(await ctx.resolveTemplate(data.position));
    if (!botId) throw new Error('Voice Seek: botId is required');
    const bot = mgr.getBot(botId);
    if (bot) bot.seek(position || 0);
  }

  private async executeVoiceTts(data: any, ctx: ExecutionContext): Promise<void> {
    // TTS is a placeholder — log that it's not yet implemented
    const text = await ctx.resolveTemplate(data.text || '');
    console.log(`[FlowRunner] TTS not yet implemented. Text: "${text}", language: ${data.language || 'default'}`);
  }

  // --- Helpers ---

  private getOutgoingEdges(nodeId: string, flowDef: FlowDefinition, handle?: string): FlowEdge[] {
    return flowDef.edges.filter(e => {
      if (e.source !== nodeId) return false;
      if (handle !== undefined) {
        return e.sourceHandle === handle;
      }
      return true;
    });
  }

  private findNode(nodeId: string, flowDef: FlowDefinition): FlowNode | undefined {
    return flowDef.nodes.find(n => n.id === nodeId);
  }

  private async log(
    ctx: ExecutionContext,
    node: FlowNode | null,
    level: string,
    message: string,
    data?: any,
  ): Promise<void> {
    try {
      await this.prisma.botExecutionLog.create({
        data: {
          executionId: ctx.executionId,
          serverConfigId: ctx.configId,
          flowId: ctx.flowId,
          nodeId: node?.id || null,
          nodeName: node?.data?.label || null,
          level,
          message,
          data: data ? JSON.stringify(data) : null,
        },
      });
    } catch {
      // Swallow DB errors during logging to avoid cascading failures
    }
  }

  private broadcast(type: string, payload: any): void {
    const msg = JSON.stringify({ type, ...payload });
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(msg);
      }
    });
  }
}
