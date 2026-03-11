# Research Assets

This directory contains the non-web-app research material that was previously mixed into the repository root.

Structure:

- `notebooks/`: exploratory analysis, causal bootstrapping, model comparison, and model-training notebooks
- `data/`: encoded research datasets used by the notebooks
- `assets/`: research diagrams and supporting text assets

Notebook path assumptions:

- notebooks read datasets from `../data/`
- notebooks that export FastAPI artifacts write to `../../fastapi-backend/models/`

This separation keeps the repository root focused on application entry points and deployment files while preserving the existing research workflow.
