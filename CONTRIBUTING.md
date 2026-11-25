# Contributing to AnalizAI (plugin-ia-grafana)

Thank you for your interest in contributing to **AnalizAI**, the AIOps and LLM-powered observability plugin for Grafana!

---

## Table of Contents
1. [Code of Conduct](#code-of-conduct)
2. [Development Environment Setup](#development-environment-setup)
3. [Local Development Scripts](#local-development-scripts)
4. [Docker & Grafana Lab Setup](#docker--grafana-lab-setup)
5. [Code Style & Linting](#code-style--linting)
6. [Testing & Quality Assurance](#testing--quality-assurance)
7. [Pull Request (PR) Guidelines](#pull-request-pr-guidelines)

---

## 1. Code of Conduct
By participating in this project, you agree to abide by our professional standards. Please treat all contributors and maintainers with respect, maintain technical sobriety, and adhere strictly to security and data privacy best practices.

---

## 2. Development Environment Setup

### Prerequisites
* **Node.js**: `>= 22` (Managed via `.nvmrc`)
* **npm**: `>= 10`
* **Docker & Docker Compose**: For running local Grafana instances with plugin pre-provisioned.

### Initial Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd plugin-ia-grafana
   ```
2. Ensure you are using the correct Node version:
   ```bash
   nvm use
   ```
3. Install project dependencies:
   ```bash
   npm install
   ```

---

## 3. Local Development Scripts

All core development commands are defined in [`package.json`](file:///home/brunocabral/Documentos/Projetos-antigravity/plugin-ia-grafana/package.json):

* **`npm install`**: Installs all project dependencies.
* **`npm run dev`**: Starts Webpack in watch mode (`development`) for live building during frontend development.
* **`npm run build`**: Builds the plugin bundle for production (`production` mode via Webpack).
* **`npm run test:ci`**: Runs the Jest test suite in CI mode (`--passWithNoTests --maxWorkers 4`).
* **`npm run typecheck`**: Runs TypeScript type checking without emitting files (`tsc --noEmit`).
* **`npm run lint`**: Lints the codebase using ESLint.
* **`npm run lint:fix`**: Automatically fixes ESLint issues and formats files with Prettier.
* **`npm run server`**: Starts the local Grafana and backend services stack using Docker Compose (`docker compose up --build`).
* **`npm run e2e`**: Runs Playwright end-to-end tests.

---

## 4. Docker & Grafana Lab Setup

To test the plugin live inside a fully configured Grafana instance:

```bash
npm run server
```

This command executes `docker compose up --build`, spinning up Grafana with the plugin mounted into the plugins directory. Access your local Grafana instance at `http://localhost:3000` (default credentials: `admin` / `admin`).

---

## 5. Code Style & Linting

We maintain strict code quality standards using ESLint (`eslint.config.mjs`) and Prettier (`.prettierrc.js`).

* **Linting Code**:
  ```bash
  npm run lint
  ```
* **Formatting & Fixing**:
  ```bash
  npm run lint:fix
  ```
* **Type Safety**: Always ensure your code passes TypeScript checks:
  ```bash
  npm run typecheck
  ```

---

## 6. Testing & Quality Assurance

* **Unit & Component Tests**: Written in Jest and React Testing Library.
  ```bash
  npm run test:ci
  ```
* **End-to-End Tests**:
  ```bash
  npm run e2e
  ```
* **Pre-Commit Checklist**: Before opening a pull request, always run:
  1. `npm run typecheck`
  2. `npm run lint`
  3. `npm run test:ci`
  4. `npm run build`

---

## 7. Pull Request (PR) Guidelines

1. **Branch Naming**: Use descriptive branch names (e.g., `feature/ai-query-optimizer`, `fix/metric-sync-error`).
2. **Commit Messages**: Write clear, concise, and structured commit messages following conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`).
3. **PR Description**: Provide a clear summary of changes, motivation, testing steps performed, and any relevant screenshots or logs.
4. **Review Process**: Ensure all CI status checks (linting, tests, build) pass successfully before requesting code review from maintainers.
