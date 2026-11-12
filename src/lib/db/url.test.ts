import { describe, expect, it } from "vitest";
import { connectionOptions } from "./url";

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
