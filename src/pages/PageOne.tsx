import React from 'react';
import { css } from '@emotion/css';
import { PluginPage } from '@grafana/runtime';
import { CopilotChat } from '../components/chat/CopilotChat';

function PageOne() {
  return (
    <PluginPage>
      <div className={styles.container}>
        <CopilotChat />
      </div>
    </PluginPage>
  );
}

export default PageOne;

const styles = {
  container: css`
    display: flex;
    flex-direction: column;
    height: calc(100vh - 120px);
    width: 100%;
    overflow: hidden;
  `,
};
