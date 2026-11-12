import { describe, expect, it } from "vitest";
import { connectionOptions, databaseUrl } from "./url";

describe("connectionOptions", () => {
  it("fjerner ukjente parametre og slår på SSL", () => {
    expect(
      connectionOptions("postgres://u:p@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x"),
    ).toEqual({ url: "postgres://u:p@aws-0-eu-north-1.pooler.supabase.com:6543/postgres", ssl: "require" });
  });
  it("ingen SSL lokalt", () => {
    expect(connectionOptions("postgres://postgres@127.0.0.1:5544/postgres").ssl).toBe(false);
  });
});

describe("databaseUrl", () => {
  it("foretrekker DATABASE_URL, så POSTGRES_URL", () => {
    expect(databaseUrl({ DATABASE_URL: "a", POSTGRES_URL: "b" })).toBe("a");
    expect(databaseUrl({ POSTGRES_URL: "b" })).toBe("b");
  });
  it("finner variabel med prefiks, men ikke NON_POOLING", () => {
    expect(databaseUrl({ STORAGE_POSTGRES_URL_NON_POOLING: "x", STORAGE_POSTGRES_URL: "y" })).toBe("y");
  });
  it("tom uten database", () => {
    expect(databaseUrl({})).toBe("");
  });
});
