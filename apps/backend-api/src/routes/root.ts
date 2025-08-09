import type { FastifyPluginAsync } from 'fastify';

const root: FastifyPluginAsync = async (fastify, _opts): Promise<void> => {
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Root'],
        summary: 'Root endpoint redirect',
        description: 'Redirects to the comprehensive health check endpoint',
        response: {
          302: {
            description: 'Redirect to health check endpoint',
            type: 'object',
            properties: {
              statusCode: {
                type: 'number',
                example: 302,
              },
              message: {
                type: 'string',
                example: 'Found. Redirecting to /health',
              },
            },
          },
        },
      },
    },

    async (_request, reply) => {
      return reply.redirect('/health', 302);
    }
  );
};

export default root;
