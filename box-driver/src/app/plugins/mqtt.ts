import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasNetworkConnection } from '../utils/network';

const heartBeatTopic = 'hub/heartbeat' as const;
const hubOpenTopic = 'hub/open';
const hubCloseTopic = 'hub/close';
const hubOpenedTopic = 'hub/opened';
const hubClosedTopic = 'hub/closed';

export default fp(async function (fastify: FastifyInstance) {
  fastify.mqtt.subscribe(hubOpenTopic, (error, granted) => {
    console.log('Subscribed to hubOpen topic');
  }).subscribe(hubCloseTopic, (error, granted) => {
    console.log('Subscribed to hubClose topic');
  }).on('message', async (topic, payload) => {
    if (topic === hubOpenTopic) {
      // Assume opening the box takes 2 seconds, with 60% success rate
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (Math.random() < 0.6) {
        fastify.mqtt.publish(hubOpenedTopic, 'success', { qos: 2 });
      } else {
        fastify.mqtt.publish(hubOpenedTopic, 'failure', { qos: 2 });
      }
    }
    if (topic === hubCloseTopic) {
      // Assume closing the box takes 2 seconds, with 60% success rate
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (Math.random() < 0.6) {
        fastify.mqtt.publish(hubClosedTopic, 'success', { qos: 2 });
      } else {
        fastify.mqtt.publish(hubClosedTopic, 'failure', { qos: 2 });
      }
    }
  });

  setInterval(() => {
    if (hasNetworkConnection()) {
      fastify.mqtt.publish(heartBeatTopic, 'OK', { qos: 2 });
    }
  }, 1000);
});
