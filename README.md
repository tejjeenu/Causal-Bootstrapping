# Causal ML on UCI Heart Disease (Angiographic CAD)

This project was both an investigation and a build opportunity: an investigation into whether CAD prediction performance reflects stable causal signal versus confounded associations, and an opportunity to create a clinician-facing tool that is more causally robust in practice.

Live web application:
- https://cad-causal-risk-predictor.web.app/

---

## Problem

Many machine learning models report around 80-82% accuracy on the UCI Heart Disease angiographic CAD prediction task. However:

- The dataset is observational, not randomized
- Key variables such as age and sex are strong confounders of CAD
- High predictive performance may reflect correlation, not causation
- Models may fail under distribution shift or intervention-like settings

As a result, it is unclear whether reported performance represents meaningful individual-level prediction or merely exploits confounded statistical structure.

---

## Solution

This project evaluates predictive performance before and after causal deconfounding using causal bootstrapping, allowing us to test whether ML models rely on:

- Genuine causal signal, or
- Confounding-driven associations

The approach explicitly encodes causal assumptions via a directed acyclic graph (DAG) and resamples data to approximate a deconfounded interventional distribution.

The intent is to prioritize the model that remains most reliable after this stress test (best calibration and stable discrimination), and use that model in a web app designed for clinician workflows.

---

## Causal Diagram

![Causal DAG used for deconfounding and model selection](research/assets/causaldiagram.png)

---

## Intended Model Comparison Strategy

The repo is designed to compare model behavior under different causal/data-shift conditions using this workflow:

1. Define causal assumptions with a DAG and generate deconfounded training datasets (for example backdoor and truncated-factorization variants).
2. Keep a confounded holdout split from the original observational data as a reality-check evaluation set.
3. Train multiple candidate classifiers on each deconfounded training dataset under the same feature schema.
4. Evaluate each candidate under all four train/test pairings:
   - Confounded -> Confounded
   - Confounded -> Deconfounded
   - Deconfounded -> Confounded
   - Deconfounded -> Deconfounded
5. Report prediction performance as mean and standard deviation for each metric (`accuracy`, `roc_auc`, `pr_auc`, `brier`, `log_loss`) within each pairing.
6. Choose models by evaluation context rather than a single global ranking:
   - In-distribution performance: use Confounded -> Confounded and Deconfounded -> Deconfounded.
   - Causal-mechanism shift performance: use Confounded -> Deconfounded and Deconfounded -> Confounded.
   - Deconfounded-trained models should be relatively insensitive to confounding signals.
   - Confounded-trained models should show sensitivity when confounding is removed.
7. Retrain/deploy only after selecting the context-appropriate model.
8. Train bootstrap replicas for uncertainty estimation and package everything into a single inference artifact for the API.

Interpretation of "causally robust" in this project:
- A model is treated as more causally robust if deconfounded-trained performance remains stable across Deconfounded -> Deconfounded and Deconfounded -> Confounded, while maintaining reasonable discrimination and calibration.
- This is an intended robustness proxy under stated DAG assumptions, not proof of true causal identification.

Current repository snapshot:
- The FastAPI service is configured to use a single sigmoid-calibrated XGBoost artifact path via `MODEL_ARTIFACT_PATH` (no fallback model path).
- The shipped inference artifact is rebuilt from `research/data/heart_disease_preprocessed_backdoor.csv` with post-hoc probability calibration to reduce the extreme 0/100-style probabilities produced by the raw model.

Repository layout:
- `frontend/`, `fastapi-backend/`, and `spring-backend/` contain the deployable web application services.
- `research/notebooks/` contains the standalone analysis and training notebooks.
- `research/data/` contains the research CSV datasets used by those notebooks.
- `research/assets/` contains causal diagrams and supporting research assets.

---

## Method Overview

- Causal DAG Specification
  - Age, Sex -> CAD (confounding)
  - Clinical features (cholesterol, blood pressure, etc.) -> CAD
  - Optional pathways: Age/Sex -> clinical features

- Causal Bootstrapping
  - Based on Nunes et al. (2019)
  - Resamples observational data to remove confounding effects implied by the DAG

- Model Training
  - Train identical classifiers on:
    - Original (associational) dataset
    - Deconfounded (causal bootstrap) dataset

- Performance Comparison
  - Compare expected predictive quality and calibration
  - Quantify uncertainty via repeated bootstrapping and cross-validation

---

## Functionalities

- Explicit causal modeling via DAG assumptions
- Causal bootstrapping to remove confounding structure
- Side-by-side evaluation of associational vs causal performance
- Multiple classifiers for robustness analysis
- Bootstrap-based confidence intervals for performance differences
- Calibration analysis to assess probabilistic reliability

---

## Technologies Used

- Python
- scikit-learn - classical ML models and evaluation
- NumPy / Pandas - data processing
- Causal bootstrapping - implementation following Nunes et al. (2019)

Optional:
- XGBoost / LightGBM
- PyTorch or Keras (simple neural networks)

---

## Evaluation Metrics

To ensure clinically and causally meaningful evaluation, the analysis prioritizes proper scoring rules and calibration metrics over threshold-dependent accuracy.

### Primary metrics
- Brier Score (expected squared error of predicted probabilities)
- Calibration slope and intercept

### Secondary metrics
- ROC AUC
- Precision-Recall AUC
- Log loss (cross-entropy)

### Optional decision-oriented analysis
- Decision curve analysis (net benefit across risk thresholds)

### Uncertainty estimation
- Repeated causal bootstrapping
- Cross-validation
- Bootstrap confidence intervals on metric differences between original and deconfounded datasets

Key quantities of interest:
- Delta Brier = Brier(deconfounded) - Brier(original)
- Delta Calibration slope
- Delta ROC AUC

---

## Impact

This project provides a causal stress test for medical machine learning models by:

- Distinguishing predictive accuracy from causal validity
- Revealing when performance collapses after deconfounding
- Demonstrating risks of deploying associational models in clinical settings
- Encouraging causal thinking in healthcare ML evaluation

It also translates those findings into deployment choices: prefer causally robust model behavior over headline associational accuracy when exposing predictions to clinicians.

In other words, the work is not only analytical; it is also translational, using the investigation to shape a practical clinical application.

---

## Expected Outcome

- Significant degradation after deconfounding
  - Indicates reliance on confounded associations
- Minimal change after deconfounding
  - Suggests predictive signal persists beyond major confounders
- Unstable or counterintuitive changes
  - Highlight sensitivity to causal assumptions and limited sample size

> This analysis does not prove causality, but evaluates whether predictive success is robust to causal deconfounding under explicit assumptions.

---

## References

- UCI Heart Disease Dataset
  https://archive.ics.uci.edu/dataset/45/heart+disease

- Nunes et al., Causal Bootstrapping
  https://arxiv.org/abs/1910.09648

- Example angiographic CAD clinical study
  https://www.sciencedirect.com/science/article/pii/0002914989905249

---

## Application Architecture Choices (2026)

Live web application:
- https://cad-causal-risk-predictor.web.app/

The web app is intentionally split into small, technology-specific modules rather than one large full-stack service.

Core modules:
- `frontend/`: React + Vite user interface, built as static assets and served behind a reverse proxy in the Docker stack.
- `fastapi-backend/`: Python inference service for model loading, feature encoding, batch CSV prediction, and probability estimation.
- `spring-backend/`: Java service for authentication, session handling, and CRUD over Supabase-backed user data.
- `research/`: notebooks, datasets, and causal analysis assets kept outside the deployable runtime path.

Why the app is modular:
- The ML runtime is isolated from auth and persistence so model-serving code can stay in Python, where the training artifacts, preprocessing logic, and calibration workflow already live.
- Auth and CRUD are isolated from inference so application state, user sessions, and Supabase integration can evolve without forcing changes to the ML API contract.
- The split creates clear ownership boundaries: the frontend requests predictions from FastAPI, and only the Spring service reads or writes app-specific user data.
- Research assets remain separate from deployable services so exploratory notebooks and training files do not become accidental runtime dependencies.
- This structure also allows the inference API to be reused by other clients or scripts without carrying the rest of the web app with it.

Why these runtime choices were made:
- FastAPI was chosen for inference because the deployed artifact is a Python `joblib` bundle built from the same ecosystem used for training and calibration.
- Spring Boot was chosen for auth and CRUD because the app needs a stable service layer around sessions, request validation, response DTOs, and Supabase-backed business rules.
- The frontend stays thin and API-driven so browser code focuses on clinician workflows, accessibility, and validation rather than embedding backend concerns.

Why Docker and Compose are part of the architecture:
- Each service has its own Dockerfile so its runtime dependencies are packaged independently and can be started in a production-like shape.
- `docker-compose.yml` exists to reproduce the real topology locally: one frontend container, one ML container, and one CRUD container on the same network.
- This catches environment and integration problems earlier, especially model-path issues, proxy routing, service-to-service communication, and per-service configuration drift.
- The frontend container uses Nginx to serve the built app and proxy `/ml-api/*` and `/crud-api/*`, which keeps the browser on a single origin and reduces CORS complexity.
- The same path-based contract is mirrored in local development through the Vite proxy, so the frontend can call stable routes in both dev and deployment-style runs.

Other significant design choices:
- Spring reads its own `.env` file and FastAPI reads its own model/config environment, which keeps secrets and service configuration scoped to the service that actually needs them.
- Supabase is used as the persistence layer, but access is mediated through the Spring API so table access rules, auth checks, and response shaping stay centralized.
- The deployed model artifact is a sigmoid-calibrated XGBoost bundle rather than the raw classifier because the UI exposes patient-level risk percentages, not just score ranking.
- Sigmoid calibration was chosen as the conservative fit for this dataset size: it reduces overconfident probabilities without changing the overall service contract or requiring a separate calibration service.
- The frontend was built with responsive and accessible interaction patterns because the app is intended to remain usable across desktop and mobile clinician workflows, not just as a desktop demo.

Clinical intent in the web app:
- Surface predictions from the model chosen for the intended deployment context, with preference for causally robust behavior over the highest raw associational score.
- Let clinical domain knowledge be represented explicitly (for example via configurable risk settings/thresholds and labels).
- Improve reliability of patient-level risk estimates by combining data-driven learning with domain-informed rules.

Accessibility and device portability:
- The frontend includes keyboard-oriented accessibility patterns such as a skip link, visible focus states, semantic form labels, ARIA live regions, alert messaging, dialog semantics, and accessible custom dropdown roles.
- Error states are exposed to assistive technologies through `role="alert"`, `aria-invalid`, and `aria-describedby` where relevant.
- Motion-sensitive users are supported with reduced-motion handling via `prefers-reduced-motion`.
- The layout is responsive across desktop, tablet, and phone breakpoints so prediction, authentication, batch upload, and saved-results workflows remain usable across multiple device sizes.
- Mobile-specific spacing and stacking behavior were adjusted so controls such as authentication actions and categorical dropdowns remain readable and usable on smaller screens.
- Batch upload guidance and file-type validation are surfaced in the UI so users receive immediate feedback rather than only backend failure messages.

Probability calibration:
- The deployed FastAPI artifact is now a sigmoid-calibrated XGBoost classifier rather than the raw XGBoost probability output.
- Calibration is intended to make reported probabilities less overconfident while preserving ranking performance as much as possible.
- To rebuild the calibrated artifact locally, run `python fastapi-backend/scripts/build_calibrated_xgboost_artifact.py`.

Calibration reasoning:
- Raw gradient-boosted models often rank patients well but produce probabilities that are too extreme.
- In this project, the uncalibrated model frequently clustered outputs near 0 or 1, which is undesirable when the UI presents the number as a patient-facing risk estimate.
- Post-hoc calibration keeps the trained decision function but learns a mapping from raw score to probability using held-out structure from the training data.
- Sigmoid calibration was chosen as a conservative option for a relatively small dataset because it usually overfits less than isotonic calibration.
- The goal is not to change which patients are relatively riskier than others; the goal is to make a predicted `p` behave more like an actual frequency estimate.
- This is especially important here because the web app surfaces percentages, not only rank ordering or binary labels.

See:

- [`WEBAPP_SETUP.md`](WEBAPP_SETUP.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/ML_API.md`](docs/ML_API.md)
- [`docs/CRUD_API.md`](docs/CRUD_API.md)
- [`docs/DEPLOY_RENDER_FIREBASE.md`](docs/DEPLOY_RENDER_FIREBASE.md)
