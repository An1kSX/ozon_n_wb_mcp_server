#!/bin/sh
set -eu

: "${PUBLIC_HOST:=}"
: "${PUBLIC_IP:=}"
: "${ACME_EMAIL:=}"

mkdir -p /etc/caddy /etc/letsencrypt /var/www/certbot

email_args() {
  if [ -n "$ACME_EMAIL" ]; then
    printf '%s\n%s\n' "--email" "$ACME_EMAIL"
  else
    printf '%s\n' "--register-unsafely-without-email"
  fi
}

write_domain_caddyfile() {
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
}

write_ip_challenge_caddyfile() {
  cat > /etc/caddy/Caddyfile <<'EOF'
:80 {
  root * /var/www/certbot
  file_server
}
EOF
}

write_ip_https_caddyfile() {
  cat > /etc/caddy/Caddyfile <<EOF
http://$PUBLIC_IP {
  handle /.well-known/acme-challenge/* {
    root * /var/www/certbot
    file_server
  }

  redir https://{host}{uri} 308
}

https://$PUBLIC_IP {
  tls /etc/letsencrypt/live/$PUBLIC_IP/fullchain.pem /etc/letsencrypt/live/$PUBLIC_IP/privkey.pem
  encode zstd gzip
  reverse_proxy wb-mcp:3000
}
EOF
}

renew_ip_certificate_loop() {
  while true; do
    sleep 12h
    certbot renew \
      --webroot \
      --webroot-path /var/www/certbot \
      --deploy-hook "caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile" || true
  done
}

if [ -n "$PUBLIC_HOST" ]; then
  write_domain_caddyfile
  exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
fi

if [ -z "$PUBLIC_IP" ]; then
  echo "PUBLIC_HOST is empty, so PUBLIC_IP is required for IP-only HTTPS mode." >&2
  exit 1
fi

write_ip_challenge_caddyfile
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID="$!"
trap 'kill "$CADDY_PID" 2>/dev/null || true' EXIT INT TERM

sleep 2

if [ ! -f "/etc/letsencrypt/live/$PUBLIC_IP/fullchain.pem" ]; then
  certbot certonly \
    --non-interactive \
    --agree-tos \
    $(email_args) \
    --webroot \
    --webroot-path /var/www/certbot \
    --preferred-profile shortlived \
    --ip-address "$PUBLIC_IP"
fi

write_ip_https_caddyfile
caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
renew_ip_certificate_loop &

wait "$CADDY_PID"
