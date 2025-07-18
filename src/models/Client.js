export class Client {
	constructor(data = {}) {
		this.id = data.id || null;
		this.clientName = data.client_name || data.clientName || '';
		this.clientNumber = data.client_number || data.clientNumber || '';
		this.callSid = data.call_sid || data.callSid || null;
		this.status = data.status || 'away';
		this.isActive = Boolean(data.is_active ?? data.isActive ?? true);
	}

	toDatabaseObject() {
		return {
			id: this.id,
			client_name: this.clientName,
			client_number: this.clientNumber,
			call_sid: this.callSid,
			status: this.status,
			is_active: this.isActive ? 1 : 0
		};
	}

	toApiResponse() {
		return {
			id: this.id,
			name: this.clientName,
			number: this.clientNumber,
			status: this.status,
			isActive: this.isActive,
			callSid: this.callSid
		};
	}

	isAvailable() {
		return this.isActive && this.status === 'available' && !this.callSid;
	}

	isBusy() {
		return this.status === 'busy-on-call' || Boolean(this.callSid);
	}

	setAvailable() {
		this.status = 'available';
		this.callSid = null;
	}

	setBusy(callSid = null) {
		if (this.isBusy() && this.callSid && this.callSid !== callSid) {
			throw new Error(`Client is already busy with call ${this.callSid}`);
		}
		
		this.status = 'busy-on-call';
		if (callSid) {
			this.callSid = callSid;
		}
	}

	setAway() {
		this.status = 'away';
		this.callSid = null;
	}

	canAcceptCall() {
		return this.isActive && !this.isBusy() && this.status !== 'away';
	}

	getCurrentCallInfo() {
		if (!this.isBusy()) {
			return null;
		}
		
		return {
			callSid: this.callSid,
			status: this.status,
			isBusy: true
		};
	}

	validate() {
		const errors = [];

		if (!this.clientName || this.clientName.trim().length === 0) {
			errors.push('Client name is required');
		}

		if (!this.clientNumber || this.clientNumber.trim().length === 0) {
			errors.push('Client number is required');
		}

		return {
			isValid: errors.length === 0,
			errors
		};
	}

	static fromDatabaseRow(row) {
		return new Client(row);
	}

	static fromApiRequest(data) {
		return new Client({
			clientName: data.clientName || data.name,
			clientNumber: data.clientNumber || data.number,
			status: data.status || 'away',
			isActive: data.isActive !== undefined ? data.isActive : true
		});
	}
}
