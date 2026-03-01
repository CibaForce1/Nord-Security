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

const request = require('supertest');
const app = require('../src/index');

describe('Insecure OTS API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /secret echoes secret and calls OTS', async () => {
    const res = await request(app)
      .post('/secret?passphrase=pw&ttl=60')
      .set('Content-Type', 'text/plain')
      .send('my-secret');

    expect(res.status).toBe(200);
    expect(res.body.echoedSecret).toBe('my-secret');
    expect(res.body.otsResponse).toBeDefined();
  });

  it('GET /secret/:id returns mocked result', async () => {
    const res = await request(app).get('/secret/secret-id-123?passphrase=pw');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('secret-id-123');
    expect(res.body.result).toBeDefined();
  });

  it('GET /env leaks environment', async () => {
    const res = await request(app).get('/env');
    expect(res.status).toBe(200);
    expect(res.body.env).toBeDefined();
  });

  it('POST /admin/eval executes code', async () => {
    const res = await request(app)
      .post('/admin/eval')
      .set('Content-Type', 'text/plain')
      .send('2+3');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.result).toBe(5);
  });
});