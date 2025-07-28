import fp from 'fastify-plugin';

// Empty object type that allows any properties (for compatibility with Fastify's index signature)
export type SupportPluginOptions = Record<string, unknown>;

// The use of fastify-plugin is required to be able
// to export the decorators to the outer scope
export default fp<SupportPluginOptions>(async (fastify, _opts) => {
  fastify.decorate('someSupport', () => 'hugs');
});

// When using .decorate you have to specify added properties for Typescript
declare module 'fastify' {
  export interface FastifyInstance {
    someSupport(): string;
  }
}
