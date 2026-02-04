# Agent Guide – Development Infrastructure

## Overview

This document describes the development infrastructure setup for the project,
including tools, workflows, and local commands.

## Build System

### TypeScript Compilation

- **Compiler**: `tsc`
- **Build command**: `npm run build`
- **Output**: `build/` directory

## Testing

### Unit Tests

- **Framework**: Vitest
- **Command**: `npm run test:units:fast`
- **Test files**: `**/*.spec.ts`
- **Coverage**: configured via `vitest.config.ts` (V8 provider)

### Type Checks

- **Command**: `npm run test:types`

## Code Quality

### ESLint

- **Version**: v9 (flat config)
- **Config**: `eslint.config.js`
- **Command**: `npm run lint` or `npm run lint:fix`
- **Rules**:
  - Import order: type imports first, then runtime imports
  - `no-restricted-imports`: enforces module boundaries

### Prettier

- **Config**: `.prettierrc.json`
- **Command**: `npm run format` or `npm run format:check`

## NPM Scripts

### Build

- `npm run build` - Compile TypeScript to `build/`
- `npm run prebuild` - Clean `build/` directory

### Testing

- `npm test` - Run unit tests + type checks
- `npm run test:units` - Run all unit tests
- `npm run test:units:fast` - Run unit tests (fast)
- `npm run test:types` - Run type checks
- `npm run test:coverage` - Run tests with coverage
- `npm run test:coverage:fast` - Run tests with coverage (fast)

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Project Structure

### Source Code

- `src/` - Main source code
  - `src/client/` - Core HTTP client implementation
  - `src/with-*/` - Helper modules

### Tests

- `src/**/*.spec.ts` - Unit tests

### Configuration Files

- `tsconfig.json` - Main TypeScript config
- `vitest.config.ts` - Vitest configuration
- `eslint.config.js` - ESLint configuration (flat config)
- `.prettierrc.json` - Prettier configuration

## Node.js Support

- **Supported versions**: >= 20.x (see `package.json` engines)
