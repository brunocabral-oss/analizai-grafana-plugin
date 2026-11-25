import React, { ChangeEvent, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { css } from '@emotion/css';
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps, PluginMeta } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Combobox, ComboboxOption, Field, FieldSet, Input, SecretInput, useStyles2 } from '@grafana/ui';

import { AIProviderType, NOCPilotConfig } from '../../engine/types';

type AppPluginSettings = NOCPilotConfig;

type State = {
  provider: AIProviderType;
  apiUrl: string;
  modelName: string;
  temperature: number;
  isApiKeySet: boolean;
  apiKey: string;
};

const PROVIDER_OPTIONS: Array<ComboboxOption<AIProviderType>> = [
  { label: 'Ollama (Local / On-Premise)', value: 'ollama', description: 'Zero vazamento de dados, executa localmente ou em servidor de inferência dedicado' },
  { label: 'OpenAI (GPT-4o / GPT-4o-mini)', value: 'openai', description: 'API pública OpenAI oficial' },
  { label: 'Groq (Llama 3 Ultra Rápido)', value: 'groq', description: 'Inferência em milissegundos via GroqCloud' },
  { label: 'vLLM / LocalAI (OpenAI-Compatible)', value: 'vllm', description: 'Servidor vLLM on-premise com protocolo OpenAI' },
  { label: 'Demo / Offline Mode (No API Key)', value: 'mock', description: 'Modo demonstração offline sem necessidade de chave de API' },
];

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<AppPluginSettings>> {}

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const { enabled, pinned, jsonData, secureJsonFields } = plugin.meta;
  const [state, setState] = useState<State>({
    provider: jsonData?.provider || 'ollama',
    apiUrl: jsonData?.endpointUrl || 'http://localhost:11434',
    modelName: jsonData?.modelName || 'llama3:8b',
    temperature: jsonData?.temperature ?? 0.2,
    apiKey: '',
    isApiKeySet: Boolean(secureJsonFields?.apiKey),
  });

  const onProviderChange = (val: ComboboxOption<AIProviderType>) => {
    const provider = val.value || 'ollama';
    let defaultUrl = 'http://localhost:11434';
    let defaultModel = 'llama3:8b';

    if (provider === 'openai') {
      defaultUrl = 'https://api.openai.com/v1';
      defaultModel = 'gpt-4o-mini';
    } else if (provider === 'groq') {
      defaultUrl = 'https://api.groq.com/openai/v1';
      defaultModel = 'llama-3.3-70b-versatile';
    } else if (provider === 'vllm') {
      defaultUrl = 'http://localhost:8000/v1';
      defaultModel = 'meta-llama/Meta-Llama-3-8B-Instruct';
    } else if (provider === 'mock') {
      defaultUrl = 'mock://local';
      defaultModel = 'analizai-sre-demo';
    }

    setState((prev) => ({
      ...prev,
      provider,
      apiUrl: defaultUrl,
      modelName: defaultModel,
    }));
  };

  const onResetApiKey = () =>
    setState({
      ...state,
      apiKey: '',
      isApiKeySet: false,
    });

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      [event.target.name]: event.target.value.trim(),
    });
  };

  const onSubmit = () => {
    updatePluginAndReload(plugin.meta.id, {
      enabled,
      pinned,
      jsonData: {
        provider: state.provider,
        endpointUrl: state.apiUrl,
        modelName: state.modelName,
        temperature: Number(state.temperature),
      },
      secureJsonData: state.isApiKeySet
        ? undefined
        : {
            apiKey: state.apiKey,
          },
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <FieldSet label="AnalizAI - Configuração do Motor de Inteligência Artificial">
        <Field label="Provedor de Inteligência Artificial" description="Escolha entre modelos locais (Ollama/vLLM) para máxima privacidade ou APIs de nuvem">
          <Combobox
            width={60}
            options={PROVIDER_OPTIONS}
            value={state.provider}
            onChange={(val) => {
              if (val) {
                onProviderChange(val);
              }
            }}
          />
        </Field>

        <Field label="Endpoint URL" description="URL base da API de inferência" className={s.marginTop}>
          <Input
            width={60}
            name="apiUrl"
            id="config-api-url"
            value={state.apiUrl}
            placeholder="http://localhost:11434"
            onChange={onChange}
          />
        </Field>

        <Field label="Nome do Modelo" description="Identificador do modelo que processará os DataFrames" className={s.marginTop}>
          <Input
            width={60}
            name="modelName"
            id="config-model-name"
            value={state.modelName}
            placeholder="llama3:8b ou gpt-4o-mini"
            onChange={onChange}
          />
        </Field>

        {state.provider !== 'ollama' && state.provider !== 'mock' && (
          <Field label="Chave de API (Secret Key)" description="Armazenada de forma criptografada pelo backend do Grafana" className={s.marginTop}>
            <SecretInput
              width={60}
              id="config-api-key"
              name="apiKey"
              value={state.apiKey}
              isConfigured={state.isApiKeySet}
              placeholder="sk-..."
              onChange={onChange}
              onReset={onResetApiKey}
            />
          </Field>
        )}

        <div className={s.marginTop}>
          <Button type="submit">
            Salvar Configurações do AnalizAI
          </Button>
        </div>
      </FieldSet>
    </form>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  colorWeak: css`
    color: ${theme.colors.text.secondary};
  `,
  marginTop: css`
    margin-top: ${theme.spacing(3)};
  `,
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<AppPluginSettings>>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = await getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  return lastValueFrom(response);
};
