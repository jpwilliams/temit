import { TemitClient } from "./TemitClient";
import { z } from "zod";

describe("Properties", () => {
  const serviceName = "service-test";

  const temit = new TemitClient(serviceName, {
    events: {
      foo: {
        bar: z.string(),
      },
    },
    endpoints: {
      "user.update": {
        input: {
          id: z.string(),
          name: z.string(),
        },
        output: {
          id: z.string(),
        }
      }
    }
  });

  const updateUser = temit.createRequester("user.update");

  updateUser({
    
  })
});
