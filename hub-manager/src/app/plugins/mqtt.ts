import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

const heartBeatTopic = 'hub/heartbeat' as const;

export default fp(async function (fastify: FastifyInstance) {});
