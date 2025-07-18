export class SignalMonitoringService {
	constructor() {
		this.isMonitoring = false;
		this.metrics = {
			network: {
				connectionType: 'unknown',
				effectiveType: 'unknown',
				downlink: 0,
				rtt: 0,
				saveData: false
			},
			call: {
				jitter: 0,
				packetLoss: 0,
				roundTripTime: 0,
				mos: 0,
				audioLevel: 0,
				bytesReceived: 0,
				bytesSent: 0
			},
			webrtc: {
				iceConnectionState: 'new',
				connectionState: 'new',
				signalingState: 'stable'
			}
		};
		
		this.qualityScore = {
			overall: 3,
			network: 3,
			audio: 3,
			stability: 3
		};
		
		this.thresholds = {
			excellent: {
				jitter: 30,
				packetLoss: 1,
				rtt: 150,
				mos: 4.0,
				downlink: 10
			},
			good: {
				jitter: 60,
				packetLoss: 3,
				rtt: 300,
				mos: 3.5,
				downlink: 5
			},
			fair: {
				jitter: 100,
				packetLoss: 5,
				rtt: 500,
				mos: 3.0,
				downlink: 2
			}
		};
		
		this.monitoringInterval = null;
		this.networkChangeHandlers = [];
		this.qualityChangeHandlers = [];
		this.warningHandlers = [];
		
		this.statsHistory = [];
		this.maxHistoryLength = 60;
		this.currentCall = null;
		this.device = null;
		
		this.initializeNetworkMonitoring();
	}

	initializeNetworkMonitoring() {
		this.updateNetworkMetrics();
		
		if ('connection' in navigator) {
			navigator.connection.addEventListener('change', () => {
				this.updateNetworkMetrics();
				this.notifyNetworkChange();
			});
		}
		
		setTimeout(() => {
			this.updateNetworkMetrics();
			this.updateQualityScores();
		}, 1000);
	}

	updateNetworkMetrics() {
		if ('connection' in navigator) {
			const conn = navigator.connection;
			this.metrics.network = {
				connectionType: conn.type || 'unknown',
				effectiveType: conn.effectiveType || 'unknown',
				downlink: conn.downlink || 0,
				rtt: conn.rtt || 0,
				saveData: conn.saveData || false
			};
		} else {
			this.metrics.network = {
				connectionType: 'unknown',
				effectiveType: '4g',
				downlink: 10,
				rtt: 50,
				saveData: false
			};
		}
	}

	startMonitoring(device = null, call = null) {
		if (this.isMonitoring && !call) {
			return;
		}
		
		this.isMonitoring = true;
		this.device = device;
		this.currentCall = call;
		
		this.updateNetworkMetrics();
		this.updateQualityScores();
		
		this.monitoringInterval = setInterval(() => {
			this.collectMetrics();
		}, 2000);
		
		if (call) {
			this.setupCallMonitoring(call);
		}
		
		document.dispatchEvent(new CustomEvent('signal:monitoringStarted'));
	}

	stopMonitoring() {
		this.isMonitoring = false;
		
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}
		
		this.currentCall = null;
		document.dispatchEvent(new CustomEvent('signal:monitoringStopped'));
	}

	setupCallMonitoring(call) {
		if (!call) {
			return;
		}
		
		call.on('warning', (name, data) => {
			this.handleTwilioWarning(name, data);
		});
		
		call.on('warning-cleared', (name) => {
			this.handleTwilioWarningCleared(name);
		});
		
		call.on('disconnect', () => {
			this.currentCall = null;
		});
	}

	handleTwilioWarning(name, data) {
		console.log('Twilio warning received:', name, data);
		
		this.updateCallMetricsFromWarning(name, data);
		this.updateQualityScores();
		
		const warnings = [{
			type: name,
			severity: this.getWarningSeverity(name),
			message: this.getWarningMessage(name, data),
			suggestion: this.getWarningSuggestion(name)
		}];
		
		this.notifyWarnings(warnings);
	}

	handleTwilioWarningCleared(name) {
		console.log('Twilio warning cleared:', name);
		
		document.dispatchEvent(new CustomEvent('signal:warningCleared', {
			detail: { name }
		}));
	}

	updateCallMetricsFromWarning(name, data) {
		switch (name) {
			case 'high-jitter':
				if (data && data.jitter) {
					this.metrics.call.jitter = data.jitter;
				}
				break;
			case 'high-packets-lost-fraction':
				if (data && data.packetLossPercentage) {
					this.metrics.call.packetLoss = data.packetLossPercentage;
				}
				break;
			case 'high-rtt':
				if (data && data.rtt) {
					this.metrics.call.roundTripTime = data.rtt;
				}
				break;
			case 'low-mos':
				if (data && data.mos) {
					this.metrics.call.mos = data.mos;
				}
				break;
			case 'constant-audio-input-level':
				if (data && data.audioLevel !== undefined) {
					this.metrics.call.audioLevel = data.audioLevel;
				}
				break;
		}
	}

	getWarningSeverity(warningName) {
		const criticalWarnings = [
			'high-packets-lost-fraction',
			'low-mos',
			'constant-audio-input-level'
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

	getWarningSuggestion(name) {
		const suggestions = {
			'high-packets-lost-fraction': 'Check your network connection or try switching to a wired connection',
			'low-mos': 'Switch to a better network or move to an area with stronger signal',
			'high-jitter': 'Move closer to your router or switch to a more stable connection',
			'constant-audio-input-level': 'Check if your microphone is muted or try selecting a different microphone',
			'high-rtt': 'Check your internet connection speed or try a different network'
		};
		
		return suggestions[name] || 'Try improving your network connection';
	}

	updateQualityScores() {
		this.qualityScore.network = this.calculateNetworkScore();
		this.qualityScore.audio = this.calculateAudioScore();
		this.qualityScore.stability = this.calculateStabilityScore();
		this.qualityScore.overall = this.calculateOverallScore();
		
		this.notifyQualityChange();
	}

	calculateNetworkScore() {
		const { downlink, rtt, effectiveType } = this.metrics.network;
		
		let score = 4;
		
		if (effectiveType === 'slow-2g') score = 1;
		else if (effectiveType === '2g') score = 2;
		else if (effectiveType === '3g') score = 3;
		else if (effectiveType === '4g') score = 4;
		else if (effectiveType === 'unknown') score = 3;
		
		if (rtt > 500) score = Math.min(score, 2);
		else if (rtt > 300) score = Math.min(score, 3);
		else if (rtt > 150) score = Math.min(score, 4);
		
		if (downlink > 0) {
			if (downlink < 1) score = Math.min(score, 2);
			else if (downlink < 2) score = Math.min(score, 3);
			else if (downlink < 5) score = Math.min(score, 4);
		}
		
		return Math.max(1, score);
	}

	calculateAudioScore() {
		const { jitter, packetLoss, mos } = this.metrics.call;
		
		if (mos > 0) {
			if (mos >= 4.0) return 5;
			if (mos >= 3.5) return 4;
			if (mos >= 3.0) return 3;
			if (mos >= 2.5) return 2;
			return 1;
		}
		
		if (jitter === 0 && packetLoss === 0) {
			return this.currentCall ? 4 : 3;
		}
		
		let score = 5;
		
		if (jitter > this.thresholds.fair.jitter) score = 2;
		else if (jitter > this.thresholds.good.jitter) score = 3;
		else if (jitter > this.thresholds.excellent.jitter) score = 4;
		
		if (packetLoss > this.thresholds.fair.packetLoss) score = Math.min(score, 2);
		else if (packetLoss > this.thresholds.good.packetLoss) score = Math.min(score, 3);
		else if (packetLoss > this.thresholds.excellent.packetLoss) score = Math.min(score, 4);
		
		return Math.max(1, score);
	}

	calculateStabilityScore() {
		if (this.statsHistory.length < 5) {
			return 4;
		}
		
		const recentStats = this.statsHistory.slice(-5);
		const qualityValues = recentStats.map(s => s.quality.overall);
		const variance = this.calculateVariance(qualityValues);
		
		if (variance > 2) return 2;
		if (variance > 1) return 3;
		if (variance > 0.5) return 4;
		return 5;
	}

	calculateVariance(values) {
		if (values.length === 0) return 0;
		
		const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
		const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
		
		return variance;
	}

	calculateOverallScore() {
		const weights = {
			network: 0.4,
			audio: 0.4,
			stability: 0.2
		};
		
		return Math.round(
			this.qualityScore.network * weights.network +
			this.qualityScore.audio * weights.audio +
			this.qualityScore.stability * weights.stability
		);
	}

	addToHistory() {
		const snapshot = {
			timestamp: Date.now(),
			network: { ...this.metrics.network },
			call: { ...this.metrics.call },
			quality: { ...this.qualityScore }
		};
		
		this.statsHistory.push(snapshot);
		
		if (this.statsHistory.length > this.maxHistoryLength) {
			this.statsHistory.shift();
		}
	}

	collectMetrics() {
		this.updateNetworkMetrics();
		this.updateQualityScores();
		this.addToHistory();
	}

	getSignalStrength() {
		const score = this.qualityScore.overall;
		
		if (score >= 4) return 'excellent';
		if (score >= 3) return 'good';
		if (score >= 2) return 'fair';
		return 'poor';
	}

	getSignalBars() {
		const score = this.qualityScore.overall;
		return Math.max(1, Math.min(5, score));
	}

	onNetworkChange(handler) {
		this.networkChangeHandlers.push(handler);
	}

	onQualityChange(handler) {
		this.qualityChangeHandlers.push(handler);
	}

	onWarning(handler) {
		this.warningHandlers.push(handler);
	}

	notifyNetworkChange() {
		const networkInfo = { ...this.metrics.network };
		this.networkChangeHandlers.forEach(handler => {
			try {
				handler(networkInfo);
			} catch (error) {
				console.error('Error in network change handler:', error);
			}
		});
	}

	notifyQualityChange() {
		const qualityInfo = {
			scores: { ...this.qualityScore },
			strength: this.getSignalStrength(),
			bars: this.getSignalBars()
		};
		
		this.qualityChangeHandlers.forEach(handler => {
			try {
				handler(qualityInfo);
			} catch (error) {
				console.error('Error in quality change handler:', error);
			}
		});
	}

	notifyWarnings(warnings) {
		this.warningHandlers.forEach(handler => {
			try {
				handler(warnings);
			} catch (error) {
				console.error('Error in warning handler:', error);
			}
		});
	}

	destroy() {
		this.stopMonitoring();
		this.networkChangeHandlers = [];
		this.qualityChangeHandlers = [];
		this.warningHandlers = [];
		this.statsHistory = [];
	}
}
