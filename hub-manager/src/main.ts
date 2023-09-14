import Fastify from 'fastify';
import { app } from './app/app';
import mqtt from 'mqtt';
import redis from '@fastify/redis';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

// Instantiate Fastify with some config
const server = Fastify({
  logger: {
    level: 'error',
    transport: {
      target: 'pino-pretty',
    },
  },
});

// Register your application as a normal plugin.
server.register(app);
server.register(redis);

const start = async () => {
  const mqttClient = mqtt.connect({
    host: 'localhost',
    port: 1883,
  });

  mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');

    server.decorate('mqtt', mqttClient);

    // Start listening.
    server.listen({ port, host }, (err) => {
      if (err) {
        server.log.error(err);
        process.exit(1);
      } else {
        console.log(`[ hub-manager-ready ] http://${host}:${port}`);
      }
    });
  });

  server.addHook('onClose', () => {
    mqttClient.end();
  });

  mqttClient.on('error', (err) => {
    console.error('Could not connect to MQTT broker:', err);
  });
};

start();

// this declaration must be in scope of the typescript interpreter to work
declare module 'fastify' {
  interface FastifyInstance {
    // you must reference the interface and not the type
    mqtt: mqtt.MqttClient;
  }
}
