import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("TLS deployment configuration", () => {
  it("runs the app behind a TLS proxy instead of publishing app port 3000", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");

    expect(compose).toContain("tls-proxy:");
    expect(compose).toContain('"80:80"');
    expect(compose).toContain('"443:443"');
    expect(compose).toContain("expose:");
    expect(compose).toContain('"3000"');
    expect(compose).not.toContain('"3000:3000"');
  });

  it("supports domain and IP-only certificate modes", () => {
    const entrypoint = readFileSync("docker/tls/entrypoint.sh", "utf8");

    expect(entrypoint).toContain("PUBLIC_HOST");
    expect(entrypoint).toContain("PUBLIC_IP");
    expect(entrypoint).toContain("--preferred-profile shortlived");
    expect(entrypoint).toContain("--ip-address");
    expect(entrypoint).toContain("certbot renew");
    expect(entrypoint).toContain("caddy reload");
  });
});
