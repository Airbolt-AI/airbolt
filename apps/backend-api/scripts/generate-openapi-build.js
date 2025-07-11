#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import Fastify from 'fastify';
import fp from 'fastify-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateOpenAPISpec() {
  try {
    // Set dummy environment variables for OpenAPI generation only
    // These are not used during spec generation but required by env validation
    process.env.OPENAI_API_KEY =
      process.env.OPENAI_API_KEY || 'sk-dummy-key-for-openapi-generation';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'dummy-secret-for-openapi-generation';

    // Check if dist directory exists
    const distPath = join(__dirname, '..', 'dist');
    if (!existsSync(distPath)) {
      console.error(
        '❌ Dist directory not found. Please run "pnpm build" first.'
      );
      process.exit(1);
    }

    // Validate build output exists
    const appPath = join(distPath, 'app.js');
    if (!existsSync(appPath)) {
      console.error(`❌ app.js not found at: ${appPath}`);
      console.error('Ensure the build completed successfully.');
      process.exit(1);
    }

    // Import the built app
    const { default: App } = await import(appPath);

    // Build the Fastify app
    const app = Fastify({
      logger: false, // Disable logging for spec generation
    });

    // Register our application
    await app.register(fp(App));

    // Wait for plugins to load (this might take a moment for autoload)
    await app.ready();

    // Generate OpenAPI specification
    const spec = app.swagger();

    // Write to openapi.json file
    const outputPath = join(__dirname, '..', 'openapi.json');
    writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf8');

    console.log(`✅ OpenAPI specification generated at: ${outputPath}`);
    console.log(`📊 Found ${Object.keys(spec.paths || {}).length} endpoints`);

    // Close the app
    await app.close();

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI specification:', error);
    process.exit(1);
  }
}

// Run the generation
generateOpenAPISpec();
