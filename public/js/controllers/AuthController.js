import { ApiService } from '../services/ApiService.js';

export class AuthController {
	constructor() {
		this.apiService = new ApiService();
	}

	async login(credentials) {
		return await this.apiService.login(credentials.clientName);
	}

	async getAccessToken(clientName) {
		return await this.apiService.getAccessToken(clientName);
	}

	async getCallHistory(clientName, limit = 5) {
		return await this.apiService.getCallHistory(clientName, limit);
	}

	async logout(clientName) {
		return await this.apiService.logout(clientName);
	}
}
