(function () {
	const vscode = acquireVsCodeApi();
	window.vscodeApi = vscode; // For E2E testing

	const chatInput = document.getElementById('chat-input');
	const terminalSelect = document.getElementById('terminal-select');
	const buttonContainer = document.getElementById('button-container');
	const chatLogContainer = document.getElementById('chat-log-container');
	const clearLogBtn = document.getElementById('clear-log-btn');
	const settingsToggleBtn = document.getElementById('settings-toggle-btn');
	const settingsPanel = document.getElementById('settings-panel');
	const sendDelayInput = document.getElementById('send-delay-input');
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

	// Setup Menu
	const menu = document.createElement('div');
	menu.className = 'dropdown-menu';
	document.body.appendChild(menu);

	let currentButtonIndex = -1;
	let currentButtonData = null;

	document.addEventListener('click', (e) => {
		if (!menu.contains(e.target)) {
			menu.style.display = 'none';
		}
	});

	function showMenu(e, index, buttonData) {
		e.stopPropagation();
		currentButtonIndex = index;
		currentButtonData = buttonData;

		menu.innerHTML = `
			<div class="menu-item" id="menu-toggle-auto-enter">
				<div class="menu-icon ${buttonData.autoEnter ? 'active' : ''}">
					<i class="codicon codicon-${buttonData.autoEnter ? 'pass-filled' : 'circle-outline'}"></i>
				</div>
				<span>Enter自動追加: ${buttonData.autoEnter ? 'ON' : 'OFF'}</span>
			</div>
			<div class="menu-item danger" id="menu-delete-button">
				<div class="menu-icon">
					<i class="codicon codicon-trash"></i>
				</div>
				<span>削除</span>
			</div>
		`;

		menu.style.display = 'block';
		
		// Position menu
		const rect = e.target.getBoundingClientRect();
		let top = rect.bottom + window.scrollY;
		let left = rect.left + window.scrollX;

		// Check screen bounds
		if (left + 150 > window.innerWidth) {
			left = window.innerWidth - 160;
		}
		if (top + 100 > window.innerHeight) {
			top = rect.top - menu.offsetHeight;
		}

		menu.style.top = `${top}px`;
		menu.style.left = `${left}px`;

		document.getElementById('menu-toggle-auto-enter').onclick = () => {
			const updated = { ...buttonData, autoEnter: !buttonData.autoEnter };
			vscode.postMessage({
				type: 'updateButton',
				index: index,
				button: updated
			});
			menu.style.display = 'none';
		};

		document.getElementById('menu-delete-button').onclick = () => {
			vscode.postMessage({
				type: 'deleteButton',
				value: buttonData.command
			});
			menu.style.display = 'none';
		};
	}

	// Drag and Drop
	let draggedItem = null;
	let draggedIndex = -1;

	function setupDragAndDrop(item, index) {
		item.draggable = true;
		item.addEventListener('dragstart', (e) => {
			draggedItem = item;
			draggedIndex = index;
			item.classList.add('dragging');
			e.dataTransfer.effectAllowed = 'move';
		});

		item.addEventListener('dragend', () => {
			item.classList.remove('dragging');
			const allItems = buttonContainer.querySelectorAll('.button-wrapper');
			allItems.forEach(i => i.classList.remove('drag-over'));
		});

		item.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'move';
			item.classList.add('drag-over');
		});

		item.addEventListener('dragleave', () => {
			item.classList.remove('drag-over');
		});

		item.addEventListener('drop', (e) => {
			e.preventDefault();
			if (draggedIndex !== index) {
				const buttons = Array.from(buttonContainer.querySelectorAll('.button-wrapper')).map(w => w._buttonData);
				const [removed] = buttons.splice(draggedIndex, 1);
				buttons.splice(index, 0, removed);
				
				vscode.postMessage({
					type: 'updateButtonOrder',
					buttons: buttons
				});
			}
		});
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
	
	settingsToggleBtn.addEventListener('click', () => {
		const isVisible = settingsPanel.style.display === 'block';
		settingsPanel.style.display = isVisible ? 'none' : 'block';
		settingsToggleBtn.classList.toggle('active', !isVisible);
	});
	
	sendDelayInput.addEventListener('change', () => {
		const value = parseInt(sendDelayInput.value, 10);
		if (!isNaN(value) && value >= 0) {
			vscode.postMessage({
				type: 'updateSendDelay',
				value: value
			});
		}
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
			case 'updateSendDelay':
				{
					sendDelayInput.value = message.value;
					break;
				}
			case 'updateButtons':
				{
					buttonContainer.innerHTML = '';
					message.buttons.forEach((btn, index) => {
						const wrapper = document.createElement('div');
						wrapper.className = 'button-wrapper';
						wrapper._buttonData = btn; // Store data for D&D

						const handle = document.createElement('div');
						handle.className = 'drag-handle';
						handle.innerHTML = '<i class="codicon codicon-gripper"></i>';
						wrapper.appendChild(handle);

						const button = document.createElement('button');
						button.className = 'saved-button';
						button.textContent = btn.label;
						button.title = btn.command + (btn.autoEnter ? ' (↵ auto)' : '');
						button.addEventListener('click', () => {
							const terminalName = terminalSelect.value;
							vscode.postMessage({
								type: 'sendToTerminal',
								value: btn.command,
								terminalName: terminalName,
								autoEnter: !!btn.autoEnter
							});
						});
						wrapper.appendChild(button);

						const settingsBtn = document.createElement('button');
						settingsBtn.className = 'settings-btn';
						settingsBtn.title = 'Settings';
						settingsBtn.innerHTML = '<i class="codicon codicon-settings"></i>';
						settingsBtn.addEventListener('click', (e) => showMenu(e, index, btn));
						wrapper.appendChild(settingsBtn);

						buttonContainer.appendChild(wrapper);
						setupDragAndDrop(wrapper, index);
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
			case 'setBusy':
				{
					const isBusy = message.value;
					chatInput.disabled = isBusy;
					terminalSelect.disabled = isBusy;
					clearLogBtn.disabled = isBusy;
					
					const allButtons = document.querySelectorAll('button');
					allButtons.forEach(btn => {
						btn.disabled = isBusy;
					});

					if (isBusy) {
						chatInput.placeholder = '送信中...';
					} else {
						chatInput.placeholder = 'コマンドを入力してEnterで送信...';
						chatInput.focus();
					}
					break;
				}
		}
	});

	vscode.postMessage({ type: 'refreshTerminals' });
	// Pre-fetch files
	vscode.postMessage({ type: 'searchFiles' });
}());
