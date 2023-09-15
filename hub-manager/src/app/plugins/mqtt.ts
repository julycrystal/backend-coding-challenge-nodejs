import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

const heartBeatTopic = 'hub/heartbeat' as const;
const lastHeartBeatDate = 'lastHeartBeatDate';

export default fp(async function (fastify: FastifyInstance) {
  fastify.mqtt.subscribe(heartBeatTopic, (error, granted) => {
    console.log('Subscribed to heartbeat');
  }).on('message', (topic, payload) => {
    if (topic === heartBeatTopic) {
      const now = Number(new Date());
      fastify.redis.set(lastHeartBeatDate, now);
    }
  });
});
