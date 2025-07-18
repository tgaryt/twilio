import express from 'express';
import { createServer } from 'http';
import { createServer as createServerHttps } from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

import { AuthController } from './src/controllers/AuthController.js';
import { CallController } from './src/controllers/CallController.js';
import { WebhookController } from './src/controllers/WebhookController.js';

import { DatabaseService } from './src/services/DatabaseService.js';
import { TwilioService } from './src/services/TwilioService.js';
import { SocketService } from './src/services/SocketService.js';

dotenv.config();
let credentials = null;
try {
    const certPath = process.env.HTTPS_CERT_PATH || '';
    const privateKey = readFileSync(certPath + '/privkey.pem', 'utf8');
    const certificate = readFileSync(certPath + '/cert.pem', 'utf8');
    const ca = readFileSync(certPath + '/chain.pem', 'utf8');
    credentials = {
        key: privateKey,
        cert: certificate,
        ca: ca
    };
} catch (e) {
    // SSL certificates not found, will run in HTTP mode
}


class TwilioBrowserApp {
	constructor() {
		this.app = express();
        if ( credentials ) {
            this.server = createServerHttps(credentials, this.app);
        } else {
            this.server = createServer(this.app);
        }
		this.port = process.env.PORT;
		
		this.initializeServices();
		this.initializeMiddleware();
		this.initializeRoutes();
		this.initializeErrorHandling();
	}

	initializeServices() {
		this.databaseService = new DatabaseService();
		this.twilioService = new TwilioService();
		this.socketService = new SocketService(this.server, this.databaseService);
		
		this.authController = new AuthController(this.databaseService, this.twilioService);
		this.callController = new CallController(this.databaseService, this.socketService, this.twilioService);
		this.webhookController = new WebhookController(this.databaseService, this.twilioService, this.socketService);
	}

	initializeMiddleware() {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		this.app.use(cors({
			origin: false,
			methods: ["GET", "POST"]
		}));

		this.app.use(express.json());
		this.app.use(express.urlencoded({ extended: true }));

		this.app.use(express.static(join(__dirname, 'public')));

		this.app.use((req, res, next) => {
			res.setHeader('Content-Security-Policy', 
				"default-src 'self'; " +
				"script-src 'self' 'unsafe-inline'; " +
				"media-src 'self' mediastream: https://media.twiliocdn.com https://sdk.twilio.com; " +
				"connect-src 'self' https://eventgw.twilio.com wss://voice-js.roaming.twilio.com https://media.twiliocdn.com https://sdk.twilio.com; " +
				"style-src 'self' 'unsafe-inline';"
			);
			next();
		});
	}

	initializeRoutes() {
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		this.app.get('/', (req, res) => {
			res.sendFile(join(__dirname, 'public', 'index.html'));
		});

		this.app.post('/api/auth/login', this.authController.login.bind(this.authController));
		this.app.post('/api/auth/token', this.authController.generateToken.bind(this.authController));
		this.app.post('/api/auth/logout', this.authController.logout.bind(this.authController));

		this.app.get('/api/calls/status/:clientName', this.callController.getCallStatus.bind(this.callController));
		this.app.get('/api/calls/history/:clientName', this.callController.getCallHistory.bind(this.callController));

		this.app.post('/api/webhook/voice', this.webhookController.handleVoiceWebhook.bind(this.webhookController));
		this.app.post('/api/webhook/status', this.webhookController.handleStatusWebhook.bind(this.webhookController));
	}

	initializeErrorHandling() {
		this.app.use((req, res) => {
			res.status(404).json({ error: 'Route not found' });
		});

		this.app.use((error, req, res, next) => {
			res.status(500).json({ error: 'Internal server error' });
		});
	}

	async start() {
		try {
			await this.databaseService.connect();
			await this.twilioService.initialize();
			
			this.server.listen(this.port, () => {
				console.log('Database connected successfully');
				console.log(`Server running on port ${this.port}`);
			});
		} catch (error) {
			console.error('Failed to start application:', error);
			process.exit(1);
		}
	}
}

const app = new TwilioBrowserApp();
app.start();
