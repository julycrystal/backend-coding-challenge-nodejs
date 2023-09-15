import AltairFastify from 'altair-fastify-plugin';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import mercurius, { IResolvers } from 'mercurius';
import mercuriusCodegen, { gql } from 'mercurius-codegen';

const lastHeartBeatDate = 'lastHeartBeatDate';
const hubOpenTopic = 'hub/open';
const hubOpenedTopic = 'hub/opened';

const isDateDiffInRange = (now: Date | string | number, last: Date | string | number, range: number) => {
  const nowInMilli = Number(now);
  const lastInMilli = Number(last);
  const isInRange = (nowInMilli - lastInMilli) <= range;
  return isInRange;
};

// Using the fake "gql" from mercurius-codegen gives tooling support for
// "prettier formatting" and "IDE syntax highlighting".
// It's optional
const schema = gql`
  type Query {
    hello(name: String!): String!
    isHubOnline: Boolean!
  }

  type Mutation {
    open(id: String!): Boolean!
    close(id: String!): Boolean!
  }

  type Subscription {
    time: Int!
    isHubOnline: Boolean!
  }
`;

const resolvers: IResolvers = {
  Query: {
    hello(root, args, ctx) {
      // root ~ {}
      // args.name ~ string
      // ctx.authorization ~ string | undefined
      return 'hello ' + args.name;
    },
    async isHubOnline(root, args, ctx) {
      const now = new Date();
      const last = await ctx.redis.get(lastHeartBeatDate);
      return isDateDiffInRange(now, last, 1200);
    },
  },
  Mutation: {
    async open(root, args, ctx) {
      return new Promise((resolve) => {
        ctx.mqtt.subscribe(hubOpenedTopic, (error, granted) => {
          console.log('Subscribed to hubOpened topic');
        }).on('message', (topic, payload) => {
          if (topic === hubOpenedTopic) {
            const result = payload.toString();
            if (result === 'success') {
              resolve(true);
            } else {
              resolve(false);
            }
          }
        }).publish(hubOpenTopic, 'id field', { qos: 2 });
      });
    },
  },
  Subscription: {
    time: {
      async subscribe(root, args, ctx) {
        console.log('Started time subscription');
        const start = Date.now();

        const interval = setInterval(() => {
          ctx.pubsub.publish({
            topic: `time_${ctx.id}`,
            payload: {
              // Make sure to set the value at the key of the Subscription property `time`
              time: Date.now() - start,
            },
          });
        }, 200);

        const unsubscribe = await ctx.pubsub.subscribe(`time_${ctx.id}`);
        unsubscribe.addListener('end', () => {
          console.log('Stopped time subscription');
          clearInterval(interval);
        });
        return unsubscribe;
      },
    },
    isHubOnline: {
      async subscribe(root, args, ctx) {
        console.log('Started isHubOnline subscription');

        const interval = setInterval(async () => {
          const now = new Date();
          const last = await ctx.redis.get(lastHeartBeatDate);
          const isHubOnline = isDateDiffInRange(now, last, 1200);

          ctx.pubsub.publish({
            topic: `isHubOnline_${ctx.id}`,
            payload: {
              isHubOnline
            },
          });
        }, 200);

        const unsubscribe = await ctx.pubsub.subscribe(`isHubOnline_${ctx.id}`);
        unsubscribe.addListener('end', () => {
          console.log('Stopped isHubOnline subscription');
          clearInterval(interval);
        });
        return unsubscribe;
      },
    },
  },
};

const buildContext = (fastify: FastifyInstance) => {
  return {
    redis: fastify.redis,
    mqtt: fastify.mqtt,
  };
};

declare module 'mercurius' {
  interface MercuriusContext extends ReturnType<typeof buildContext> {
    id: string;
  }
}

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(mercurius, {
    schema,
    resolvers,
    context: () => buildContext(fastify),
    subscription: {
      fullWsTransport: true,
      emitter: fastify.redis,
      context: () => buildContext(fastify),
    },
    graphiql: true,
  });

  fastify.register(AltairFastify, {
    path: '/',
    baseURL: '/',
    endpointURL: '/graphql',
  });

  mercuriusCodegen(fastify, {
    targetPath: './hub-manager/src/generated.ts',
    silent: true,
  }).catch(console.error);
});
