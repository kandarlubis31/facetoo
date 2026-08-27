import Fastify from 'fastify';
import { env } from './utils/env.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

async function main() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    },
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Register plugins (cors, helmet, jwt, swagger, rate-limit)
  await registerPlugins(app);

  // Register routes
  await registerRoutes(app);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 Server running at http://localhost:${env.PORT}`);
    console.log(`📚 Swagger docs at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();