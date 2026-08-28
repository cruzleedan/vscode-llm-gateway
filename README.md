# LLM Gateway Connector

Connect GitHub Copilot Chat to your company's LLM gateway with zero configuration. Automatically discovers available models and proxies requests through litellm.

## Features

- 🔄 **Automatic Model Discovery** - Fetches available models from your gateway
- 🚀 **Zero Config** - Just add your gateway URL and API key
- 🔌 **Built-in Proxy** - Runs litellm proxy in the background
- 🔒 **Secure** - API keys stored in VS Code's secure storage
- 🎯 **Compatible** - Works with any OpenAI-compatible LLM gateway
- 🔍 **Smart Detection** - Automatically finds litellm installation across different Python versions

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Cmd/Ctrl+Shift+X`)
3. Search for "LLM Gateway Connector"
4. Click **Install**

### From VSIX file

```bash
code --install-extension llm-gateway-connector-0.1.0.vsix
```

## Configuration

After installation:

1. Open Settings (`Cmd/Ctrl + ,`)
2. Search for "LLM Gateway"
3. Configure the following:
   - **Gateway URL**: Your company's LLM gateway endpoint (e.g., `https://llmgateway.company.com`)
   - **API Key**: Your authentication key
   - **Proxy Port** (optional): Local port for proxy (default: 8000)
   - **Litellm Path** (optional): Custom path to litellm executable (auto-detected if empty)

4. Reload VS Code (`Cmd/Ctrl+Shift+P` → "Developer: Reload Window")

The extension will automatically:
- Detect or install litellm
- Fetch available models from your gateway
- Start the proxy server
- Register models with GitHub Copilot Chat

## Requirements

- GitHub Copilot subscription
- Python 3.8+ (for litellm)
- Network access to your LLM gateway

## Extension Settings

- `llmGateway.url`: Your LLM Gateway base URL
- `llmGateway.apiKey`: API key for authentication
- `llmGateway.proxyPort`: Local port for the proxy (default: 8000)
- `llmGateway.autoRefreshModels`: Auto-fetch models on startup
- `llmGateway.dropParams`: Parameters to drop for compatibility

## Commands

- `LLM Gateway: Refresh Models` - Fetch latest models from gateway
- `LLM Gateway: Restart Proxy` - Restart the litellm proxy
- `LLM Gateway: Show Status` - Show extension logs

## Usage

After configuration, your gateway models will appear in the Copilot Chat model selector. Select any model to start chatting!

## Troubleshooting

**Models not appearing?**
1. Check the Output panel (LLM Gateway channel)
2. Verify your gateway URL and API key
3. Run "LLM Gateway: Refresh Models"

**Proxy not starting?**
1. Ensure Python and pip are installed
2. Run "LLM Gateway: Restart Proxy"
3. Check the Output panel for errors

## Privacy

This extension:
- Only communicates with your configured gateway
- Stores API keys securely in VS Code
- Runs the proxy locally on your machine
- Does not send data to third parties

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and contribution guidelines.

## License

MIT
