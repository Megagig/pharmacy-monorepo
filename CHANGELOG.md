# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Monorepo structure with Turborepo
- Shared configuration packages:
  - `@pharmacy/typescript-config` - TypeScript configurations (base, react, node)
  - `@pharmacy/eslint-config` - ESLint configurations (base, react)
  - `@pharmacy/prettier-config` - Prettier configuration
- Git hooks with Husky and lint-staged
- Conventional commits enforcement

### Changed
- Migrated from single-repo to monorepo structure

### Infrastructure
- Setup pnpm workspaces
- Setup Turbo for build orchestration

## [1.0.0] - 2025-11-20

### Initial Release
- Web application (React + Vite + Tailwind CSS)
- Backend API (Express + MongoDB)
- Patient management system
- Prescription management
- Appointment scheduling
- MTR (Medication Therapy Review) integration
- RBAC (Role-Based Access Control)
- Feature flag system
- Payment integration (Nomba)
- Real-time notifications (Socket.io)
