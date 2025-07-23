export class NotificationService {
	constructor() {
		this.permission = null;
		this.activeNotification = null;
		this.isElectronApp = false;
		this.initializeSync();
	}

	initializeSync() {
		this.isElectronApp = window.electronAPI && window.electronAPI.isElectron;

		if (this.isElectronApp) {
			this.permission = 'granted';
			return true;
		}

		if (!('Notification' in window)) {
			this.permission = 'denied';
			return false;
		}

		this.permission = Notification.permission;
		return this.permission === 'granted';
	}

	async initialize() {
		return this.initializeSync();
	}

	async requestPermission() {
		try {
			if (this.isElectronApp) {
				this.permission = 'granted';
				return true;
			}

			const permission = await Notification.requestPermission();
			this.permission = permission;
			return permission === 'granted';
		} catch (error) {
			console.error('Error requesting notification permission:', error);
			return false;
		}
	}

	canShowNotifications() {
		if (this.isElectronApp) {
			return true;
		}

		return ('Notification' in window) && 
			   (Notification.permission === 'granted');
	}

	showIncomingCallNotification(callerNumber) {
		if (!this.canShowNotifications()) {
			return false;
		}

		this.clearActiveNotification();

		try {
			const title = 'EZ-AD Dialer - Incoming Call';
			const body = `Incoming call from ${callerNumber}`;
			const options = {
				body: body,
				icon: this.isElectronApp ? null : '/icons/favicon-32x32.png',
				tag: 'incoming-call',
				requireInteraction: true,
				silent: false
			};

			if (this.isElectronApp) {
				this.activeNotification = new Notification(title, options);
				
				if (this.activeNotification.onclick !== undefined) {
					this.activeNotification.onclick = () => {
						this.handleNotificationClick();
					};
				}
			} else {
				options.badge = '/icons/favicon-32x32.png';
				this.activeNotification = new Notification(title, options);

				this.activeNotification.onclick = () => {
					this.handleNotificationClick();
				};

				this.activeNotification.onclose = () => {
					this.activeNotification = null;
				};

				this.activeNotification.onerror = (error) => {
					console.error('Notification error:', error);
					this.activeNotification = null;
				};
			}

			return true;

		} catch (error) {
			console.error('Failed to show notification:', error);
			return false;
		}
	}

	handleNotificationClick() {
		if (this.isElectronApp && window.electronAPI) {
			window.electronAPI.focusWindow();
		} else {
			window.focus();
		}
		this.clearActiveNotification();
	}

	clearActiveNotification() {
		if (this.activeNotification) {
			if (this.isElectronApp && window.electronAPI) {
				window.electronAPI.closeNotification();
			} else {
				this.activeNotification.close();
			}
			this.activeNotification = null;
		}
	}

	showGeneralNotification(title, body, options = {}) {
		if (!this.canShowNotifications()) {
			return false;
		}

		try {
			const notificationOptions = {
				body: body,
				icon: this.isElectronApp ? null : '/icons/favicon-32x32.png',
				tag: options.tag || 'general',
				requireInteraction: options.requireInteraction || false,
				silent: options.silent || false,
				...options
			};

			const notification = new Notification(title, notificationOptions);

			if (notification.onclick !== undefined) {
				notification.onclick = () => {
					this.handleNotificationClick();
				};
			}

			return true;

		} catch (error) {
			console.error('Failed to show general notification:', error);
			return false;
		}
	}
}
