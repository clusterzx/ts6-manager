// Bot Flow Types

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // 'true' | 'false' for condition nodes
  label?: string;
}

export type NodeType = 'trigger' | 'action' | 'condition' | 'delay' | 'variable' | 'log';

export type NodeData = TriggerNodeData | ActionNodeData | ConditionNodeData | DelayNodeData | VariableNodeData | LogNodeData;

// --- Trigger Types ---
export type TriggerNodeData =
  | EventTriggerData
  | CronTriggerData
  | WebhookTriggerData
  | CommandTriggerData;

export interface EventTriggerData {
  triggerType: 'event';
  label: string;
  eventName: string;
  filters?: Record<string, string>;
}

export interface CronTriggerData {
  triggerType: 'cron';
  label: string;
  cronExpression: string;
  timezone?: string;
}

export interface WebhookTriggerData {
  triggerType: 'webhook';
  label: string;
  webhookPath: string;
  method: 'GET' | 'POST';
  secret?: string;
}

export interface CommandTriggerData {
  triggerType: 'command';
  label: string;
  commandPrefix: string;
  commandName: string;
  description?: string;
}

// --- Action Types ---
export type ActionNodeData =
  | KickActionData
  | BanActionData
  | MoveActionData
  | MessageActionData
  | PokeActionData
  | ChannelCreateActionData
  | ChannelEditActionData
  | ChannelDeleteActionData
  | GroupAddClientActionData
  | GroupRemoveClientActionData
  | WebQueryActionData
  | WebhookActionData
  | HttpRequestActionData
  | AfkMoverActionData
  | IdleKickerActionData
  | PokeGroupActionData
  | RankCheckActionData
  | TempChannelCleanupActionData
  | AnimatedChannelActionData;

export interface KickActionData {
  actionType: 'kick';
  label: string;
  reasonId: 4 | 5;
  reasonMsg: string;
}

export interface BanActionData {
  actionType: 'ban';
  label: string;
  duration?: number;
  reason?: string;
}

export interface MoveActionData {
  actionType: 'move';
  label: string;
  channelId: string;
}

export interface MessageActionData {
  actionType: 'message';
  label: string;
  targetMode: 1 | 2 | 3;
  target?: string;
  message: string;
}

export interface PokeActionData {
  actionType: 'poke';
  label: string;
  message: string;
}

export interface ChannelCreateActionData {
  actionType: 'channelCreate';
  label: string;
  params: Record<string, string>;
}

export interface GroupAddClientActionData {
  actionType: 'groupAddClient';
  label: string;
  groupId: string;
}

export interface GroupRemoveClientActionData {
  actionType: 'groupRemoveClient';
  label: string;
  groupId: string;
}

export interface WebQueryActionData {
  actionType: 'webquery';
  label: string;
  command: string;
  params: Record<string, string>;
  storeAs?: string;
}

export interface WebhookActionData {
  actionType: 'webhook';
  label: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  storeAs?: string;
}

export interface ChannelEditActionData {
  actionType: 'channelEdit';
  label: string;
  channelId: string;
  params: Record<string, string>;
}

export interface ChannelDeleteActionData {
  actionType: 'channelDelete';
  label: string;
  channelId: string;
  force?: boolean;
}

export interface HttpRequestActionData {
  actionType: 'httpRequest';
  label: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  storeAs?: string;
}

export interface AfkMoverActionData {
  actionType: 'afkMover';
  label: string;
  afkChannelId: string;
  idleThresholdSeconds: number;
  exemptGroupIds?: string;
}

export interface IdleKickerActionData {
  actionType: 'idleKicker';
  label: string;
  idleThresholdSeconds: number;
  reason?: string;
  exemptGroupIds?: string;
}

export interface PokeGroupActionData {
  actionType: 'pokeGroup';
  label: string;
  groupId: string;
  message: string;
}

export interface RankCheckActionData {
  actionType: 'rankCheck';
  label: string;
  ranks: string;
}

export interface TempChannelCleanupActionData {
  actionType: 'tempChannelCleanup';
  label: string;
  parentChannelId: string;
  protectedChannelIds?: string;
}

export interface AnimatedChannelActionData {
  actionType: 'animatedChannel';
  label: string;
  channelId: string;
  text: string;
  style: 'scroll' | 'typewriter' | 'bounce' | 'blink' | 'wave' | 'alternateCase';
  intervalSeconds: string;
  prefix: string;
}

// --- Condition ---
export interface ConditionNodeData {
  nodeType: 'condition';
  label: string;
  expression: string;
}

// --- Delay ---
export interface DelayNodeData {
  nodeType: 'delay';
  label: string;
  delayMs: number;
}

// --- Variable ---
export interface VariableNodeData {
  nodeType: 'variable';
  label: string;
  operation: 'set' | 'increment' | 'append';
  variableName: string;
  value: string;
}

// --- Log ---
export interface LogNodeData {
  nodeType: 'log';
  label: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

// Bot Flow (from API)
export interface BotFlowSummary {
  id: number;
  name: string;
  description: string | null;
  serverConfigId: number;
  virtualServerId: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
  lastExecution?: string;
}

export interface BotFlowDetail extends BotFlowSummary {
  flowData: FlowDefinition;
}

export interface BotExecutionSummary {
  id: number;
  flowId: number;
  triggeredBy: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  endedAt: string | null;
  error: string | null;
}

export interface BotLogEntry {
  id: number;
  executionId: number | null;
  nodeId: string | null;
  nodeName: string | null;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data: Record<string, any> | null;
  timestamp: string;
}
