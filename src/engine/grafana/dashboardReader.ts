import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';
import { DSQueryTarget } from './dsProxyQuery';

export interface DashboardPanelInfo {
  id: number;
  title: string;
  type: string;
  datasource?: {
    uid?: string;
    type?: string;
  };
  targets?: any[];
}

import { TemplateResolver } from './templateResolver';

export class DashboardReader {
  /**
   * Obtém a lista de dashboards disponíveis no catálogo do Grafana
   */
  public static async searchDashboards(query = ''): Promise<Array<{ uid: string; title: string; url: string }>> {
    try {
      const response$ = getBackendSrv().fetch<Array<{ uid: string; title: string; url: string }>>({
        url: `/api/search?query=${encodeURIComponent(query)}&type=dash-db&limit=5000`,
        method: 'GET',
      });
      const res = await lastValueFrom(response$);
      return res.data || [];
    } catch (e) {
      console.error('[AnalizAI] Erro ao pesquisar dashboards:', e);
      return [];
    }
  }

  /**
   * Carrega a definição completa de um dashboard pelo UID
   */
  public static async getDashboardByUid(uid: string): Promise<any> {
    try {
      const response$ = getBackendSrv().fetch<{ dashboard: any }>({
        url: `/api/dashboards/uid/${uid}`,
        method: 'GET',
      });
      const res = await lastValueFrom(response$);
      return res.data?.dashboard;
    } catch (e) {
      console.error(`[AnalizAI] Erro ao buscar dashboard ${uid}:`, e);
      return null;
    }
  }

  /**
   * Extrai e aplana todos os painéis do dashboard (incluindo painéis aninhados em linhas/rows)
   */
  private static flattenPanels(panels: any[]): any[] {
    const result: any[] = [];
    if (!Array.isArray(panels)) {
      return result;
    }

    for (const p of panels) {
      if (!p) {
        continue;
      }
      if (p.type === 'row') {
        if (Array.isArray(p.panels) && p.panels.length > 0) {
          result.push(...this.flattenPanels(p.panels));
        }
      } else {
        result.push(p);
      }
    }
    return result;
  }

  /**
   * Extrai alvos de consulta de todos os painéis de um dashboard para análise pelo Copiloto,
   * resolvendo automaticamente variáveis de template ($api, $host, $__range, etc.).
   */
  public static extractTargetsFromDashboard(
    dashboard: any,
    timeRange = { from: 'now-1h', to: 'now' }
  ): DSQueryTarget[] {
    const targets: DSQueryTarget[] = [];
    if (!dashboard || !dashboard.panels || !Array.isArray(dashboard.panels)) {
      return targets;
    }

    // Constrói mapa de variáveis a partir do templating do dashboard
    const variables = dashboard.templating?.list || [];
    const varMap = TemplateResolver.buildVariableMap(variables, timeRange);

    const allPanels = this.flattenPanels(dashboard.panels);
    let queryIndex = 0;

    for (const panel of allPanels) {
      if (!panel.targets || !Array.isArray(panel.targets)) {
        continue;
      }

      const defaultDs = panel.datasource;
      const panelTitle = panel.title || `Painel ${panel.id}`;

      for (const rawTarget of panel.targets) {
        // Ignora targets desabilitados
        if (rawTarget.hide) {
          continue;
        }

        // Se for query do Zabbix, aceita SOMENTE queryType 0 (métricas time-series)
        // Rejeita queryType 1 (services), 2 (problems), 5 (triggers) que geram HTTP 400
        if (rawTarget.queryType !== undefined && String(rawTarget.queryType) !== '0') {
          continue;
        }

        const rawDs = rawTarget.datasource || defaultDs;
        const panelUnit = panel.fieldConfig?.defaults?.unit;

        // Normaliza datasource (objeto { uid, type } ou string legada) e ignora datasources internos do Grafana
        const dsUidRaw = typeof rawDs === 'string' ? rawDs : rawDs?.uid;
        const dsTypeRaw = typeof rawDs === 'object' && rawDs?.type ? rawDs.type : 'unknown';

        if (dsUidRaw && dsUidRaw !== '-- Mixed --' && dsUidRaw !== '-- Grafana --') {
          // Resolve variáveis no payload da query ($__range, $api, $host, etc.)
          const resolvedPayload = TemplateResolver.resolveQueryPayload(rawTarget, varMap);
          const resolvedDsUid = TemplateResolver.resolveString(dsUidRaw, varMap);

          targets.push({
            datasourceUid: resolvedDsUid,
            datasourceType: dsTypeRaw,
            queryPayload: resolvedPayload,
            refId: `P${panel.id}_${String.fromCharCode(65 + (queryIndex % 26))}`,
            panelTitle,
            unit: panelUnit,
          });
          queryIndex++;
        }
      }
    }

    return targets;
  }
}
