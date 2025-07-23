export class CallController {
	constructor() {
		this.device = null;
		this.currentCall = null;
		this.isMuted = false;
		this.callTimer = null;
		this.ringtoneInterval = null;
		this.statsCollectionInterval = null;
		this.callStartTime = null;
		this.callEventListeners = new Map();
	}

	async initializeTwilioDevice(token) {
		try {
			await this.cleanup();

			this.device = new window.Twilio.Device(token, {
				debug: false,
				enableRingingState: true,
				codecPreferences: ['opus', 'pcmu'],
				dscp: true
			});

			this.setupDeviceEventListeners();
			
			await this.device.register();
			
			return true;

		} catch (error) {
			throw error;
		}
	}

	async updateAccessToken(token) {
		if (!this.device) {
			throw new Error('Device not initialized');
		}

		try {
			this.device.updateToken(token);
			return true;
		} catch (error) {
			throw error;
		}
	}

	setupDeviceEventListeners() {
		this.device.on('ready', () => {
			document.dispatchEvent(new CustomEvent('device:ready'));
		});

		this.device.on('error', (error) => {
			document.dispatchEvent(new CustomEvent('device:error', { detail: { error } }));
		});

		this.device.on('incoming', (call) => {
			this.handleIncomingCall(call);
		});

		this.device.on('connect', (call) => {
			this.handleCallConnect(call);
		});

		this.device.on('disconnect', (call) => {
			this.handleCallDisconnect(call);
		});

		if (this.device.audio) {
			this.device.audio.on('deviceChange', (lostActiveDevices) => {
				document.dispatchEvent(new CustomEvent('audio:deviceChange', {
					detail: { lostActiveDevices }
				}));
			});
		}
	}

	handleIncomingCall(call) {
		this.currentCall = call;
		this.callStartTime = Date.now();
		this.setupCallEventListeners(call);
		this.setupCallStatsMonitoring(call);
		this.playRingtone();
		this.startCallTimer();
		
		const callerNumber = call.parameters.From || 'Unknown Number';
		const callSid = call.parameters.CallSid || 'Unknown';
		
		document.dispatchEvent(new CustomEvent('call:incoming', {
			detail: {
				call,
				from: callerNumber,
				callSid: callSid,
				direction: 'incoming'
			}
		}));

		setTimeout(() => {
			document.dispatchEvent(new CustomEvent('notification:incomingCall', {
				detail: { 
					from: callerNumber,
					callSid: callSid
				}
			}));
		}, 100);
	}

	setupCallEventListeners(call) {
		const listeners = {
			cancel: () => this.handleCallEnd('cancelled by caller'),
			disconnect: () => this.handleCallEnd('disconnected'),
			reject: () => this.handleCallEnd('rejected'),
			accept: () => this.handleCallConnect(call),
			error: (error) => {
				console.error('Call error:', error);
				this.handleCallEnd('error');
			},
			warning: (name, data) => this.handleCallWarning(name, data),
			'warning-cleared': (name) => this.handleCallWarningCleared(name)
		};

		this.callEventListeners.clear();

		Object.entries(listeners).forEach(([event, handler]) => {
			call.on(event, handler);
			this.callEventListeners.set(event, handler);
		});
	}

	removeCallEventListeners() {
		if (this.currentCall && this.callEventListeners.size > 0) {
			this.callEventListeners.forEach((handler, event) => {
				try {
					this.currentCall.removeListener(event, handler);
				} catch (error) {
					console.warn(`Failed to remove listener for ${event}:`, error);
				}
			});
			this.callEventListeners.clear();
		}
	}

	setupCallStatsMonitoring(call) {
		if (!call || typeof call.getStats !== 'function') {
			return;
		}

		this.statsCollectionInterval = setInterval(async () => {
			try {
				const stats = await call.getStats();
				this.processCallStats(stats);
			} catch (error) {
				console.error('Error collecting call stats:', error);
			}
		}, 1000);
	}

	processCallStats(stats) {
		if (!stats || !Array.isArray(stats) || stats.length === 0) {
			return;
		}

		const processedStats = [];
		
		stats.forEach(stat => {
			if (stat.codecName && stat.codecName.toLowerCase().includes('audio')) {
				processedStats.push({
					timestamp: stat.timestamp || Date.now(),
					jitter: this.parseStatValue(stat.jitter),
					packetsReceived: this.parseStatValue(stat.packetsReceived),
					packetsLost: this.parseStatValue(stat.packetsLost),
					bytesReceived: this.parseStatValue(stat.bytesReceived),
					bytesSent: this.parseStatValue(stat.bytesSent),
					rtt: this.parseStatValue(stat.rtt),
					mos: this.parseStatValue(stat.mos),
					audioLevel: this.parseStatValue(stat.audioLevel),
					codecName: stat.codecName
				});
			}
		});

		if (processedStats.length > 0) {
			document.dispatchEvent(new CustomEvent('call:statsUpdate', {
				detail: { stats: processedStats }
			}));
		}
	}

	parseStatValue(value) {
		if (value === undefined || value === null || value === '') {
			return 0;
		}
		const parsed = parseFloat(value);
		return isNaN(parsed) ? 0 : parsed;
	}

	handleCallWarning(name, data) {
		document.dispatchEvent(new CustomEvent('call:warning', {
			detail: { 
				name, 
				data,
				severity: this.getWarningSeverity(name),
				message: this.getWarningMessage(name, data)
			}
		}));
	}

	handleCallWarningCleared(name) {
		document.dispatchEvent(new CustomEvent('call:warningCleared', {
			detail: { name }
		}));
	}

	getWarningSeverity(warningName) {
		const criticalWarnings = [
			'high-packets-lost-fraction',
			'low-mos',
			'constant-audio-input-level',
			'high-jitter'
		];
		
		return criticalWarnings.includes(warningName) ? 'critical' : 'warning';
	}

	getWarningMessage(name, data) {
		const messages = {
			'high-packets-lost-fraction': 'High packet loss detected - audio quality may be degraded',
			'low-mos': 'Poor call quality detected - consider switching networks',
			'high-jitter': 'Network instability detected - audio may be choppy',
			'constant-audio-input-level': 'Microphone issue detected - check your audio settings',
			'high-rtt': 'High network latency detected - conversations may have delays'
		};
		
		return messages[name] || `Call quality warning: ${name}`;
	}

	handleCallConnect(call) {
		this.stopRingtone();
		this.callStartTime = Date.now();
		
		document.dispatchEvent(new CustomEvent('call:connected', {
			detail: { call }
		}));

		document.dispatchEvent(new CustomEvent('notification:clear'));
	}

	handleCallDisconnect(call) {
		this.handleCallEnd('disconnected');
		document.dispatchEvent(new CustomEvent('notification:clear'));
	}

	handleCallEnd(reason = 'completed') {
		const callDuration = this.callStartTime ? Date.now() - this.callStartTime : 0;
		
		this.endCall();
		
		document.dispatchEvent(new CustomEvent('call:ended', {
			detail: { 
				reason,
				duration: Math.round(callDuration / 1000)
			}
		}));

		document.dispatchEvent(new CustomEvent('notification:clear'));
	}

	async answerCall(call = null) {
		const targetCall = call || this.currentCall;
		if (targetCall) {
			targetCall.accept();
			
			setTimeout(() => {
				document.dispatchEvent(new CustomEvent('call:connected', {
					detail: { call: targetCall }
				}));
				document.dispatchEvent(new CustomEvent('notification:clear'));
			}, 100);
			
			return true;
		}
		return false;
	}

	async rejectCall(call = null) {
		const targetCall = call || this.currentCall;
		if (targetCall) {
			targetCall.reject();
			this.handleCallEnd('rejected');
			return true;
		}
		return false;
	}

	async hangupCall(call = null) {
		const targetCall = call || this.currentCall;
		if (targetCall) {
			targetCall.disconnect();
			this.handleCallEnd('hangup');
			return true;
		}
		return false;
	}

	toggleMute() {
		if (this.currentCall) {
			this.isMuted = !this.isMuted;
			this.currentCall.mute(this.isMuted);
			
			document.dispatchEvent(new CustomEvent('call:muteChanged', {
				detail: { isMuted: this.isMuted }
			}));
			
			return this.isMuted;
		}
		return false;
	}

	sendDTMF(digit) {
		if (this.currentCall && this.currentCall.status() === 'open') {
			try {
				this.currentCall.sendDigits(digit);
				
				document.dispatchEvent(new CustomEvent('call:dtmfSent', {
					detail: { digit }
				}));
				
				return true;
			} catch (error) {
				console.error('Failed to send DTMF:', error);
				return false;
			}
		}
		return false;
	}

	getCallQuality() {
		if (!this.currentCall) {
			return null;
		}

		return {
			callSid: this.currentCall.parameters?.CallSid,
			status: this.currentCall.status(),
			direction: this.currentCall.direction,
			duration: this.callStartTime ? Date.now() - this.callStartTime : 0,
			isMuted: this.isMuted
		};
	}

	endCall() {
		this.removeCallEventListeners();
		this.stopCallTimer();
		this.stopRingtone();
		this.stopStatsCollection();
		this.isMuted = false;
		this.currentCall = null;
		this.callStartTime = null;
	}

	async performPostCallCleanup() {
		this.endCall();
		
		try {
			if (this.device) {
				const deviceState = this.device.state;
				
				if (deviceState === 'unregistered') {
					await this.device.register();
					document.dispatchEvent(new CustomEvent('ui:addActivity', {
						detail: { 
							message: 'Device re-registered after call completion', 
							type: 'success' 
						}
					}));
				} else if (deviceState === 'registered') {
					document.dispatchEvent(new CustomEvent('ui:addActivity', {
						detail: { 
							message: 'Device already registered and ready', 
							type: 'info' 
						}
					}));
				} else {
					document.dispatchEvent(new CustomEvent('ui:addActivity', {
						detail: { 
							message: `Device state: ${deviceState}`, 
							type: 'info' 
						}
					}));
				}
			}
		} catch (error) {
			console.error('Post-call device registration failed:', error);
			document.dispatchEvent(new CustomEvent('ui:addActivity', {
				detail: { 
					message: 'Device re-registration failed after call', 
					type: 'error' 
				}
			}));
		}
	}

	stopStatsCollection() {
		if (this.statsCollectionInterval) {
			clearInterval(this.statsCollectionInterval);
			this.statsCollectionInterval = null;
		}
	}

	playRingtone() {
		try {
			const audioContext = new (window.AudioContext || window.webkitAudioContext)();
			
			this.ringtoneInterval = setInterval(() => {
				if (this.currentCall && this.currentCall.status() === 'pending') {
					const oscillator = audioContext.createOscillator();
					const gainNode = audioContext.createGain();
					
					oscillator.connect(gainNode);
					gainNode.connect(audioContext.destination);
					
					oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
					gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
					
					oscillator.start();
					oscillator.stop(audioContext.currentTime + 0.5);
				}
			}, 2000);
		} catch (error) {
			console.log('Could not play ringtone:', error);
		}
	}

	stopRingtone() {
		if (this.ringtoneInterval) {
			clearInterval(this.ringtoneInterval);
			this.ringtoneInterval = null;
		}
	}

	startCallTimer() {
		let seconds = 0;
		this.callTimer = setInterval(() => {
			seconds++;
			const minutes = Math.floor(seconds / 60);
			const remainingSeconds = seconds % 60;
			const timeString = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
			
			document.dispatchEvent(new CustomEvent('call:timerUpdate', {
				detail: { time: timeString, seconds }
			}));
		}, 1000);
	}

	stopCallTimer() {
		if (this.callTimer) {
			clearInterval(this.callTimer);
			this.callTimer = null;
		}
	}

	async runPreflightTest() {
		try {
			if (!this.device || !this.device.audio) {
				throw new Error('Device not ready for preflight test');
			}

			const test = this.device.audio.runPreflight();
			
			return new Promise((resolve, reject) => {
				test.on('completed', (report) => {
					resolve({
						success: true,
						report: {
							edge: report.edge,
							iceCandidateStats: report.iceCandidateStats,
							networkTiming: report.networkTiming,
							selectedIceCandidatePairStats: report.selectedIceCandidatePairStats
						}
					});
				});

				test.on('failed', (error) => {
					reject(new Error(`Preflight test failed: ${error.message}`));
				});
			});
		} catch (error) {
			throw error;
		}
	}

	async cleanup() {
		this.endCall();
		this.stopStatsCollection();
		
		if (this.device) {
			try {
				if (this.device.state === 'registered') {
					this.device.unregister();
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				this.device.destroy();
				await new Promise(resolve => setTimeout(resolve, 500));
			} catch (error) {
				console.error('Device cleanup error:', error);
			}
			this.device = null;
		}
	}
}
