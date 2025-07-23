import twilio from 'twilio';

export class TwilioService {
	constructor() {
		this.client = null;
		this.accountSid = process.env.TWILIO_ACCOUNT_SID;
		this.authToken = process.env.TWILIO_AUTH_TOKEN;
		this.apiKey = process.env.TWILIO_API_KEY;
		this.apiSecret = process.env.TWILIO_API_SECRET;
		this.twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
	}

	async initialize() {
		try {
			if (!this.accountSid || !this.authToken || !this.apiKey || !this.apiSecret || !this.twimlAppSid) {
				throw new Error('Missing required Twilio configuration');
			}

			this.client = twilio(this.accountSid, this.authToken);
			
			await this.client.api.accounts(this.accountSid).fetch();

		} catch (error) {
			throw error;
		}
	}

	async generateAccessToken(client) {
		try {
			const { jwt } = twilio;
			const { VoiceGrant } = jwt.AccessToken;

			const accessToken = new jwt.AccessToken(
				this.accountSid,
				this.apiKey,
				this.apiSecret,
				{ 
					identity: client.clientName,
					ttl: 3600
				}
			);

			const voiceGrant = new VoiceGrant({
				incomingAllow: true
			});

			accessToken.addGrant(voiceGrant);

			return {
				token: accessToken.toJwt(),
				identity: client.clientName,
				ttl: 3600
			};

		} catch (error) {
			throw error;
		}
	}

	generateClientDialTwiML(clientName, callerNumber) {
		try {
			const twiml = new twilio.twiml.VoiceResponse();
			
			const dial = twiml.dial({
				answerOnBridge: true,
				callerId: callerNumber,
				timeout: 30
			});
			
			dial.client(clientName);

			return twiml.toString();

		} catch (error) {
			throw error;
		}
	}

	generateErrorTwiML(message) {
		try {
			const twiml = new twilio.twiml.VoiceResponse();
			twiml.say({
				voice: 'alice',
				language: 'en-US'
			}, message);
			twiml.hangup();

			return twiml.toString();

		} catch (error) {
			throw error;
		}
	}

	generateBusyTwiML() {
		try {
			const twiml = new twilio.twiml.VoiceResponse();
			twiml.reject({ reason: 'busy' });
			return twiml.toString();

		} catch (error) {
			const twiml = new twilio.twiml.VoiceResponse();
			twiml.say({
				voice: 'alice',
				language: 'en-US'
			}, 'The line is busy.');
			twiml.hangup();
			return twiml.toString();
		}
	}

	async getCallHistory(clientNumber, limit = 5) {
		try {
			const calls = await this.client.calls.list({
				limit: limit * 3
			});

			const filteredCalls = calls.filter(call => {
				const allowedStatuses = ['completed', 'busy', 'no-answer', 'canceled'];
				return allowedStatuses.includes(call.status) && 
					   (call.to === clientNumber || call.from === clientNumber);
			});
			
			filteredCalls.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

			return filteredCalls.slice(0, limit).map(call => ({
				callSid: call.sid,
				from: call.from,
				to: call.to,
				direction: call.direction,
				status: call.status,
				duration: call.duration || 0,
				startTime: call.startTime,
				endTime: call.endTime,
				price: call.price || '0.00',
				priceUnit: call.priceUnit || 'USD'
			}));

		} catch (error) {
			throw error;
		}
	}
}
