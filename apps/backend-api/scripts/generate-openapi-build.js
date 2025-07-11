#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateOpenAPISpec() {
  try {
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

    // Import the built app factory
    const { buildApp } = await import(appPath);

    // Build the app with env validation skipped for OpenAPI generation
    const app = await buildApp({
      logger: false, // Disable logging for spec generation
      skipEnvValidation: true, // Skip env validation for OpenAPI generation
    });

    // Wait for plugins to load (this might take a moment for autoload)
    await app.ready();

    // Give a small delay to ensure all plugins are fully loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate OpenAPI specification
    if (typeof app.swagger !== 'function') {
      throw new Error(
        'Swagger plugin not loaded. Make sure @fastify/swagger is registered.'
      );
    }
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
