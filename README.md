# Causal Risk Predictor for Coronary Artery Disease

This repository combines a causal ML investigation with a deployable clinical-style web app for coronary artery disease risk prediction. The core question is simple: does strong performance on the UCI Heart Disease dataset survive after deconfounding, or is it mostly driven by observational associations?

Live app:
- https://cad-causal-risk-predictor.web.app/

## App Screenshots

<p align="center">
  <img src="app%20screenshot%201.png" alt="App screenshot 1" width="31%" />
  <img src="app%20screenshot%202.png" alt="App screenshot 2" width="31%" />
  <img src="app%20screenshot%203.png" alt="App screenshot 3" width="31%" />
</p>

These screens show the main prediction workflow, risk classification controls, saved-results history, and the overall responsive layout of the app.

## What The Project Does

- evaluates heart disease prediction under confounded and deconfounded training conditions
- uses causal bootstrapping to stress-test whether model performance is stable after removing key confounding structure
- deploys a calibrated prediction service through a clinician-facing web interface
- supports authentication, saved results, editable risk thresholds, and batch CSV prediction

## Research Question

Reported CAD prediction accuracy on observational data is often around `80-82%`, but that does not guarantee the model learned stable causal signal. In this project, age and sex are treated as major confounders and causal bootstrapping is used as a robustness check.

Working question:

> If a classifier performs well on the observational dataset, does that performance hold after deconfounding?

## Causal Framing

![Causal DAG used for deconfounding and model selection](research/assets/causaldiagram.png)

The project uses an explicit DAG, deconfounded resampling, cross-context model comparison, and calibrated probability outputs. The intent is not to prove causality, but to prefer models that remain useful under a more demanding causal stress test.

## Web App Features

- single-patient risk prediction with probability, uncertainty, and risk label output
- custom risk classification thresholds and labels
- user authentication and saved prediction history
- saved-results review with persisted clinical inputs
- batch CSV prediction and history saving
- responsive frontend with keyboard-accessible interaction patterns

## Architecture

The deployed app is split into three services:

- `frontend/`: React + Vite UI served behind Nginx
- `fastapi-backend/`: Python inference API for model loading and prediction
- `spring-backend/`: Java auth + CRUD API over Supabase-backed user data

This keeps model-serving logic in Python, application state in Spring Boot, and browser concerns in the frontend.

## Repository Layout

- `frontend/`: production UI
- `fastapi-backend/`: ML inference service
- `spring-backend/`: authentication, sessions, risk settings, saved results
- `research/`: notebooks, datasets, and causal analysis assets
- `docs/`: architecture, deployment, and API references

## Quick Start

For the full setup flow, use [`WEBAPP_SETUP.md`](WEBAPP_SETUP.md).

### Docker Compose

```powershell
Copy-Item .env.compose.example .env
Copy-Item spring-backend/.env.example spring-backend/.env
# fill in SUPABASE_URL and SUPABASE_ANON_KEY in spring-backend/.env
docker compose up --build -d
```

App URLs:

- Frontend: `http://127.0.0.1`
- FastAPI health: `http://127.0.0.1/ml-api/health`
- Spring health: `http://127.0.0.1/crud-api/health`

### Local Dev

Run each service separately if you want a faster iteration loop:

- FastAPI on `:8000`
- Spring Boot on `:8080`
- Vite frontend on `:5173`

## Model And Evaluation Summary

- benchmark dataset: UCI Heart Disease
- main deployment artifact: sigmoid-calibrated XGBoost bundle
- primary evaluation priorities: calibration, Brier score, ROC AUC, PR AUC, and log loss
- deployment preference: models that remain stable after deconfounding, not just models with the best observational headline accuracy

## Key References

- Dataset: https://archive.ics.uci.edu/dataset/45/heart+disease
- Causal bootstrapping: https://arxiv.org/abs/1910.09648
- Example angiographic CAD study: https://www.sciencedirect.com/science/article/pii/0002914989905249

## Further Documentation

- [`WEBAPP_SETUP.md`](WEBAPP_SETUP.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md)
- [`docs/ML_API.md`](docs/ML_API.md)
- [`docs/CRUD_API.md`](docs/CRUD_API.md)
- [`docs/DEPLOY_RENDER_FIREBASE.md`](docs/DEPLOY_RENDER_FIREBASE.md)
