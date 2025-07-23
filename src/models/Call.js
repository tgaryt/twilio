export class Call {
	constructor(data = {}) {
		this.callSid = data.callSid || data.CallSid || '';
		this.from = data.from || data.From || '';
		this.to = data.to || data.To || '';
		this.status = data.status || data.CallStatus || 'initiated';
		this.direction = data.direction || data.Direction || 'inbound';
		this.startTime = data.startTime || data.StartTime || new Date();
		this.endTime = data.endTime || data.EndTime || null;
		this.duration = data.duration || data.Duration || 0;
		this.clientName = data.clientName || '';
	}

	toApiResponse() {
		return {
			callSid: this.callSid,
			from: this.from,
			to: this.to,
			status: this.status,
			direction: this.direction,
			startTime: this.startTime,
			endTime: this.endTime,
			duration: this.duration,
			clientName: this.clientName
		};
	}

	isActive() {
		return ['initiated', 'ringing', 'in-progress'].includes(this.status);
	}

	isCompleted() {
		return ['completed', 'failed', 'canceled', 'busy', 'no-answer'].includes(this.status);
	}

	getDurationInSeconds() {
		if (this.endTime && this.startTime) {
			return Math.floor((new Date(this.endTime) - new Date(this.startTime)) / 1000);
		}
		return 0;
	}

	setCompleted(status = 'completed') {
		this.status = status;
		this.endTime = new Date();
		this.duration = this.getDurationInSeconds();
	}

	validate() {
		const errors = [];

		if (!this.callSid || this.callSid.trim().length === 0) {
			errors.push('Call SID is required');
		}

		if (!this.from || this.from.trim().length === 0) {
			errors.push('From number is required');
		}

		if (!this.to || this.to.trim().length === 0) {
			errors.push('To number is required');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	static fromTwilioWebhook(webhookData) {
		return new Call({
			callSid: webhookData.CallSid,
			from: webhookData.From,
			to: webhookData.To,
			status: webhookData.CallStatus,
			direction: webhookData.Direction,
			startTime: webhookData.StartTime ? new Date(webhookData.StartTime) : new Date()
		});
	}

	static fromIncomingCall(clientName, from, to, callSid) {
		return new Call({
			callSid,
			from,
			to,
			clientName,
			status: 'initiated',
			direction: 'inbound',
			startTime: new Date()
		});
	}
}
