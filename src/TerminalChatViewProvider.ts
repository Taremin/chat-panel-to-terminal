import * as vscode from 'vscode';

export class TerminalChatViewProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'terminal-chat-view';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _context: vscode.ExtensionContext,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case 'sendToTerminal':
					{
						const config = vscode.workspace.getConfiguration('terminalChatPanel');
						const delay = config.get<number>('sendDelay') || 100;

						let terminal = vscode.window.terminals.find(t => t.name === data.terminalName);
						if (!terminal) {
							terminal = vscode.window.activeTerminal || vscode.window.terminals[0];
						}

						if (terminal) {
							if (data.autoEnter) {
								this._view?.webview.postMessage({ type: 'setBusy', value: true });
							}
							
							terminal.sendText(data.value, false);
							
							if (data.autoEnter) {
								await new Promise(resolve => setTimeout(resolve, delay));
								terminal.sendText('\x0a', false);
								this._view?.webview.postMessage({ type: 'setBusy', value: false });
							}
							
							await this._addChatLog(data.value);
						} else {
							vscode.window.showErrorMessage(`No active terminal found to send command.`);
						}
						break;
					}
				case 'updateButton':
					{
						const config = vscode.workspace.getConfiguration('terminalChatPanel');
						const buttons = config.get<any[]>('buttons') || [];
						const index = data.index;
						if (index >= 0 && index < buttons.length) {
							buttons[index] = {
								label: data.button.label,
								command: data.button.command,
								autoEnter: data.button.autoEnter
							};
							await config.update('buttons', buttons, vscode.ConfigurationTarget.Global);
							this._updateButtons();
						}
						break;
					}
				case 'updateButtonOrder':
					{
						const config = vscode.workspace.getConfiguration('terminalChatPanel');
						await config.update('buttons', data.buttons, vscode.ConfigurationTarget.Global);
						this._updateButtons();
						break;
					}
				case 'saveButton':
					{
						const config = vscode.workspace.getConfiguration('terminalChatPanel');
						const buttons = config.get<any[]>('buttons') || [];
						const newCommand = data.value.trim();
						
						// 重複チェック (トリミングした状態で比較)
						if (!buttons.some(b => b.command.trim() === newCommand)) {
							buttons.push({ label: newCommand, command: newCommand });
							await config.update('buttons', buttons, vscode.ConfigurationTarget.Global);
						}
						this._updateButtons();
						break;
					}
				case 'deleteButton':
					{
						const config = vscode.workspace.getConfiguration('terminalChatPanel');
						const buttons = config.get<any[]>('buttons') || [];
						const commandToDelete = data.value.trim();
						
						// 指定されたコマンドと一致しないものだけ残す (すべて削除されるが、そもそも重複を許さないので1つだけ消える動作になる)
						const newButtons = buttons.filter(b => b.command.trim() !== commandToDelete);
						
						await config.update('buttons', newButtons, vscode.ConfigurationTarget.Global);
						this._updateButtons();
						break;
					}
				case 'clearLog':
					{
						await this._context.globalState.update('terminalChatLog', []);
						this._updateChatLog();
						break;
					}
				case 'searchFiles':
					{
						const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 100);
						const filePaths = files.map(f => vscode.workspace.asRelativePath(f));
						this._view?.webview.postMessage({ type: 'fileSuggestions', files: filePaths });
						break;
					}
				case 'refreshTerminals':
					{
						this._updateTerminals();
						break;
					}
				case 'initialized':
					{
						// Webview側の初期化が完了したタイミングですべてのデータを送信する
						this._updateTerminals();
						this._updateButtons();
						this._updateChatLog();
						this._updateSendDelay();
						break;
					}
			}
		});

		// Listen for terminal changes
		vscode.window.onDidOpenTerminal(() => this._updateTerminals());
		vscode.window.onDidCloseTerminal(() => this._updateTerminals());
		vscode.window.onDidChangeActiveTerminal(() => this._updateTerminals());

		// Listen for config changes
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('terminalChatPanel.buttons')) {
				this._updateButtons();
			}
			if (e.affectsConfiguration('terminalChatPanel.sendDelay')) {
				this._updateSendDelay();
			}
		});

		// Initial data send
		this._updateTerminals();
		this._updateButtons();
		this._updateChatLog();
		this._updateSendDelay();
	}

	private async _addChatLog(message: string) {
		const log = this._context.globalState.get<string[]>('terminalChatLog') || [];
		log.push(message);
		// 直近の50件程度に制限
		if (log.length > 50) log.shift();
		await this._context.globalState.update('terminalChatLog', log);
		this._updateChatLog();
	}

	private _updateChatLog() {
		if (this._view) {
			const log = this._context.globalState.get<string[]>('terminalChatLog') || [];
			this._view.webview.postMessage({ type: 'updateChatLog', log });
		}
	}

	private _updateTerminals() {
		if (this._view) {
			const terminalNames = vscode.window.terminals.map(t => t.name);
			const activeTerminalName = vscode.window.activeTerminal?.name;
			this._view.webview.postMessage({ type: 'updateTerminals', terminals: terminalNames, active: activeTerminalName });
		}
	}

	private _updateButtons() {
		if (this._view) {
			const config = vscode.workspace.getConfiguration('terminalChatPanel');
			const buttons = config.get<any[]>('buttons') || [];
			this._view.webview.postMessage({ type: 'updateButtons', buttons });
		}
	}

	private _updateSendDelay() {
		if (this._view) {
			const config = vscode.workspace.getConfiguration('terminalChatPanel');
			const sendDelay = config.get<number>('sendDelay') || 100;
			this._view.webview.postMessage({ type: 'updateSendDelay', value: sendDelay });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css'));
		const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));

		return `<!DOCTYPE html>
			<html lang="ja">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleUri}" rel="stylesheet">
				<link href="${codiconsUri}" rel="stylesheet">
				<title>Terminal Chat</title>
			</head>
			<body>
				<div class="container">
					<div id="button-container" class="button-area">
						<!-- Persistent Buttons -->
					</div>
					<div class="divider"></div>
					<div id="chat-log-container" class="chat-log-area">
						<!-- Chat History -->
					</div>
					<div class="divider"></div>
					<div class="control-area">
						<div class="terminal-row">
							<select id="terminal-select">
								<option value="">ターミナルを選択...</option>
							</select>
							<button id="settings-toggle-btn" title="Settings" class="icon-button"><i class="codicon codicon-settings"></i></button>
							<button id="clear-log-btn" title="Clear History" class="icon-button"><i class="codicon codicon-trash"></i></button>
						</div>
						<div id="settings-panel" class="settings-panel" style="display: none;">
							<div class="settings-row">
								<label for="send-delay-input">Send Delay (ms):</label>
								<input type="number" id="send-delay-input" min="0" max="5000" step="50">
							</div>
						</div>
						<div class="input-container">
							<div id="suggestion-list"></div>
							<textarea id="chat-input" placeholder="コマンドを入力してEnterで送信..."></textarea>
						</div>
					</div>
				</div>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
