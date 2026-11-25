import React, { useState, useRef, useEffect, useCallback } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Icon, Spinner, Combobox, ComboboxOption, useStyles2 } from '@grafana/ui';
import { CopilotMessage, VOCPilotConfig } from '../../engine/types';
import { DataFrameCompactor } from '../../engine/dataframe/compactor';
import { PromptTemplates } from '../../engine/prompts/templates';
import { LLMClientFactory } from '../../llm/clientFactory';
import { DashboardReader } from '../../engine/grafana/dashboardReader';
import { DSProxyQueryEngine } from '../../engine/grafana/dsProxyQuery';

interface CopilotChatProps {
  config?: VOCPilotConfig;
  dashboardUid?: string;
  dataFrames?: any[]; // Se injetado por um painel ou contexto de dashboard
  onClose?: () => void; // Opcional se renderizado dentro de um Drawer
  hideSelector?: boolean; // Se verdadeiro, oculta o seletor (útil para painéis fixos de dashboard)
}

const WELCOME_MESSAGE: CopilotMessage = {
  id: 'welcome',
  role: 'assistant',
  timestamp: Date.now(),
  content:
    '👋 **AnalizAI** ativo. Análise de indicadores, validação técnica de projetos (**Go/No-Go baseado em dados**) e observabilidade SRE. Selecione um dashboard para iniciar a avaliação.',
};

export const CopilotChat: React.FC<CopilotChatProps> = ({ config, dashboardUid, dataFrames, onClose, hideSelector = false }) => {
  const styles = useStyles2(getStyles);

  const activeConfig: VOCPilotConfig = config || {
    provider: 'openai',
    endpointUrl: '/api/plugin-proxy/analizai-app/llm/v1',
    modelName: 'DeepSeek-V4.1-Flash',
    temperature: 0.2,
    maxTokens: 450,
  };

  const defaultApiKey = '';
  // UID do dashboard ativo selecionado
  const [activeUid, setActiveUid] = useState<string>(() => {
    if (dashboardUid) {
      return dashboardUid;
    }
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryDash = urlParams.get('dashboard');
      if (queryDash) {
        return queryDash;
      }
      const match = window.location.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (e) {
      // noop
    }
    return localStorage.getItem('analizai_selected_dashboard_uid') || localStorage.getItem('nocpilot_selected_dashboard_uid') || 'opf3-lab-api';
  });

  const [dashboardsList, setDashboardsList] = useState<Array<ComboboxOption<string>>>([]);
  const [isRefreshingDashboards, setIsRefreshingDashboards] = useState(false);

  // Sincroniza se dashboardUid vier via prop (ex: do painel no dashboard)
  useEffect(() => {
    if (dashboardUid && dashboardUid !== activeUid) {
      setActiveUid(dashboardUid);
    }
  }, [dashboardUid, activeUid]);

  // Função central de sincronização de dashboards (Auto-Discovery)
  const refreshDashboards = useCallback(async (manual = false) => {
    try {
      if (manual) {
        setIsRefreshingDashboards(true);
      }
      const list = await DashboardReader.searchDashboards('');
      const opts: Array<ComboboxOption<string>> = list.map((d) => ({ label: d.title || d.uid || '', value: d.uid || '' }));
      setDashboardsList((prev) => {
        const prevKey = prev.map((p) => p.value).join(',');
        const newKey = opts.map((o) => o.value).join(',');
        if (prevKey !== newKey) {
          return opts;
        }
        return prev;
      });

      if (!activeUid && opts.length > 0) {
        const chosen = opts[0]?.value;
        if (chosen) {
          setActiveUid(chosen);
          localStorage.setItem('analizai_selected_dashboard_uid', chosen);
        }
      }
    } catch (e) {
      console.warn('[AnalizAI] Erro ao sincronizar dashboards:', e);
    } finally {
      if (manual) {
        setTimeout(() => setIsRefreshingDashboards(false), 600);
      }
    }
  }, [activeUid]);

  // Auto-Discovery contínuo: carrega no início, a cada 30 segundos e ao refocar a aba
  useEffect(() => {
    refreshDashboards();

    const interval = setInterval(() => {
      refreshDashboards();
    }, 30000);

    const onFocus = () => {
      refreshDashboards();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshDashboards]);

  const storageKey = `analizai_chat_history_${activeUid || 'general'}`;
  const legacyStorageKey = `nocpilot_chat_history_${activeUid || 'general'}`;

  const loadSavedMessages = useCallback((): CopilotMessage[] => {
    try {
      const saved = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Sempre sincroniza a saudação inicial vigente (evita manter texto legado de versões anteriores)
          return parsed.map((m: CopilotMessage) => (m.id === 'welcome' ? { ...WELCOME_MESSAGE, timestamp: m.timestamp } : m));
        }
      }
    } catch (e) {
      console.warn('[AnalizAI] Erro ao carregar histórico local:', e);
    }
    return [WELCOME_MESSAGE];
  }, [storageKey, legacyStorageKey]);

  // Carrega histórico do localStorage se disponível (com suporte a fallback legado)
  const [messages, setMessages] = useState<CopilotMessage[]>(() => loadSavedMessages());

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [telemetryStatus, setTelemetryStatus] = useState<string>('Carregando telemetria...');
  const [activeDashboardTitle, setActiveDashboardTitle] = useState<string>('');
  const [cachedTelemetry, setCachedTelemetry] = useState<any>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Recarrega o histórico sempre que o activeUid alternar
  useEffect(() => {
    setMessages(loadSavedMessages());
  }, [loadSavedMessages]);

  // Salva no localStorage quando o histórico de mensagens for atualizado
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e) {
        console.warn('[AnalizAI] Erro ao persistir mensagens:', e);
      }
    }
  }, [messages, storageKey]);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  /**
   * Coleta e compacta telemetria do dashboard ativo
   */
  const loadTelemetry = useCallback(async (uid?: string, frames?: any[]) => {
    const targetUid = uid || activeUid;
    try {
      setTelemetryStatus('⏳ Coletando telemetria...');
      let rawFrames = frames || dataFrames || [];

      let currentTitle = activeDashboardTitle;
      let dashTimeRange = { from: 'now-1h', to: 'now' };
      if (rawFrames.length === 0 && targetUid) {
        const dash = await DashboardReader.getDashboardByUid(targetUid);
        if (dash) {
          currentTitle = dash.title || targetUid;
          setActiveDashboardTitle(currentTitle);
          dashTimeRange = {
            from: dash.time?.from || 'now-1h',
            to: dash.time?.to || 'now',
          };
          const targets = DashboardReader.extractTargetsFromDashboard(dash, dashTimeRange);
          if (targets.length > 0) {
            rawFrames = await DSProxyQueryEngine.query(targets, dashTimeRange);
          }
        }
      }

      if (rawFrames.length === 0) {
        setTelemetryStatus('⚠️ Nenhum dado ativo no momento');
        setCachedTelemetry(null);
        return null;
      }

      const compacted = DataFrameCompactor.compact(rawFrames, dashTimeRange);
      if (currentTitle) {
        compacted.dashboardTitle = currentTitle;
      }
      setCachedTelemetry(compacted);
      setTelemetryStatus(
        `🟢 ${compacted.metrics.length} métricas e ${compacted.logs.length} streams compactados`
      );
      return compacted;
    } catch (e) {
      console.error('[AnalizAI] Erro ao coletar telemetria:', e);
      setTelemetryStatus('⚠️ Erro ao consultar telemetria');
      return null;
    }
  }, [dataFrames, activeUid, activeDashboardTitle]);

  // Pré-carrega a telemetria sempre que o dashboard selecionado mudar
  useEffect(() => {
    setCachedTelemetry(null);
    if (activeUid || (dataFrames && dataFrames.length > 0)) {
      loadTelemetry(activeUid, dataFrames);
    }
  }, [activeUid, dataFrames, loadTelemetry]);

  const gatherTelemetry = async () => {
    if (cachedTelemetry) {
      return cachedTelemetry;
    }
    return await loadTelemetry(activeUid, dataFrames);
  };

  // Limpa o histórico da sessão atual
  const handleClearHistory = () => {
    localStorage.removeItem(storageKey);
    setMessages([
      {
        ...WELCOME_MESSAGE,
        timestamp: Date.now(),
      },
    ]);
  };

  // Copia o último diagnóstico para a área de transferência
  const handleCopyLastDiagnosis = () => {
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant' && m.id !== 'welcome');
    const textToCopy = lastAssistantMsg
      ? lastAssistantMsg.content
      : messages.map((m) => `[${m.role.toUpperCase()}] ${m.content}`).join('\n\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyFeedback('Copiado!');
      setTimeout(() => setCopyFeedback(null), 2500);
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) {
      return;
    }

    const userMessage: CopilotMessage = {
      id: String(Date.now()),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // 1. Extração e compactação de telemetria
      const telemetry = await gatherTelemetry();

      // 2. Montagem do prompt com guardrails
      let systemPrompt = PromptTemplates.getSystemPrompt();
      if (telemetry) {
        systemPrompt += '\n\n' + PromptTemplates.formatTelemetryForPrompt(telemetry);
      }

      // 3. Inicialização da resposta da IA
      const assistantMessageId = 'resp_' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          telemetryContext: telemetry || undefined,
        },
      ]);

      // 4. Conexão com o provedor e streaming com Janela Deslizante (otimização de tokens)
      const recentHistory = messages
        .filter((m) => m.id !== 'welcome' && !m.id.startsWith('err_') && m.content.trim().length > 0)
        .slice(-4);
      const chatContext = [...recentHistory, userMessage];

      const provider = LLMClientFactory.getProvider(activeConfig);
      await provider.streamChat(
        chatContext,
        systemPrompt,
        activeConfig,
        defaultApiKey,
        {
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
          },
          onUsage: (usage) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, tokenUsage: usage }
                  : msg
              )
            );
          },
        }
      );
    } catch (err: any) {
      console.error('[AnalizAI] Erro durante inferência:', err);
      setMessages((prev) => [
        // Remove bolha vazia caso o erro tenha ocorrido antes do primeiro chunk
        ...prev.filter((m) => !(m.id.startsWith('resp_') && m.content.trim() === '')),
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `❌ **Falha de Conexão com a IA:** ${err.message || 'Erro desconhecido'}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Renderiza blocos de texto e comandos de terminal CLI formatados
   */
  const renderMessageContent = (content: string) => {
    if (!content.includes('```')) {
      return <pre className={styles.preContent}>{content || (isLoading ? 'Pensando...' : '')}</pre>;
    }

    const parts = content.split(/(```[\s\S]*?```)/g);
    return (
      <div className={styles.formattedContainer}>
        {parts.map((part, idx) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const lines = part.slice(3, -3).trim().split('\n');
            const lang = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
            const code = lang ? lines.slice(1).join('\n') : lines.join('\n');

            return (
              <div key={idx} className={styles.cliCard}>
                <div className={styles.cliCardHeader}>
                  <span className={styles.cliCardLang}>⚡ {lang.toUpperCase() || 'CLI COMMAND'}</span>
                  <button
                    className={styles.copyBtn}
                    onClick={() => navigator.clipboard.writeText(code)}
                    title="Copiar comando para o terminal"
                  >
                    <Icon name="copy" size="sm" /> Copiar
                  </button>
                </div>
                <pre className={styles.cliCode}>{code}</pre>
              </div>
            );
          }
          return (
            <pre key={idx} className={styles.preContent}>
              {part}
            </pre>
          );
        })}
      </div>
    );
  };

  const getTokenInfo = (msg: CopilotMessage) => {
    if (msg.role !== 'assistant' || msg.id === 'welcome') {
      return null;
    }
    if (msg.tokenUsage && msg.tokenUsage.totalTokens > 0) {
      return msg.tokenUsage;
    }
    // Fallback retroativo para mensagens históricas pré-existentes
    if (msg.content && msg.content.length > 25) {
      const estOut = Math.max(1, Math.round(msg.content.length / 4));
      const estIn = 420;
      return {
        promptTokens: estIn,
        completionTokens: estOut,
        totalTokens: estIn + estOut,
      };
    }
    return null;
  };

  return (
    <div className={styles.container}>
      {/* Header do Copiloto */}
      <div className={styles.header}>
        {/* Lado Esquerdo: Identidade do Copiloto */}
        <div className={styles.headerLeft}>
          <img
            src="/public/plugins/analizai-app/img/logo-analizai.svg?v=2.1.4"
            alt="AnalizAI"
            width={22}
            height={22}
            style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
          />
          <span>AnalizAI</span>
          <span className={styles.modelTag}>{activeConfig.modelName}</span>
        </div>

        {/* Centro: Seletor Centralizado e Único de Dashboard */}
        {!hideSelector && (
          <div className={styles.headerCenter}>
            <span className={styles.dashSelectorLabel}>📊 Dashboard Ativo:</span>
            <Combobox
              width={34}
              options={dashboardsList}
              value={activeUid}
              onChange={(opt) => {
                const newUid = String(opt?.value || '');
                setActiveUid(newUid);
                localStorage.setItem('analizai_selected_dashboard_uid', newUid);
              }}
              placeholder="Selecione o Dashboard para Análise..."
            />
            <button
              className={styles.headerIconBtn}
              onClick={() => refreshDashboards(true)}
              title="Detectar novos dashboards criados no Grafana (Auto-Discovery)"
            >
              <Icon name="sync" className={isRefreshingDashboards ? styles.spinningIcon : undefined} size="sm" />
              <span>{isRefreshingDashboards ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </div>
        )}

        {/* Lado Direito: Telemetria e Ações Rápidas */}
        <div className={styles.headerRight}>
          <div className={styles.telemetryTag}>{telemetryStatus}</div>
          
          <button
            className={styles.headerIconBtn}
            onClick={handleCopyLastDiagnosis}
            title="Copiar diagnóstico para o clipboard / passagem de plantão"
          >
            <Icon name="copy" size="sm" />
            <span>{copyFeedback || 'Copiar'}</span>
          </button>

          <button
            className={styles.headerIconBtn}
            onClick={handleClearHistory}
            title="Limpar histórico desta sessão"
          >
            <Icon name="trash-alt" size="sm" />
            <span>Limpar</span>
          </button>

          {onClose && (
            <button className={styles.headerIconBtn} onClick={onClose} title="Fechar Drawer">
              <Icon name="times" size="sm" />
            </button>
          )}
        </div>
      </div>

      {/* Ações Rápidas de Governança de Projeto & SRE */}
      <div className={styles.quickActions}>
        <button
          className={styles.actionBtn}
          onClick={() => handleSendMessage('Analise os indicadores deste dashboard e emita um parecer técnico estruturado (Go / No-Go) fundamentado nos dados reais para apoiar a decisão de aprovação pelo time de projeto.')}
          disabled={isLoading}
        >
          🎯 Parecer Go / No-Go
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => handleSendMessage('Faça um resumo executivo dos principais KPIs, taxas de sucesso, estabilidade e capacidade deste dashboard com foco em impacto de negócio.')}
          disabled={isLoading}
        >
          📊 Resumo de Indicadores
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => handleSendMessage('Quais os principais gargalos, picos fora do padrão e erros (4xx/5xx) neste dashboard? Apresente o ranking e o impacto na aprovação ou operação.')}
          disabled={isLoading}
        >
          🚀 Erros & Gargalos
        </button>
        <button
          className={styles.actionBtn}
          onClick={() => handleSendMessage('Execute um Diagnóstico Técnico (RCA) correlacionando as anomalias de métricas com os logs de erro e forneça comandos CLI de mitigação.')}
          disabled={isLoading}
        >
          🔍 Diagnóstico Técnico (RCA)
        </button>
      </div>

      {/* Lista de Mensagens */}
      <div className={styles.messageList}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}
          >
            <div className={styles.messageHeader}>
              <span className={styles.senderName}>
                {msg.role === 'user' ? '👤 Operador' : '🤖 AnalizAI'}
              </span>
              <span className={styles.messageTime}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className={styles.messageContent}>
              {renderMessageContent(msg.content)}
            </div>
            {(() => {
              const tokenInfo = getTokenInfo(msg);
              if (!tokenInfo) {
                return null;
              }
              return (
                <div className={styles.tokenBadge} title="Consumo de tokens (Prompt / Conclusão)">
                  <span className={styles.tokenIcon}>🪙</span>
                  <span className={styles.tokenCount}>{tokenInfo.totalTokens} tokens</span>
                  <span className={styles.tokenSplit}>({tokenInfo.promptTokens} in / {tokenInfo.completionTokens} out)</span>
                </div>
              );
            })()}
          </div>
        ))}
        {isLoading && (
          <div className={styles.loadingIndicator}>
            <Spinner size={16} />
            <span style={{ marginLeft: 8 }}>Processando telemetria e gerando resposta...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de Mensagem */}
      <div className={styles.inputArea}>
        <Input
          value={inputText}
          placeholder="Faça uma pergunta sobre as métricas ou logs..."
          onChange={(e) => setInputText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
          disabled={isLoading}
          suffix={
            <Button
              size="sm"
              icon="arrow-right"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputText.trim()}
            >
              Enviar
            </Button>
          }
        />
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 480px;
    background: ${theme.colors.background.primary};
    border-radius: ${theme.shape.radius.default};
    border: 1px solid ${theme.colors.border.weak};
    overflow: hidden;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: ${theme.spacing(1.25, 2)};
    background: ${theme.colors.background.secondary};
    border-bottom: 1px solid ${theme.colors.border.weak};
    flex-wrap: wrap;
    gap: ${theme.spacing(1.5)};
  `,
  headerLeft: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    font-weight: ${theme.typography.fontWeightBold};
    color: ${theme.colors.text.primary};
    flex: 0 0 auto;
  `,
  headerIcon: css`
    color: ${theme.colors.primary.text};
  `,
  modelTag: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    background: ${theme.colors.action.hover};
    padding: 2px 6px;
    border-radius: 4px;
    color: ${theme.colors.text.secondary};
  `,
  headerCenter: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 1 1 auto;
    min-width: 280px;
  `,
  dashSelectorLabel: css`
    font-size: 12px;
    font-weight: 600;
    color: ${theme.colors.text.primary};
    white-space: nowrap;
  `,
  headerRight: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    flex: 0 0 auto;
  `,
  headerIconBtn: css`
    display: flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 6px;
    padding: 3px 8px;
    color: ${theme.colors.text.secondary};
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
      background: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};
      border-color: ${theme.colors.primary.border};
    }
  `,
  spinningIcon: css`
    animation: spin 1s linear infinite;
    @keyframes spin {
      100% {
        transform: rotate(360deg);
      }
    }
  `,
  telemetryTag: css`
    font-size: 11px;
    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.primary};
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid ${theme.colors.border.weak};
  `,
  quickActions: css`
    display: flex;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1, 2)};
    background: ${theme.colors.background.secondary};
    border-bottom: 1px solid ${theme.colors.border.weak};
    overflow-x: auto;
  `,
  actionBtn: css`
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
    color: ${theme.colors.text.primary};
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
    &:hover {
      background: ${theme.colors.action.hover};
      border-color: ${theme.colors.primary.border};
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  messageList: css`
    flex: 1;
    overflow-y: auto;
    padding: ${theme.spacing(2)};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1.5)};
  `,
  userMessage: css`
    align-self: flex-end;
    max-width: 85%;
    background: ${theme.colors.primary.main};
    color: ${theme.colors.primary.contrastText};
    border-radius: 12px 12px 2px 12px;
    padding: ${theme.spacing(1, 1.5)};
  `,
  assistantMessage: css`
    align-self: flex-start;
    max-width: 95%;
    width: 95%;
    background: ${theme.colors.background.secondary};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 12px 12px 12px 2px;
    padding: ${theme.spacing(1.5)};
  `,
  messageHeader: css`
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    opacity: 0.8;
    margin-bottom: 6px;
  `,
  senderName: css`
    font-weight: bold;
  `,
  messageTime: css`
    margin-left: 8px;
  `,
  messageContent: css`
    font-size: 13px;
    line-height: 1.5;
  `,
  formattedContainer: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  preContent: css`
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
    margin: 0;
  `,
  cliCard: css`
    background: #0f141c;
    border: 1px solid ${theme.colors.border.medium};
    border-radius: 6px;
    margin: 6px 0;
    overflow: hidden;
  `,
  cliCardHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 10px;
    background: #18202d;
    border-bottom: 1px solid #232d3f;
  `,
  cliCardLang: css`
    font-size: 11px;
    font-weight: 600;
    color: #4cd494;
    letter-spacing: 0.5px;
  `,
  copyBtn: css`
    display: flex;
    align-items: center;
    gap: 4px;
    background: #253346;
    border: none;
    color: #cbd5e1;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
    &:hover {
      background: #33445c;
      color: #fff;
    }
  `,
  cliCode: css`
    padding: 10px;
    margin: 0;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 12px;
    color: #f1f5f9;
    background: #0d121a;
    overflow-x: auto;
    white-space: pre;
  `,
  loadingIndicator: css`
    display: flex;
    align-items: center;
    color: ${theme.colors.text.secondary};
    font-size: 12px;
    padding: ${theme.spacing(1)};
  `,
  inputArea: css`
    padding: ${theme.spacing(1.5, 2)};
    background: ${theme.colors.background.secondary};
    border-top: 1px solid ${theme.colors.border.weak};
  `,
  tokenBadge: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    padding: 3px 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid ${theme.colors.border.weak};
    border-radius: 12px;
    font-size: 11px;
    color: ${theme.colors.text.secondary};
  `,
  tokenIcon: css`
    font-size: 12px;
  `,
  tokenCount: css`
    font-weight: 600;
    color: #4cd494;
  `,
  tokenSplit: css`
    opacity: 0.75;
    font-size: 10px;
  `,
});
