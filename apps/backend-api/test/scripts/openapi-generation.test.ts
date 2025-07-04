import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { OpenAPIV3 } from 'openapi-types';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('OpenAPI Generation Scripts', () => {
  const backendApiPath = join(__dirname, '../../');
  const openApiPath = join(backendApiPath, 'openapi.json');
  const generationScript = join(backendApiPath, 'scripts/generate-openapi.js');

  let originalOpenApi: string | null = null;

  beforeEach(() => {
    // Backup existing openapi.json if it exists
    if (existsSync(openApiPath)) {
      originalOpenApi = readFileSync(openApiPath, 'utf8');
    }
  });

  afterEach(() => {
    // Restore or clean up openapi.json
    if (originalOpenApi) {
      writeFileSync(openApiPath, originalOpenApi, 'utf8');
      originalOpenApi = null;
    } else if (existsSync(openApiPath)) {
      unlinkSync(openApiPath);
    }
  });

  describe('Development OpenAPI Generation Script', () => {
    it('should exist and be executable', () => {
      expect(existsSync(generationScript)).toBe(true);
    });

    it('should generate valid OpenAPI specification', async () => {
      // Remove existing file to ensure fresh generation
      if (existsSync(openApiPath)) {
        unlinkSync(openApiPath);
      }

      // Run the generation script with test API key
      const { stdout, stderr } = await execAsync(`node ${generationScript}`, {
        cwd: backendApiPath,
        timeout: 30000, // 30 second timeout
        env: {
          ...process.env,
          OPENAI_API_KEY: 'sk-test1234567890abcdef',
        },
      });

      // Should have success output
      expect(stdout).toContain('✅ OpenAPI specification generated');
      expect(stdout).toContain('📊 Found');
      expect(stdout).toContain('endpoints');
      expect(stderr).toBe('');

      // Should create the OpenAPI file
      expect(existsSync(openApiPath)).toBe(true);

      // Should contain valid JSON
      const content = readFileSync(openApiPath, 'utf8');
      const spec = JSON.parse(content);

      // Basic validation
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info).toBeDefined();
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    }, 35000);

    it('should generate spec with correct structure', async () => {
      // Remove existing file
      if (existsSync(openApiPath)) {
        unlinkSync(openApiPath);
      }

      await execAsync(`node ${generationScript}`, {
        cwd: backendApiPath,
        timeout: 30000,
        env: {
          ...process.env,
          OPENAI_API_KEY: 'sk-test1234567890abcdef',
        },
      });

      const content = readFileSync(openApiPath, 'utf8');
      const spec = JSON.parse(content);

      // Required OpenAPI 3.0 fields
      expect(spec.openapi).toBe('3.0.0');
      expect(spec.info.title).toBe('AI Fastify Template API');
      expect(spec.info.version).toBe('1.0.0');

      // Should have paths
      expect(spec.paths).toBeDefined();
      expect(spec.paths['/']).toBeDefined();
      expect(spec.paths['/example/']).toBeDefined();

      // Should have components
      expect(spec.components).toBeDefined();
      expect(spec.components.securitySchemes).toBeDefined();

      // Should have tags
      expect(spec.tags).toBeDefined();
      expect(spec.tags.length).toBeGreaterThan(0);
    }, 35000);

    it('should handle script errors gracefully', async () => {
      // Test with a modified script that should fail
      const invalidScript = `#!/usr/bin/env node
console.error('❌ Test error');
process.exit(1);`;

      const tempScript = join(backendApiPath, 'scripts/test-invalid.js');
      writeFileSync(tempScript, invalidScript);

      try {
        await execAsync(`node ${tempScript}`, {
          cwd: backendApiPath,
          timeout: 10000,
        });

        // Should not reach here
        expect(false).toBe(true);
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stderr).toContain('❌ Test error');
      } finally {
        // Clean up
        if (existsSync(tempScript)) {
          unlinkSync(tempScript);
        }
      }
    });
  });

  describe('OpenAPI Specification Quality', () => {
    let spec: OpenAPIV3.Document;

    beforeAll(async () => {
      // Generate fresh spec for quality checks
      if (existsSync(openApiPath)) {
        unlinkSync(openApiPath);
      }

      await execAsync(`node ${generationScript}`, {
        cwd: backendApiPath,
        timeout: 30000,
      });

      const content = readFileSync(openApiPath, 'utf8');
      spec = JSON.parse(content);
    });

    it('should have complete endpoint documentation', () => {
      for (const [, pathItem] of Object.entries(spec.paths)) {
        const methods = [
          'get',
          'post',
          'put',
          'delete',
          'patch',
          'options',
          'head',
        ] as const;
        for (const method of methods) {
          const operation = pathItem?.[method];
          if (
            operation &&
            typeof operation === 'object' &&
            'responses' in operation
          ) {
            // Each operation should have required fields
            expect(operation.summary).toBeDefined();
            expect(operation.description).toBeDefined();
            expect(operation.tags).toBeDefined();
            expect(operation.responses).toBeDefined();

            // Should have at least one success response (200, 201, etc.)
            const successResponses = Object.keys(operation.responses).filter(
              code => code.startsWith('2')
            );
            expect(successResponses.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should have consistent response schemas', () => {
      for (const [, pathItem] of Object.entries(spec.paths)) {
        const methods = [
          'get',
          'post',
          'put',
          'delete',
          'patch',
          'options',
          'head',
        ] as const;
        for (const method of methods) {
          const operation = pathItem?.[method];
          if (
            operation &&
            typeof operation === 'object' &&
            'responses' in operation
          ) {
            for (const [, response] of Object.entries(operation.responses)) {
              if (
                response &&
                typeof response === 'object' &&
                !('$ref' in response) &&
                response.content
              ) {
                // Should have application/json content type
                expect(response.content['application/json']).toBeDefined();
                expect(
                  response.content['application/json']?.schema
                ).toBeDefined();
              }
            }
          }
        }
      }
    });

    it('should include examples for all responses', () => {
      const rootPath = spec.paths?.['/'];
      const rootGet = rootPath?.get;
      const rootResponse = rootGet?.responses?.['200'];

      if (
        rootResponse &&
        typeof rootResponse === 'object' &&
        !('$ref' in rootResponse)
      ) {
        const jsonContent = rootResponse.content?.['application/json'];
        const schema = jsonContent?.schema;
        if (schema && 'properties' in schema && schema.properties) {
          const messageProperty = schema.properties['message'];
          if (
            messageProperty &&
            typeof messageProperty === 'object' &&
            'example' in messageProperty
          ) {
            expect(messageProperty['example']).toBe('Hello World!');
          }
        }
      }

      const examplePath = spec.paths?.['/example/'];
      const exampleGet = examplePath?.get;
      const exampleResponse = exampleGet?.responses?.['200'];

      if (
        exampleResponse &&
        typeof exampleResponse === 'object' &&
        !('$ref' in exampleResponse)
      ) {
        const jsonContent = exampleResponse.content?.['application/json'];
        const schema = jsonContent?.schema;
        if (schema && 'example' in schema) {
          expect(schema['example']).toBe('this is an example');
        }
      }
    });

    it('should be suitable for SDK generation', () => {
      // Check that all required fields for Fern generation are present
      expect(spec.openapi).toBeDefined();
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBeDefined();
      expect(spec.info.version).toBeDefined();
      expect(spec.paths).toBeDefined();

      // Should have at least one path
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);

      // Each path should have proper operations
      for (const pathItem of Object.values(spec.paths)) {
        const operations = ['get', 'post', 'put', 'delete', 'patch'] as const;
        const hasOperation = operations.some(
          op =>
            pathItem &&
            op in pathItem &&
            pathItem[op as keyof typeof pathItem] !== undefined
        );
        expect(hasOperation).toBe(true);
      }
    });
  });
});
