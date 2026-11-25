import React from 'react';
import { PanelProps } from '@grafana/data';
import { CopilotChat } from '../chat/CopilotChat';

interface NOCPilotPanelOptions {}

export const NOCPilotPanel: React.FC<PanelProps<NOCPilotPanelOptions>> = (props) => {
  const frames = props.data?.series || [];

  // Detecta o UID do dashboard onde este painel está embutido
  let dashUid: string | undefined;
  try {
    const match = window.location.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      dashUid = match[1];
    }
  } catch (e) {
    // noop
  }

  return (
    <div style={{ width: props.width, height: props.height, overflow: 'hidden' }}>
      <CopilotChat dataFrames={frames.length > 0 ? frames : undefined} dashboardUid={dashUid} hideSelector={true} />
    </div>
  );
};

export const VOCPilotPanel = NOCPilotPanel;
