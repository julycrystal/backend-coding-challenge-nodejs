import AltairFastify from 'altair-fastify-plugin';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import mercurius, { IResolvers } from 'mercurius';
import mercuriusCodegen, { gql } from 'mercurius-codegen';

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
      const exists = (await ctx.redis.exists('hub_online')) === 1;
      return exists;
    },
  },
  Subscription: {
    time: {
      async subscribe(root, args, ctx) {
        console.log('Started subscription');
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
          console.log('Stopped subscription');
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
