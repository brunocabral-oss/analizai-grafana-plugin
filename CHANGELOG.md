# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to Semantic Versioning.

## [2.1.4] - 2026-11-25

### Fixed
- Add explicit SVG width/height and render AnalizAI logo directly in chat header.

## [2.1.3] - 2026-10-22

### Fixed
- Rename logo asset to `logo-analizai.svg` to bypass Grafana 1h browser cache.

## [2.1.2] - 2026-10-22

### Added
- Apply AnalizAI prism A logo SVG and concise Go/No-Go description.

## [2.1.1] - 2026-10-21

### Changed
- Bump version to 2.1.1 to invalidate Grafana browser asset cache.

## [2.1.0] - 2026-10-21

### Added
- Go/No-Go ASD-STE100 workflow, local LLM proxy endpoint, and welcome cache sync.

### Fixed
- Route LLM calls through Grafana same-origin plugin-proxy to eliminate `Failed to fetch`.

## [2.0.0] - 2026-10-20

### Added
- Rebrand to AnalizAI v2.0.0, enforce ASD-STE100 prompts, subsystem pruning, and dynamic dashboard discovery.

## [1.1.0] - 2026-10-20

### Changed
- Bump version to 1.1.0 to bust browser cache.

## [1.0.0] - 2026-10-20

### Added
- Initial release of NOCPilot / AnalizAI Grafana plugin architecture.
