import { SignalMonitoringService } from '../services/SignalMonitoringService.js';
import { SignalIndicatorUI } from '../ui/SignalIndicatorUI.js';

export class SignalController {
	constructor() {
		this.monitoringService = new SignalMonitoringService();
		this.indicatorUI = new SignalIndicatorUI();
		this.isInitialized = false;
		this.enhancedMonitoring = false;
		this.currentCall = null;
		this.device = null;
	}

	initialize() {
		if (this.isInitialized) return;
		
		this.indicatorUI.initialize();
		this.setupEventHandlers();
		this.setupMonitoringServiceHandlers();
		
		setTimeout(() => {
			this.startBasicMonitoring();
		}, 500);
		
		this.isInitialized = true;
		console.log('Signal monitoring system initialized');
	}

	setupEventHandlers() {
		document.addEventListener('device:ready', () => {
			this.handleDeviceReady();
		});

		document.addEventListener('call:incoming', (e) => {
			this.handleCallStart(e.detail.call);
		});

		document.addEventListener('call:connected', (e) => {
			this.handleCallConnected(e.detail.call);
		});

		document.addEventListener('call:ended', () => {
			this.handleCallEnded();
		});

		document.addEventListener('call:disconnected', () => {
			this.handleCallEnded();
		});
	}

	setupMonitoringServiceHandlers() {
		this.monitoringService.onNetworkChange((networkInfo) => {
			this.indicatorUI.updateNetworkInfo(networkInfo);
			this.logNetworkChange(networkInfo);
		});

		this.monitoringService.onQualityChange((qualityInfo) => {
			this.indicatorUI.updateSignalStrength(qualityInfo);
			this.handleQualityChange(qualityInfo);
		});

		this.monitoringService.onWarning((warnings) => {
			this.indicatorUI.showWarning(warnings);
			this.handleWarnings(warnings);
		});
	}

	handleDeviceReady() {
		this.startBasicMonitoring();
		this.addActivityLog('Signal monitoring activated', 'success');
	}

	handleCallStart(call) {
		this.currentCall = call;
		this.monitoringService.startMonitoring(this.device, call);
		
		this.addActivityLog('Enhanced signal monitoring activated for call', 'info');
	}

	handleCallConnected(call) {
		this.currentCall = call;
		
		if (this.enhancedMonitoring) {
			this.addActivityLog('Enhanced signal monitoring active during call', 'info');
		}
	}

	handleCallEnded() {
		this.currentCall = null;
		this.indicatorUI.clearAllWarnings();
		
		if (!this.enhancedMonitoring) {
			this.startBasicMonitoring();
		}
		
		this.addActivityLog('Call-specific monitoring stopped', 'info');
	}

	handleQualityChange(qualityInfo) {
		const { strength, scores } = qualityInfo;
		
		if (this.currentCall) {
			this.indicatorUI.updateCallQualityWarning(qualityInfo, true);
			
			if (strength === 'poor') {
				this.addActivityLog('Critical: Poor call quality detected', 'error');
			} else if (strength === 'fair') {
				this.addActivityLog('Warning: Fair call quality detected', 'warning');
			}
		}
		
		this.logQualityChange(qualityInfo);
	}

	handleWarnings(warnings) {
		warnings.forEach(warning => {
			const level = warning.severity === 'critical' ? 'error' : 'warning';
			this.addActivityLog(warning.message, level);
		});
	}

	startBasicMonitoring() {
		this.monitoringService.startMonitoring(this.device);
		this.addActivityLog('Basic signal monitoring started', 'success');
	}

	logNetworkChange(networkInfo) {
		const { effectiveType, connectionType, downlink } = networkInfo;
		let message = 'Network detected: ';
		
		if (connectionType && connectionType !== 'unknown') {
			message += connectionType;
		} else if (effectiveType && effectiveType !== 'unknown') {
			message += effectiveType;
		} else {
			message += 'Network connection';
		}
		
		if (downlink > 0) {
			message += ` (${downlink.toFixed(1)} Mbps)`;
		}
		
		this.addActivityLog(message, 'info');
	}

	logQualityChange(qualityInfo) {
		const { strength, scores } = qualityInfo;
		
		if (this.enhancedMonitoring) {
			console.log('Signal Quality Update:', {
				strength,
				overall: scores.overall,
				network: scores.network,
				audio: scores.audio,
				stability: scores.stability
			});
		}
	}

	addActivityLog(message, type = 'info') {
		document.dispatchEvent(new CustomEvent('ui:addActivity', {
			detail: { message, type }
		}));
	}

	getSignalStrength() {
		return this.monitoringService.getSignalStrength();
	}

	getSignalBars() {
		return this.monitoringService.getSignalBars();
	}

	getDetailedMetrics() {
		return this.monitoringService.getDetailedMetrics();
	}

	isMonitoring() {
		return this.monitoringService.isMonitoring;
	}

	setDevice(device) {
		this.device = device;
	}

	destroy() {
		this.monitoringService.destroy();
		this.indicatorUI.destroy();
		
		this.isInitialized = false;
		this.enhancedMonitoring = false;
		this.currentCall = null;
		this.device = null;
		
		console.log('Signal monitoring system destroyed');
	}
}
