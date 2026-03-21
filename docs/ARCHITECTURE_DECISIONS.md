# Architecture Decisions Summary

This document is the short, decision-focused explanation of how the web application is structured and why those choices were made.

For setup and service-level details, also see:

- [`README.md`](../README.md)
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`WEBAPP_SETUP.md`](../WEBAPP_SETUP.md)
- [`docs/CRUD_API.md`](./CRUD_API.md)
- [`docs/ML_API.md`](./ML_API.md)

## System Shape

The application is intentionally split into four major parts:

- `frontend/`: React user interface
- `fastapi-backend/`: Python ML inference service
- `spring-backend/`: authentication and CRUD service
- `research/`: notebooks, datasets, and training artifacts

Why:

- each part solves a different problem with different runtime needs
- the deployed app stays smaller and easier to reason about
- model-serving concerns do not get mixed with user/session concerns
- research code stays separate from production-serving code

## Key Decisions

### 1. Separate inference from auth and persistence

Choice:

- FastAPI owns prediction endpoints
- Spring Boot owns auth, sessions, and user data CRUD

Why:

- the trained model artifact, preprocessing, and calibration workflow already live in Python
- auth, cookies, request validation, and business-rule CRUD are a cleaner fit for a structured service layer
- separating them keeps the ML API reusable by scripts or other clients without dragging along app-specific persistence

Tradeoff:

- there are two backends to run and configure instead of one
- the payoff is clearer boundaries and less coupling

### 2. Keep the frontend thin and API-driven

Choice:

- the browser handles workflow, validation, accessibility, and presentation
- it does not contain model logic or direct database access

Why:

- UI code should stay focused on clinician-facing interaction
- server-side services remain the source of truth for prediction, authentication, and persistence
- this reduces the risk of duplicating logic across the browser and backend

Tradeoff:

- more API calls are needed
- but behavior stays centralized and easier to change safely

### 3. Use Supabase as the persistence and auth provider, but hide it behind Spring

Choice:

- Supabase stores users and application data
- the frontend talks to Spring, not directly to Supabase tables

Why:

- authorization checks, response shaping, session handling, and validation stay centralized
- the frontend avoids carrying direct database assumptions
- persistence rules can change without changing the browser contract

Tradeoff:

- one extra service hop exists for CRUD
- but the application keeps a cleaner security boundary

### 4. Package the deployed model as a calibrated artifact

Choice:

- FastAPI loads one committed calibrated model bundle from disk

Why:

- the app displays patient-level risk percentages, not only rankings
- calibrated probabilities are more appropriate than raw boosted-tree scores for that UI
- one artifact keeps inference deterministic and operationally simple

Tradeoff:

- rebuilding the artifact is an explicit step
- but runtime behavior becomes simpler and more predictable

### 5. Prefer a calibrated XGBoost deployment artifact over exposing many candidate models

Choice:

- the webapp serves one selected model artifact instead of letting runtime choose among many research candidates

Why:

- deployment should be stable and easy to audit
- model selection belongs in research and evaluation, not in request-time branching
- the API contract stays simple for the frontend and external clients

Tradeoff:

- less runtime flexibility
- better reproducibility and lower operational complexity

### 6. Keep research assets outside the runtime path

Choice:

- notebooks and exploratory datasets remain under `research/`
- deployable services depend only on the committed runtime inputs they actually need

Why:

- exploratory work changes often and should not become accidental production dependency
- runtime containers stay smaller and more focused
- production startup is less fragile

Tradeoff:

- some training context is not colocated inside the backend service folders
- but the production boundary is much clearer

### 7. Mirror deployment routing locally with proxies

Choice:

- Docker uses Nginx path-based proxying for `/ml-api/*` and `/crud-api/*`
- local frontend development mirrors that with the Vite proxy

Why:

- the frontend can use stable API paths in both local and deployment-style runs
- this reduces CORS complexity and environment-specific branching
- integration issues show up earlier

Tradeoff:

- proxy configuration becomes part of the app architecture
- but frontend code stays cleaner and more portable

### 8. Containerize each service independently

Choice:

- frontend, FastAPI, and Spring Boot each have their own container image

Why:

- each service has different dependencies and runtime expectations
- local Docker Compose better matches deployed topology
- failures and configuration issues are easier to isolate by service

Tradeoff:

- more moving parts during local setup
- better production fidelity and clearer ownership

### 9. Scope configuration per service

Choice:

- FastAPI reads its own model/runtime config
- Spring reads its own auth/CRUD config

Why:

- each service only sees the environment it actually needs
- secrets and operational knobs stay scoped
- this reduces accidental coupling between services

Tradeoff:

- there are multiple env files/settings to manage
- but service boundaries remain explicit

### 10. Add auth hardening in the Spring layer

Choice:

- session cookies are managed server-side
- signup uses a stronger password policy
- login/signup are rate limited
- password reset flows terminate through Spring endpoints

Why:

- auth policy belongs in the service that owns sessions and security checks
- browser-side validation alone is not trustworthy
- centralizing this logic keeps security behavior consistent

Tradeoff:

- more backend auth code
- stronger and more predictable security behavior

### 11. Build for clinician-style usability, not only technical correctness

Choice:

- responsive layout, accessible controls, batch upload, saved result history, and configurable risk labels are first-class features

Why:

- the app is meant to be used as a practical decision-support-style interface, not just a model demo
- prediction quality is only useful if the interaction model is clear and usable

Tradeoff:

- more frontend complexity than a minimal demo
- much better real-world usability

## What This Architecture Optimizes For

The current design is optimized for:

- clear separation between research, inference, and application state
- stable deployment behavior
- reuse of the ML API outside the webapp
- centralized security and persistence rules
- reliable patient-facing probability presentation
- maintainability as the app grows

It is not optimized for:

- minimum number of services
- minimum local setup complexity
- runtime model experimentation inside the deployed app

Those tradeoffs are intentional.
