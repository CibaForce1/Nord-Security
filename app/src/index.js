const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

// Fail fast if required secrets are missing
const requiredEnv = ['OTS_USER', 'OTS_KEY'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and provide values before starting.');
  process.exit(1);
}

const OTSClient = require('./otsClient');

const app = express();

app.set('trust proxy', 1);

app.use(express.text({ type: '*/*', limit: '1mb' }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || false,
    credentials: false,
    methods: ['GET', 'POST'],
  })
);

app.use(morgan('combined'));

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Health endpoint
app.get('/health', (_req, res) => {
  res.status(200).send({ status: 'ok', now: Date.now() });
});

// Create a one-time secret via OneTimeSecret API
app.post('/secret', async (req, res) => {
  try {
    const secret = req.body || (req.query.secret || '');
    if (!secret) {
      return res.status(400).send({ error: 'secret body is required' });
    }
    const passphrase = req.query.passphrase;
    const ttl = parseInt(req.query.ttl || '86400', 10);

    const client = new OTSClient();
    const result = await client.createSecret({ secret, passphrase, ttl });

    res.status(200).send({ otsResponse: result });
  } catch (err) {
    console.error('Error creating secret', err.message);
    res.status(500).send({ error: 'Failed to create secret' });
  }
});

// Retrieve a one-time secret via OneTimeSecret API
app.get('/secret/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const passphrase = req.query.passphrase;

    const client = new OTSClient();
    const result = await client.retrieveSecret(id, passphrase);

    res.status(200).send({ result });
  } catch (err) {
    console.error('Error retrieving secret', err.message);
    res.status(500).send({ error: 'Failed to retrieve secret' });
  }
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`API listening at http://${HOST}:${PORT}`);
});

module.exports = app;
