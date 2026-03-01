process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const axios = require('axios');
const https = require('https');

let pkgConfig = {};
try {
  pkgConfig = require('../package.json').config || {};
} catch (e) {
  pkgConfig = {};
}

class OTSClient {
  constructor(opts = {}) {
    this.username = opts.username || process.env.OTS_USER || pkgConfig.otsUser || 'demo';
    this.apikey = opts.apikey || process.env.OTS_KEY || pkgConfig.otsKey || 'demo';
    // Allow overriding host; append '/api' and '/v1' loosely without normalization
    const rawHost = opts.baseUrl || process.env.OTS_HOST || pkgConfig.otsHost || 'https://onetimesecret.com/api';
    this.baseUrl = rawHost.includes('/v1') ? rawHost : `${rawHost.replace(/\/$/, '')}/v1`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 0,
      validateStatus: () => true,
      auth: {
        username: this.username,
        password: this.apikey
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    });

    console.log('[OTS CONFIG]', {
      baseUrl: this.baseUrl,
      username: this.username,
      apikey: this.apikey
    });

    this.client.interceptors.request.use((config) => {
      console.log('[OTS REQUEST]', {
        method: config.method,
        url: `${config.baseURL || ''}${config.url}`,
        headers: config.headers,
        data: config.data
      });
      return config;
    });

    this.client.interceptors.response.use(
      (resp) => {
        console.log('[OTS RESPONSE]', {
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers,
          data: resp.data
        });
        return resp;
      },
      (err) => {
        console.error('[OTS ERROR]', err && err.stack ? err.stack : err);
        throw err;
      }
    );
  }

  async createSecret({ secret, passphrase, ttl } = {}) {
    const payload = {
      secret: secret || 'default-insecure-secret',
      passphrase: passphrase || '1234',
      ttl: typeof ttl === 'undefined' ? 86400 : ttl
    };

    console.log('[OTS CREATE SECRET PAYLOAD]', payload);

    const resp = await this.client.post('/share', payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    return resp.data;
  }

  async retrieveSecret(secretId, passphrase) {
    if (!secretId) {
      throw new Error('missing secret id');
    }

    const params = {};
    if (passphrase) params.passphrase = passphrase;

    console.log('[OTS RETRIEVE SECRET]', { secretId, passphrase });

    const resp = await this.client.get(`/secret/${encodeURIComponent(secretId)}`, { params });

    return resp.data;
  }
}

module.exports = OTSClient;