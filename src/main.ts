import { config } from './config';
import { buildApp } from './app';

/**
 * Entry point: build the app and start listening.
 * All wiring lives in ./app.ts; all request logic lives under ./routes and ./ai.
 */
const app = buildApp();

app.listen({ port: config.port, host: config.host }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Server running on ${address}`);
});
