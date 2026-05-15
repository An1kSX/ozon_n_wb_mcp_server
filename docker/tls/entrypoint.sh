#!/bin/sh
set -eu

: "${PUBLIC_HOST:=}"
: "${ACME_EMAIL:=}"

if [ -z "$PUBLIC_HOST" ]; then
  echo "PUBLIC_HOST is required. HTTPS by address is not supported." >&2
  exit 1
fi

mkdir -p /etc/caddy

if [ -n "$ACME_EMAIL" ]; then
  cat > /etc/caddy/Caddyfile <<EOF
{
  email $ACME_EMAIL
}

$PUBLIC_HOST {
  encode zstd gzip
  reverse_proxy wb-mcp:3000
}
EOF
else
  cat > /etc/caddy/Caddyfile <<EOF
$PUBLIC_HOST {
  encode zstd gzip
  reverse_proxy wb-mcp:3000
}
EOF
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
