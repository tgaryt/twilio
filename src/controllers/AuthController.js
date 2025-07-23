import { Client } from '../models/Client.js';

export class AuthController {
	constructor(databaseService, twilioService) {
		this.databaseService = databaseService;
		this.twilioService = twilioService;
	}

	async login(req, res) {
		try {
			const { clientName } = req.body;
			
			if (!clientName || clientName.trim().length === 0) {
				return res.status(400).json({ 
					success: false, 
					error: 'Client name is required' 
				});
			}

			const clientData = await this.databaseService.findClientByName(clientName);
			
			if (!clientData) {
				return res.status(404).json({ 
					success: false, 
					error: 'Client not found or inactive' 
				});
			}

			const client = Client.fromDatabaseRow(clientData);
			
			if (!client.isActive) {
				return res.status(403).json({ 
					success: false, 
					error: 'Client account is inactive' 
				});
			}

			client.setAvailable();
			await this.databaseService.updateClient(client);

			res.json({
				success: true,
				client: client.toApiResponse()
			});

		} catch (error) {
			res.status(500).json({ 
				success: false, 
				error: 'Internal server error' 
			});
		}
	}

	async generateToken(req, res) {
		try {
			const { clientName } = req.body;

			if (!clientName || clientName.trim().length === 0) {
				return res.status(400).json({ 
					success: false, 
					error: 'Client name is required' 
				});
			}

			const clientData = await this.databaseService.findClientByName(clientName);
			
			if (!clientData) {
				return res.status(404).json({ 
					success: false, 
					error: 'Client not found' 
				});
			}

			const client = Client.fromDatabaseRow(clientData);
			
			const tokenData = await this.twilioService.generateAccessToken(client);

			res.json({
				success: true,
				token: tokenData.token,
				identity: tokenData.identity,
				number: client.clientNumber
			});

		} catch (error) {
			res.status(500).json({ 
				success: false, 
				error: 'Failed to generate token' 
			});
		}
	}

	async logout(req, res) {
		try {
			const { clientName } = req.body;
			
			if (clientName) {
				const clientData = await this.databaseService.findClientByName(clientName);
				
				if (clientData) {
					const client = Client.fromDatabaseRow(clientData);
					client.setAway();
					await this.databaseService.updateClient(client);
				}
			}

			res.json({ 
				success: true, 
				message: 'Logged out successfully' 
			});

		} catch (error) {
			res.status(500).json({ 
				success: false, 
				error: 'Logout failed' 
			});
		}
	}
}
