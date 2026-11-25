import { PanelPlugin } from '@grafana/data';
import { NOCPilotPanel } from '../components/panel/NOCPilotPanel';

export const plugin = new PanelPlugin(NOCPilotPanel);
