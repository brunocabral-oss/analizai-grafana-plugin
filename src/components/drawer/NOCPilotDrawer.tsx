import React, { useState } from 'react';
import { css, keyframes } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { CopilotChat } from '../chat/CopilotChat';

interface NOCPilotDrawerProps {
  initialDashboardUid?: string;
  defaultOpen?: boolean;
}

export const NOCPilotDrawer: React.FC<NOCPilotDrawerProps> = ({ initialDashboardUid, defaultOpen = false }) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedUid, setSelectedUid] = useState<string>(() => {
    if (initialDashboardUid) {
      return initialDashboardUid;
    }
    try {
      const match = window.location.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (e) {
      // noop
    }
    return '';
  });

  const [prevInitialDashboardUid, setPrevInitialDashboardUid] = useState(initialDashboardUid);
  if (initialDashboardUid !== prevInitialDashboardUid) {
    setPrevInitialDashboardUid(initialDashboardUid);
    if (initialDashboardUid) {
      setSelectedUid(initialDashboardUid);
    }
  }

  return (
    <>
      {/* Botão Flutuante (FAB) quando o drawer está recolhido */}
      {!isOpen && (
        <button
          className={styles.fabButton}
          onClick={() => setIsOpen(true)}
          title="Abrir Copiloto de IA (AnalizAI)"
          aria-label="Abrir Copiloto AnalizAI"
        >
          <div className={styles.fabPulse} />
          <Icon name="brain" size="lg" className={styles.fabIcon} />
          <span className={styles.fabText}>AnalizAI</span>
        </button>
      )}

      {/* Backdrop com desfoque de fundo */}
      {isOpen && <div className={styles.backdrop} onClick={() => setIsOpen(false)} />}

      {/* Painel Retrátil (Drawer) */}
      <div className={`${styles.drawerContainer} ${isOpen ? styles.drawerOpen : styles.drawerClosed}`}>
        {/* Barra superior de controle do Drawer */}
        <div className={styles.drawerTopBar}>
          <div className={styles.drawerTitleSection}>
            <Icon name="brain" className={styles.drawerHeaderIcon} />
            <span className={styles.drawerTitle}>AnalizAI</span>
            <span className={styles.drawerBadge}>NOC AI</span>
          </div>

          <button
            className={styles.closeBtn}
            onClick={() => setIsOpen(false)}
            title="Recolher Copiloto"
            aria-label="Fechar"
          >
            <Icon name="times" size="md" />
          </button>
        </div>

        {/* Corpo do Drawer com o Chat Inteligente */}
        <div className={styles.drawerChatWrapper}>
          <CopilotChat dashboardUid={selectedUid} onClose={() => setIsOpen(false)} />
        </div>
      </div>
    </>
  );
};

export const VOCPilotDrawer = NOCPilotDrawer;

const pulseAnim = keyframes`
  0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(76, 212, 148, 0.6); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(76, 212, 148, 0); }
  100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(76, 212, 148, 0); }
`;

const getStyles = (theme: GrafanaTheme2) => ({
  fabButton: css`
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    border: 1px solid #374151;
    border-radius: 30px;
    color: #f3f4f6;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(76, 212, 148, 0.3);
      border-color: #4cd494;
    }
  `,
  fabPulse: css`
    position: absolute;
    left: 8px;
    top: 50%;
    margin-top: -4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #4cd494;
    animation: ${pulseAnim} 2s infinite;
  `,
  fabIcon: css`
    margin-left: 8px;
    color: #4cd494;
  `,
  fabText: css`
    letter-spacing: 0.5px;
  `,
  backdrop: css`
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    z-index: 10000;
  `,
  drawerContainer: css`
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 520px;
    max-width: calc(100vw - 32px);
    height: 100vh;
    background: ${theme.colors.background.primary};
    border-left: 1px solid ${theme.colors.border.weak};
    box-shadow: -12px 0 36px rgba(0, 0, 0, 0.6);
    z-index: 10001;
    display: flex;
    flex-direction: column;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  `,
  drawerOpen: css`
    transform: translateX(0);
  `,
  drawerClosed: css`
    transform: translateX(100%);
  `,
  drawerTopBar: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.spacing(1.5, 2)};
    background: ${theme.colors.background.secondary};
    border-bottom: 1px solid ${theme.colors.border.weak};
    gap: ${theme.spacing(1.5)};
  `,
  drawerTitleSection: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  drawerHeaderIcon: css`
    color: #4cd494;
  `,
  drawerTitle: css`
    font-size: 15px;
    font-weight: 700;
    color: ${theme.colors.text.primary};
  `,
  drawerBadge: css`
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: #1e3a2f;
    color: #4cd494;
    border: 1px solid #2d5a49;
  `,
  drawerDashboardSelector: css`
    flex: 1;
    min-width: 140px;
  `,
  closeBtn: css`
    background: transparent;
    border: none;
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    &:hover {
      background: ${theme.colors.action.hover};
      color: ${theme.colors.text.primary};
    }
  `,
  drawerChatWrapper: css`
    flex: 1;
    height: calc(100vh - 64px);
    overflow: hidden;
  `,
});
