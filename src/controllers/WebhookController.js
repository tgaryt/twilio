import { Client } from '../models/Client.js';

export class WebhookController {
	constructor(databaseService, twilioService, socketService) {
		this.databaseService = databaseService;
		this.twilioService = twilioService;
		this.socketService = socketService;
	}

	async handleVoiceWebhook(req, res) {
		try {
			const { To, From, CallSid } = req.body;
			
			const clientData = await this.databaseService.findClientByNumber(To);

			if (!clientData) {
				const twiml = this.twilioService.generateErrorTwiML('This number is not currently available.');
				return res.type('text/xml').send(twiml);
			}

			const client = Client.fromDatabaseRow(clientData);
			
			if (!client.isActive) {
				const twiml = this.twilioService.generateErrorTwiML('This number is currently unavailable.');
				return res.type('text/xml').send(twiml);
			}

			if (client.isBusy()) {
				const twiml = this.twilioService.generateBusyTwiML();
				return res.type('text/xml').send(twiml);
			}
			
			client.setBusy(CallSid);
			await this.databaseService.updateClient(client);

			this.socketService.emitToClient(client.clientName, 'incoming-call', {
				callSid: CallSid,
				from: From,
				to: To,
				clientName: client.clientName
			});

			const twiml = this.twilioService.generateClientDialTwiML(client.clientName, From);
			
			res.type('text/xml').send(twiml);

		} catch (error) {
			const twiml = this.twilioService.generateErrorTwiML('An error occurred. Please try again later.');
			res.type('text/xml').send(twiml);
		}
	}

	async handleStatusWebhook(req, res) {
		try {
			const { CallSid, CallStatus } = req.body;
			
			if (['completed', 'failed', 'canceled', 'busy', 'no-answer'].includes(CallStatus)) {
				
				const clientData = await this.databaseService.findClientByCallSid(CallSid);

				if (clientData) {
					const client = Client.fromDatabaseRow(clientData);
					
					client.setAvailable();
					await this.databaseService.updateClient(client);

					this.socketService.emitToClient(client.clientName, 'call-status-update', {
						callSid: CallSid,
						status: CallStatus,
						clientName: client.clientName
					});
				}
			}

			res.sendStatus(200);

		} catch (error) {
			res.sendStatus(500);
		}
	}
}
