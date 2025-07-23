import { Server } from 'socket.io';

export class SocketService {
	constructor(httpServer, databaseService) {
		this.databaseService = databaseService;
		this.activeConnections = new Map();
		this.socketClients = new Map();
		
		this.io = new Server(httpServer, {
			cors: {
				origin: false,
				methods: ["GET", "POST"]
			}
		});

		this.initializeSocketHandlers();
	}

	initializeSocketHandlers() {
		this.io.on('connection', (socket) => {

			socket.on('register-client', async (data) => {
				await this.handleClientRegistration(socket, data);
			});

			socket.on('call-answered', async (data) => {
				await this.handleCallAnswered(socket, data);
			});

			socket.on('call-rejected', async (data) => {
				await this.handleCallRejected(socket, data);
			});

			socket.on('call-ended', async (data) => {
				await this.handleCallEnded(socket, data);
			});

			socket.on('ping', () => {
				socket.emit('pong');
			});

			socket.on('disconnect', async () => {
				await this.handleClientDisconnect(socket);
			});
		});
	}

	async handleClientRegistration(socket, data) {
		try {
			const { clientName } = data;
			
			if (!clientName) {
				socket.emit('registration-error', { error: 'Client name is required' });
				return;
			}

			const clientData = await this.databaseService.findClientByName(clientName);
			
			if (!clientData) {
				socket.emit('registration-error', { error: 'Client not found' });
				return;
			}

			this.activeConnections.set(clientName, socket.id);
			this.socketClients.set(socket.id, clientName);
			
			socket.join(clientName);

			await this.databaseService.updateClientStatus(clientName, 'available');

			socket.emit('registration-success', { 
				clientName,
				status: 'registered',
				message: 'Successfully registered for incoming calls'
			});

		} catch (error) {
			socket.emit('registration-error', { error: 'Registration failed' });
		}
	}

	async handleCallAnswered(socket, data) {
		try {
			const clientName = this.socketClients.get(socket.id);
			const { callSid } = data;

			if (!clientName || !callSid) {
				return;
			}

			await this.databaseService.updateClientStatus(clientName, 'busy-on-call', callSid);

			socket.emit('call-status-update', {
				callSid,
				status: 'answered',
				message: 'Call answered successfully'
			});

		} catch (error) {
			console.error('Call answered handler error:', error);
		}
	}

	async handleCallRejected(socket, data) {
		try {
			const clientName = this.socketClients.get(socket.id);
			const { callSid } = data;

			if (!clientName || !callSid) {
				return;
			}

			await this.databaseService.updateClientStatus(clientName, 'available', null);

			socket.emit('call-status-update', {
				callSid,
				status: 'rejected',
				message: 'Call rejected'
			});

		} catch (error) {
			console.error('Call rejected handler error:', error);
		}
	}

	async handleCallEnded(socket, data) {
		try {
			const clientName = this.socketClients.get(socket.id);
			const { callSid, reason } = data;

			if (!clientName || !callSid) {
				return;
			}

			await this.databaseService.updateClientStatus(clientName, 'available', null);

			socket.emit('call-status-update', {
				callSid,
				status: 'ended',
				reason: reason || 'completed',
				message: 'Call ended'
			});

		} catch (error) {
			console.error('Call ended handler error:', error);
		}
	}

	async handleClientDisconnect(socket) {
		try {
			const clientName = this.socketClients.get(socket.id);
			
			if (clientName) {
				await this.databaseService.updateClientStatus(clientName, 'away', null);
				
				this.activeConnections.delete(clientName);
				this.socketClients.delete(socket.id);
			}

		} catch (error) {
			console.error('Client disconnect handler error:', error);
		}
	}

	emitToClient(clientName, event, data) {
		const socketId = this.activeConnections.get(clientName);
		if (socketId) {
			this.io.to(socketId).emit(event, data);
			return true;
		}
		return false;
	}

	emitToRoom(room, event, data) {
		this.io.to(room).emit(event, data);
	}

	broadcastToAll(event, data) {
		this.io.emit(event, data);
	}

	getActiveClients() {
		return Array.from(this.activeConnections.keys());
	}

	isClientConnected(clientName) {
		return this.activeConnections.has(clientName);
	}

	getClientSocketId(clientName) {
		return this.activeConnections.get(clientName);
	}
}
