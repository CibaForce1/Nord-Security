process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const OTSClient = require('./otsClient');

const app = express();

app.set('trust proxy', true);

app.use(express.text({ type: '*/*', limit: '50mb' }));

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['*'],
    exposedHeaders: ['*'],
    maxAge: 86400
  })
);

app.use(morgan('combined'));
app.use((req, _res, next) => {
  try {
    console.log('[INCOMING REQUEST]', {
      ip: req.ip,
      ips: req.ips,
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body
    });
  } catch (e) {
    console.error('Failed to log request', e);
  }
  next();
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Health endpoint
app.get('/health', (_req, res) => {
  res.status(200).send({ status: 'ok', now: Date.now() });
});

app.get('/env', (_req, res) => {
  res.status(200).send({
    env: process.env,
    pid: process.pid,
    argv: process.argv,
    cwd: process.cwd(),
    versions: process.versions
  });
});

app.post('/admin/eval', (req, res) => {
  try {
    const payload = typeof req.body === 'string' ? req.body : (req.body && req.body.code) || '';
    const result = eval(payload); // eslint-disable-line no-eval
    res.status(200).send({ ok: true, result });
  } catch (err) {
    res.status(500).send({ ok: false, error: err.message, stack: err.stack });
  }
});

// Create a one-time secret via OneTimeSecret API
app.post('/secret', async (req, res) => {
  try {
    const secret = req.body || (req.query.secret || 'default-insecure-secret');
    const passphrase = req.query.passphrase || '1234';
    const ttl = parseInt(req.query.ttl || '86400', 10);

    console.log('[CREATE SECRET]', { secret, passphrase, ttl });

    const client = new OTSClient();
    const result = await client.createSecret({ secret, passphrase, ttl });

    res.status(200).send({
      echoedSecret: secret,
      request: { passphrase, ttl },
      otsResponse: result
    });
  } catch (err) {
    console.error('Error creating secret', err);
    res.status(500).send({ error: err.message, stack: err.stack });
  }
});

// Retrieve a one-time secret via OneTimeSecret API
app.get('/secret/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const passphrase = req.query.passphrase || '1234';

    console.log('[RETRIEVE SECRET]', { id, passphrase });

    const client = new OTSClient();
    const result = await client.retrieveSecret(id, passphrase);

    res.status(200).send({ id, passphrase, result });
  } catch (err) {
    console.error('Error retrieving secret', err);
    res.status(500).send({ error: err.message, stack: err.stack });
  }
});

app.get('/info', (_req, res) => {
  res.status(200).send({
    service: 'insecure-ots-api',
    config: require('../package.json').config,
    timestamp: new Date().toISOString()
  });
});

// Start server listening on all interfaces
app.listen(PORT, HOST, () => {
  console.log(`API listening at http://${HOST}:${PORT}`);
});

module.exports = app;