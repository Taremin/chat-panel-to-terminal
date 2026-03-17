import * as vscode from 'vscode';
import { TerminalChatViewProvider } from './TerminalChatViewProvider';

export function activate(context: vscode.ExtensionContext) {
	const provider = new TerminalChatViewProvider(context.extensionUri, context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(TerminalChatViewProvider.viewType, provider, {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);
}

export function deactivate() {}
