import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("TLS deployment configuration", () => {
  it("runs the app behind a domain-only TLS proxy instead of publishing app port 3000", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");

    expect(compose).toContain("tls-proxy:");
    expect(compose).toContain('"80:80"');
    expect(compose).toContain('"443:443"');
    expect(compose).toContain("expose:");
    expect(compose).toContain('"3000"');
    expect(compose).not.toContain('"3000:3000"');
  });

  it("requires PUBLIC_HOST and does not contain address-certificate logic", () => {
    const entrypoint = readFileSync("docker/tls/entrypoint.sh", "utf8");

    expect(entrypoint).toContain("PUBLIC_HOST is required");
    expect(entrypoint).toContain("caddy run");
    expect(entrypoint).not.toContain("PUBLIC_IP");
    expect(entrypoint).not.toContain("certbot");
    expect(entrypoint).not.toContain("--ip-address");
  });
});
