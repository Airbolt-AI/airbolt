import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

const swaggerPlugin: FastifyPluginAsync = async fastify => {
  // Register Swagger for OpenAPI spec generation
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'AI Fastify Template API',
        description:
          'Production-ready Fastify backend API with TypeScript and comprehensive validation',
        version: '1.0.0',
        contact: {
          name: 'Your Name',
          email: 'your-email@example.com',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        {
          name: 'Root',
          description: 'Root endpoints',
        },
        {
          name: 'Example',
          description: 'Example endpoints',
        },
        {
          name: 'Authentication',
          description: 'Authentication endpoints',
        },
        {
          name: 'Chat',
          description: 'AI Chat endpoints',
        },
      ],
    },
    hideUntagged: false,
  });

  // Register Swagger UI for interactive documentation
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) {
        next();
      },
      preHandler: function (_request, _reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: header => header,
    transformSpecification: (swaggerObject, _request, _reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });
};

export default fp(swaggerPlugin, {
  name: 'swagger',
});
