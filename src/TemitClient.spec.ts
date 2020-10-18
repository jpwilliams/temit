import { TemitClient } from "./TemitClient";

describe("Properties", () => {
  const serviceName = "service-test";
  const temit = new TemitClient(serviceName);

  test("has name", () => {
    expect(temit.name).toBe(serviceName);
  });
});
