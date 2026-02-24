import type { PrismaClient } from '../../generated/prisma/index.js';
import type { ConnectionPool } from '../ts-client/connection-pool.js';
import { EventBridge } from './event-bridge.js';
import { FlowRunner } from './flow-runner.js';
import type { Express, Request, Response } from 'express';
import type { WebSocketServer } from 'ws';
import cron from 'node-cron';
import type {
  FlowDefinition, FlowNode, FlowEdge,
  EventTriggerData, CronTriggerData, WebhookTriggerData, CommandTriggerData,
  AnimatedChannelActionData,
} from '@ts6/common';
import { AnimationManager } from './animation-manager.js';
import type { AnimationConfig } from './animation-manager.js';

/**
 * Normalize flow data from the frontend editor format to the engine format.
 *
 * Editor format:
 *   node: { id, type: "trigger_event"/"action_kick"/etc, label, config: { eventName, reason, ... }, x, y }
 *   edge: { id, source, sourcePort, target, targetPort }
 *
 * Engine format (matches @ts6/common types):
 *   node: { id, type: "trigger"/"action"/etc, position: {x,y}, data: { triggerType/actionType, label, ...config } }
 *   edge: { id, source, target, sourceHandle }
 *
 * Config field mappings:
 *   trigger_event:   { eventName } → { triggerType:'event', eventName }
 *   trigger_cron:    { cron } → { triggerType:'cron', cronExpression: cron }
 *   trigger_webhook: { path } → { triggerType:'webhook', webhookPath: path }
 *   trigger_command: { command } → { triggerType:'command', commandPrefix:'!', commandName: command }
 *   action_kick:     { reasonid, reason } → { actionType:'kick', reasonId: parseInt(reasonid)||5, reasonMsg: reason }
 *   action_ban:      { time, reason } → { actionType:'ban', duration: time, reason }
 *   action_move:     { channelId } → { actionType:'move', channelId }
 *   action_message:  { targetMode, message } → { actionType:'message', targetMode: modeMap, message }
 *   condition:       { expression } → { nodeType:'condition', expression }
 *   delay:           { delay } → { nodeType:'delay', delayMs: delay }
 *   variable:        { operation, name, value } → { nodeType:'variable', operation, variableName: name, value }
 *   log:             { level, message } → { nodeType:'log', level, message }
 */
function normalizeFlowData(raw: any): FlowDefinition {
  const targetModeMap: Record<string, number> = { client: 1, channel: 2, server: 3 };

  const nodes: FlowNode[] = (raw.nodes || []).map((n: any) => {
    const nodeType: string = n.type || '';

    // Already in engine format?
    if (n.data && (n.data.triggerType || n.data.actionType || n.data.nodeType)) {
      return { ...n, position: n.position || { x: n.x || 0, y: n.y || 0 } };
    }

    const config = n.config || {};
    const label = n.label || nodeType.replace(/_/g, ' ');
    const position = n.position || { x: n.x || 0, y: n.y || 0 };
    let type: string;
    let data: any;

    if (nodeType === 'trigger_event') {
      type = 'trigger';
      data = { triggerType: 'event', label, eventName: config.eventName || '', filters: config.filters };
    } else if (nodeType === 'trigger_cron') {
      type = 'trigger';
      data = { triggerType: 'cron', label, cronExpression: config.cron || config.cronExpression || '', timezone: config.timezone || undefined };
    } else if (nodeType === 'trigger_webhook') {
      type = 'trigger';
      data = { triggerType: 'webhook', label, webhookPath: config.path || config.webhookPath || '', method: config.method || 'POST', secret: config.secret || undefined };
    } else if (nodeType === 'trigger_command') {
      type = 'trigger';
      const cmd = config.command || '';
      const prefix = cmd.startsWith('!') ? '!' : config.commandPrefix || '!';
      const name = cmd.startsWith('!') ? cmd.substring(1) : cmd;
      data = { triggerType: 'command', label, commandPrefix: prefix, commandName: name };
    } else if (nodeType === 'action_kick') {
      type = 'action';
      data = { actionType: 'kick', label, reasonId: parseInt(config.reasonid) || 5, reasonMsg: config.reason || '' };
    } else if (nodeType === 'action_ban') {
      type = 'action';
      data = { actionType: 'ban', label, duration: config.time || 0, reason: config.reason || '' };
    } else if (nodeType === 'action_move') {
      type = 'action';
      data = { actionType: 'move', label, channelId: config.channelId || config.cid || '' };
    } else if (nodeType === 'action_message') {
      type = 'action';
      data = { actionType: 'message', label, targetMode: targetModeMap[config.targetMode] || 1, message: config.message || '', target: config.target };
    } else if (nodeType === 'action_poke') {
      type = 'action';
      data = { actionType: 'poke', label, message: config.message || '' };
    } else if (nodeType === 'action_channelCreate') {
      type = 'action';
      const params: Record<string, string> = {};
      if (config.channel_name) params.channel_name = config.channel_name;
      if (config.cpid) params.cpid = config.cpid;
      if (config.channel_flag_temporary) params.channel_flag_temporary = config.channel_flag_temporary;
      if (config.channel_flag_semi_permanent) params.channel_flag_semi_permanent = config.channel_flag_semi_permanent;
      if (config.channel_topic) params.channel_topic = config.channel_topic;
      data = { actionType: 'channelCreate', label, params: { ...params, ...config.params } };
    } else if (nodeType === 'action_channelEdit') {
      type = 'action';
      const params: Record<string, string> = {};
      if (config.channel_name) params.channel_name = config.channel_name;
      if (config.channel_topic) params.channel_topic = config.channel_topic;
      if (config.channel_description) params.channel_description = config.channel_description;
      if (config.channel_maxclients) params.channel_maxclients = config.channel_maxclients;
      data = { actionType: 'channelEdit', label, channelId: config.channelId || config.cid || '', params: { ...params, ...config.params } };
    } else if (nodeType === 'action_channelDelete') {
      type = 'action';
      data = { actionType: 'channelDelete', label, channelId: config.channelId || config.cid || '', force: !!config.force };
    } else if (nodeType === 'action_groupAdd') {
      type = 'action';
      data = { actionType: 'groupAddClient', label, groupId: config.groupId || '' };
    } else if (nodeType === 'action_groupRemove') {
      type = 'action';
      data = { actionType: 'groupRemoveClient', label, groupId: config.groupId || '' };
    } else if (nodeType === 'action_webquery') {
      type = 'action';
      data = { actionType: 'webquery', label, command: config.command || '', params: config.params || {}, storeAs: config.storeAs || undefined };
    } else if (nodeType === 'action_webhook') {
      type = 'action';
      data = { actionType: 'webhook', label, url: config.url || '', method: config.method || 'POST', headers: config.headers, body: config.body, storeAs: config.storeAs || undefined };
    } else if (nodeType === 'action_httpRequest') {
      type = 'action';
      data = { actionType: 'httpRequest', label, url: config.url || '', method: config.method || 'GET', headers: config.headers, body: config.body, storeAs: config.storeAs || undefined };
    } else if (nodeType === 'action_afkMover') {
      type = 'action';
      data = { actionType: 'afkMover', label, afkChannelId: config.afkChannelId || '', idleThresholdSeconds: parseInt(config.idleThresholdSeconds) || 300, exemptGroupIds: config.exemptGroupIds || '' };
    } else if (nodeType === 'action_idleKicker') {
      type = 'action';
      data = { actionType: 'idleKicker', label, idleThresholdSeconds: parseInt(config.idleThresholdSeconds) || 1800, reason: config.reason || '', exemptGroupIds: config.exemptGroupIds || '' };
    } else if (nodeType === 'action_pokeGroup') {
      type = 'action';
      data = { actionType: 'pokeGroup', label, groupId: config.groupId || '', message: config.message || '' };
    } else if (nodeType === 'action_rankCheck') {
      type = 'action';
      data = { actionType: 'rankCheck', label, ranks: config.ranks || '[]' };
    } else if (nodeType === 'action_tempChannelCleanup') {
      type = 'action';
      data = { actionType: 'tempChannelCleanup', label, parentChannelId: config.parentChannelId || '', protectedChannelIds: config.protectedChannelIds || '' };
    } else if (nodeType === 'action_voicePlay') {
      type = 'action';
      data = { actionType: 'voicePlay', label, botId: config.botId || '', songId: config.songId || '', playlistId: config.playlistId || '' };
    } else if (nodeType === 'action_voiceStop') {
      type = 'action';
      data = { actionType: 'voiceStop', label, botId: config.botId || '' };
    } else if (nodeType === 'action_voiceJoinChannel') {
      type = 'action';
      data = { actionType: 'voiceJoinChannel', label, botId: config.botId || '', channelId: config.channelId || '', channelPassword: config.channelPassword || '' };
    } else if (nodeType === 'action_voiceLeaveChannel') {
      type = 'action';
      data = { actionType: 'voiceLeaveChannel', label, botId: config.botId || '' };
    } else if (nodeType === 'action_voiceVolume') {
      type = 'action';
      data = { actionType: 'voiceVolume', label, botId: config.botId || '', volume: config.volume || '50' };
    } else if (nodeType === 'action_voicePauseResume') {
      type = 'action';
      data = { actionType: 'voicePauseResume', label, botId: config.botId || '', action: config.action || 'toggle' };
    } else if (nodeType === 'action_voiceSkip') {
      type = 'action';
      data = { actionType: 'voiceSkip', label, botId: config.botId || '', direction: config.direction || 'next' };
    } else if (nodeType === 'action_voiceSeek') {
      type = 'action';
      data = { actionType: 'voiceSeek', label, botId: config.botId || '', position: config.position || '0' };
    } else if (nodeType === 'action_voiceTts') {
      type = 'action';
      data = { actionType: 'voiceTts', label, botId: config.botId || '', text: config.text || '', language: config.language || '' };
    } else if (nodeType === 'action_animatedChannel') {
      type = 'action';
      data = { actionType: 'animatedChannel', label, channelId: config.channelId || '', text: config.text || '', style: config.style || 'scroll', intervalSeconds: config.intervalSeconds || '3', prefix: config.prefix || '[cspacer]' };
    } else if (nodeType === 'condition') {
      type = 'condition';
      data = { nodeType: 'condition', label, expression: config.expression || '' };
    } else if (nodeType === 'delay') {
      type = 'delay';
      data = { nodeType: 'delay', label, delayMs: config.delay || config.delayMs || 1000 };
    } else if (nodeType === 'variable') {
      type = 'variable';
      data = { nodeType: 'variable', label, operation: config.operation || 'set', variableName: config.name || '', value: config.value || '' };
    } else if (nodeType === 'log') {
      type = 'log';
      data = { nodeType: 'log', label, level: config.level || 'info', message: config.message || '' };
    } else {
      // Pass through unknown types
      type = nodeType;
      data = { label, ...config };
    }

    return { id: n.id, type, position, data } as FlowNode;
  });

  const edges: FlowEdge[] = (raw.edges || []).map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || e.sourcePort || undefined,
    label: e.label || undefined,
  }));

  return { nodes, edges };
}

interface LoadedFlow {
  id: number;
  name: string;
  serverConfigId: number;
  virtualServerId: number;
  flowData: FlowDefinition;
  triggerNodes: FlowNode[];
}

interface CronEntry {
  flowId: number;
  nodeId: string;
  task: cron.ScheduledTask;
}

interface WebhookEntry {
  flowId: number;
  nodeId: string;
  path: string;
  method: string;
  secret?: string;
}

const MAX_CONCURRENT_PER_FLOW = 20;

export class BotEngine {
  private flows: Map<number, LoadedFlow> = new Map();
  private eventBridge: EventBridge;
  private flowRunner: FlowRunner;
  private animationManager: AnimationManager;
  private cronJobs: CronEntry[] = [];
  private webhookEntries: WebhookEntry[] = [];
  private executionCounts: Map<number, number> = new Map();
  private running: boolean = false;

  constructor(
    private prisma: PrismaClient,
    private connectionPool: ConnectionPool,
    private wss: WebSocketServer,
    private app: Express,
  ) {
    this.eventBridge = new EventBridge(prisma);
    this.flowRunner = new FlowRunner(prisma, connectionPool, wss);
    this.animationManager = new AnimationManager();
  }

  setVoiceBotManager(manager: any): void {
    this.flowRunner.setVoiceBotManager(manager);
  }

  getEventBridge(): EventBridge {
    return this.eventBridge;
  }

  async start(): Promise<void> {
    if (this.running) return;

    // Always register event listener (even if no flows yet — flows can be enabled later)
    this.eventBridge.on('tsEvent', this.onTsEvent.bind(this));

    await this.loadFlows();

    if (this.flows.size === 0) {
      console.log('[BotEngine] No enabled flows found, engine idle (will activate when flows are enabled)');
      this.running = true;
      return;
    }

    // Setup SSH connections for all unique server+vserver pairs (non-blocking)
    this.setupSshConnections();

    // Setup cron jobs
    this.setupCronJobs();

    // Build webhook registry
    this.buildWebhookRegistry();

    // Start animations for all loaded flows
    for (const flow of this.flows.values()) {
      this.startAnimationsForFlow(flow.id, flow.serverConfigId, flow.virtualServerId);
    }

    this.running = true;

    const sshCount = this.eventBridge.getConnectedKeys().length;
    console.log(`[BotEngine] Started with ${this.flows.size} flow(s), ${sshCount} SSH connection(s), ${this.cronJobs.length} cron job(s), ${this.webhookEntries.length} webhook(s)`);

    this.broadcast('bot:engine:started', { flowCount: this.flows.size });
  }

  async stop(): Promise<void> {
    this.running = false;
    this.animationManager.stopAll();
    this.teardownCronJobs();
    this.webhookEntries = [];
    this.eventBridge.removeAllListeners('tsEvent');
    this.flows.clear();
    this.executionCounts.clear();
  }

  async enableFlow(flowId: number): Promise<void> {
    console.log(`[BotEngine] Enabling flow ${flowId}...`);
    const dbFlow = await this.prisma.botFlow.findUnique({ where: { id: flowId } });
    if (!dbFlow || !dbFlow.enabled) {
      console.log(`[BotEngine] Flow ${flowId} not found or not enabled in DB`);
      return;
    }

    try {
      const raw = JSON.parse(dbFlow.flowData);
      const flowData = normalizeFlowData(raw);
      const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger');

      const hasAnimations = flowData.nodes.some(n => n.type === 'action' && (n.data as any).actionType === 'animatedChannel');
      console.log(`[BotEngine] Flow ${flowId} ('${dbFlow.name}'): ${triggerNodes.length} trigger(s), ${flowData.nodes.length} node(s), ${flowData.edges.length} edge(s)${hasAnimations ? ', has animations' : ''}`);

      if (triggerNodes.length === 0 && !hasAnimations) {
        console.warn(`[BotEngine] Flow ${flowId} has no trigger nodes and no animations — nothing to activate`);
      }

      for (const t of triggerNodes) {
        const td = t.data as any;
        console.log(`[BotEngine]   Trigger: type=${td.triggerType}, ${td.triggerType === 'event' ? `event=${td.eventName}` : td.triggerType === 'cron' ? `cron=${td.cronExpression}` : td.triggerType === 'command' ? `cmd=${td.commandPrefix}${td.commandName}` : `webhook=${td.webhookPath}`}`);
      }

      this.flows.set(flowId, {
        id: dbFlow.id,
        name: dbFlow.name,
        serverConfigId: dbFlow.serverConfigId,
        virtualServerId: dbFlow.virtualServerId,
        flowData,
        triggerNodes,
      });

      // Ensure SSH connection exists for event/command triggers
      const hasEventTrigger = triggerNodes.some(t => {
        const td = t.data as any;
        return td.triggerType === 'event' || td.triggerType === 'command';
      });

      if (hasEventTrigger) {
        console.log(`[BotEngine] Flow needs SSH — connecting to server ${dbFlow.serverConfigId}, sid=${dbFlow.virtualServerId}...`);
        if (!this.eventBridge.isConnected(dbFlow.serverConfigId, dbFlow.virtualServerId)) {
          // Non-blocking: SSH connects in background, events will flow once connected
          this.eventBridge.connectServer(dbFlow.serverConfigId, dbFlow.virtualServerId).catch(err => {
            console.error(`[BotEngine] SSH connection failed for ${dbFlow.serverConfigId}:${dbFlow.virtualServerId}: ${err.message}`);
          });
        } else {
          console.log(`[BotEngine] SSH already connected for ${dbFlow.serverConfigId}:${dbFlow.virtualServerId}`);
        }
      }

      // Setup cron jobs for this flow
      this.setupCronJobsForFlow(flowId);

      // Add webhook entries for this flow
      this.buildWebhookRegistryForFlow(flowId);

      // Start animations for any animatedChannel action nodes
      this.startAnimationsForFlow(flowId, dbFlow.serverConfigId, dbFlow.virtualServerId);

      console.log(`[BotEngine] Flow ${flowId} ('${dbFlow.name}') enabled successfully`);
    } catch (err: any) {
      console.error(`[BotEngine] Failed to enable flow ${flowId}: ${err.message}`);
    }
  }

  async disableFlow(flowId: number): Promise<void> {
    this.animationManager.stopAnimation(flowId);
    this.teardownCronJobs(flowId);
    this.webhookEntries = this.webhookEntries.filter(w => w.flowId !== flowId);
    this.flows.delete(flowId);
    this.executionCounts.delete(flowId);

    // Check if any remaining flows use the same SSH connections
    await this.cleanupUnusedSshConnections();

    console.log(`[BotEngine] Flow ${flowId} disabled`);
  }

  async reloadFlow(flowId: number): Promise<void> {
    const flow = this.flows.get(flowId);
    if (flow) {
      // Flow was active — disable then re-enable
      await this.disableFlow(flowId);
      const dbFlow = await this.prisma.botFlow.findUnique({ where: { id: flowId } });
      if (dbFlow?.enabled) {
        await this.enableFlow(flowId);
      }
    }
  }

  handleWebhookRequest(req: Request, res: Response): void {
    const webhookPath = String(req.params.path || req.params[0] || '');
    const method = req.method.toUpperCase();
    const providedSecret = String(req.headers['x-webhook-secret'] || req.query.secret || '');

    const matching = this.webhookEntries.filter(w =>
      w.path === webhookPath && (w.method === method || w.method === 'ANY')
    );

    if (matching.length === 0) {
      res.status(404).json({ error: 'No webhook handler found' });
      return;
    }

    let triggered = 0;
    let rejected = 0;
    for (const wh of matching) {
      if (wh.secret && wh.secret !== providedSecret) {
        rejected++;
        continue;
      }

      const flow = this.flows.get(wh.flowId);
      if (!flow) continue;

      const webhookData: Record<string, string> = {
        webhook_path: webhookPath,
        webhook_method: method,
        webhook_body: JSON.stringify(req.body || {}),
        webhook_query: JSON.stringify(req.query || {}),
      };

      this.executeFlow(flow, wh.nodeId, 'webhook', webhookData);
      triggered++;
    }

    if (triggered === 0 && rejected > 0) {
      res.status(403).json({ error: 'Invalid webhook secret' });
      return;
    }

    res.json({ triggered });
  }

  getFlow(flowId: number): LoadedFlow | undefined {
    return this.flows.get(flowId);
  }

  destroy(): void {
    this.stop();
    this.eventBridge.destroy();
    this.broadcast('bot:engine:stopped', {});
  }

  // --- Private Methods ---

  private async loadFlows(): Promise<void> {
    const dbFlows = await this.prisma.botFlow.findMany({ where: { enabled: true } });

    for (const dbFlow of dbFlows) {
      try {
        const raw = JSON.parse(dbFlow.flowData);
        const flowData = normalizeFlowData(raw);
        const triggerNodes = flowData.nodes.filter(n => n.type === 'trigger');
        const hasAnimations = flowData.nodes.some(n => n.type === 'action' && (n.data as any).actionType === 'animatedChannel');

        if (triggerNodes.length === 0 && !hasAnimations) {
          console.warn(`[BotEngine] Flow ${dbFlow.id} ('${dbFlow.name}') has no trigger nodes and no animations, skipping`);
          continue;
        }

        this.flows.set(dbFlow.id, {
          id: dbFlow.id,
          name: dbFlow.name,
          serverConfigId: dbFlow.serverConfigId,
          virtualServerId: dbFlow.virtualServerId,
          flowData,
          triggerNodes,
        });
      } catch (err: any) {
        console.error(`[BotEngine] Failed to parse flow ${dbFlow.id}: ${err.message}`);
      }
    }
  }

  private setupSshConnections(): void {
    const serverPairs = new Set<string>();
    for (const flow of this.flows.values()) {
      serverPairs.add(`${flow.serverConfigId}:${flow.virtualServerId}`);
    }

    for (const pair of serverPairs) {
      const [configId, sid] = pair.split(':').map(Number);
      // Non-blocking: don't await SSH connections during startup
      this.eventBridge.connectServer(configId, sid).catch(err => {
        console.error(`[BotEngine] SSH connection failed for ${pair}: ${err.message}`);
      });
    }
  }

  private async cleanupUnusedSshConnections(): Promise<void> {
    const neededKeys = new Set<string>();
    for (const flow of this.flows.values()) {
      neededKeys.add(`${flow.serverConfigId}:${flow.virtualServerId}`);
    }

    for (const key of this.eventBridge.getConnectedKeys()) {
      if (!neededKeys.has(key)) {
        const [configId, sid] = key.split(':').map(Number);
        await this.eventBridge.disconnectServer(configId, sid);
      }
    }
  }

  private onTsEvent(configId: number, sid: number, eventName: string, data: Record<string, string>): void {
    console.log(`[BotEngine] TS Event received: ${eventName} from ${configId}:${sid}`, JSON.stringify(data).substring(0, 200));
    for (const flow of this.flows.values()) {
      if (flow.serverConfigId !== configId || flow.virtualServerId !== sid) continue;

      for (const triggerNode of flow.triggerNodes) {
        const triggerData = triggerNode.data as any;

        // Event trigger
        if (triggerData.triggerType === 'event') {
          const eventTrigger = triggerData as EventTriggerData;
          if (eventTrigger.eventName !== eventName) {
            console.log(`[BotEngine]   Flow ${flow.id}: trigger wants '${eventTrigger.eventName}', got '${eventName}' — skip`);
            continue;
          }

          // Apply filters
          if (eventTrigger.filters) {
            let matches = true;
            for (const [key, value] of Object.entries(eventTrigger.filters)) {
              if (data[key] !== value) { matches = false; break; }
            }
            if (!matches) continue;
          }

          this.executeFlow(flow, triggerNode.id, 'event', data);
        }

        // Command trigger (special case of text message)
        if (triggerData.triggerType === 'command' && eventName === 'notifytextmessage') {
          const cmdTrigger = triggerData as CommandTriggerData;
          const msg = data.msg || '';
          const fullCommand = (cmdTrigger.commandPrefix || '!') + cmdTrigger.commandName;

          if (!msg.startsWith(fullCommand)) continue;

          // Check that the command is followed by a space or is the entire message
          const afterCmd = msg.substring(fullCommand.length);
          if (afterCmd.length > 0 && afterCmd[0] !== ' ') continue;

          const args = afterCmd.trim();
          const enrichedData = { ...data, command_args: args, command_name: cmdTrigger.commandName };
          this.executeFlow(flow, triggerNode.id, 'command', enrichedData);
        }
      }
    }
  }

  private executeFlow(flow: LoadedFlow, triggerNodeId: string, triggerType: string, eventData: Record<string, string>): void {
    console.log(`[BotEngine] Executing flow ${flow.id} ('${flow.name}') triggered by ${triggerType}`);

    // Rate limiting
    const current = this.executionCounts.get(flow.id) || 0;
    if (current >= MAX_CONCURRENT_PER_FLOW) {
      console.warn(`[BotEngine] Flow ${flow.id} rate limited (${current} concurrent executions)`);
      return;
    }
    this.executionCounts.set(flow.id, current + 1);

    // Extract timezone from the trigger node (if cron trigger has one)
    const triggerNode = flow.flowData.nodes.find(n => n.id === triggerNodeId);
    const triggerData = triggerNode?.data as any;
    const timezone = triggerData?.timezone as string | undefined;

    this.flowRunner.execute(flow, triggerNodeId, triggerType, eventData, timezone)
      .catch(err => {
        console.error(`[BotEngine] Flow ${flow.id} execution error: ${err.message}`);
      })
      .finally(() => {
        const count = this.executionCounts.get(flow.id) || 1;
        this.executionCounts.set(flow.id, count - 1);
      });
  }

  private setupCronJobs(): void {
    for (const flow of this.flows.values()) {
      this.setupCronJobsForFlow(flow.id);
    }
  }

  private setupCronJobsForFlow(flowId: number): void {
    const flow = this.flows.get(flowId);
    if (!flow) return;

    for (const triggerNode of flow.triggerNodes) {
      const triggerData = triggerNode.data as any;
      if (triggerData.triggerType !== 'cron') continue;

      const cronData = triggerData as CronTriggerData;
      if (!cron.validate(cronData.cronExpression)) {
        console.error(`[BotEngine] Invalid cron expression '${cronData.cronExpression}' in flow ${flowId}`);
        continue;
      }

      const task = cron.schedule(cronData.cronExpression, () => {
        this.executeFlow(flow, triggerNode.id, 'cron', {});
      }, {
        timezone: cronData.timezone || 'UTC',
      });

      this.cronJobs.push({ flowId, nodeId: triggerNode.id, task });
    }
  }

  private buildWebhookRegistry(): void {
    for (const flow of this.flows.values()) {
      this.buildWebhookRegistryForFlow(flow.id);
    }
  }

  private buildWebhookRegistryForFlow(flowId: number): void {
    const flow = this.flows.get(flowId);
    if (!flow) return;

    for (const triggerNode of flow.triggerNodes) {
      const triggerData = triggerNode.data as any;
      if (triggerData.triggerType !== 'webhook') continue;

      const whData = triggerData as WebhookTriggerData;
      this.webhookEntries.push({
        flowId,
        nodeId: triggerNode.id,
        path: whData.webhookPath,
        method: whData.method || 'POST',
        secret: whData.secret || undefined,
      });
    }
  }

  private teardownCronJobs(flowId?: number): void {
    const toRemove = flowId !== undefined
      ? this.cronJobs.filter(j => j.flowId === flowId)
      : this.cronJobs;

    for (const entry of toRemove) {
      entry.task.stop();
    }

    this.cronJobs = flowId !== undefined
      ? this.cronJobs.filter(j => j.flowId !== flowId)
      : [];
  }

  private startAnimationsForFlow(flowId: number, serverConfigId: number, virtualServerId: number): void {
    const flow = this.flows.get(flowId);
    if (!flow) return;

    const animNodes = flow.flowData.nodes.filter(
      n => n.type === 'action' && (n.data as any).actionType === 'animatedChannel'
    );

    if (animNodes.length === 0) return;

    try {
      const client = this.connectionPool.getClient(serverConfigId);

      for (const node of animNodes) {
        const d = node.data as AnimatedChannelActionData;
        const config: AnimationConfig = {
          channelId: d.channelId,
          text: d.text,
          style: d.style || 'scroll',
          intervalSeconds: parseInt(d.intervalSeconds) || 3,
          prefix: d.prefix || '[cspacer]',
        };

        this.animationManager.startAnimation(flowId, virtualServerId, config, client);
      }
    } catch (err: any) {
      console.error(`[BotEngine] Failed to start animations for flow ${flowId}: ${err.message}`);
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
