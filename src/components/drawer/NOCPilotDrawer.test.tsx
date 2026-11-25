import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NOCPilotDrawer } from './NOCPilotDrawer';

describe('Components/drawer/NOCPilotDrawer', () => {
  test('renders closed by default with floating action button (FAB)', () => {
    render(<NOCPilotDrawer />);

    const fabButton = screen.getByRole('button', { name: /Abrir Copiloto AnalizAI/i });
    expect(fabButton).toBeInTheDocument();
  });

  test('renders open when defaultOpen is true', () => {
    render(<NOCPilotDrawer defaultOpen={true} />);

    const fabButton = screen.queryByRole('button', { name: /Abrir Copiloto AnalizAI/i });
    expect(fabButton).not.toBeInTheDocument();

    expect(screen.getByText(/NOC AI/i)).toBeInTheDocument();
    const analizaiElements = screen.getAllByText(/AnalizAI/i);
    expect(analizaiElements.length).toBeGreaterThan(0);
  });

  test('opens drawer when FAB is clicked and closes when close button is clicked', async () => {
    render(<NOCPilotDrawer />);

    const fabButton = screen.getByRole('button', { name: /Abrir Copiloto AnalizAI/i });
    fireEvent.click(fabButton);

    expect(screen.getByText(/NOC AI/i)).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /^Fechar$/i });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Abrir Copiloto AnalizAI/i })).toBeInTheDocument();
    });
  });

  test('passes initialDashboardUid correctly', () => {
    render(<NOCPilotDrawer initialDashboardUid="test-dash-123" defaultOpen={true} />);
    expect(screen.getByText(/NOC AI/i)).toBeInTheDocument();
  });
});
