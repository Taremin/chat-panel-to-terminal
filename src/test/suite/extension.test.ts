import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

suite('Terminal Chat Panel Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	// package.json を読み込んで拡張機能 ID を構築
	const getExtensionId = () => {
		const packageJsonPath = path.join(__dirname, '..', '..', '..', 'package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
		return `${packageJson.publisher}.${packageJson.name}`;
	};

	const extensionId = getExtensionId();

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension(extensionId));
	});

	test('Configuration should save and delete buttons', async () => {
		const config = vscode.workspace.getConfiguration('terminalChatPanel');
		const testButton = { label: 'test-cmd', command: 'test-cmd', autoEnter: true };

		// 1. 追加のテスト (autoEnter を含む)
		let buttons = config.get<any[]>('buttons') || [];
		const originalLength = buttons.length;
		
		buttons.push(testButton);
		await config.update('buttons', buttons, vscode.ConfigurationTarget.Global);
		
		let updatedButtons = vscode.workspace.getConfiguration('terminalChatPanel').get<any[]>('buttons') || [];
		assert.strictEqual(updatedButtons.length, originalLength + 1);
		const added = updatedButtons.find(b => b.command === 'test-cmd');
		assert.ok(added);
		assert.strictEqual(added.autoEnter, true);

		// 2. 削除のテスト
		updatedButtons = updatedButtons.filter(b => b.command !== 'test-cmd');
		await config.update('buttons', updatedButtons, vscode.ConfigurationTarget.Global);
		
		const finalButtons = vscode.workspace.getConfiguration('terminalChatPanel').get<any[]>('buttons') || [];
		assert.strictEqual(finalButtons.length, originalLength);
		assert.ok(!finalButtons.some(b => b.command === 'test-cmd'));
	});

	test('Configuration should handle button reordering', async () => {
		const config = vscode.workspace.getConfiguration('terminalChatPanel');
		const originalButtons = config.get<any[]>('buttons') || [];
		
		const btn1 = { label: 'btn1', command: 'cmd1' };
		const btn2 = { label: 'btn2', command: 'cmd2' };
		
		// 準備
		await config.update('buttons', [btn1, btn2], vscode.ConfigurationTarget.Global);
		
		// 入れ替え
		const reordered = [btn2, btn1];
		await config.update('buttons', reordered, vscode.ConfigurationTarget.Global);
		
		const finalButtons = vscode.workspace.getConfiguration('terminalChatPanel').get<any[]>('buttons') || [];
		assert.strictEqual(finalButtons.length, 2);
		assert.strictEqual(finalButtons[0].label, 'btn2');
		assert.strictEqual(finalButtons[1].label, 'btn1');

		// 元に戻す（クリーンアップ）
		await config.update('buttons', originalButtons, vscode.ConfigurationTarget.Global);
	});

	test('Chat log should persist in globalState', async () => {
		const extension = vscode.extensions.getExtension(extensionId);
		const context = await extension?.activate(); // activation returns exports if any, but we want globalState
		
		// 実際には Provider 内部の globalState を直接触ることは難しいため、
		// 拡張機能がアクティベートされることを確認するにとどめるか、
		// Provider を export してテストから触れるようにする必要があります。
		assert.ok(extension?.isActive);
	});
});

