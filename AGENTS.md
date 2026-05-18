# Linkup JS SDK Agent Guide

This repository contains the public JavaScript/TypeScript SDK for the Linkup API.

## Goal

Keep the SDK aligned with the current public, stable Linkup API while preserving a clean JS/TS developer experience.

## Working Rules

- Read this file before making changes.
- Prefer minimal diffs focused on the public API change being synchronized.
- Do not expose internal, beta, deprecated, or undocumented API behavior unless explicitly requested.
- Preserve the repo's public JS/TS conventions:
  - use camelCase in the SDK public surface;
  - convert to API wire-format only at the request boundary.
- Avoid unnecessary breaking changes. If a change would be breaking or ambiguous, stop and explain instead of guessing.
- If code generation exists for a given area, use the generation command instead of manually editing generated output.

## When Updating the SDK

When adding or changing a public API capability, update the relevant pieces together:
- request/response types,
- client methods,
- error handling if needed,
- tests,
- README/examples if the user-facing API changed.

## Validation

Before opening a PR, run the narrowest relevant checks:
- `npm test`
- `npm run lint`
- `npm run build`

## Non-Goals

- Do not change package version, release config, or publish settings unless the task explicitly asks for it.
- Do not refactor unrelated code while performing API synchronization.

## Sync Decisions

Add durable exceptions here when a proposed sync should not be repeated.

- Do not expose API capabilities that are not clearly public and stable.
- If a capability was intentionally rejected for product/design reasons, do not propose it again until this file is updated.
