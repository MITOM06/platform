import type { MongooseModuleFactoryOptions } from "@nestjs/mongoose";

/**
 * Mongoose connection options for every NestJS service. `family: 4` resolves the
 * database host with an A query only. Under Docker Desktop (the Mac mini) the
 * embedded DNS answers SERVFAIL to the AAAA query of the MongoDB Atlas hosts —
 * since 2026-10-10 a CNAME chain to an IPv4-only EC2 name — and musl's
 * getaddrinfo in the Alpine Node images then fails the whole lookup (EAI_AGAIN),
 * so auth-, ai- and connector-service never reached the database. Atlas and the
 * self-host Mongo container are IPv4.
 */
export function mongoConnectionOptions(
  uri: string | undefined,
): MongooseModuleFactoryOptions {
  return { uri, family: 4 };
}
