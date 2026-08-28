import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

interface ModelInfo {
  id: string;
  name: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  toolCalling: boolean;
  vision: boolean;
}

interface GatewayModel {
  id: string;
  name?: string;
  context_length?: number;
  max_tokens?: number;
  supports_function_calling?: boolean;
  supports_vision?: boolean;
}

let proxyProcess: ChildProcess | null = null;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('LLM Gateway');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'llmGateway.showStatus';
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('llmGateway.refreshModels', () => refreshModels(context)),
    vscode.commands.registerCommand('llmGateway.restart', () => restartProxy(context)),
    vscode.commands.registerCommand('llmGateway.showStatus', showStatus)
  );

  // Check if litellm is installed
  const litellmInstalled = await checkLiteLLMInstalled();
  if (!litellmInstalled) {
    const result = await vscode.window.showWarningMessage(
      'litellm is not installed. Install it now?',
      'Install',
      'Later'
    );
    if (result === 'Install') {
      await installLiteLLM();
    } else {
      updateStatusBar('error', 'litellm not installed');
      return;
    }
  }

  // Start the proxy and configure models
  await startProxy(context);
}

export function deactivate() {
  if (proxyProcess) {
    proxyProcess.kill();
    proxyProcess = null;
  }
  statusBarItem?.dispose();
  outputChannel?.dispose();
}

async function checkLiteLLMInstalled(): Promise<boolean> {
  const litellmPath = await findLiteLLMPath();
  return litellmPath !== null;
}

async function findLiteLLMPath(): Promise<string | null> {
  // Check user-configured path first
  const config = vscode.workspace.getConfiguration('llmGateway');
  const customPath = config.get<string>('litellmPath');
  if (customPath) {
    try {
      await execAsync(`"${customPath}" --version`);
      outputChannel.appendLine(`Using custom litellm path: ${customPath}`);
      return customPath;
    } catch {
      outputChannel.appendLine(`Custom litellm path not working: ${customPath}`);
    }
  }

  // Try PATH first
  try {
    await execAsync('litellm --version');
    outputChannel.appendLine('Found litellm in PATH');
    return 'litellm';
  } catch {}

  // Try common installation locations
  const commonPaths = [
    '/usr/local/bin/litellm',
    `${process.env.HOME}/.local/bin/litellm`,
    '/opt/homebrew/bin/litellm',
    '/usr/bin/litellm'
  ];

  for (const path of commonPaths) {
    try {
      await execAsync(`"${path}" --version`);
      outputChannel.appendLine(`Found litellm at: ${path}`);
      return path;
    } catch {}
  }

  // Try Python user install directories (version-agnostic)
  if (process.platform === 'darwin') {
    // macOS - check all Python versions
    const pythonVersions = ['3.9', '3.10', '3.11', '3.12', '3.13'];
    for (const ver of pythonVersions) {
      const path = `${process.env.HOME}/Library/Python/${ver}/bin/litellm`;
      try {
        await execAsync(`"${path}" --version`);
        outputChannel.appendLine(`Found litellm at: ${path}`);
        return path;
      } catch {}
    }
  }

  // Try using Python to find it
  try {
    const { stdout } = await execAsync('python3 -c "import litellm; import os; print(os.path.join(os.path.dirname(litellm.__file__), \'../../../bin/litellm\'))"');
    const path = stdout.trim();
    try {
      await execAsync(`"${path}" --version`);
      outputChannel.appendLine(`Found litellm via Python: ${path}`);
      return path;
    } catch {}
  } catch {}

  // Last resort: try running as Python module
  try {
    await execAsync('python3 -c "import litellm"');
    outputChannel.appendLine('Will use litellm as Python module');
    return 'python3 -m litellm.proxy.cli';
  } catch {}

  outputChannel.appendLine('litellm not found in any common location');
  return null;
}

async function installLiteLLM() {
  outputChannel.show();
  outputChannel.appendLine('Installing litellm...');
  updateStatusBar('loading', 'Installing litellm...');

  try {
    await execAsync('pip3 install --user litellm[proxy]');
    outputChannel.appendLine('litellm installed successfully');
    vscode.window.showInformationMessage('litellm installed successfully. Reload VS Code to continue.');
  } catch (error) {
    outputChannel.appendLine(`Failed to install litellm: ${error}`);
    vscode.window.showErrorMessage('Failed to install litellm. Install manually with: pip3 install --user litellm[proxy]');
  }
}

async function startProxy(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('llmGateway');
  const gatewayUrl = config.get<string>('url');
  const apiKey = config.get<string>('apiKey');
  const proxyPort = config.get<number>('proxyPort', 8000);

  if (!gatewayUrl) {
    updateStatusBar('warning', 'Configure gateway URL');
    vscode.window.showWarningMessage(
      'LLM Gateway: Please configure your gateway URL in settings',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'llmGateway.url');
      }
    });
    return;
  }

  if (!apiKey) {
    updateStatusBar('warning', 'Configure API key');
    vscode.window.showWarningMessage(
      'LLM Gateway: Please configure your API key in settings',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'llmGateway.apiKey');
      }
    });
    return;
  }

  try {
    // Fetch models from gateway
    updateStatusBar('loading', 'Fetching models...');
    const models = await fetchModelsFromGateway(gatewayUrl, apiKey);

    if (models.length === 0) {
      throw new Error('No models available from gateway');
    }

    // Generate litellm config
    const configPath = path.join(context.globalStorageUri.fsPath, 'config.yaml');
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await generateLiteLLMConfig(configPath, gatewayUrl, apiKey, models);

    // Start litellm proxy
    outputChannel.appendLine(`Starting litellm proxy on port ${proxyPort}...`);
    updateStatusBar('loading', 'Starting proxy...');

    // Find litellm executable
    const litellmPath = await findLiteLLMPath();
    if (!litellmPath) {
      throw new Error('litellm executable not found. Configure path in settings or install with: pip3 install --user litellm[proxy]');
    }

    outputChannel.appendLine(`Starting proxy with: ${litellmPath}`);

    // Handle Python module execution differently
    if (litellmPath.includes('python')) {
      const [pythonCmd, ...moduleArgs] = litellmPath.split(' ');
      proxyProcess = spawn(pythonCmd, [
        ...moduleArgs,
        '--config', configPath,
        '--port', proxyPort.toString(),
        '--detailed_debug'
      ]);
    } else {
      proxyProcess = spawn(litellmPath, [
        '--config', configPath,
        '--port', proxyPort.toString(),
        '--detailed_debug'
      ]);
    }

    let proxyReady = false;

    proxyProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      outputChannel.appendLine(`[proxy] ${output}`);

      outputChannel.appendLine(`[DEBUG] stdout check: proxyReady=${proxyReady}, includes('Uvicorn')=${output.includes('Uvicorn running')}`);

      if (!proxyReady && output.includes('Uvicorn running')) {
        proxyReady = true;
        outputChannel.appendLine('[DEBUG] CALLING onProxyReady from STDOUT');
        onProxyReady(context, models);
      }
    });

    proxyProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      outputChannel.appendLine(`[proxy] ${output}`);

      const hasUvicorn = output.includes('Uvicorn running');
      const hasStartup = output.includes('Application startup complete');
      outputChannel.appendLine(`[DEBUG] stderr check: proxyReady=${proxyReady}, hasUvicorn=${hasUvicorn}, hasStartup=${hasStartup}`);

      // litellm logs startup messages to stderr
      if (!proxyReady && (hasUvicorn || hasStartup)) {
        proxyReady = true;
        outputChannel.appendLine('[DEBUG] CALLING onProxyReady from STDERR');
        onProxyReady(context, models);
      }
    });

    proxyProcess.on('error', (error) => {
      outputChannel.appendLine(`Failed to start proxy: ${error.message}`);
      updateStatusBar('error', 'Proxy failed');
      vscode.window.showErrorMessage(`LLM Gateway: Failed to start proxy - ${error.message}`);
    });

    proxyProcess.on('exit', (code) => {
      outputChannel.appendLine(`Proxy exited with code ${code}`);
      if (code !== 0 && code !== null) {
        updateStatusBar('error', 'Proxy stopped');
      }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`Error starting proxy: ${message}`);
    updateStatusBar('error', 'Setup failed');
    vscode.window.showErrorMessage(`LLM Gateway: ${message}`);
  }
}

async function fetchModelsFromGateway(gatewayUrl: string, apiKey: string): Promise<GatewayModel[]> {
  try {
    const response = await axios.get(`${gatewayUrl}/v1/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000
    });

    if (response.data?.data) {
      return response.data.data;
    }
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch models: ${message}`);
  }
}

async function generateLiteLLMConfig(
  configPath: string,
  gatewayUrl: string,
  apiKey: string,
  models: GatewayModel[]
): Promise<void> {
  const config = vscode.workspace.getConfiguration('llmGateway');
  const dropParams = config.get<string[]>('dropParams', ['temperature', 'top_p']);

  const modelList = models.map(model => ({
    model_name: model.id,
    litellm_params: {
      model: `openai/${model.id}`,
      api_base: gatewayUrl,
      api_key: apiKey,
      drop_params: true,
      additional_drop_params: dropParams
    }
  }));

  const yamlConfig = `model_list:
${modelList.map(m => `  - model_name: ${m.model_name}
    litellm_params:
      model: ${m.litellm_params.model}
      api_base: "${m.litellm_params.api_base}"
      api_key: "${m.litellm_params.api_key}"
      drop_params: ${m.litellm_params.drop_params}
      additional_drop_params: ${JSON.stringify(m.litellm_params.additional_drop_params)}
`).join('\n')}

litellm_settings:
  drop_params: true
  additional_drop_params: [
    "temperature", "top_p", "intent", "copilot_thread_id", "copilot_request_id",
    "n", "stop", "model_max_tokens", "best_of", "logit_bias", "user", "seed",
    "presence_penalty", "frequency_penalty", "response_format"
  ]
  num_retries: 2
  timeout: 60
`;

  await fs.promises.writeFile(configPath, yamlConfig, 'utf-8');
  outputChannel.appendLine(`Generated config at ${configPath}`);
}

async function onProxyReady(context: vscode.ExtensionContext, models: GatewayModel[]) {
  outputChannel.appendLine('=== PROXY IS READY ===');
  outputChannel.appendLine(`Model count: ${models.length}`);

  try {
    // Register models with VS Code
    await registerChatModels(context, models);
    outputChannel.appendLine('Models registered successfully');

    const modelCount = models.length;
    updateStatusBar('ready', `${modelCount} models ready`);
    vscode.window.showInformationMessage(`LLM Gateway: Connected with ${modelCount} models`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`ERROR in onProxyReady: ${message}`);
    updateStatusBar('error', 'Failed to register models');
  }
}

async function registerChatModels(context: vscode.ExtensionContext, models: GatewayModel[]) {
  const config = vscode.workspace.getConfiguration('llmGateway');
  const proxyPort = config.get<number>('proxyPort', 8000);
  const proxyUrl = `http://127.0.0.1:${proxyPort}`;

  const chatModelsPath = getChatModelsPath();
  outputChannel.appendLine(`Chat models path: ${chatModelsPath}`);

  const modelConfigs: ModelInfo[] = models.map(model => {
    // Bedrock models have 64-char limit on tool names - disable tools for them
    const isBedrockModel = model.id.includes('bedrock') || model.id.includes('amazon');

    return {
      id: model.id,
      name: model.name || model.id,
      maxInputTokens: model.context_length || 128000,
      maxOutputTokens: model.max_tokens || 16384,
      toolCalling: !isBedrockModel && model.supports_function_calling !== false,
      vision: model.supports_vision !== false
    };
  });

  outputChannel.appendLine(`Mapped ${modelConfigs.length} model configs`);

  const chatConfig = [{
    name: "LLM Gateway",
    vendor: "customendpoint",
    apiKey: "${input:chat.lm.secret.llmgateway}",
    apiType: "chat-completions",
    models: modelConfigs.map(m => ({
      id: m.id,
      url: proxyUrl,
      toolCalling: m.toolCalling,
      vision: m.vision,
      name: m.name,
      maxInputTokens: m.maxInputTokens,
      maxOutputTokens: m.maxOutputTokens
    }))
  }];

  try {
    outputChannel.appendLine(`Creating directory: ${path.dirname(chatModelsPath)}`);
    await fs.promises.mkdir(path.dirname(chatModelsPath), { recursive: true });

    outputChannel.appendLine(`Writing config to: ${chatModelsPath}`);
    await fs.promises.writeFile(chatModelsPath, JSON.stringify(chatConfig, null, 2), 'utf-8');

    outputChannel.appendLine(`✓ Successfully registered ${modelConfigs.length} models with VS Code Chat`);
    outputChannel.appendLine(`✓ Config written to: ${chatModelsPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`✗ Failed to register models: ${message}`);
    throw error;
  }
}

function getChatModelsPath(): string {
  const platform = process.platform;
  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'chatLanguageModels.json');
  } else if (platform === 'win32') {
    return path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'chatLanguageModels.json');
  } else {
    return path.join(home, '.config', 'Code', 'User', 'chatLanguageModels.json');
  }
}

async function refreshModels(context: vscode.ExtensionContext) {
  outputChannel.show();
  outputChannel.appendLine('Refreshing models...');

  // Stop existing proxy
  if (proxyProcess) {
    proxyProcess.kill();
    proxyProcess = null;
  }

  // Restart
  await startProxy(context);
}

async function restartProxy(context: vscode.ExtensionContext) {
  outputChannel.show();
  outputChannel.appendLine('Restarting proxy...');

  if (proxyProcess) {
    proxyProcess.kill();
    proxyProcess = null;
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  await startProxy(context);
}

function showStatus() {
  outputChannel.show();
}

function updateStatusBar(state: 'ready' | 'loading' | 'error' | 'warning', text: string) {
  const icons = {
    ready: '$(check)',
    loading: '$(sync~spin)',
    error: '$(error)',
    warning: '$(warning)'
  };

  statusBarItem.text = `${icons[state]} LLM Gateway: ${text}`;
  statusBarItem.show();
}
