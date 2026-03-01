jest.mock('../src/otsClient', () => {
  const create = jest.fn(async ({ secret, passphrase, ttl } = {}) => {
    return { status: 'ok', secret_key: 'secret-id-123', echo: { secret, passphrase, ttl } };
  });
  const retrieve = jest.fn(async (id, passphrase) => {
    return { status: 'ok', value: 'decrypted-value', id, passphrase };
  });
  return function MockClient() {
    return { createSecret: create, retrieveSecret: retrieve };
  };
});

// Provide required env vars before loading the app
process.env.OTS_USER = 'test-user';
process.env.OTS_KEY = 'test-key';

const request = require('supertest');
const app = require('../src/index');

describe('OTS API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /secret calls OTS and returns response', async () => {
    const res = await request(app)
      .post('/secret?passphrase=pw&ttl=60')
      .set('Content-Type', 'text/plain')
      .send('my-secret');

    expect(res.status).toBe(200);
    expect(res.body.otsResponse).toBeDefined();
  });

  it('POST /secret returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/secret')
      .set('Content-Type', 'text/plain')
      .send('');

    expect(res.status).toBe(400);
  });

  it('GET /secret/:id returns mocked result', async () => {
    const res = await request(app).get('/secret/secret-id-123?passphrase=pw');
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  it('GET /env does not exist', async () => {
    const res = await request(app).get('/env');
    expect(res.status).toBe(404);
  });

  it('POST /admin/eval does not exist', async () => {
    const res = await request(app).post('/admin/eval').send('2+3');
    expect(res.status).toBe(404);
  });
});
