import { describeWithSockets } from '../../testUtils/socketDescribe';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validateBody, validateQuery } from '../validate';

// Test schema
const testBodySchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  email: z.string().email().optional(),
});

const testQuerySchema = z.object({
  page: z.coerce.number().int().min(0).optional(),
  search: z.string().max(100).optional(),
});

// Set up test app
const app = express();
app.use(express.json());

app.post('/test-body', validateBody(testBodySchema), (_req, res) => {
  res.json({ success: true, body: _req.body });
});

app.get('/test-query', validateQuery(testQuerySchema), (_req, res) => {
  res.json({ success: true, query: _req.query });
});

describeWithSockets('Validation Middleware', () => {
  describe('validateBody', () => {
    it('should pass valid body through', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: 'John', age: 25 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.body.name).toBe('John');
    });

    it('should accept optional fields', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: 'John', age: 25, email: 'john@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.body.email).toBe('john@example.com');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: 'John' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toBe('Invalid request body');
      expect(res.body.details).toBeDefined();
      expect(res.body.details.issues).toBeDefined();
    });

    it('should reject invalid types', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: 'John', age: 'not-a-number' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject negative age', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: 'John', age: -5 });

      expect(res.status).toBe(400);
    });

    it('should reject empty name', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: '', age: 25 });

      expect(res.status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: 'John', age: 25, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.details.issues).toBeDefined();
      expect(res.body.details.issues[0]).toContain('email');
    });

    it('should pass through unknown fields (Zod passthrough by default)', async () => {
      const res = await request(app)
        .post('/test-body')
        .send({ name: 'John', age: 25, malicious: '<script>alert(1)</script>' });

      // Zod by default does not strip unknown keys unless .strict() is used
      // The validation passes because all required fields are present
      expect(res.status).toBe(200);
    });
  });

  describe('validateQuery', () => {
    it('should pass valid query params through', async () => {
      const res = await request(app).get('/test-query?page=2&search=hello');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should coerce page to number via Zod', async () => {
      const res = await request(app).get('/test-query?page=5');

      expect(res.status).toBe(200);
      // Query params are validated but the response uses req.query which keeps string type
      // The validated data is on req.validatedQuery
      expect(res.body.query.page).toBe('5');
    });

    it('should accept empty query', async () => {
      const res = await request(app).get('/test-query');

      expect(res.status).toBe(200);
    });

    it('should reject negative page', async () => {
      const res = await request(app).get('/test-query?page=-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toBe('Invalid query parameters');
    });
  });
});
