import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { axe } from 'vitest-axe'
import App from './App'

const defaultRules = [
  { threshold: 0, label: 'Low Risk' },
  { threshold: 0.35, label: 'Medium Risk' },
  { threshold: 0.7, label: 'High Risk' },
]

const predictionResponse = {
  risk_probability: 0.72,
  risk_percent: 72.0,
  risk_label: 'High Risk',
  uncertainty_std: 0.04,
  uncertainty_percent: 4.0,
  confidence_interval_95: [0.64, 0.8],
  model_name: 'MockModel',
  training_source: 'mock-source',
  risk_rules: defaultRules,
}

const numericRangeCases = [
  { label: 'Age', invalidValue: '0', expectedMessage: 'Age must be between 1 and 120.' },
  { label: 'Resting Blood Pressure (mm Hg)', invalidValue: '49', expectedMessage: 'Resting Blood Pressure (mm Hg) must be between 50 and 250.' },
  { label: 'Serum Cholesterol (mg/dl)', invalidValue: '701', expectedMessage: 'Serum Cholesterol (mg/dl) must be between 50 and 700.' },
  { label: 'Maximum Heart Rate (beats per minute)', invalidValue: '201', expectedMessage: 'Maximum Heart Rate (beats per minute) must be between 120 and 200.' },
  { label: 'Oldpeak', invalidValue: '10.1', expectedMessage: 'Oldpeak must be between 0 and 10.' },
  { label: 'Number of Major Vessels', invalidValue: '4', expectedMessage: 'Number of Major Vessels must be between 0 and 3.' },
]

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function createFetchMock(routes) {
  return vi.fn(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase()
    const fullPath = String(url).replace(/^https?:\/\/[^/]+/i, '')
    const key = `${method} ${fullPath}`
    const handler = routes[key]
    if (!handler) {
      throw new Error(`Unhandled fetch route: ${key}`)
    }
    if (typeof handler === 'function') {
      return handler({ method, fullPath, options })
    }
    return jsonResponse(handler.body, handler.status)
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('auth mode switch card toggles modern sign-up/sign-in copy', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Sign In / Sign Up' }))
  expect(await screen.findByText('New to the app?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /Create account/i }))
  expect(await screen.findByText('Already have an account?')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Sign in instead/i })).toBeInTheDocument()
})

test('app has no obvious accessibility violations in the auth panel', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  const { container } = render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign In / Sign Up' }))
  await screen.findByText('New to the app?')

  const results = await axe(container)
  expect(results.violations).toHaveLength(0)
})

test('signup requires matching confirmation and shows password guidance', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Sign In / Sign Up' }))
  fireEvent.click(await screen.findByRole('button', { name: /Create account/i }))

  expect(await screen.findByText(/Use at least 12 characters/i)).toBeInTheDocument()
  expect(screen.getByTestId('password-strength-fill')).toHaveStyle({ width: '0%' })
  expect(screen.getByTestId('password-confirm-status')).toHaveTextContent('Re-enter the password to confirm it.')

  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Long enough passphrase1!' } })
  expect(screen.getByTestId('password-strength-fill')).toHaveStyle({ width: '100%' })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Different passphrase1!' } })
  expect(screen.getByTestId('password-confirm-status')).toHaveTextContent('Passwords do not match yet.')
  fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form'))

  expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
})

test('signup shows matching confirmation state when passwords match', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Sign In / Sign Up' }))
  fireEvent.click(await screen.findByRole('button', { name: /Create account/i }))

  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Long enough passphrase1!' } })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Long enough passphrase1!' } })

  expect(await screen.findByTestId('password-confirm-status')).toHaveTextContent('Passwords match.')
  expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('aria-invalid', 'false')
})

test('custom select supports keyboard interaction', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  const user = userEvent.setup()
  render(<App />)

  const chestPainSelect = screen.getByRole('button', { name: 'Chest Pain Type' })
  chestPainSelect.focus()
  await user.keyboard('{ArrowDown}')
  await user.keyboard('{ArrowDown}{Enter}')

  expect(screen.getByRole('button', { name: 'Chest Pain Type' })).toHaveTextContent('Atypical Angina')
})

test('forgot password flow posts reset request and returns to login', async () => {
  let resetRequestBody = null
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
    'POST /crud-api/auth/password-reset/request': ({ options }) => {
      resetRequestBody = JSON.parse(options.body)
      return jsonResponse({ message: 'If the email exists, a reset link has been sent.' })
    },
  })

  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Sign In / Sign Up' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }).closest('form'))

  await waitFor(() => expect(resetRequestBody).toEqual({ email: 'user@example.com' }))
  expect(await screen.findByText('If the email exists, a reset link has been sent.')).toBeInTheDocument()
  expect(screen.getByText('New to the app?')).toBeInTheDocument()
})

test('recovery link flow updates password and authenticates the user', async () => {
  const previousPath = window.location.pathname + window.location.search
  window.history.replaceState({}, '', '/#type=recovery&access_token=recovery-token&expires_in=900')

  let confirmRequestBody = null
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
    'POST /crud-api/auth/password-reset/confirm': ({ options }) => {
      confirmRequestBody = JSON.parse(options.body)
      return jsonResponse({ authenticated: true, user: { id: 'u1', email: 'u@example.com' } })
    },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': { body: { results: [] } },
  })

  render(<App />)

  fireEvent.change(await screen.findByLabelText('New Password'), { target: { value: 'Long enough passphrase1!' } })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Long enough passphrase1!' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Update password' }).closest('form'))

  await waitFor(() => expect(confirmRequestBody).toEqual({
    accessToken: 'recovery-token',
    expiresIn: 900,
    password: 'Long enough passphrase1!',
  }))
  expect(await screen.findByText('Custom Risk Classification')).toBeInTheDocument()

  window.history.replaceState({}, '', previousPath || '/')
})

test('predict flow renders result card', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
    'POST /ml-api/predict': { body: predictionResponse },
  })

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Predict Risk' }))

  expect(await screen.findByText('High Risk')).toBeInTheDocument()
  expect(screen.getByText(/Probability:/i)).toBeInTheDocument()
})

test('form validation shows numeric-range error', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  render(<App />)
  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '0' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Predict Risk' }).closest('form'))

  expect(await screen.findByText('Age must be between 1 and 120.')).toBeInTheDocument()
})

test.each(numericRangeCases)('form validation rejects out-of-range value for $label', async ({ label, invalidValue, expectedMessage }) => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  render(<App />)
  fireEvent.change(screen.getByLabelText(label), { target: { value: invalidValue } })
  fireEvent.submit(screen.getByRole('button', { name: 'Predict Risk' }).closest('form'))

  expect(await screen.findByText(expectedMessage)).toBeInTheDocument()
})

test('save flow requires patient first and last name', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': { body: { results: [] } },
    'POST /ml-api/predict': { body: predictionResponse },
  })

  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Predict Risk' }))
  expect(await screen.findByText('Save This Result')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save This Result' }))

  expect(await screen.findByText('Enter first and last name before saving.')).toBeInTheDocument()
})

test('save flow posts patient name fields and shows saved confirmation', async () => {
  let saveRequestBody = null
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': { body: { results: [] } },
    'POST /ml-api/predict': { body: predictionResponse },
    'POST /crud-api/results': ({ options }) => {
      saveRequestBody = JSON.parse(options.body)
      return jsonResponse({
        id: 'saved-1',
        created_at: '2026-02-24T12:00:00Z',
        patient_first_name: saveRequestBody.patient_first_name,
        patient_last_name: saveRequestBody.patient_last_name,
        clinical_inputs: saveRequestBody.clinical_inputs,
        risk_probability: 0.72,
        risk_percent: 72,
        risk_label: 'High Risk',
        uncertainty_std: 0.04,
        uncertainty_percent: 4,
        confidence_interval_95: [0.64, 0.8],
      })
    },
  })

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Predict Risk' }))
  expect(await screen.findByRole('button', { name: 'Save This Result' })).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Patient First Name'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText('Patient Last Name'), { target: { value: 'Lovelace' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save This Result' }))

  await waitFor(() => expect(saveRequestBody).toBeTruthy())
  expect((await screen.findAllByText('Saved.')).length).toBeGreaterThan(0)
  expect(saveRequestBody.patient_first_name).toBe('Ada')
  expect(saveRequestBody.patient_last_name).toBe('Lovelace')
  expect(saveRequestBody.clinical_inputs).toBeTruthy()
})

test('save success popup can clear prediction result view', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': { body: { results: [] } },
    'POST /ml-api/predict': { body: predictionResponse },
    'POST /crud-api/results': {
      body: {
        id: 'saved-2',
        created_at: '2026-02-24T12:00:00Z',
        patient_first_name: 'Ada',
        patient_last_name: 'Lovelace',
        clinical_inputs: { age: 58 },
        risk_probability: 0.72,
        risk_percent: 72,
        risk_label: 'High Risk',
        uncertainty_std: 0.04,
        uncertainty_percent: 4,
        confidence_interval_95: [0.64, 0.8],
      },
    },
  })

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Predict Risk' }))
  expect(await screen.findByRole('button', { name: 'Save This Result' })).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Patient First Name'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText('Patient Last Name'), { target: { value: 'Lovelace' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save This Result' }))

  expect(await screen.findByRole('dialog', { name: 'Prediction Saved' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear Result View' }))

  await waitFor(() => {
    expect(screen.getByText('Submit the form to see prediction output.')).toBeInTheDocument()
  })
})

test('authenticated users can see saved patient names in history table', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': {
      body: {
        results: [
          {
            id: 'saved-1',
            created_at: '2026-02-24T12:00:00Z',
            patient_first_name: 'Ada',
            patient_last_name: 'Lovelace',
            clinical_inputs: {
              age: 58,
              trestbps: 132,
              chol: 224,
              thalach: 173,
              oldpeak: 3.2,
              ca: 2,
              sex: 'Male',
              cp: 'Asymptomatic',
              fbs: '<=120',
              restecg: 'Normal ECG',
              exang: 'Yes Ex Angina',
              slope: 'Flat',
              thal: 'Reversible Defect',
            },
            risk_probability: 0.72,
            risk_percent: 72,
            risk_label: 'High Risk',
            uncertainty_std: 0.04,
            uncertainty_percent: 4,
            confidence_interval_95: [0.64, 0.8],
          },
        ],
      },
    },
  })

  render(<App />)

  await waitFor(() => {
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Lovelace')).toBeInTheDocument()
  })

  const savedResultsTable = screen.getByRole('table', { name: /saved prediction results with clinical inputs/i })
  expect(within(savedResultsTable).getByText('Normal ECG')).toBeInTheDocument()
  expect(within(savedResultsTable).getByText('Reversible Defect')).toBeInTheDocument()
})

test('logout resets form, result, and batch state to defaults', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': {
      body: {
        results: [
          {
            id: 'saved-1',
            created_at: '2026-02-24T12:00:00Z',
            patient_first_name: 'Ada',
            patient_last_name: 'Lovelace',
            clinical_inputs: { age: 58, sex: 'Male', cp: 'Asymptomatic', trestbps: 132, chol: 224, thalach: 173, oldpeak: 3.2, ca: 2 },
            risk_probability: 0.72,
            risk_percent: 72,
            risk_label: 'High Risk',
            uncertainty_std: 0.04,
            uncertainty_percent: 4,
            confidence_interval_95: [0.64, 0.8],
          },
        ],
      },
    },
    'POST /ml-api/predict': { body: predictionResponse },
    'POST /ml-api/predict/batch-csv': {
      body: {
        total_rows: 1,
        predictions: [
          {
            row_number: 2,
            patient_first_name: 'Ada',
            patient_last_name: 'Lovelace',
            clinical_inputs: {
              age: 58,
              sex: 'Male',
              cp: 'Asymptomatic',
              trestbps: 132,
              chol: 224,
              thalach: 173,
              oldpeak: 3.2,
              ca: 2,
            },
            prediction: {
              ...predictionResponse,
            },
          },
        ],
      },
    },
    'POST /crud-api/auth/logout': { body: { message: 'logged out' } },
  })

  render(<App />)

  fireEvent.change(screen.getByLabelText('Age'), { target: { value: '63' } })
  fireEvent.click(screen.getByRole('button', { name: 'Predict Risk' }))
  expect(await screen.findByText('High Risk')).toBeInTheDocument()

  const fileInput = screen.getByLabelText(/Patient CSV file/i)
  const file = new File(
    [
      'patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope,thal\n'
      + 'Ada,Lovelace,58,132,224,173,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat,Reversible Defect\n',
    ],
    'patients.csv',
    { type: 'text/csv' },
  )
  fireEvent.change(fileInput, { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: 'Run Batch Prediction' }))
  expect(await screen.findByText('Batch prediction complete. Processed 1 row(s).')).toBeInTheDocument()
  expect(screen.getAllByText('Ada').length).toBeGreaterThan(0)

  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

  await waitFor(() => {
    expect(screen.getByText('Submit the form to see prediction output.')).toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: 'Sign In / Sign Up' })).toBeInTheDocument()
  expect(screen.queryByText('Custom Risk Classification')).not.toBeInTheDocument()
  expect(screen.queryByText('My Saved Results')).not.toBeInTheDocument()
  expect(screen.queryByText('Batch Results')).not.toBeInTheDocument()
  expect(screen.queryByText('Batch prediction complete. Processed 1 row(s).')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Age')).toHaveValue(58)
})

test('batch csv prediction processes multiple patients', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
    'POST /ml-api/predict/batch-csv': {
      body: {
        total_rows: 1,
        predictions: [
          {
            row_number: 2,
            patient_first_name: 'Ada',
            patient_last_name: 'Lovelace',
            clinical_inputs: {
              age: 58,
              sex: 'Male',
              cp: 'Asymptomatic',
              trestbps: 132,
              chol: 224,
              thalach: 173,
              oldpeak: 3.2,
              ca: 2,
            },
            prediction: {
              risk_probability: 0.72,
              risk_percent: 72,
              risk_label: 'High Risk',
              uncertainty_std: 0.04,
              uncertainty_percent: 4,
              confidence_interval_95: [0.64, 0.8],
              model_name: 'MockModel',
              training_source: 'mock-source',
              risk_rules: defaultRules,
            },
          },
        ],
      },
    },
  })

  render(<App />)
  const fileInput = screen.getByLabelText(/Patient CSV file/i)
  const file = new File(
    [
      'patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope,thal\n'
      + 'Ada,Lovelace,58,132,224,173,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat,Reversible Defect\n',
    ],
    'patients.csv',
    { type: 'text/csv' },
  )

  fireEvent.change(fileInput, { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: 'Run Batch Prediction' }))

  expect(await screen.findByText('Batch prediction complete. Processed 1 row(s).')).toBeInTheDocument()
  expect(screen.getAllByText('Ada').length).toBeGreaterThan(0)
})

test('batch prediction rejects non-csv uploads before request', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: false, user: null } },
  })

  render(<App />)
  const fileInput = screen.getByLabelText(/Patient CSV file/i)
  const file = new File(['not,a,csv,for,this,app'], 'patients.txt', { type: 'text/plain' })

  fireEvent.change(fileInput, { target: { files: [file] } })
  expect(await screen.findByText('Uploaded batch file must be a CSV.')).toBeInTheDocument()
  expect(fileInput).toHaveAttribute('aria-invalid', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Run Batch Prediction' }))

  expect(globalThis.fetch).toHaveBeenCalledTimes(1)
})

test('batch tile appears above saved results for signed-in users', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': { body: { results: [] } },
  })

  render(<App />)

  const batchHeading = await screen.findByRole('heading', { name: 'Batch Prediction (CSV)' })
  const savedHeading = await screen.findByRole('heading', { name: 'My Saved Results' })
  const relation = batchHeading.compareDocumentPosition(savedHeading)
  expect((relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
})

test('batch prediction results can be saved to history', async () => {
  let savedCalls = 0
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': { body: { results: [] } },
    'POST /ml-api/predict/batch-csv': {
      body: {
        total_rows: 1,
        predictions: [
          {
            row_number: 2,
            patient_first_name: 'Ada',
            patient_last_name: 'Lovelace',
            clinical_inputs: {
              age: 58,
              sex: 'Male',
              cp: 'Asymptomatic',
              trestbps: 132,
              chol: 224,
              thalach: 173,
              oldpeak: 3.2,
              ca: 2,
            },
            prediction: {
              risk_probability: 0.72,
              risk_percent: 72,
              risk_label: 'High Risk',
              uncertainty_std: 0.04,
              uncertainty_percent: 4,
              confidence_interval_95: [0.64, 0.8],
              model_name: 'MockModel',
              training_source: 'mock-source',
              risk_rules: defaultRules,
            },
          },
        ],
      },
    },
    'POST /crud-api/results': {
      body: {
        id: 'saved-batch-1',
        created_at: '2026-02-24T12:00:00Z',
        patient_first_name: 'Ada',
        patient_last_name: 'Lovelace',
        clinical_inputs: { age: 58, sex: 'Male', cp: 'Asymptomatic', trestbps: 132, chol: 224, thalach: 173, oldpeak: 3.2, ca: 2 },
        risk_probability: 0.72,
        risk_percent: 72,
        risk_label: 'High Risk',
        uncertainty_std: 0.04,
        uncertainty_percent: 4,
        confidence_interval_95: [0.64, 0.8],
      },
    },
  })

  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn(async (...args) => {
    const [url, options = {}] = args
    const method = (options.method || 'GET').toUpperCase()
    if (method === 'POST' && String(url).includes('/crud-api/results')) {
      savedCalls += 1
    }
    return originalFetch(...args)
  })

  render(<App />)
  const fileInput = screen.getByLabelText(/Patient CSV file/i)
  const file = new File(
    [
      'patient_first_name,patient_last_name,age,trestbps,chol,thalach,oldpeak,ca,sex,cp,fbs,restecg,exang,slope,thal\n'
      + 'Ada,Lovelace,58,132,224,173,3.2,2,Male,Asymptomatic,<=120,Normal ECG,Yes Ex Angina,Flat,Reversible Defect\n',
    ],
    'patients.csv',
    { type: 'text/csv' },
  )

  fireEvent.change(fileInput, { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: 'Run Batch Prediction' }))
  expect(await screen.findByText('Batch prediction complete. Processed 1 row(s).')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Save Batch Results' }))
  expect(await screen.findByText('Saved 1 batch result(s).', { selector: '.save-message' })).toBeInTheDocument()
  expect(savedCalls).toBe(1)
})

test('risk settings require a zero threshold and at least two rules', async () => {
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: defaultRules } },
    'GET /crud-api/results': { body: { results: [] } },
  })

  render(<App />)

  const thresholdInputs = await screen.findAllByLabelText('Threshold')
  fireEvent.change(thresholdInputs[0], { target: { value: '0.1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Rules' }))
  expect(await screen.findByText('One threshold must be 0.')).toBeInTheDocument()
  fireEvent.change(screen.getAllByLabelText('Threshold')[0], { target: { value: '0' } })

  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[2])
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1])
  expect(await screen.findByText('At least two rules are required.')).toBeInTheDocument()
})

test('three thresholds apply low medium high tones by threshold order', async () => {
  const orderedRules = [
    { threshold: 0.0, label: 'Stable' },
    { threshold: 0.45, label: 'Watch' },
    { threshold: 0.8, label: 'Urgent' },
  ]
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: orderedRules } },
    'GET /crud-api/results': { body: { results: [] } },
    'POST /ml-api/predict': {
      body: {
        ...predictionResponse,
        risk_label: 'Watch',
        risk_rules: orderedRules,
      },
    },
  })

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Predict Risk' }))

  const riskLabel = await screen.findByText('Watch', { selector: '.risk-label' })
  expect(riskLabel.className).toContain('medium')
})

test('more than three thresholds removes risk color coding', async () => {
  const manyRules = [
    { threshold: 0.0, label: 'Tier 1' },
    { threshold: 0.25, label: 'Tier 2' },
    { threshold: 0.5, label: 'Tier 3' },
    { threshold: 0.75, label: 'Tier 4' },
  ]
  globalThis.fetch = createFetchMock({
    'GET /crud-api/auth/me': { body: { authenticated: true, user: { id: 'u1', email: 'u@example.com' } } },
    'GET /crud-api/risk-settings': { body: { rules: manyRules } },
    'GET /crud-api/results': { body: { results: [] } },
    'POST /ml-api/predict': {
      body: {
        ...predictionResponse,
        risk_label: 'Tier 4',
        risk_rules: manyRules,
      },
    },
  })

  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Predict Risk' }))

  const riskLabel = await screen.findByText('Tier 4', { selector: '.risk-label' })
  expect(riskLabel.className).not.toContain('high')
  expect(riskLabel.className).not.toContain('medium')
  expect(riskLabel.className).not.toContain('low')
})
