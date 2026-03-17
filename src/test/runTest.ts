import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
	// Ensure Code.exe doesn't run as Node.js by removing the environment variable
	delete process.env.ELECTRON_RUN_AS_NODE;
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './suite/index');

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath
		});
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();
