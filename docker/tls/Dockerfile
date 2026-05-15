FROM caddy:2-alpine

RUN apk add --no-cache python3 py3-pip \
  && python3 -m venv /opt/certbot \
  && /opt/certbot/bin/pip install --no-cache-dir "certbot>=5.4,<6"

ENV PATH="/opt/certbot/bin:${PATH}"

COPY entrypoint.sh /usr/local/bin/tls-entrypoint.sh
RUN chmod +x /usr/local/bin/tls-entrypoint.sh

EXPOSE 80 443
ENTRYPOINT ["/usr/local/bin/tls-entrypoint.sh"]
