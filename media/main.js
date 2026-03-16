(function () {
	const vscode = acquireVsCodeApi();
	window.vscodeApi = vscode; // For E2E testing

	const chatInput = document.getElementById('chat-input');
	const terminalSelect = document.getElementById('terminal-select');
	const buttonContainer = document.getElementById('button-container');
	const chatLogContainer = document.getElementById('chat-log-container');
	const clearLogBtn = document.getElementById('clear-log-btn');
	const suggestionList = document.getElementById('suggestion-list');

	let allFiles = [];
	let filteredFiles = [];
	let selectedIndex = -1;
	let atSymbolIndex = -1;

	chatInput.addEventListener('keydown', (e) => {
		if (suggestionList.style.display === 'block') {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedIndex = (selectedIndex + 1) % filteredFiles.length;
				updateSelection();
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedIndex = (selectedIndex - 1 + filteredFiles.length) % filteredFiles.length;
				updateSelection();
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				if (selectedIndex >= 0) {
					selectSuggestion(filteredFiles[selectedIndex]);
				}
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				hideSuggestions();
				return;
			}
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const value = chatInput.value.trim();
			if (value) {
				const terminalName = terminalSelect.value;
				vscode.postMessage({
					type: 'sendToTerminal',
					value: value,
					terminalName: terminalName
				});
				chatInput.value = '';
				hideSuggestions();
			}
		}
	});

	chatInput.addEventListener('input', (e) => {
		const value = chatInput.value;
		const cursorIndex = chatInput.selectionStart;
		const textBeforeCursor = value.substring(0, cursorIndex);
		
		const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
		
		if (atMatch) {
			atSymbolIndex = atMatch.index;
			const query = atMatch[1].toLowerCase();
			
			if (allFiles.length === 0) {
				vscode.postMessage({ type: 'searchFiles' });
			}
			
			filteredFiles = allFiles.filter(f => f.toLowerCase().includes(query)).slice(0, 20);
			
			if (filteredFiles.length > 0) {
				showSuggestions(filteredFiles);
			} else {
				hideSuggestions();
			}
		} else {
			hideSuggestions();
		}
	});

	function showSuggestions(files) {
		suggestionList.innerHTML = '';
		files.forEach((file, index) => {
			const item = document.createElement('div');
			item.className = 'suggestion-item';
			item.textContent = file;
			item.addEventListener('click', () => selectSuggestion(file));
			suggestionList.appendChild(item);
		});
		suggestionList.style.display = 'block';
		selectedIndex = 0;
		updateSelection();
	}

	function hideSuggestions() {
		suggestionList.style.display = 'none';
		selectedIndex = -1;
	}

	function updateSelection() {
		const items = suggestionList.getElementsByClassName('suggestion-item');
		for (let i = 0; i < items.length; i++) {
			items[i].classList.toggle('selected', i === selectedIndex);
			if (i === selectedIndex) {
				items[i].scrollIntoView({ block: 'nearest' });
			}
		}
	}

	function selectSuggestion(file) {
		const value = chatInput.value;
		const beforeAt = value.substring(0, atSymbolIndex);
		const afterCursor = value.substring(chatInput.selectionStart);
		
		const replacement = '@' + file;
		chatInput.value = beforeAt + replacement + afterCursor;
		chatInput.focus();
		const newCursorPos = atSymbolIndex + replacement.length;
		chatInput.setSelectionRange(newCursorPos, newCursorPos);
		
		hideSuggestions();
	}

	clearLogBtn.addEventListener('click', () => {
		vscode.postMessage({ type: 'clearLog' });
	});

	window.addEventListener('message', event => {
		const message = event.data;
		console.log('Webview received message:', message.type);
		switch (message.type) {
			case 'updateTerminals':
				{
					const currentVal = terminalSelect.value;
					terminalSelect.innerHTML = '<option value="">ターミナルを選択...</option>';
					message.terminals.forEach(name => {
						const option = document.createElement('option');
						option.value = name;
						option.text = name;
						if (name === message.active || name === currentVal) {
							option.selected = true;
						}
						terminalSelect.appendChild(option);
					});
					break;
				}
			case 'updateButtons':
				{
					buttonContainer.innerHTML = '';
					message.buttons.forEach(btn => {
						const wrapper = document.createElement('div');
						wrapper.className = 'button-wrapper';

						const button = document.createElement('button');
						button.className = 'saved-button';
						button.textContent = btn.label;
						button.title = btn.command;
						button.addEventListener('click', () => {
							const terminalName = terminalSelect.value;
							vscode.postMessage({
								type: 'sendToTerminal',
								value: btn.command,
								terminalName: terminalName
							});
						});

						const deleteBtn = document.createElement('button');
						deleteBtn.className = 'delete-btn';
						deleteBtn.title = 'Delete Button';
						deleteBtn.innerHTML = '<i class="codicon codicon-close"></i>';
						deleteBtn.addEventListener('click', (e) => {
							e.stopPropagation();
							vscode.postMessage({
								type: 'deleteButton',
								value: btn.command
							});
						});

						wrapper.appendChild(button);
						wrapper.appendChild(deleteBtn);
						buttonContainer.appendChild(wrapper);
					});
					break;
				}
			case 'updateChatLog':
				{
					chatLogContainer.innerHTML = '';
					message.log.forEach(text => {
						const entry = document.createElement('div');
						entry.className = 'chat-entry';

						const textSpan = document.createElement('span');
						textSpan.className = 'chat-text';
						textSpan.textContent = text;
						textSpan.addEventListener('click', () => {
							chatInput.value = text;
							chatInput.focus();
						});

						const saveBtn = document.createElement('button');
						saveBtn.className = 'icon-button';
						saveBtn.title = 'Save as Button';
						saveBtn.innerHTML = '<i class="codicon codicon-save"></i>';
						saveBtn.addEventListener('click', () => {
							vscode.postMessage({
								type: 'saveButton',
								value: text
							});
						});

						entry.appendChild(textSpan);
						entry.appendChild(saveBtn);
						chatLogContainer.appendChild(entry);
					});
					chatLogContainer.scrollTop = chatLogContainer.scrollHeight;
					break;
				}
			case 'fileSuggestions':
				{
					allFiles = message.files;
					// Re-trigger filtering with current input
					chatInput.dispatchEvent(new Event('input'));
					break;
				}
		}
	});

	vscode.postMessage({ type: 'refreshTerminals' });
	// Pre-fetch files
	vscode.postMessage({ type: 'searchFiles' });
}());
