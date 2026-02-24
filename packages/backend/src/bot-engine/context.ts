import { Parser } from 'expr-eval';
import type { PrismaClient } from '../../generated/prisma/index.js';

function resolveDotPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current instanceof Map ? current.get(part) : current[part];
  }
  return current;
}

function getTimeValues(timezone?: string): Record<string, string | number> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  if (timezone && timezone !== 'UTC') {
    try {
      const fmt = (opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en-US', { ...opts, timeZone: timezone }).format(now);
      const hours = Number(fmt({ hour: 'numeric', hour12: false }));
      const minutes = Number(fmt({ minute: 'numeric' }));
      const seconds = Number(fmt({ second: 'numeric' }));
      const day = Number(fmt({ day: 'numeric' }));
      const month = Number(fmt({ month: 'numeric' }));
      const year = Number(fmt({ year: 'numeric' }));
      const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getDay();

      return {
        hours: pad(hours),
        minutes: pad(minutes),
        seconds: pad(seconds),
        time: `${pad(hours)}:${pad(minutes)}`,
        date: `${pad(day)}.${pad(month)}.${year}`,
        timestamp: Math.floor(now.getTime() / 1000),
        day: pad(day),
        month: pad(month),
        year,
        dayOfWeek,
      };
    } catch {
      // Invalid timezone — fall through to default
    }
  }

  return {
    hours: pad(now.getHours()),
    minutes: pad(now.getMinutes()),
    seconds: pad(now.getSeconds()),
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    date: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
    timestamp: Math.floor(now.getTime() / 1000),
    day: pad(now.getDate()),
    month: pad(now.getMonth() + 1),
    year: now.getFullYear(),
    dayOfWeek: now.getDay(),
  };
}

export class ExecutionContext {
  private tempVars: Map<string, any> = new Map();
  private exprParser: Parser;

  constructor(
    private prisma: PrismaClient,
    public readonly flowId: number,
    public readonly executionId: number,
    public readonly configId: number,
    public readonly sid: number,
    public readonly triggerType: string,
    public readonly eventData: Record<string, string>,
    public readonly timezone?: string,
  ) {
    this.exprParser = new Parser();
    // Register custom functions for expression evaluation
    this.exprParser.functions.contains = (str: string, substr: string) => String(str).includes(String(substr)) ? 1 : 0;
    this.exprParser.functions.startsWith = (str: string, prefix: string) => String(str).startsWith(String(prefix)) ? 1 : 0;
    this.exprParser.functions.endsWith = (str: string, suffix: string) => String(str).endsWith(String(suffix)) ? 1 : 0;
    this.exprParser.functions.lower = (str: string) => String(str).toLowerCase();
    this.exprParser.functions.upper = (str: string) => String(str).toUpperCase();
    this.exprParser.functions.length = (str: string) => String(str).length;
    this.exprParser.functions.split = (str: string, sep: string, index: number) => {
      const parts = String(str).split(String(sep));
      return parts[index] ?? '';
    };
  }

  private applyFilter(value: string, filter: string): string {
    switch (filter) {
      case 'uptime': {
        const totalSec = parseInt(value, 10) || 0;
        const d = Math.floor(totalSec / 86400);
        const h = Math.floor((totalSec % 86400) / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const parts: string[] = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0 || d > 0) parts.push(`${h}h`);
        parts.push(`${m}m`);
        return parts.join(' ');
      }
      case 'round': return String(Math.round(parseFloat(value) || 0));
      case 'floor': return String(Math.floor(parseFloat(value) || 0));
      default: return value;
    }
  }

  async resolveTemplate(template: string): Promise<string> {
    if (!template || !template.includes('{{')) return template;

    const matches = template.matchAll(/\{\{(.+?)\}\}/g);
    let result = template;

    for (const match of matches) {
      const fullMatch = match[0];
      const raw = match[1].trim();
      // Support pipe filters: {{path|filter}}
      const pipeIdx = raw.indexOf('|');
      const path = pipeIdx >= 0 ? raw.substring(0, pipeIdx).trim() : raw;
      const filter = pipeIdx >= 0 ? raw.substring(pipeIdx + 1).trim() : null;
      let value = '';

      if (path.startsWith('event.')) {
        const key = path.substring(6);
        // Support nested access: event.webhook_body.test → parse webhook_body as JSON, access .test
        if (this.eventData[key] !== undefined) {
          value = this.eventData[key];
        } else {
          const firstDot = key.indexOf('.');
          if (firstDot > 0) {
            const topKey = key.substring(0, firstDot);
            const rest = key.substring(firstDot + 1);
            const topVal = this.eventData[topKey];
            if (topVal) {
              try {
                const parsed = JSON.parse(topVal);
                const resolved = resolveDotPath(parsed, rest);
                value = resolved != null ? String(resolved) : '';
              } catch {
                value = '';
              }
            }
          }
        }
      } else if (path.startsWith('var.')) {
        const name = path.substring(4);
        value = await this.getVariable(name);
      } else if (path.startsWith('temp.')) {
        const dotPath = path.substring(5);
        // Support nested access: temp.server.virtualserver_clientsonline
        const firstDot = dotPath.indexOf('.');
        if (firstDot === -1) {
          value = String(this.tempVars.get(dotPath) ?? '');
        } else {
          const topKey = dotPath.substring(0, firstDot);
          const rest = dotPath.substring(firstDot + 1);
          const topVal = this.tempVars.get(topKey);
          const resolved = resolveDotPath(topVal, rest);
          value = resolved != null ? String(resolved) : '';
        }
      } else if (path.startsWith('time.')) {
        const key = path.substring(5);
        const tv = getTimeValues(this.timezone);
        value = tv[key] != null ? String(tv[key]) : '';
      } else if (path.startsWith('exec.')) {
        const key = path.substring(5);
        switch (key) {
          case 'flowId': value = String(this.flowId); break;
          case 'executionId': value = String(this.executionId); break;
          case 'configId': value = String(this.configId); break;
          case 'sid': value = String(this.sid); break;
          case 'triggerType': value = this.triggerType; break;
          default: value = '';
        }
      }

      if (filter) value = this.applyFilter(value, filter);
      result = result.replace(fullMatch, value);
    }

    return result;
  }

  async evaluateCondition(expression: string): Promise<boolean> {
    try {
      const scope = await this.buildExpressionScope();
      const result = this.exprParser.evaluate(expression, scope);
      return !!result;
    } catch (err: any) {
      console.warn(`[ExecutionContext] Expression evaluation failed: "${expression}" — ${err.message}`);
      return false;
    }
  }

  async getVariable(name: string): Promise<string> {
    const record = await this.prisma.botVariable.findFirst({
      where: { flowId: this.flowId, name, scope: 'flow' },
    });
    return record?.value ?? '';
  }

  async setVariable(name: string, value: string): Promise<void> {
    const existing = await this.prisma.botVariable.findFirst({
      where: { flowId: this.flowId, name, scope: 'flow' },
    });

    if (existing) {
      await this.prisma.botVariable.update({
        where: { id: existing.id },
        data: { value },
      });
    } else {
      await this.prisma.botVariable.create({
        data: { flowId: this.flowId, name, value, scope: 'flow' },
      });
    }
  }

  async incrementVariable(name: string, amount: string): Promise<void> {
    const current = await this.getVariable(name);
    const currentNum = parseFloat(current) || 0;
    const increment = parseFloat(amount) || 0;
    await this.setVariable(name, String(currentNum + increment));
  }

  async appendVariable(name: string, value: string): Promise<void> {
    const current = await this.getVariable(name);
    await this.setVariable(name, current + value);
  }

  setTemp(name: string, value: any): void {
    this.tempVars.set(name, value);
  }

  getTemp(name: string): any {
    return this.tempVars.get(name);
  }

  private async buildExpressionScope(): Promise<Record<string, any>> {
    // Build event namespace
    const event: Record<string, any> = {};
    for (const [key, val] of Object.entries(this.eventData)) {
      // Try to convert numeric strings to numbers for expression evaluation
      const num = Number(val);
      event[key] = isNaN(num) ? val : num;
    }

    // Build var namespace from DB
    const varRecords = await this.prisma.botVariable.findMany({
      where: { flowId: this.flowId, scope: 'flow' },
    });
    const vars: Record<string, any> = {};
    for (const v of varRecords) {
      const num = Number(v.value);
      vars[v.name] = isNaN(num) ? v.value : num;
    }

    // Build temp namespace
    const temp: Record<string, any> = {};
    for (const [key, val] of this.tempVars.entries()) {
      temp[key] = val;
    }

    // Build time namespace
    const tv = getTimeValues(this.timezone);
    const time: Record<string, any> = {};
    for (const [k, v] of Object.entries(tv)) {
      const num = Number(v);
      time[k] = isNaN(num) ? v : num;
    }

    return { event, var: vars, temp, time };
  }
}
