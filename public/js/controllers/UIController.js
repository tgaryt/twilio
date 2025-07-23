import { PhoneFormatter } from '../utils/PhoneFormatter.js';

export class UIController {
	constructor() {
		this.currentUser = null;
	}

	initialize() {
		this.setupEventListeners();
		this.setupCustomEventListeners();
	}

	setupEventListeners() {
		document.getElementById('login-form').addEventListener('submit', (e) => {
			e.preventDefault();
			const clientName = document.getElementById('client-name').value.trim();
			
			if (!clientName) {
				this.showError('Please enter your client name');
				return;
			}

			document.dispatchEvent(new CustomEvent('auth:loginRequest', {
				detail: { clientName }
			}));
		});

		document.getElementById('logout-btn').addEventListener('click', () => {
			document.dispatchEvent(new CustomEvent('auth:logoutRequest'));
		});

		document.getElementById('enable-notifications-btn').addEventListener('click', () => {
			document.dispatchEvent(new CustomEvent('notification:requestPermission'));
		});

		document.getElementById('answer-btn').addEventListener('click', () => {
			document.dispatchEvent(new CustomEvent('call:answer', {
				detail: { call: window.currentCall }
			}));
		});

		document.getElementById('reject-btn').addEventListener('click', () => {
			document.dispatchEvent(new CustomEvent('call:reject', {
				detail: { call: window.currentCall }
			}));
		});

		document.getElementById('hangup-btn').addEventListener('click', () => {
			document.dispatchEvent(new CustomEvent('call:hangup', {
				detail: { call: window.currentCall }
			}));
		});

		document.getElementById('mute-btn').addEventListener('click', () => {
			document.dispatchEvent(new CustomEvent('call:mute', {
				detail: { callSid: window.currentCall?.parameters?.CallSid }
			}));
		});

		document.getElementById('keypad-toggle-btn').addEventListener('click', () => {
			const keypad = document.getElementById('dtmf-keypad');
			const toggleBtn = document.getElementById('keypad-toggle-btn');
			
			if (keypad.classList.contains('hidden')) {
				keypad.classList.remove('hidden');
				toggleBtn.innerHTML = '<span class="text-xl">&#128290;</span><span>Hide Keypad</span>';
			} else {
				keypad.classList.add('hidden');
				toggleBtn.innerHTML = '<span class="text-xl">&#128290;</span><span>Keypad</span>';
			}
		});

		document.addEventListener('click', (e) => {
			if (e.target.classList.contains('dtmf-key')) {
				const digit = e.target.dataset.digit;
				document.dispatchEvent(new CustomEvent('call:sendDTMF', {
					detail: { digit }
				}));
			}
		});
	}

	setupCustomEventListeners() {
		document.addEventListener('device:ready', () => {
			this.updateConnectionStatus(true);
		});

		document.addEventListener('device:error', (e) => {
			this.updateConnectionStatus(false);
			this.addActivity(`Device error: ${e.detail.error.message}`, 'error');
		});

		document.addEventListener('call:incoming', (e) => {
			this.showIncomingCall(e.detail);
			document.dispatchEvent(new CustomEvent('notification:incomingCall', {
				detail: { from: e.detail.from }
			}));
		});

		document.addEventListener('call:connected', () => {
			this.showActiveCall();
			document.dispatchEvent(new CustomEvent('notification:clear'));
		});

		document.addEventListener('call:disconnected', () => {
			this.hideCallInterface();
		});

		document.addEventListener('call:ended', (e) => {
			this.hideCallInterface();
			this.addActivity(`Call ended: ${e.detail.reason}`, 'info');
			document.dispatchEvent(new CustomEvent('notification:clear'));
		});

		document.addEventListener('call:timerUpdate', (e) => {
			this.updateCallTimer(e.detail.time);
		});

		document.addEventListener('call:muteChanged', (e) => {
			this.updateMuteButton(e.detail.isMuted);
		});

		document.addEventListener('socket:connected', () => {
			this.updateConnectionStatus(true);
		});

		document.addEventListener('socket:disconnected', () => {
			this.updateConnectionStatus(false);
		});

		document.addEventListener('socket:registered', () => {
			this.addActivity('Successfully registered for incoming calls', 'success');
		});

		document.addEventListener('socket:incomingCall', (e) => {
			this.addActivity(`Incoming call from ${PhoneFormatter.format(e.detail.from)}`, 'info');
			
			const mockCall = {
				parameters: {
					From: e.detail.from,
					CallSid: e.detail.callSid
				}
			};
			
			this.showIncomingCall({
				call: mockCall,
				from: e.detail.from,
				callSid: e.detail.callSid,
				direction: 'incoming'
			});
		});
	}

	showActivationScreen(user) {
		this.currentUser = user;
		
		document.getElementById('login-screen').classList.add('hidden');
		document.getElementById('app-screen').classList.add('hidden');
		document.getElementById('activation-screen').classList.remove('hidden');
		
		document.getElementById('activation-user-name').textContent = user.name;
		
		this.resetActivationButton();
		
		if (window.electronAPI && window.electronAPI.isElectron) {
			document.getElementById('notification-permission-section').classList.add('hidden');
		} else if ('Notification' in window && Notification.permission === 'default') {
			document.getElementById('notification-permission-section').classList.remove('hidden');
		}
	}

	resetActivationButton() {
		const activateBtn = document.getElementById('activate-dialer-btn');
		if (activateBtn) {
			activateBtn.disabled = false;
			activateBtn.innerHTML = `
				<span class="text-2xl mr-3">&#9658;</span>
				<span>Start EZ-AD Dialer</span>
			`;
		}
	}

	showApp(user) {
		this.currentUser = user;
		
		document.getElementById('login-screen').classList.add('hidden');
		document.getElementById('activation-screen').classList.add('hidden');
		document.getElementById('app-screen').classList.remove('hidden');
		
		document.getElementById('user-name').textContent = user.name;
		document.getElementById('user-number').textContent = PhoneFormatter.format(user.number);
		
		this.addActivity('EZ-AD Dialer activated successfully', 'success');
	}

	showLogin() {
		document.getElementById('app-screen').classList.add('hidden');
		document.getElementById('activation-screen').classList.add('hidden');
		document.getElementById('login-screen').classList.remove('hidden');
		
		document.getElementById('client-name').value = '';
		this.hideError();
		this.resetActivationButton();
	}

	showIncomingCall(callData) {
		window.currentCall = callData.call;
		
		document.getElementById('no-calls').classList.add('hidden');
		document.getElementById('call-interface').classList.remove('hidden');
		
		document.getElementById('call-interface-title').textContent = 'Incoming Call';
		document.getElementById('caller-number').textContent = PhoneFormatter.format(callData.from) || 'Unknown';
		
		const callActions = document.getElementById('call-actions');
		const activeControls = document.getElementById('active-call-controls');
		
		if (callActions && activeControls) {
			callActions.classList.remove('hidden');
			activeControls.classList.add('hidden');
		}

		this.addActivity(`Incoming call from ${PhoneFormatter.format(callData.from)}`, 'info');
	}

	showActiveCall() {
		const callActions = document.getElementById('call-actions');
		const activeControls = document.getElementById('active-call-controls');
		
		if (callActions && activeControls) {
			callActions.classList.add('hidden');
			activeControls.classList.remove('hidden');
		}
		
		this.addActivity('Call connected', 'success');
	}

	hideCallInterface() {
		document.getElementById('call-interface').classList.add('hidden');
		document.getElementById('no-calls').classList.remove('hidden');
		
		document.getElementById('call-actions').classList.remove('hidden');
		document.getElementById('active-call-controls').classList.add('hidden');
		document.getElementById('dtmf-keypad').classList.add('hidden');
		
		document.getElementById('call-duration').textContent = '00:00';
		
		const toggleBtn = document.getElementById('keypad-toggle-btn');
		toggleBtn.innerHTML = '<span class="text-xl">&#128290;</span><span>Keypad</span>';
		
		this.updateMuteButton(false);
		
		window.currentCall = null;
	}

	updateCallTimer(timeString) {
		document.getElementById('call-duration').textContent = timeString;
	}

	updateMuteButton(isMuted) {
		const muteBtn = document.getElementById('mute-btn');
		if (isMuted) {
			muteBtn.innerHTML = '<span class="text-xl">&#128263;</span><span>Unmute</span>';
			muteBtn.classList.remove('bg-white/15', 'hover:bg-white/25', 'border-white/40');
			muteBtn.classList.add('bg-red-500/30', 'hover:bg-red-500/40', 'border-red-500/40', 'text-red-200');
		} else {
			muteBtn.innerHTML = '<span class="text-xl">&#128263;</span><span>Mute</span>';
			muteBtn.classList.remove('bg-red-500/30', 'hover:bg-red-500/40', 'border-red-500/40', 'text-red-200');
			muteBtn.classList.add('bg-white/15', 'hover:bg-white/25', 'border-white/40', 'text-white');
		}
	}

	updateConnectionStatus(connected) {
		const indicator = document.getElementById('status-indicator');
		const text = document.getElementById('status-text');
		
		if (connected) {
			indicator.classList.remove('bg-gray-400', 'bg-red-400', 'animate-pulse');
			indicator.classList.add('bg-green-400');
			text.textContent = 'Connected';
		} else {
			indicator.classList.remove('bg-green-400');
			indicator.classList.add('bg-red-400', 'animate-pulse');
			text.textContent = 'Disconnected';
		}
	}

	showLoading(show = true) {
		document.getElementById('loading-overlay').classList.toggle('hidden', !show);
	}

	showError(message) {
		const errorDiv = document.getElementById('login-error');
		errorDiv.textContent = message;
		errorDiv.classList.remove('hidden');
	}

	hideError() {
		document.getElementById('login-error').classList.add('hidden');
	}

	updateCallHistory(callHistory) {
		const historyContainer = document.getElementById('call-history-list');
		
		if (!callHistory || callHistory.length === 0) {
			historyContainer.innerHTML = `
				<div class="flex items-center justify-center py-8 text-white/60">
					<div class="text-center">
						<div class="text-3xl mb-2">&#128222;</div>
						<div class="text-sm">No call history</div>
					</div>
				</div>
			`;
			return;
		}

		historyContainer.innerHTML = '';
		
		callHistory.forEach(call => {
			const callItem = this.createCallHistoryItem(call);
			historyContainer.appendChild(callItem);
		});
	}

	createCallHistoryItem(call) {
		const callDiv = document.createElement('div');
		callDiv.className = 'bg-white/10 border border-white/20 rounded-lg p-4 transition-all hover:bg-white/15';
		
		let statusColor = 'text-gray-300';
		let statusText = call.status;
		let statusIcon = '&#128222;';
		
		switch (call.status) {
			case 'completed':
				statusColor = 'text-green-300';
				statusText = 'Completed';
				statusIcon = '&#9989;';
				break;
			case 'failed':
				statusColor = 'text-red-300';
				statusText = 'Failed';
				statusIcon = '&#10060;';
				break;
			case 'busy':
				statusColor = 'text-yellow-300';
				statusText = 'Busy';
				statusIcon = '&#128245;';
				break;
			case 'no-answer':
				statusColor = 'text-orange-300';
				statusText = 'No Answer';
				statusIcon = '&#128222;';
				break;
			case 'canceled':
				statusColor = 'text-gray-300';
				statusText = 'Canceled';
				statusIcon = '&#128683;';
				break;
		}
		
		const directionIcon = call.direction === 'inbound' ? '&#8595;' : '&#8593;';
		const directionText = call.direction === 'inbound' ? 'Incoming' : 'Outgoing';
		const phoneNumber = call.direction === 'inbound' ? call.from : call.to;
		
		const duration = call.duration ? this.formatDuration(call.duration) : '0:00';
		const callTime = new Date(call.startTime).toLocaleString();
		
		callDiv.innerHTML = `
			<div class="flex items-start justify-between">
				<div class="flex items-start space-x-3 flex-1">
					<div class="flex-shrink-0">
						<span class="text-lg">${directionIcon}</span>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center space-x-2 mb-1">
							<span class="text-white/90 text-sm font-medium">${directionText}</span>
							<span class="${statusColor} text-xs">${statusIcon} ${statusText}</span>
						</div>
						<div class="text-white/80 text-sm font-medium mb-1">
							${PhoneFormatter.format(phoneNumber)}
						</div>
						<div class="text-white/60 text-xs">
							${callTime}
						</div>
					</div>
				</div>
				<div class="flex-shrink-0 text-right">
					<div class="text-white/80 text-sm font-medium">${duration}</div>
				</div>
			</div>
		`;
		
		return callDiv;
	}

	formatDuration(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	addActivity(message, type = 'info') {
		const activityLog = document.getElementById('activity-log');
		const timestamp = new Date().toLocaleTimeString();
		
		const noActivityElement = activityLog.querySelector('.text-center');
		if (noActivityElement) {
			noActivityElement.remove();
		}
		
		const activityItem = document.createElement('div');
		activityItem.className = 'bg-white/10 border border-white/20 rounded-lg p-4 transition-all hover:bg-white/15';
		
		let iconColor = 'text-blue-300';
		let icon = '&#8505;';
		let bgColor = 'bg-blue-500/20';
		let borderColor = 'border-blue-500/30';
		
		switch (type) {
			case 'success':
				iconColor = 'text-green-300';
				icon = '&#9989;';
				bgColor = 'bg-green-500/20';
				borderColor = 'border-green-500/30';
				break;
			case 'error':
				iconColor = 'text-red-300';
				icon = '&#10060;';
				bgColor = 'bg-red-500/20';
				borderColor = 'border-red-500/30';
				break;
			case 'warning':
				iconColor = 'text-yellow-300';
				icon = '&#9888;';
				bgColor = 'bg-yellow-500/20';
				borderColor = 'border-yellow-500/30';
				break;
		}
		
		activityItem.classList.add(bgColor, borderColor);
		
		activityItem.innerHTML = `
			<div class="flex items-start space-x-3">
				<div class="flex-shrink-0">
					<span class="${iconColor} text-lg">${icon}</span>
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-white/90 text-sm font-medium">${message}</div>
					<div class="text-white/60 text-xs mt-1">${timestamp}</div>
				</div>
			</div>
		`;
		
		activityLog.insertBefore(activityItem, activityLog.firstChild);
		
		while (activityLog.children.length > 10) {
			activityLog.removeChild(activityLog.lastChild);
		}
	}
}
