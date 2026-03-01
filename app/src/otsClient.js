const axios = require('axios');

class OTSClient {
  constructor(opts = {}) {
    this.username = opts.username || process.env.OTS_USER;
    this.apikey = opts.apikey || process.env.OTS_KEY;
    const rawHost = opts.baseUrl || process.env.OTS_HOST || 'https://onetimesecret.com/api';
    this.baseUrl = rawHost.includes('/v1') ? rawHost : `${rawHost.replace(/\/$/, '')}/v1`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000,
      auth: {
        username: this.username,
        password: this.apikey
      }
    });
  }

  async createSecret({ secret, passphrase, ttl } = {}) {
    const payload = {
      secret,
      ttl: typeof ttl === 'undefined' ? 86400 : ttl
    };
    if (passphrase) payload.passphrase = passphrase;

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

    const resp = await this.client.get(`/secret/${encodeURIComponent(secretId)}`, { params });

    return resp.data;
  }
}

module.exports = OTSClient;
