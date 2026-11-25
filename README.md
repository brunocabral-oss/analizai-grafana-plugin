# AnalizAI — AI-Powered Observability Copilot for Grafana

[![CI Status](https://github.com/analizai/plugin-ia-grafana/actions/workflows/ci.yml/badge.svg)](https://github.com/analizai/plugin-ia-grafana/actions)
[![Grafana Plugin](https://img.shields.io/badge/Grafana-v13.2.3-orange?logo=grafana)](https://grafana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)](https://react.dev)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](https://opensource.org/licenses/Apache-2.0)

**AnalizAI** is an advanced, enterprise-grade AIOps and LLM-powered observability plugin designed for Grafana. It bridges operational telemetry with state-of-the-art Large Language Models to deliver automated Root Cause Analysis (RCA), intelligent dashboard querying, and real-time NOC/VOC copilot assistance directly inside your Grafana workflows.

---

## 🚀 Key Features

- **🧠 Multi-Provider LLM Engine**: Seamlessly switch between local and cloud AI providers including **Ollama** (local privacy-first models), **OpenAI**, **Groq** (ultra-low latency inference), and **vLLM**.
- **📊 DataFrame Compactor**: Automatically compacts high-volume Grafana time-series DataFrames and tabular metrics into token-optimized summaries tailored for LLM context limits.
- **⚡ Template Resolver**: Dynamically injects dashboard variables, active time ranges, data source metadata, and alert contexts into prompt templates in real time.
- **🛠️ NOC & VOC Copilot Panels & Drawers**: Dedicated interactive panels and side drawers providing instant incident triaging, metric anomaly explanation, and guided troubleshooting for Network Operations Centers (NOC) and Video Operations Centers (VOC).
- **🔒 Secure Credential Management**: Leverages Grafana's secure data source provisioning (`secureJsonData`) to protect API keys and sensitive endpoint tokens.

---

## 📐 Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Grafana [Grafana Enterprise / OSS v13.2.3]
        UI[AnalizAI App & Cockpit / Panels]
        Resolver[Template Resolver & Context Injector]
        Compactor[DataFrame Compactor]
    end

    subgraph Engine [AnalizAI Core Engine]
        Factory[LLM Client Factory]
        Prompts[Prompt Templates & RCA Engine]
    end

    subgraph Providers [LLM Providers]
        Ollama[Ollama (Local / Air-Gapped)]
        OpenAI[OpenAI API (GPT-4o)]
        Groq[Groq LPU Inference (Llama 3)]
        vLLM[vLLM Enterprise Serving]
    end

    UI --> Resolver
    Resolver --> Compactor
    Compactor --> Engine
    Engine --> Factory
    Factory --> Ollama
    Factory --> OpenAI
    Factory --> Groq
    Factory --> vLLM
```

---

## ⚙️ Configuration Guide

1. Navigate to **Administration > Plugins > AnalizAI**.
2. Configure your preferred **LLM Provider**:
   - `mock`: Built-in offline demonstration provider (`MockLLMProvider`) that returns deterministic, instant AI insights without requiring external API keys or network access.
   - `ollama`: Local endpoint (e.g., `http://localhost:11434`)
   - `openai`, `groq`, `vllm`: Cloud/Enterprise API endpoints.
3. Securely store your API keys in **Secure JSON Data** (`apiKey`), preventing exposure in dashboard JSON exports.

---

## 🛠️ Development & Quickstart

### Prerequisites
- Node.js `>=22`
- npm `10.9.2+`
- Docker & Docker Compose (for local Grafana test container)

### Installation & Build

```bash
# Clone repository
git clone https://github.com/analizai/plugin-ia-grafana.git
cd plugin-ia-grafana

# Install dependencies
npm ci

# Build production bundle
npm run build
```

### NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run build` | Compile and bundle plugin for production via Webpack |
| `npm run dev` | Run Webpack in watch mode for live development |
| `npm run test` | Run Jest test suite in watch mode (`--onlyChanged`) |
| `npm run test:ci` | Execute CI test suite (`--passWithNoTests --maxWorkers 4`) |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run lint` | Run ESLint static analysis |
| `npm run server` | Spin up local Grafana dev environment via Docker Compose |
| `npm run sign` | Sign plugin bundle using Grafana signing tools |

### Docker Compose Quickstart & Demo / Offline Mode

Launch an isolated Grafana instance with AnalizAI pre-installed, provisioned with the **Service Health Demo** dashboard, and ready for offline testing:

```bash
npm run server
```

1. Access Grafana at `http://localhost:3000` (Default credentials: `admin` / `admin`).
2. Navigate to Dashboards and open the pre-provisioned **Service Health Demo** dashboard.
3. Test AnalizAI immediately without an external LLM key: the environment utilizes the built-in `MockLLMProvider` to return instant, deterministic AIOps insights and Root Cause Analysis.

---

## 🧪 Testing

Run the rigorous unit and integration test suite:

```bash
npm run test:ci
```

---

## 📄 License

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for more information.
