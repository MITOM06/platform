import { mongoConnectionOptions } from "../mongo-options";

/**
 * Production 2026-10-10: on the Mac mini, Docker Desktop's DNS answers SERVFAIL to
 * the AAAA query of the MongoDB Atlas hosts, and musl's getaddrinfo (the Node
 * images are Alpine) then fails the whole lookup with EAI_AGAIN. auth-, ai- and
 * connector-service never reached the database; an A-only lookup (family 4) works.
 */
describe("mongoConnectionOptions", () => {
  it("resolves the database host over IPv4 only", () => {
    expect(
      mongoConnectionOptions("mongodb+srv://u:p@cluster.example.net/platform"),
    ).toEqual({
      uri: "mongodb+srv://u:p@cluster.example.net/platform",
      family: 4,
    });
  });

  it("keeps an unset URI unset (the service fails fast on it)", () => {
    expect(mongoConnectionOptions(undefined).uri).toBeUndefined();
  });
});
