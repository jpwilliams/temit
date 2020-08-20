import { TemitClient } from "./TemitClient";

(async () => {
  const temit = new TemitClient({
    name: "index.spec.ts",
  });

  // console.log("temit:", temit);

  await temit.connect();

  await temit
    .createEndpoint("foo", (event) => {
      console.log("event:", event);

      return "Hello, Jack!";
    })
    .open();

  const getFoo = temit.createRequestor<[], string>("foo");
  const foo = await getFoo();

  console.log("foo:", foo);

  await temit.close();
})();
