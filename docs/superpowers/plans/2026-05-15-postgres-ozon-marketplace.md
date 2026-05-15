# Postgres And Ozon Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SQLite/WB-only storage with Postgres-backed marketplace accounts and add Ozon Seller + Performance API support.

**Architecture:** The app uses one `pg.Pool` for all database access, with schema migrations executed at startup. Admin routes manage encrypted marketplace credentials for Wildberries and Ozon, while MCP tools call allowlisted marketplace API endpoints and never accept raw marketplace credentials from Claude.

**Tech Stack:** Node.js ES modules, Express, `pg`, Postgres 16, Docker Compose, `pg-mem` for isolated tests, Vitest, Supertest, Nock.

---

## Tasks

- [ ] Add failing tests for Postgres-backed marketplace account storage.
- [ ] Replace `better-sqlite3` with `pg` and refactor database access to async queries.
- [ ] Replace `wb_cabinets` with `marketplace_accounts`.
- [ ] Add Ozon Seller and Performance API clients with allowlisted endpoints.
- [ ] Add Ozon MCP tools for monthly sales, profit, ad spend by SKU, and logistics share.
- [ ] Update Docker Compose with Postgres and `DATABASE_URL`.
- [ ] Add TLS proxy with Caddy domain mode and Certbot IP-only mode.
- [ ] Update README and `.env.example`.
- [ ] Run `npm test -- --run` and `docker compose build` where Node/Docker are available.

## Self-Review Checklist

- Spec coverage: Postgres, marketplace accounts, Ozon Seller API, Ozon Performance API, Docker deployment, encrypted credentials, and MCP tool changes are covered.
- Completion marker scan: no unresolved implementation markers.
- Security coverage: marketplace credentials are admin-only, encrypted at rest, never accepted via Claude MCP input, and never returned in admin/MCP responses.
