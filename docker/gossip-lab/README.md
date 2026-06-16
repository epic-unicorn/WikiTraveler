# Gossip lab dev keys

These RSA keypairs are **for local gossip-lab testing only**. They are mounted into
Docker containers via `docker-compose.gossip.yml` and must never be used in production.

Regenerate if needed:

```bash
openssl genrsa -out node-a.private.pem 2048
openssl rsa -in node-a.private.pem -pubout -out node-a.public.pem
openssl genrsa -out node-b.private.pem 2048
openssl rsa -in node-b.private.pem -pubout -out node-b.public.pem
```
