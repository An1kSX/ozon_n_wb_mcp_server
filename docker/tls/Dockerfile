FROM caddy:2-alpine

COPY entrypoint.sh /usr/local/bin/tls-entrypoint.sh
RUN chmod +x /usr/local/bin/tls-entrypoint.sh

EXPOSE 80 443
ENTRYPOINT ["/usr/local/bin/tls-entrypoint.sh"]
