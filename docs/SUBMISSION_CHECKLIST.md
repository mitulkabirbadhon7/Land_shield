# LandShield - Pre-Submission Checklist

## Pre-submission items carried over

- [ ] Verify `docker compose up --build` on a Docker-enabled machine. Expected: /api/v1/health returns 200, frontend on :3000 returns 200, seed runs once (no duplicates after `docker compose restart backend`), one clean deed registers and verifies VALID through the stack. Owner: whoever has Docker. Optional — the live deployment link is the primary deliverable.
