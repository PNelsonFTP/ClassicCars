import { describe, it, expect } from "vitest";
import { publicAddress, validateUrl } from "../server/safe-fetch";
import { parseAsk } from "../server/ingest/adapters";
describe("fetch and money boundaries", () => {
  it("rejects private and reserved IPv4/IPv6 addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "169.254.169.254",
      "172.16.0.5",
      "192.168.1.2",
      "100.64.0.1",
      "198.18.0.1",
      "224.1.1.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
    ])
      expect(publicAddress(ip), ip).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
  });
  it("rejects unsafe protocols, userinfo, ports and unexpected origins before network", async () => {
    for (const url of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com:444",
      "file:///etc/passwd",
    ])
      await expect(validateUrl(url)).rejects.toThrow();
    await expect(
      validateUrl("https://other.example", ["https://example.com"]),
    ).rejects.toThrow("allowlisted");
  });
  it("does not treat financing, deposits, engine displacement or bids as asks", () => {
    expect(parseAsk("$21,500 (OBO)")).toBe(21500);
    for (const s of [
      "$399 /mo",
      "$1000 deposit",
      "current bid $8500",
      "350 V8",
      "Call for price",
    ])
      expect(parseAsk(s)).toBeNull();
  });
});
