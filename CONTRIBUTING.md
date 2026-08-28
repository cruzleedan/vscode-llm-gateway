# Contributing to LLM Gateway Connector

## Development Setup

### Prerequisites

- Node.js 20+
- npm
- Python 3.8+ (for litellm)
- VS Code

### Build from Source

```bash
# Clone the repository
git clone https://github.com/cruzleedan/vscode-llm-gateway.git
cd vscode-llm-gateway

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (for active development)
npm run watch
```

### Testing Locally

```bash
# Package the extension
npm run package
# or
npx vsce package

# Install in VS Code
code --install-extension llm-gateway-connector-0.1.0.vsix

# Reload VS Code
# Cmd/Ctrl+Shift+P → "Developer: Reload Window"
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Test the extension in the new VS Code window
4. Check the Output panel → "LLM Gateway" channel for logs
5. Use `console.log` statements (they appear in the Extension Development Host console)

## Publishing to Marketplace

### First-time setup

1. **Create a Publisher account**
   - Go to https://marketplace.visualstudio.com/manage
   - Sign in with Microsoft/Azure account
   - Create a new publisher ID (or use existing: `D3Cruz`)

2. **Get a Personal Access Token (PAT)**
   - Go to https://dev.azure.com
   - User Settings → Personal Access Tokens
   - Create token with **Marketplace (Manage)** scope
   - Set expiration (recommend: 90 days)
   - Save the token securely

3. **Login with vsce**
   ```bash
   npx vsce login D3Cruz
   # Paste your PAT when prompted
   ```

### Publishing updates

```bash
# 1. Update version in package.json
# 2. Update CHANGELOG.md with changes
# 3. Commit changes
git add .
git commit -m "Release v0.1.1"
git tag v0.1.1
git push origin main --tags

# 4. Build and publish
npm run compile
npx vsce package
npx vsce publish

# Or use shortcuts for version bumping
npx vsce publish patch  # 0.1.0 → 0.1.1
npx vsce publish minor  # 0.1.0 → 0.2.0
npx vsce publish major  # 0.1.0 → 1.0.0
```

### Pre-publish checklist

- [ ] All tests pass (`npm test`)
- [ ] Code compiles without errors (`npm run compile`)
- [ ] README.md is up to date
- [ ] CHANGELOG.md includes new changes
- [ ] Version bumped in package.json
- [ ] Extension tested locally
- [ ] Git tag created

## Project Structure

```
vscode-llm-gateway/
├── src/
│   └── extension.ts          # Main extension code
├── out/                       # Compiled JavaScript (gitignored)
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── README.md                 # User-facing documentation
├── CONTRIBUTING.md           # This file
├── LICENSE                   # MIT license
└── .vscodeignore            # Files to exclude from package
```

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules (configured in `.eslintrc.json`)
- Use async/await over promises
- Add JSDoc comments for public functions
- Keep functions focused and small

## Adding Features

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and test thoroughly
3. Update README.md if user-facing
4. Commit with descriptive messages
5. Push and create a pull request

## Troubleshooting Development Issues

**Extension not loading:**
- Check Output → Extension Host for errors
- Ensure `npm run compile` completed successfully
- Try reloading the Extension Development Host

**Changes not reflecting:**
- Run `npm run compile` after code changes
- Reload the Extension Development Host window
- Check the `out/` directory has updated `.js` files

**vsce package fails:**
- Ensure all files in `.vscodeignore` are correct
- Check for missing dependencies in package.json
- Verify LICENSE file exists

## Support

For questions or issues:
- Open an issue on GitHub
- Check existing issues for solutions
- Review VS Code extension development docs: https://code.visualstudio.com/api
