export class SocketController {
	constructor() {
		this.socket = null;
		this.isConnected = false;
		this.clientName = null;
		this.reconnectAttempts = 0;
		this.maxReconnectAttempts = 5;
		this.reconnectDelay = 1000;
		this.pingInterval = null;
		this.lastPongTime = null;
	}

	async connect(clientName) {
		try {
			this.clientName = clientName;
			this.socket = window.io({
				transports: ['websocket', 'polling'],
				upgrade: true,
				rememberUpgrade: true,
				timeout: 20000,
				forceNew: false
			});
			
			this.setupSocketEventListeners();
			this.startPingMonitoring();
			
			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Connection timeout'));
				}, 10000);

				this.socket.on('connect', () => {
					clearTimeout(timeout);
					resolve(true);
				});

				this.socket.on('connect_error', (error) => {
					clearTimeout(timeout);
					reject(error);
				});
			});

		} catch (error) {
			throw error;
		}
	}

	setupSocketEventListeners() {
		this.socket.on('connect', () => {
			this.isConnected = true;
			this.reconnectAttempts = 0;
			this.lastPongTime = Date.now();
			
			if (this.clientName) {
				this.socket.emit('register-client', { clientName: this.clientName });
			}
			
			document.dispatchEvent(new CustomEvent('socket:connected'));
		});

		this.socket.on('disconnect', (reason) => {
			this.isConnected = false;
			document.dispatchEvent(new CustomEvent('socket:disconnected', { 
				detail: { reason } 
			}));
			
			if (reason === 'io server disconnect') {
				this.attemptReconnection();
			}
		});

		this.socket.on('connect_error', (error) => {
			this.isConnected = false;
			console.error('Socket connection error:', error);
			this.attemptReconnection();
		});

		this.socket.on('reconnect', (attemptNumber) => {
			this.isConnected = true;
			this.reconnectAttempts = 0;
			
			if (this.clientName) {
				this.socket.emit('register-client', { clientName: this.clientName });
			}
			
			document.dispatchEvent(new CustomEvent('socket:reconnected', {
				detail: { attemptNumber }
			}));
		});

		this.socket.on('reconnect_error', (error) => {
			console.error('Socket reconnection error:', error);
		});

		this.socket.on('reconnect_failed', () => {
			document.dispatchEvent(new CustomEvent('socket:reconnectFailed'));
		});

		this.socket.on('registration-success', (data) => {
			document.dispatchEvent(new CustomEvent('socket:registered', { detail: data }));
		});

		this.socket.on('registration-error', (data) => {
			document.dispatchEvent(new CustomEvent('socket:registrationError', { detail: data }));
		});

		this.socket.on('incoming-call', (data) => {
			document.dispatchEvent(new CustomEvent('socket:incomingCall', { detail: data }));
			
			document.dispatchEvent(new CustomEvent('notification:incomingCall', {
				detail: { 
					from: data.from,
					callSid: data.callSid,
					source: 'socket'
				}
			}));
		});

		this.socket.on('call-status-update', (data) => {
			document.dispatchEvent(new CustomEvent('socket:callStatusUpdate', { detail: data }));
		});

		this.socket.on('pong', () => {
			this.lastPongTime = Date.now();
		});
	}

	startPingMonitoring() {
		this.pingInterval = setInterval(() => {
			if (this.isConnected && this.socket) {
				this.socket.emit('ping');
				
				setTimeout(() => {
					const timeSinceLastPong = Date.now() - (this.lastPongTime || 0);
					if (timeSinceLastPong > 10000) {
						document.dispatchEvent(new CustomEvent('ui:addActivity', {
							detail: { 
								message: 'Socket connection appears stale - checking...', 
								type: 'warning' 
							}
						}));
						this.checkConnectionHealth();
					}
				}, 5000);
			}
		}, 30000);
	}

	stopPingMonitoring() {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	checkConnectionHealth() {
		if (!this.socket || !this.socket.connected) {
			this.attemptReconnection();
			return false;
		}
		return true;
	}

	attemptReconnection() {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			document.dispatchEvent(new CustomEvent('ui:addActivity', {
				detail: { 
					message: 'Maximum reconnection attempts reached', 
					type: 'error' 
				}
			}));
			return;
		}

		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

		document.dispatchEvent(new CustomEvent('ui:addActivity', {
			detail: { 
				message: `Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 
				type: 'info' 
			}
		}));

		setTimeout(() => {
			if (!this.isConnected && this.clientName) {
				this.connect(this.clientName).catch(error => {
					console.error('Reconnection failed:', error);
				});
			}
		}, delay);
	}

	emit(event, data) {
		if (this.socket && this.isConnected) {
			this.socket.emit(event, data);
			return true;
		} else {
			document.dispatchEvent(new CustomEvent('ui:addActivity', {
				detail: { 
					message: 'Cannot emit - socket not connected', 
					type: 'warning' 
				}
			}));
			return false;
		}
	}

	forceReconnect() {
		if (this.socket) {
			this.socket.disconnect();
			setTimeout(() => {
				this.connect(this.clientName).catch(error => {
					console.error('Force reconnection failed:', error);
				});
			}, 1000);
		}
	}

	getConnectionStatus() {
		return {
			isConnected: this.isConnected,
			reconnectAttempts: this.reconnectAttempts,
			lastPongTime: this.lastPongTime,
			socketId: this.socket?.id || null,
			clientName: this.clientName
		};
	}

	disconnect() {
		this.stopPingMonitoring();
		
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
		}
		
		this.isConnected = false;
		this.clientName = null;
		this.reconnectAttempts = 0;
		this.lastPongTime = null;
	}
}
