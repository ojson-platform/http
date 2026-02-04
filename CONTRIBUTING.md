# Contributing to @ojson/http

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Documentation](#documentation)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js**: Version 20.x or 22.x
- **npm**: Latest version
- **Git**: For version control

### Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/ojson-platform/http.git
   cd http
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify the setup**:
   ```bash
   npm run build
   npm test
   ```

## Development Workflow

### Project Structure

```
http/
├── src/                    # Source code
│   ├── client/             # Core HTTP client
│   └── types.ts            # Public type definitions
├── docs/                   # Documentation
│   ├── AGENTS/             # AI agent guides
│   └── ADR/                # Architectural Decision Records (future)
└── build/                  # Compiled output (generated)
```

### Making Changes

1. **Create a branch** from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** following the [Code Style](#code-style) guidelines.

3. **Run tests** to ensure everything works:
   ```bash
   npm test
   ```

4. **Run linting** to check code quality:
   ```bash
   npm run lint
   ```

5. **Format your code**:
   ```bash
   npm run format
   ```

6. **Commit your changes** following [Commit Guidelines](#commit-guidelines).

## Code Style

### TypeScript

- **Strict mode**: All code must pass TypeScript strict mode checks.
- **ES2020 target**: Code is compiled to ES2020 with ES modules.
- **Functional patterns**: Prefer functional programming patterns where possible.
- **Pure functions**: Keep core logic deterministic and side-effect free when possible.

### Import Organization

Imports must be organized in a specific order:

1. **Type imports first** (all `import type` statements):
   - External type imports
   - Parent module type imports
   - Local type imports

2. **Empty line separator**

3. **Runtime imports** (regular `import` statements):
   - External module imports
   - **Empty line separator**
   - Parent module imports
   - **Empty line separator**
   - Local module imports

**Example**:
```typescript
import type {ExternalType} from 'external-package';
import type {ParentType} from '../parent-module';
import type {LocalType} from './local-module';

import {externalFunction} from 'external-package';

import {parentFunction} from '../parent-module';

import {localFunction} from './local-module';
```

**Important**: Do not use mixed import syntax. Always separate type imports and runtime imports.

### Module Boundaries

When importing from other modules in `src/with-*/`, always import from the module root rather than internal files. This is enforced by ESLint.

### Comments and Documentation

- **All comments must be in English** (including test comments and inline documentation).
- **JSDoc**: All public APIs must be documented with JSDoc comments.
- **Internal functions**: Use concise comments without redundant `@param` and `@returns` tags.

See `docs/AGENTS/style-and-testing.md` for detailed documentation guidelines.

### Code Formatting

The project uses **Prettier** for code formatting. Configuration is in `.prettierrc.json`. Run `npm run format` before committing.

## Testing

### Test Structure

- Test files use `.spec.ts` extension (excluded from build).
- Tests are located next to the code they test.
- Use Vitest framework for unit tests.

### Running Tests

```bash
# Run all tests (unit + type checks)
npm test

# Run only unit tests
npm run test:units

# Run unit tests (fast)
npm run test:units:fast

# Run type checks
npm run test:types

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

Focus areas:
- endpoint construction
- serialization rules
- error handling
- timeout and abort handling
- config merge behavior

## Documentation

### User Documentation

- **README.md**: Main project documentation
- **Module READMEs**: User-facing guides in `src/*/readme.md`

### Developer Documentation

- **AGENTS.md**: Index for AI coding agents
- **docs/AGENTS/**: Detailed guides for AI agents
- **docs/ADR/**: Architectural Decision Records

### Updating Documentation

- Update relevant README files when adding features
- Add ADRs for significant architectural decisions

## Commit Guidelines

This project uses [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>
```

### Commit Types

- `feat`: New feature for end users
- `fix`: Bug fix for end users
- `perf`: Performance improvement
- `refactor`: Code refactoring (no functional changes)
- `docs`: Documentation changes only
- `chore`: Maintenance tasks and infrastructure changes
- `revert`: Reverting a previous commit

**Key distinction**: `feat` is for **user-facing functionality**, while `chore` is for **development infrastructure**.

### Commit Message Rules

- **All commit messages must be in English**
- **Subject**: Brief description in imperative mood (e.g., "add", "fix", not "added", "fixed")
- **Scope** (optional): Area of codebase (e.g., `client`, `request`, `lint`)
- **Body** (optional): Detailed explanation of what and why

## Pull Request Process

1. **Update your branch**:
   ```bash
   git checkout master
   git pull origin master
   git checkout your-branch
   git rebase master
   ```

2. **Ensure all checks pass**:
   - Tests pass: `npm test`
   - Linting passes: `npm run lint`
   - Code is formatted: `npm run format:check`
   - Type checks pass: `npm run test:types`

3. **Create a Pull Request**:
   - Use the PR template provided
   - Provide a clear description of changes
   - Link related issues if applicable
   - Ensure CI checks pass

4. **Code Review**:
   - Address review comments
   - Keep commits focused and logical
   - Squash commits if requested

### PR Checklist

- [ ] Tests pass locally
- [ ] Added/updated tests for new functionality
- [ ] Type checks pass (`npm run test:types`)
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated (if needed)
- [ ] No new warnings generated
- [ ] CHANGELOG will be updated by release-please (if applicable)

## Additional Resources

- **Project Overview**: See `docs/AGENTS/core.md`
- **Architecture**: See `docs/AGENTS/helpers-and-architecture.md`
- **Style Guide**: See `docs/AGENTS/style-and-testing.md`
- **Infrastructure**: See `docs/AGENTS/dev-infrastructure.md`

## Questions?

If you have questions or need help, please:
- Open an issue for bugs or feature requests
- Check existing documentation in `docs/`

Thank you for contributing! 🎉
