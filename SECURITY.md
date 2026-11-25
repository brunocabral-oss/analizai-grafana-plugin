# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within the Grafana AI Plugin (`plugin-ia-grafana`), please report it privately. Do not open public GitHub issues for security vulnerabilities.

- **Contact**: security / maintainers via private disclosure
- **Response Time**: We aim to acknowledge receipt within 48 hours and provide a detailed remediation plan within 5 business days.

## Security Architecture Notes

### 1. No Hardcoded Secrets or Keys
- The plugin strictly forbids hardcoding API keys, tokens, passwords, or cryptographic material in source code, configuration files, or client-side bundles.
- All credentials and sensitive parameters must be injected dynamically via environment variables or Grafana's secure backend provisioning.

### 2. Grafana `secureJsonData` Proxy Pattern
- Sensitive credentials (such as LLM API keys, database passwords, or auth tokens) are stored encrypted in Grafana's database using `secureJsonData`.
- Secrets never reach the browser client. All outbound requests requiring authentication are routed exclusively through the Grafana backend datasource proxy plugin architecture, where headers and payloads are securely handled and signed server-side.

### 3. Read-Only Telemetry Inspection
- Operations interacting with external telemetry endpoints, logs, and monitoring targets operate by default in strict **Read-Only** mode.
- Mutative API calls are explicitly gated, requiring user confirmation and explicit authorization tokens to prevent unintended modifications to production environments.
