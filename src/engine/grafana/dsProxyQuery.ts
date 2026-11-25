import { DataFrame, toDataFrame } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';

export interface DSQueryTarget {
  datasourceUid: string;
  datasourceType: string;
  queryPayload: Record<string, any>;
  refId?: string;
  panelTitle?: string;
  unit?: string;
}

export class DSProxyQueryEngine {
  /**
   * Executa uma consulta universal em qualquer datasource através do proxy interno do Grafana (/api/ds/query).
   * Divide em lotes para evitar que uma query inválida derrube todo o conjunto de métricas.
   */
  public static async query(
    targets: DSQueryTarget[],
    timeRange = { from: 'now-1h', to: 'now' }
  ): Promise<DataFrame[]> {
    if (targets.length === 0) {
      return [];
    }

    const targetMap = new Map<string, DSQueryTarget>();
    const allFrames: DataFrame[] = [];

    // Agrupa em lotes de até 8 queries
    const chunkSize = 8;
    for (let i = 0; i < targets.length; i += chunkSize) {
      const chunk = targets.slice(i, i + chunkSize);
      const queries = chunk.map((t, idx) => {
        const refId = t.refId || `Q${i + idx}`;
        targetMap.set(refId, t);
        return {
          maxDataPoints: 200,
          intervalMs: 30000,
          ...t.queryPayload,
          datasource: {
            uid: t.datasourceUid,
            type: t.datasourceType,
          },
          refId,
        };
      });

      try {
        const response$ = getBackendSrv().fetch<{
          results: Record<string, { frames?: any[]; error?: string }>;
        }>({
          url: '/api/ds/query',
          method: 'POST',
          data: {
            queries,
            from: timeRange.from,
            to: timeRange.to,
          },
        });

        const response = await lastValueFrom(response$);
        const results = response.data?.results || {};

        for (const refId of Object.keys(results)) {
          const res = results[refId];
          const target = targetMap.get(refId);

          if (res.error) {
            console.warn(`[AnalizAI] Aviso na query ${refId} (${target?.panelTitle}):`, res.error);
            continue;
          }

          if (res.frames && Array.isArray(res.frames)) {
            for (const rawFrame of res.frames) {
              try {
                const frame = toDataFrame(rawFrame);
                // Vincula o título do painel e o legendFormat ao nome do DataFrame
                if (target?.panelTitle) {
                  let frameTitle = target.panelTitle;
                  const legend = target.queryPayload?.legendFormat;
                  if (legend && typeof legend === 'string' && !legend.includes('{{')) {
                    frameTitle = `${frameTitle} [${legend.trim()}]`;
                  }
                  frame.name = frameTitle;
                }
                if (target?.unit) {
                  for (const f of frame.fields) {
                    if (!f.config) {
                      f.config = {};
                    }
                    if (!f.config.unit) {
                      f.config.unit = target.unit;
                    }
                  }
                }
                allFrames.push(frame);
              } catch (e) {
                console.error('[AnalizAI] Erro ao converter frame bruto:', e);
              }
            }
          }
        }
      } catch (chunkErr) {
        console.warn(`[AnalizAI] Falha no lote de queries [${i}..${i + chunkSize}]:`, chunkErr);
      }
    }

    return allFrames;
  }
}
