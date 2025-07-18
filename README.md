# Twilio Browser Client

A modern browser-based client for receiving incoming Twilio calls.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Assets

```bash
npm run build
```

### 3. Environment Configuration

Edit `.env` with your Twilio and database credentials.

### 4. Twilio Configuration

#### Create TwiML Application

1. Go to Twilio Console > Voice > TwiML > TwiML Apps
2. Create a new TwiML App with these webhook URLs:
   - Voice Request URL: `https://dialer.ezadtv.com:5001/api/webhook/voice`
   - Voice Status Callback URL: `https://dialer.ezadtv.com:5001/api/webhook/status`
   - HTTP Method: POST for both
3. Copy the TwiML App SID to your `.env` file

#### Create API Key

1. Go to Twilio Console > Account > API Keys & Tokens
2. Create a new API Key
3. Copy the SID and Secret to your `.env` file

#### Configure Phone Numbers

1. Go to Twilio Console > Phone Numbers > Manage > Active Numbers
2. For each number assigned to a client:
   - Set Configure With: `TwiML App`
   - Set TwiML App to the one you just created

### 5. Start the Server

```bash
npm start
```

### 6. Access the Application

Open your browser to your configured URL