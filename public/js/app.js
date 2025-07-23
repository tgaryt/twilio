import { AuthController } from './controllers/AuthController.js';
import { CallController } from './controllers/CallController.js';
import { SocketController } from './controllers/SocketController.js';
import { UIController } from './controllers/UIController.js';
import { SignalController } from './controllers/SignalController.js';
import { NotificationService } from './services/NotificationService.js';

class TwilioClientApp {
	constructor() {
		this.authController = new AuthController();
		this.callController = new CallController();
		this.socketController = new SocketController();
		this.uiController = new UIController();
		this.signalController = new SignalController();
		this.notificationService = new NotificationService();
		
		this.currentUser = null;
		this.isInitialized = false;
		this.isActivated = false;
		this.healthMonitorInterval = null;
		this.tokenRefreshTimeout = null;
		this.deviceRefreshInterval = null;
		this.deferredOperations = [];
		this.lastTokenTime = null;
		this.isActivating = false;
		
		this.initialize();
	}

	async initialize() {
		try {
			this.uiController.initialize();
			this.signalController.initialize();
			this.setupEventHandlers();
			this.setupActivationHandler();
			this.isInitialized = true;
			
			await this.checkForURLLogin();
			
		} catch (error) {
			console.error('Failed to initialize TwilioClientApp:', error);
		}
	}

	setupActivationHandler() {
		document.getElementById('activate-dialer-btn').addEventListener('click', async () => {
			if (!this.isActivating) {
				await this.activateDialer();
			}
		});
	}

	async activateDialer() {
		if (this.isActivating) {
			return;
		}

		this.isActivating = true;
		
		try {
			const activateBtn = document.getElementById('activate-dialer-btn');
			activateBtn.disabled = true;
			activateBtn.innerHTML = `
				<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
				<span>Activating...</span>
			`;

			await this.performCompleteCleanup();

			await this.callController.initializeTwilioDevice(this.currentUser.token);
			this.signalController.setDevice(this.callController.device);
			
			await this.socketController.connect(this.currentUser.name);
			
			const historyResult = await this.authController.getCallHistory(this.currentUser.name, 5);
			if (historyResult.success) {
				this.uiController.updateCallHistory(historyResult.callHistory);
			}
			
			this.lastTokenTime = Date.now();
			this.isActivated = true;
			this.startHealthMonitoring();
			this.uiController.showApp(this.currentUser);
			
		} catch (error) {
			console.error('Dialer activation failed:', error);
			this.uiController.showError('Failed to activate dialer. Please try again.');
			
			const activateBtn = document.getElementById('activate-dialer-btn');
			activateBtn.disabled = false;
			activateBtn.innerHTML = `
				<span class="text-2xl mr-3">&#9658;</span>
				<span>Start EZ-AD Dialer</span>
			`;
		} finally {
			this.isActivating = false;
		}
	}

	async performCompleteCleanup() {
		try {
			this.stopHealthMonitoring();
			
			if (this.callController && this.callController.device) {
				await this.callController.cleanup();
			}
			
			if (this.socketController && this.socketController.isConnected) {
				this.socketController.disconnect();
			}
			
			this.isActivated = false;
			this.deferredOperations = [];
			this.lastTokenTime = null;
			
			await new Promise(resolve => setTimeout(resolve, 500));
			
		} catch (error) {
			console.error('Cleanup error:', error);
		}
	}

	startHealthMonitoring() {
		this.healthMonitorInterval = setInterval(() => {
			this.performHealthCheck();
		}, 120000);

		this.deviceRefreshInterval = setInterval(() => {
			this.performDeviceRefresh();
		}, 300000);

		this.scheduleTokenRefresh();
	}

	stopHealthMonitoring() {
		if (this.healthMonitorInterval) {
			clearInterval(this.healthMonitorInterval);
			this.healthMonitorInterval = null;
		}
		if (this.deviceRefreshInterval) {
			clearInterval(this.deviceRefreshInterval);
			this.deviceRefreshInterval = null;
		}
		if (this.tokenRefreshTimeout) {
			clearTimeout(this.tokenRefreshTimeout);
			this.tokenRefreshTimeout = null;
		}
	}

	isCallActive() {
		return this.callController.currentCall !== null && 
			   this.callController.currentCall.status && 
			   ['pending', 'open', 'connecting'].includes(this.callController.currentCall.status());
	}

	async performHealthCheck() {
		if (!this.isActivated) return;

		if (this.isCallActive()) {
			this.uiController.addActivity('Health check deferred - call in progress', 'info');
			return;
		}

		try {
			const socketConnected = this.socketController.isConnected;
			const deviceReady = this.callController.device && this.callController.device.state === 'ready';

			if (!socketConnected) {
				this.uiController.addActivity('Socket disconnected - reconnecting...', 'warning');
				await this.reconnectSocket();
			}

			if (!deviceReady) {
				this.uiController.addActivity('Device not ready - re-registering...', 'warning');
				await this.reregisterDevice();
			}

			this.executeDeferredOperations();

		} catch (error) {
			console.error('Health check failed:', error);
			this.uiController.addActivity('Health check failed', 'error');
		}
	}

	async performDeviceRefresh() {
		if (!this.isActivated) return;

		if (this.isCallActive()) {
			this.deferDeviceRefresh();
			return;
		}

		try {
			await this.reregisterDevice();
		} catch (error) {
			console.error('Device refresh failed:', error);
		}
	}

	scheduleTokenRefresh() {
		const refreshTime = 50 * 60 * 1000;
		this.tokenRefreshTimeout = setTimeout(async () => {
			await this.performTokenRefresh();
			this.scheduleTokenRefresh();
		}, refreshTime);
	}

	async performTokenRefresh() {
		if (!this.isActivated || !this.currentUser) return;

		if (this.isCallActive()) {
			this.deferTokenRefresh();
			return;
		}

		try {
			this.uiController.addActivity('Refreshing access token...', 'info');
			
			const tokenResult = await this.authController.getAccessToken(this.currentUser.name);
			if (!tokenResult.success) {
				throw new Error(tokenResult.error);
			}

			this.currentUser.token = tokenResult.token;
			this.lastTokenTime = Date.now();

			await this.callController.updateAccessToken(tokenResult.token);
			this.uiController.addActivity('Access token refreshed successfully', 'success');

		} catch (error) {
			console.error('Token refresh failed:', error);
			this.uiController.addActivity('Token refresh failed', 'error');
		}
	}

	async reconnectSocket() {
		try {
			this.socketController.disconnect();
			await this.socketController.connect(this.currentUser.name);
			this.uiController.addActivity('Socket reconnected successfully', 'success');
		} catch (error) {
			console.error('Socket reconnection failed:', error);
			this.uiController.addActivity('Socket reconnection failed', 'error');
		}
	}

	async reregisterDevice() {
		try {
			if (this.callController.device) {
				const deviceState = this.callController.device.state;
				
				if (deviceState === 'unregistered') {
					await this.callController.device.register();
					this.uiController.addActivity('Device re-registered successfully', 'success');
				} else if (deviceState === 'registered') {
					this.uiController.addActivity('Device already registered and ready', 'info');
				} else {
					this.uiController.addActivity(`Device state: ${deviceState}`, 'info');
				}
			}
		} catch (error) {
			console.error('Device re-registration failed:', error);
			this.uiController.addActivity('Device re-registration failed', 'error');
		}
	}

	deferTokenRefresh() {
		if (!this.deferredOperations.includes('tokenRefresh')) {
			this.deferredOperations.push('tokenRefresh');
			this.uiController.addActivity('Token refresh deferred - call in progress', 'info');
		}
	}

	deferDeviceRefresh() {
		if (!this.deferredOperations.includes('deviceRefresh')) {
			this.deferredOperations.push('deviceRefresh');
			this.uiController.addActivity('Device refresh deferred - call in progress', 'info');
		}
	}

	async executeDeferredOperations() {
		if (this.deferredOperations.length === 0) return;

		const operations = [...this.deferredOperations];
		this.deferredOperations = [];

		for (const operation of operations) {
			switch (operation) {
				case 'tokenRefresh':
					await this.performTokenRefresh();
					break;
				case 'deviceRefresh':
					await this.performDeviceRefresh();
					break;
			}
		}
	}

	async checkForURLLogin() {
		const urlParams = new URLSearchParams(window.location.search);
		const clientName = urlParams.get('client');
		
		if (clientName && clientName.trim().length > 0) {
			try {
				await this.handleLogin({ clientName: clientName.trim() });
				
			} catch (error) {
				this.uiController.showError(`Auto-login failed for client: ${clientName}`);
			}
		}
	}

	setupEventHandlers() {
		document.addEventListener('auth:loginRequest', (e) => this.handleLogin(e.detail));
		document.addEventListener('auth:logoutRequest', () => this.handleLogout());
		
		document.addEventListener('call:answer', (e) => this.handleCallAnswer(e.detail));
		document.addEventListener('call:reject', (e) => this.handleCallReject(e.detail));
		document.addEventListener('call:hangup', (e) => this.handleCallHangup(e.detail));
		document.addEventListener('call:mute', (e) => this.handleCallMute(e.detail));
		document.addEventListener('call:sendDTMF', (e) => this.handleSendDTMF(e.detail));
		
		document.addEventListener('call:ended', () => this.handleCallEnded());
		
		document.addEventListener('notification:requestPermission', () => this.handleNotificationPermissionRequest());
		document.addEventListener('notification:incomingCall', (e) => this.handleIncomingCallNotification(e.detail));
		document.addEventListener('notification:clear', () => this.handleClearNotification());
		
		document.addEventListener('ui:addActivity', (e) => {
			this.uiController.addActivity(e.detail.message, e.detail.type);
		});
		
		document.addEventListener('signal:strengthUpdated', (e) => {
			this.handleSignalStrengthUpdate(e.detail);
		});
	}

	async handleLogin(credentials) {
		try {
			this.uiController.showLoading(true);
			
			const authResult = await this.authController.login(credentials);
			if (!authResult.success) {
				throw new Error(authResult.error);
			}

			const tokenResult = await this.authController.getAccessToken(credentials.clientName);
			if (!tokenResult.success) {
				throw new Error(tokenResult.error);
			}

			this.currentUser = {
				...authResult.client,
				token: tokenResult.token,
				identity: tokenResult.identity
			};

			this.updateURLWithClient(credentials.clientName);
			this.uiController.showActivationScreen(this.currentUser);
			
		} catch (error) {
			this.uiController.showError(error.message);
		} finally {
			this.uiController.showLoading(false);
		}
	}

	updateURLWithClient(clientName) {
		const newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?client=${encodeURIComponent(clientName)}`;
		window.history.replaceState({}, document.title, newUrl);
	}

	async handleLogout() {
		try {
			this.isActivating = false;
			
			await this.performCompleteCleanup();
			
			if (this.signalController) {
				this.signalController.destroy();
				this.signalController = new SignalController();
				this.signalController.initialize();
			}
			
			if (this.currentUser) {
				await this.authController.logout(this.currentUser.name);
			}
			
			this.currentUser = null;
			this.isActivated = false;
			this.isActivating = false;
			this.deferredOperations = [];
			
			const cleanUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
			window.history.replaceState({}, document.title, cleanUrl);
			
			this.uiController.showLogin();
			
		} catch (error) {
			console.error('Logout failed:', error);
			this.isActivating = false;
		}
	}

	async handleCallAnswer(data) {
		try {
			await this.callController.answerCall(data.call);
			this.socketController.emit('call-answered', {
				clientName: this.currentUser.name,
				callSid: data.call.parameters.CallSid
			});
		} catch (error) {
			console.error('Answer call failed:', error);
		}
	}

	async handleCallReject(data) {
		try {
			await this.callController.rejectCall(data.call);
			this.socketController.emit('call-rejected', {
				clientName: this.currentUser.name,
				callSid: data.call.parameters.CallSid
			});
		} catch (error) {
			console.error('Reject call failed:', error);
		}
	}

	async handleCallHangup(data) {
		try {
			await this.callController.hangupCall(data.call);
			this.socketController.emit('call-ended', {
				clientName: this.currentUser.name,
				callSid: data.call.parameters.CallSid,
				reason: 'user_hangup'
			});
		} catch (error) {
			console.error('Hangup call failed:', error);
		}
	}

	async handleCallMute(data) {
		try {
			const isMuted = await this.callController.toggleMute();
			this.socketController.emit('call-muted', {
				clientName: this.currentUser.name,
				callSid: data.callSid,
				isMuted
			});
		} catch (error) {
			console.error('Mute call failed:', error);
		}
	}

	async handleSendDTMF(data) {
		try {
			const success = this.callController.sendDTMF(data.digit);
			if (success) {
				this.uiController.addActivity(`Sent tone: ${data.digit}`, 'info');
			} else {
				this.uiController.addActivity('Failed to send tone', 'error');
			}
		} catch (error) {
			console.error('Send DTMF failed:', error);
			this.uiController.addActivity('Failed to send tone', 'error');
		}
	}

	async handleCallEnded() {
		await this.callController.performPostCallCleanup();
		setTimeout(() => {
			this.executeDeferredOperations();
		}, 1000);
	}

	handleIncomingCallNotification(data) {
		const success = this.notificationService.showIncomingCallNotification(data.from);
		
		if (success) {
			this.uiController.addActivity(`Desktop notification shown for call from ${data.from}`, 'success');
		} else {
			this.uiController.addActivity('Failed to show desktop notification', 'warning');
			
			if (window.electronAPI) {
				window.electronAPI.showNotification({
					title: 'EZ-AD Dialer - Incoming Call',
					body: `Incoming call from ${data.from}`,
					requireInteraction: true,
					tag: 'incoming-call'
				}).then(result => {
					if (result) {
						this.uiController.addActivity('Desktop notification shown via direct API', 'success');
					}
				}).catch(error => {
					console.error('Direct Electron API error:', error);
				});
			}
		}
	}

	handleClearNotification() {
		this.notificationService.clearActiveNotification();
	}

	handleSignalStrengthUpdate(qualityInfo) {
		const { strength, scores } = qualityInfo;
		
		if (strength === 'poor' && this.currentUser) {
			this.uiController.addActivity('Poor signal quality detected - call performance may be affected', 'warning');
		}
		
		if (scores.overall <= 2 && this.callController.currentCall) {
			this.uiController.addActivity('Critical signal quality - consider switching networks', 'error');
		}
	}

	async handleNotificationPermissionRequest() {
		try {
			const btn = document.getElementById('enable-notifications-btn');
			btn.disabled = true;
			btn.innerHTML = `
				<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
				<span>Requesting...</span>
			`;

			const granted = await this.notificationService.requestPermission();
			
			if (granted) {
				btn.innerHTML = `
					<span class="text-lg mr-2">&#9989;</span>
					<span>Notifications Enabled</span>
				`;
				btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
				btn.classList.add('bg-green-600', 'hover:bg-green-700');
				
				setTimeout(() => {
					document.getElementById('notification-permission-section').classList.add('hidden');
				}, 2000);
			} else {
				btn.innerHTML = `
					<span class="text-lg mr-2">&#10060;</span>
					<span>Permission Denied</span>
				`;
				btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
				btn.classList.add('bg-red-600', 'hover:bg-red-700');
			}

		} catch (error) {
			console.error('Notification permission request failed:', error);
			const btn = document.getElementById('enable-notifications-btn');
			btn.innerHTML = `
				<span class="text-lg mr-2">&#10060;</span>
				<span>Failed</span>
			`;
			btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
			btn.classList.add('bg-red-600', 'hover:bg-red-700');
		}
	}
}

document.addEventListener('DOMContentLoaded', () => {
	new TwilioClientApp();
});
