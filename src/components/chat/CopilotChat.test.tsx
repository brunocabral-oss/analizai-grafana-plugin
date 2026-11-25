import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopilotChat } from './CopilotChat';

// Mock DashboardReader
jest.mock('../../engine/grafana/dashboardReader', () => ({
  DashboardReader: {
    searchDashboards: jest.fn().mockResolvedValue([
      { uid: 'opf3-lab-api', title: 'OPF3 LAB API', url: '/d/opf3-lab-api' },
      { uid: 'dash-2', title: 'Dashboard 2', url: '/d/dash-2' },
    ]),
    getDashboardByUid: jest.fn().mockResolvedValue({
      title: 'OPF3 LAB API',
      panels: [],
      templating: { list: [] },
    }),
    extractTargetsFromDashboard: jest.fn().mockReturnValue([]),
  },
}));

// Mock LLMClientFactory
jest.mock('../../llm/clientFactory', () => ({
  LLMClientFactory: {
    getProvider: jest.fn().mockReturnValue({
      streamChat: jest.fn().mockImplementation(async (_, __, ___, ____, callbacks) => {
        if (callbacks?.onChunk) {
          callbacks.onChunk('Mock response chunk');
        }
      }),
    }),
  },
}));

describe('CopilotChat Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders CopilotChat successfully and shows welcome message', async () => {
    render(<CopilotChat dashboardUid="opf3-lab-api" />);

    const analizaiElements = screen.getAllByText(/AnalizAI/i);
    expect(analizaiElements.length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getAllByText(/ativo/i).length).toBeGreaterThan(0);
    });
  });

  test('renders prompt input and Send button', () => {
    render(<CopilotChat dashboardUid="opf3-lab-api" hideSelector={true} />);

    const input = screen.getByPlaceholderText(/Faça uma pergunta sobre as métricas ou logs/i);
    expect(input).toBeInTheDocument();

    const sendButton = screen.getByRole('button', { name: /Enviar/i });
    expect(sendButton).toBeInTheDocument();
  });

  test('renders quick-action buttons', () => {
    render(<CopilotChat dashboardUid="opf3-lab-api" hideSelector={true} />);

    expect(screen.getByRole('button', { name: /Parecer Go \/ No-Go/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resumo de Indicadores/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Erros & Gargalos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Diagnóstico Técnico \(RCA\)/i })).toBeInTheDocument();
  });

  test('allows typing in prompt input and clicking send', async () => {
    render(<CopilotChat dashboardUid="opf3-lab-api" hideSelector={true} />);

    const input = screen.getByPlaceholderText(/Faça uma pergunta sobre as métricas ou logs/i);
    fireEvent.change(input, { target: { value: 'Qual o status da API?' } });
    expect(input).toHaveValue('Qual o status da API?');

    const sendButton = screen.getByRole('button', { name: /Enviar/i });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText(/Qual o status da API\?/i)).toBeInTheDocument();
    });
  });
});
