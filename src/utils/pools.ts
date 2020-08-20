// public
import genericPool, { Pool } from "generic-pool";
import { Connection, Channel } from "amqplib";

export const createChannelPool = (
  connection: Promise<Connection>
): Pool<Channel> => {
  return genericPool.createPool(
    {
      create: async () => {
        const con = await connection;
        const channel = await con.createChannel();

        channel.on("error", () => {
          /* Errors should be handled in implementers */
        });
        channel.on("close", () => console.log("Worker channel closed"));

        return channel;
      },

      destroy: (channel) => channel.close(),
    },
    {
      min: 1,
      max: 10,
    }
  );
};
