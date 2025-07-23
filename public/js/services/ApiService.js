export class ApiService {
	constructor() {
		this.baseUrl = '';
	}

	async makeRequest(url, options = {}) {
		try {
			const response = await fetch(url, {
				headers: {
					'Content-Type': 'application/json',
					...options.headers
				},
				...options
			});

			const data = await response.json();
			return data;

		} catch (error) {
			return { 
				success: false, 
				error: 'Request failed' 
			};
		}
	}

	async login(clientName) {
		return this.makeRequest('/api/auth/login', {
			method: 'POST',
			body: JSON.stringify({ clientName })
		});
	}

	async getAccessToken(clientName) {
		return this.makeRequest('/api/auth/token', {
			method: 'POST',
			body: JSON.stringify({ clientName })
		});
	}

	async logout(clientName) {
		return this.makeRequest('/api/auth/logout', {
			method: 'POST',
			body: JSON.stringify({ clientName })
		});
	}

	async getCallHistory(clientName, limit = 5) {
		return this.makeRequest(`/api/calls/history/${clientName}?limit=${limit}`, {
			method: 'GET'
		});
	}

	async getCallStatus(clientName) {
		return this.makeRequest(`/api/calls/status/${clientName}`, {
			method: 'GET'
		});
	}
}
