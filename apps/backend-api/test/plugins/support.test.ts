import Fastify, { type FastifyInstance } from 'fastify';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import Support from '../../src/plugins/support.js';
import { build } from '../helper.js';

describe('Support plugin', () => {
  describe('Standalone plugin test', () => {
    let fastify: FastifyInstance;

    beforeAll(async () => {
      fastify = Fastify({ logger: false });
      await fastify.register(Support, {});
      await fastify.ready();
    });

    afterAll(async () => {
      await fastify.close();
    });

    it('should work standalone', () => {
      expect(fastify.someSupport()).toBe('hugs');
    });

    it('should decorate fastify instance with someSupport method', () => {
      expect(fastify.someSupport).toBeDefined();
      expect(typeof fastify.someSupport).toBe('function');
    });

    it('should return correct support message', () => {
      const result = fastify.someSupport();
      expect(result).toBe('hugs');
      expect(typeof result).toBe('string');
    });
  });

  describe('Integrated plugin test', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await build();
      await app.ready();
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it('should be available in full app build', () => {
      expect(app.someSupport).toBeDefined();
      expect(app.someSupport()).toBe('hugs');
    });

    it('should maintain functionality in app context', () => {
      const result = app.someSupport();
      expect(result).toBe('hugs');
    });
  });

  describe('Plugin registration', () => {
    it('should register without errors', async () => {
      const testApp = Fastify({ logger: false });

      await expect(testApp.register(Support)).resolves.not.toThrow();
      await expect(testApp.ready()).resolves.not.toThrow();

      await testApp.close();
    });

    it('should be compatible with fastify-plugin', async () => {
      const testApp = Fastify({ logger: false });
      await testApp.register(Support);
      await testApp.ready();

      // Should be accessible due to fastify-plugin encapsulation
      expect(testApp.someSupport).toBeDefined();

      await testApp.close();
    });
  });
});
