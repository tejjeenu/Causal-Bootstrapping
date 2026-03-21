# CRUD API Guide (Spring Boot + Supabase)

Base URL (local): `http://localhost:8080`

This service owns:

- authentication session endpoints
- risk-rule CRUD
- prediction result CRUD against Supabase Postgres

## Run Locally

```powershell
cd spring-backend
# one-time setup
Copy-Item .env.example .env
# edit .env with your Supabase values
.\mvnw.cmd spring-boot:run
```

The service auto-loads:

- `spring-backend/.env`

Required configuration values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optional:

- `SUPABASE_RESULTS_TABLE` (default `prediction_results`)
- `SUPABASE_RISK_SETTINGS_TABLE` (default `risk_classification_settings`)
- `AUTH_COOKIE_NAME` (default `cb_auth_token`)
- `AUTH_COOKIE_SECURE` (default `false`)
- `AUTH_COOKIE_SAMESITE` (default `Lax`)
- `SIGNUP_PASSWORD_MIN_LENGTH` (default `12`)
- `AUTH_RATE_LIMIT_WINDOW_SECONDS` (default `900`)
- `AUTH_LOGIN_MAX_ATTEMPTS` (default `8`)
- `AUTH_SIGNUP_MAX_ATTEMPTS` (default `5`)
- `CORS_ORIGINS`
- `CRUD_API_PORT` (default `8080`)

## Main Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `GET /risk-settings`
- `PUT /risk-settings`
- `GET /results`
- `POST /results`
- `PATCH /results/{resultId}`
- `DELETE /results/{resultId}`

Auth notes:

- signup passwords must meet the stronger passphrase policy enforced by the backend
- login and signup are rate limited in-memory by client IP and normalized email
- non-local deployments must enable `AUTH_COOKIE_SECURE=true`

`PUT /risk-settings` rule constraints:

- at least 2 rules
- thresholds must be unique
- one threshold must be `0`
- thresholds must remain in `[0, 1]`

## Save Result Payload

`POST /results` expects model output from the ML API and persists it as-is:

```json
{
  "patient_first_name": "Ada",
  "patient_last_name": "Lovelace",
  "clinical_inputs": {
    "age": 58,
    "sex": "Male"
  },
  "risk_probability": 0.72,
  "risk_percent": 72.0,
  "risk_label": "High Risk",
  "uncertainty_std": 0.04,
  "uncertainty_percent": 4.0,
  "confidence_interval_95": [0.64, 0.80]
}
```

This keeps inference execution fully externalized to the ML API.
