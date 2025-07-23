import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseService {
	constructor() {
		this.pool = null;
	}

	async connect() {
		try {
			const config = {
				host: process.env.DB_HOST,
				user: process.env.DB_USER,
				password: process.env.DB_PASSWORD,
				database: process.env.DB_NAME,
				waitForConnections: true,
				connectionLimit: 10,
				queueLimit: 0
			};

			const sslConfig = this.getSSLConfig();
			if (sslConfig) {
				config.ssl = sslConfig;
			}

			this.pool = mysql.createPool(config);

			const connection = await this.pool.getConnection();
			connection.release();

		} catch (error) {
			throw error;
		}
	}

	getSSLConfig() {
		const useSSL = process.env.DB_USE_SSL === 'true';
		
		if (!useSSL) {
			return null;
		}

		const configDir = path.join(__dirname, '..', 'config');
		const clientCert = process.env.DB_SSL_CLIENT_CERT;
		const clientKey = process.env.DB_SSL_CLIENT_KEY;
		const serverCA = process.env.DB_SSL_SERVER_CA;

		const sslConfig = {};

		try {
			if (clientCert && clientCert.trim() !== '') {
				const certPath = path.join(configDir, clientCert);
				if (fs.existsSync(certPath)) {
					sslConfig.cert = fs.readFileSync(certPath);
				}
			}

			if (clientKey && clientKey.trim() !== '') {
				const keyPath = path.join(configDir, clientKey);
				if (fs.existsSync(keyPath)) {
					sslConfig.key = fs.readFileSync(keyPath);
				}
			}

			if (serverCA && serverCA.trim() !== '') {
				const caPath = path.join(configDir, serverCA);
				if (fs.existsSync(caPath)) {
					sslConfig.ca = fs.readFileSync(caPath);
				}
			}

			if (Object.keys(sslConfig).length > 0) {
				sslConfig.rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
				return sslConfig;
			}

		} catch (error) {
			throw new Error(`Failed to load SSL configuration: ${error.message}`);
		}

		return null;
	}

	async findClientByName(clientName) {
		try {
			const [rows] = await this.pool.execute(
				'SELECT * FROM clients WHERE client_name = ? AND is_active = 1',
				[clientName]
			);

			return rows.length > 0 ? rows[0] : null;

		} catch (error) {
			throw error;
		}
	}

	async findClientByNumber(clientNumber) {
		try {
			const [rows] = await this.pool.execute(
				'SELECT * FROM clients WHERE client_number = ? AND is_active = 1',
				[clientNumber]
			);

			return rows.length > 0 ? rows[0] : null;

		} catch (error) {
			throw error;
		}
	}

	async findClientByCallSid(callSid) {
		try {
			const [rows] = await this.pool.execute(
				'SELECT * FROM clients WHERE call_sid = ?',
				[callSid]
			);

			return rows.length > 0 ? rows[0] : null;

		} catch (error) {
			throw error;
		}
	}

	async updateClient(client) {
		try {
			const clientData = client.toDatabaseObject();
			
			await this.pool.execute(
				'UPDATE clients SET status = ?, call_sid = ? WHERE id = ?',
				[clientData.status, clientData.call_sid, clientData.id]
			);

			return true;

		} catch (error) {
			throw error;
		}
	}

	async updateClientStatus(clientName, status, callSid = null) {
		try {
			await this.pool.execute(
				'UPDATE clients SET status = ?, call_sid = ? WHERE client_name = ?',
				[status, callSid, clientName]
			);

			return true;

		} catch (error) {
			throw error;
		}
	}

	async close() {
		if (this.pool) {
			await this.pool.end();
		}
	}
}
