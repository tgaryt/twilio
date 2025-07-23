export class SignalIndicatorUI {
	constructor() {
		this.currentQuality = null;
		this.currentWarnings = [];
		this.warningNotification = null;
		this.initialized = false;
	}

	initialize() {
		if (this.initialized) return;
		
		this.createSignalIndicators();
		this.createWarningSystem();
		this.initialized = true;
	}

	createSignalIndicators() {
		const headerDiv = document.querySelector('header .flex.items-center.space-x-6');
		if (!headerDiv) return;
		
		const existingIndicator = document.getElementById('signal-quality-indicator');
		if (existingIndicator) {
			existingIndicator.remove();
		}
		
		const signalIndicator = document.createElement('div');
		signalIndicator.id = 'signal-quality-indicator';
		signalIndicator.className = 'flex items-center bg-white/15 backdrop-blur-sm rounded-full px-4 py-2 border border-white/30';
		signalIndicator.innerHTML = `
			<div class="flex items-center space-x-3">
				<div id="signal-bars" class="flex items-end space-x-1">
					<div class="w-1 h-2 bg-gray-400 rounded-sm transition-all duration-200"></div>
					<div class="w-1 h-3 bg-gray-400 rounded-sm transition-all duration-200"></div>
					<div class="w-1 h-4 bg-gray-400 rounded-sm transition-all duration-200"></div>
					<div class="w-1 h-5 bg-gray-400 rounded-sm transition-all duration-200"></div>
					<div class="w-1 h-6 bg-gray-400 rounded-sm transition-all duration-200"></div>
				</div>
				<div class="flex flex-col">
					<span id="signal-strength-text" class="text-xs text-white/90 font-medium">Detecting...</span>
					<span id="signal-connection-type" class="text-xs text-white/70">Analyzing...</span>
				</div>
			</div>
		`;
		
		const statusIndicatorDiv = headerDiv.querySelector('.flex.items-center.bg-white\\/15');
		if (statusIndicatorDiv) {
			headerDiv.insertBefore(signalIndicator, statusIndicatorDiv);
		} else {
			headerDiv.appendChild(signalIndicator);
		}
	}

	createWarningSystem() {
		let warningContainer = document.getElementById('signal-warning-container');
		if (!warningContainer) {
			warningContainer = document.createElement('div');
			warningContainer.id = 'signal-warning-container';
			warningContainer.className = 'fixed top-20 right-6 z-50 space-y-2 max-w-sm';
			document.body.appendChild(warningContainer);
		}
	}

	updateSignalStrength(qualityInfo) {
		this.currentQuality = qualityInfo;
		
		const strengthText = document.getElementById('signal-strength-text');
		const bars = document.querySelectorAll('#signal-bars > div');
		const indicator = document.getElementById('signal-quality-indicator');
		
		if (!strengthText || bars.length === 0) return;
		
		const { strength, bars: barCount, scores } = qualityInfo;
		
		const strengthConfig = {
			excellent: { text: 'Excellent', color: 'bg-green-400' },
			good: { text: 'Good', color: 'bg-yellow-400' },
			fair: { text: 'Fair', color: 'bg-orange-400' },
			poor: { text: 'Poor', color: 'bg-red-400' }
		};
		
		const config = strengthConfig[strength] || strengthConfig.poor;
		strengthText.textContent = config.text;
		
		if (indicator) {
			indicator.classList.remove('animate-pulse');
			if (strength === 'poor') {
				indicator.classList.add('animate-pulse');
			}
		}
		
		bars.forEach((bar, index) => {
			bar.classList.remove('bg-green-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-400', 'bg-gray-400');
			
			if (index < barCount) {
				bar.classList.add(config.color);
			} else {
				bar.classList.add('bg-gray-400');
			}
		});
		
		document.dispatchEvent(new CustomEvent('signal:strengthUpdated', {
			detail: qualityInfo
		}));
	}

	updateNetworkInfo(networkInfo) {
		const connectionTypeElement = document.getElementById('signal-connection-type');
		if (!connectionTypeElement) return;
		
		const { effectiveType, connectionType, downlink } = networkInfo;
		
		let displayText = '';
		
		if (connectionType && connectionType !== 'unknown') {
			if (connectionType === 'wifi') {
				displayText = 'WiFi';
			} else if (connectionType === 'cellular') {
				displayText = 'Cellular';
			} else if (connectionType === 'ethernet') {
				displayText = 'Ethernet';
			} else {
				displayText = connectionType;
			}
		} else if (effectiveType && effectiveType !== 'unknown') {
			displayText = effectiveType.toUpperCase();
		} else {
			displayText = 'Network';
		}
		
		if (downlink > 0) {
			displayText += ` (${downlink.toFixed(1)}Mbps)`;
		}
		
		connectionTypeElement.textContent = displayText;
	}

	showWarning(warnings) {
		this.currentWarnings = warnings;
		
		warnings.forEach((warning, index) => {
			setTimeout(() => {
				this.displayWarning(warning);
			}, index * 500);
		});
	}

	displayWarning(warning) {
		const container = document.getElementById('signal-warning-container');
		if (!container) return;
		
		const warningElement = document.createElement('div');
		const severityClasses = warning.severity === 'critical' 
			? 'border-red-500/40 bg-red-500/20' 
			: 'border-yellow-500/40 bg-yellow-500/20';
		
		warningElement.className = `
			bg-white/20 backdrop-blur-md border border-white/30 rounded-lg p-4 shadow-xl
			transform transition-all duration-300 translate-x-full opacity-0
			${severityClasses}
		`;
		
		const severityIcon = '&#9888;';
		const severityColor = warning.severity === 'critical' ? 'text-red-300' : 'text-yellow-300';
		
		warningElement.innerHTML = `
			<div class="flex items-start space-x-3">
				<span class="text-lg flex-shrink-0">${severityIcon}</span>
				<div class="flex-1 min-w-0">
					<div class="flex items-center justify-between mb-2">
						<h3 class="${severityColor} font-medium text-sm">Signal Quality Warning</h3>
						<button class="text-white/60 hover:text-white transition-colors close-warning">
							<span class="text-sm">&#10005;</span>
						</button>
					</div>
					<p class="text-white/90 text-sm mb-2">${warning.message}</p>
					<p class="text-white/70 text-xs">${warning.suggestion}</p>
				</div>
			</div>
		`;
		
		container.appendChild(warningElement);
		
		setTimeout(() => {
			warningElement.classList.remove('translate-x-full', 'opacity-0');
			warningElement.classList.add('translate-x-0', 'opacity-100');
		}, 100);
		
		warningElement.querySelector('.close-warning').addEventListener('click', () => {
			this.removeWarning(warningElement);
		});
		
		if (warning.severity !== 'critical') {
			setTimeout(() => {
				this.removeWarning(warningElement);
			}, 8000);
		}
	}

	removeWarning(warningElement) {
		if (!warningElement.parentNode) return;
		
		warningElement.classList.add('translate-x-full', 'opacity-0');
		setTimeout(() => {
			if (warningElement.parentNode) {
				warningElement.parentNode.removeChild(warningElement);
			}
		}, 300);
	}

	clearAllWarnings() {
		const container = document.getElementById('signal-warning-container');
		if (!container) return;
		
		const warnings = container.querySelectorAll('.bg-white\\/20');
		warnings.forEach(warning => this.removeWarning(warning));
	}

	showCallQualityWarning(isInCall) {
		if (!isInCall) return;
		
		const callInterface = document.getElementById('call-interface');
		if (!callInterface) return;
		
		let qualityWarning = document.getElementById('call-quality-warning');
		if (!qualityWarning) {
			qualityWarning = document.createElement('div');
			qualityWarning.id = 'call-quality-warning';
			qualityWarning.className = 'bg-red-500/20 border border-red-500/40 rounded-lg p-3 mb-4 hidden animate-in slide-in-from-right duration-300';
			qualityWarning.innerHTML = `
				<div class="flex items-center space-x-3">
					<span class="text-lg animate-pulse">&#9888;</span>
					<div class="flex-1">
						<div class="text-red-300 font-medium text-sm">Poor Call Quality Detected</div>
						<div class="text-red-200 text-xs mt-1" id="quality-warning-message">
							Network issues may affect call quality
						</div>
					</div>
					<button id="dismiss-quality-warning" class="text-red-300 hover:text-red-200 transition-colors">
						<span class="text-sm">&#10005;</span>
					</button>
				</div>
			`;
			
			const callTitle = callInterface.querySelector('h2');
			if (callTitle) {
				callTitle.parentNode.insertBefore(qualityWarning, callTitle.nextSibling);
			}
			
			document.getElementById('dismiss-quality-warning').addEventListener('click', () => {
				qualityWarning.classList.add('hidden');
			});
		}
		
		return qualityWarning;
	}

	updateCallQualityWarning(qualityInfo, isVisible = true) {
		const warning = this.showCallQualityWarning(isVisible);
		if (!warning) return;
		
		const message = document.getElementById('quality-warning-message');
		if (!message) return;
		
		const { strength, scores } = qualityInfo;
		
		if (strength === 'poor') {
			message.textContent = 'Severe network issues detected - call quality significantly degraded';
			warning.classList.remove('hidden');
		} else if (strength === 'fair') {
			message.textContent = 'Network instability detected - call quality may be affected';
			warning.classList.remove('hidden');
		} else {
			warning.classList.add('hidden');
		}
	}

	destroy() {
		const indicator = document.getElementById('signal-quality-indicator');
		const warningContainer = document.getElementById('signal-warning-container');
		
		if (indicator) indicator.remove();
		if (warningContainer) warningContainer.remove();
		
		this.initialized = false;
	}
}
