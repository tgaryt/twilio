import { Client } from '../models/Client.js';

export class CallController {
	constructor(databaseService, socketService, twilioService) {
		this.databaseService = databaseService;
		this.socketService = socketService;
		this.twilioService = twilioService;
	}

	async getCallStatus(req, res) {
		try {
			const { clientName } = req.params;
			
			if (!clientName) {
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

			res.json({
				success: true,
				status: {
					clientName: client.clientName,
					number: client.clientNumber,
					status: client.status,
					isAvailable: client.isAvailable(),
					isBusy: client.isBusy(),
					currentCallSid: client.callSid
				}
			});

		} catch (error) {
			res.status(500).json({ 
				success: false, 
				error: 'Failed to get call status' 
			});
		}
	}

	async getCallHistory(req, res) {
		try {
			const { clientName } = req.params;
			const limit = parseInt(req.query.limit) || 5;
			
			if (!clientName) {
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
			const callHistory = await this.twilioService.getCallHistory(client.clientNumber, limit);

			res.json({
				success: true,
				callHistory: callHistory,
				clientName: client.clientName,
				clientNumber: client.clientNumber
			});

		} catch (error) {
			res.status(500).json({ 
				success: false, 
				error: 'Failed to retrieve call history' 
			});
		}
	}
}
