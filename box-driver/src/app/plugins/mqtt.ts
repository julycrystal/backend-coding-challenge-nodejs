import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasNetworkConnection } from '../utils/network';

const heartBeatTopic = 'hub/heartbeat' as const;

export default fp(async function (fastify: FastifyInstance) {
  setInterval(() => {
    if (hasNetworkConnection()) {
      fastify.mqtt.publish(heartBeatTopic, 'OK', { qos: 2 });
    }
  }, 1000);
});
