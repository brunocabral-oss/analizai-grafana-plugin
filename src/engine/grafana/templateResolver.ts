import { getTemplateSrv } from '@grafana/runtime';

export interface DashboardVariable {
  name: string;
  type?: string;
  allValue?: string | null;
  includeAll?: boolean;
  multi?: boolean;
  current?: {
    text?: string | string[];
    value?: string | string[];
  };
  options?: Array<{ text: string; value: string }>;
}

export class TemplateResolver {
  /**
   * Converte o intervalo de tempo em uma duração compatível com Prometheus/Grafana (ex: '1h', '6h', '15m')
   */
  public static calculateRangeDuration(from = 'now-1h', to = 'now'): string {
    const fromStr = String(from).trim().toLowerCase();
    const toStr = String(to).trim().toLowerCase();

    // Padrão comum 'now-X' até 'now'
    const nowMinusMatch = fromStr.match(/^now-(\d+)([smhdwMy])$/);
    if (nowMinusMatch && toStr === 'now') {
      const amount = nowMinusMatch[1];
      const unit = nowMinusMatch[2];
      return `${amount}${unit}`;
    }

    // Se ambos forem números (timestamps em ms)
    const numFrom = Number(from);
    const numTo = Number(to);
    if (!isNaN(numFrom) && !isNaN(numTo) && numTo > numFrom) {
      const diffMs = numTo - numFrom;
      const diffMinutes = Math.round(diffMs / 60000);
      if (diffMinutes >= 1440) {
        return `${Math.round(diffMinutes / 1440)}d`;
      }
      if (diffMinutes >= 60) {
        return `${Math.round(diffMinutes / 60)}h`;
      }
      return `${Math.max(1, diffMinutes)}m`;
    }

    // Fallback seguro
    return '1h';
  }

  /**
   * Constrói o mapa de variáveis disponíveis no dashboard com seus valores padrão/expandidos
   */
  public static buildVariableMap(
    variables: DashboardVariable[] = [],
    timeRange = { from: 'now-1h', to: 'now' }
  ): Map<string, string> {
    const varMap = new Map<string, string>();

    // 1. Variáveis globais do Grafana
    const rangeDuration = this.calculateRangeDuration(timeRange.from, timeRange.to);
    varMap.set('__range', rangeDuration);
    varMap.set('__rate_interval', '1m');
    varMap.set('__interval', '15s');
    varMap.set('__interval_ms', '15000');
    varMap.set('__from', String(timeRange.from));
    varMap.set('__to', String(timeRange.to));

    // 2. Variáveis de template do dashboard
    for (const v of variables) {
      if (!v || !v.name) {
        continue;
      }

      let resolvedValue = '.*';

      const currentVal = v.current?.value;
      if (currentVal !== undefined && currentVal !== null) {
        if (currentVal === '$__all' || (Array.isArray(currentVal) && currentVal.includes('$__all'))) {
          resolvedValue = v.allValue && v.allValue.trim().length > 0 ? v.allValue : '.*';
        } else if (Array.isArray(currentVal)) {
          resolvedValue = currentVal.filter((c) => c !== '$__all').join('|') || '.*';
        } else if (typeof currentVal === 'string' && currentVal.length > 0) {
          resolvedValue = currentVal;
        }
      } else if (v.allValue && v.allValue.trim().length > 0) {
        resolvedValue = v.allValue;
      } else if (v.options && v.options.length > 0) {
        const first = v.options[0].value;
        resolvedValue = first === '$__all' ? (v.allValue || '.*') : first;
      }

      varMap.set(v.name, resolvedValue);
    }

    return varMap;
  }

  /**
   * Substitui variáveis de template e globais em uma string
   */
  public static resolveString(
    input: string,
    varMap: Map<string, string>
  ): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    let result = input;

    // Tenta primeiro via getTemplateSrv() do Grafana para máxima fidelidade caso o runtime tenha contexto
    try {
      const templateSrv = getTemplateSrv();
      if (templateSrv && typeof templateSrv.replace === 'function') {
        const scoped: Record<string, { value: string }> = {};
        for (const [key, val] of varMap.entries()) {
          scoped[key] = { value: val };
        }
        result = templateSrv.replace(result, scoped);
      }
    } catch (e) {
      // Ignora e faz fallback no regex manual
    }

    // Fallback / reforço: substitui explicitamente qualquer ocorrência residual de variáveis
    for (const [name, val] of varMap.entries()) {
      // Padrões suportados: $var, ${var}, ${var:regex}, ${var:pipe}, ${var:csv}
      const regexPatterns = [
        new RegExp(`\\$\\{${name}(?::[a-zA-Z0-9_-]+)?\\}`, 'g'),
        new RegExp(`\\$${name}\\b`, 'g'),
      ];

      for (const rx of regexPatterns) {
        if (rx.test(result)) {
          result = result.replace(rx, val);
        }
      }
    }

    return result;
  }

  /**
   * Clona profundamente um payload de consulta e resolve todas as variáveis de template
   */
  public static resolveQueryPayload<T = any>(
    payload: T,
    varMap: Map<string, string>
  ): T {
    if (payload === null || payload === undefined) {
      return payload;
    }

    if (typeof payload === 'string') {
      return this.resolveString(payload, varMap) as unknown as T;
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.resolveQueryPayload(item, varMap)) as unknown as T;
    }

    if (typeof payload === 'object') {
      const copy: Record<string, any> = {};
      for (const key of Object.keys(payload as Record<string, any>)) {
        copy[key] = this.resolveQueryPayload((payload as Record<string, any>)[key], varMap);
      }
      return copy as T;
    }

    return payload;
  }
}
