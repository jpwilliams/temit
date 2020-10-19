// local
import { generateId } from "./ids";

describe("generateId", () => {
  test("generates a fresh ID", () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
    expect(typeof id).toBe("string");
  });
});
