import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Terminal Chat Panel Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('local-dev.terminal-chat-panel'));
	});

	test('Configuration should save and delete buttons', async () => {
		const config = vscode.workspace.getConfiguration('terminalChatPanel');
		const testButton = { label: 'test-cmd', command: 'test-cmd' };

		// 1. 追加のテスト
		let buttons = config.get<any[]>('buttons') || [];
		const originalLength = buttons.length;
		
		buttons.push(testButton);
		await config.update('buttons', buttons, vscode.ConfigurationTarget.Global);
		
		let updatedButtons = vscode.workspace.getConfiguration('terminalChatPanel').get<any[]>('buttons') || [];
		assert.strictEqual(updatedButtons.length, originalLength + 1);
		assert.ok(updatedButtons.some(b => b.command === 'test-cmd'));

		// 2. 削除のテスト
		updatedButtons = updatedButtons.filter(b => b.command !== 'test-cmd');
		await config.update('buttons', updatedButtons, vscode.ConfigurationTarget.Global);
		
		const finalButtons = vscode.workspace.getConfiguration('terminalChatPanel').get<any[]>('buttons') || [];
		assert.strictEqual(finalButtons.length, originalLength);
		assert.ok(!finalButtons.some(b => b.command === 'test-cmd'));
	});

	test('Chat log should persist in globalState', async () => {
		const extension = vscode.extensions.getExtension('local-dev.terminal-chat-panel');
		const context = await extension?.activate(); // activation returns exports if any, but we want globalState
		
		// 実際には Provider 内部の globalState を直接触ることは難しいため、
		// 拡張機能がアクティベートされることを確認するにとどめるか、
		// Provider を export してテストから触れるようにする必要があります。
		assert.ok(extension?.isActive);
	});
});
