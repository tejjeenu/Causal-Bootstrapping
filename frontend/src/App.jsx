import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const LEGACY_API_BASE = import.meta.env.VITE_API_BASE_URL
const LOCAL_ML_API_BASE = '/ml-api'
const LOCAL_CRUD_API_BASE = '/crud-api'
const ML_API_BASE_FROM_ENV = import.meta.env.VITE_ML_API_BASE_URL ?? LEGACY_API_BASE ?? LOCAL_ML_API_BASE
const CRUD_API_BASE_FROM_ENV = import.meta.env.VITE_CRUD_API_BASE_URL ?? LEGACY_API_BASE ?? LOCAL_CRUD_API_BASE

const isLocalHostname = () => {
  if (typeof window === 'undefined') return false
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}

const ML_API_BASE = isLocalHostname() ? LOCAL_ML_API_BASE : ML_API_BASE_FROM_ENV
const CRUD_API_BASE = isLocalHostname() ? LOCAL_CRUD_API_BASE : CRUD_API_BASE_FROM_ENV

const NUMERIC_FIELDS = [
  { key: 'age', label: 'Age', min: 1, max: 120, step: 1 },
  { key: 'trestbps', label: 'Resting Blood Pressure (mm Hg)', min: 50, max: 250, step: 1 },
  { key: 'chol', label: 'Serum Cholesterol (mg/dl)', min: 50, max: 700, step: 1 },
  { key: 'thalach', label: 'Maximum Heart Rate (beats per minute)', min: 120, max: 200, step: 1 },
  { key: 'oldpeak', label: 'Oldpeak', min: 0, max: 10, step: 0.1 },
  { key: 'ca', label: 'Number of Major Vessels', min: 0, max: 3, step: 1 },
]

const CATEGORICAL_FIELDS = [
  { key: 'sex', label: 'Sex', options: ['Female', 'Male'] },
  { key: 'cp', label: 'Chest Pain Type', options: ['Asymptomatic', 'Atypical Angina', 'NonAnginal Pain', 'Typical Angina'] },
  { key: 'fbs', label: 'Fasting Blood Sugar (mg/dl)', options: ['<=120', '>120'] },
  { key: 'restecg', label: 'Resting ECG', options: ['LV Hypertrophy', 'Normal ECG', 'ST-T Abnormality'] },
  { key: 'exang', label: 'Exercise Induced Angina', options: ['No Ex Angina', 'Yes Ex Angina'] },
  { key: 'slope', label: 'ST Slope', options: ['Downsloping', 'Flat', 'Upsloping'] },
  { key: 'thal', label: 'Thallium Stress Test', options: ['Fixed Defect', 'Normal', 'Reversible Defect'] },
]

const DEFAULT_FORM = {
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
}

const SIGNUP_PASSWORD_MIN_LENGTH = 12
const DEFAULT_AUTH_FORM = { email: '', password: '', confirmPassword: '' }
const DEFAULT_PASSWORD_RECOVERY = { accessToken: '', expiresIn: 3600 }
const DEFAULT_RULES = [
  { threshold: 0, label: 'Low Risk' },
  { threshold: 0.35, label: 'Medium Risk' },
  { threshold: 0.7, label: 'High Risk' },
]
const ZERO_THRESHOLD_TOLERANCE = 1e-10
const DEFAULT_SAVE_IDENTITY = { firstName: '', lastName: '' }
const DEFAULT_CONFIRM_DIALOG = { open: false, type: '', resultId: '', title: '', message: '' }
const BATCH_TEMPLATE_HEADERS = [
  'patient_first_name',
  'patient_last_name',
  'age',
  'trestbps',
  'chol',
  'thalach',
  'oldpeak',
  'ca',
  'sex',
  'cp',
  'fbs',
  'restecg',
  'exang',
  'slope',
  'thal',
]
const BATCH_TEMPLATE_EXAMPLE_ROW = [
  'Ada',
  'Lovelace',
  '58',
  '132',
  '224',
  '173',
  '3.2',
  '2',
  'Male',
  'Asymptomatic',
  '<=120',
  'Normal ECG',
  'Yes Ex Angina',
  'Flat',
  'Reversible Defect',
]
const SAVED_INPUT_COLUMNS = [
  { key: 'age', label: 'Age' },
  { key: 'trestbps', label: 'Resting BP' },
  { key: 'chol', label: 'Cholesterol' },
  { key: 'thalach', label: 'Max HR' },
  { key: 'oldpeak', label: 'Oldpeak' },
  { key: 'ca', label: 'Vessels (CA)' },
  { key: 'sex', label: 'Sex' },
  { key: 'cp', label: 'Chest Pain' },
  { key: 'fbs', label: 'Fasting Blood Sugar' },
  { key: 'restecg', label: 'Resting ECG' },
  { key: 'exang', label: 'Exercise Angina' },
  { key: 'slope', label: 'ST Slope' },
  { key: 'thal', label: 'Thallium Test' },
]

const isCsvFile = (file) => {
  if (!file) return false
  const fileName = String(file.name ?? '').toLowerCase()
  const fileType = String(file.type ?? '').toLowerCase()
  return fileName.endsWith('.csv') || fileType.includes('csv')
}

const getPasswordStrengthColor = (score, meetsPolicy) => {
  if (score <= 0) return '#dce7f1'
  if (!meetsPolicy || score <= 1) return '#d5281b'
  if (score === 2) return '#f0a121'
  if (score === 3) return '#d6a300'
  if (score === 4) return '#1682c5'
  return '#007f3b'
}

const allCharactersIdentical = (value) => {
  if (!value) return false
  return value.split('').every((character) => character === value[0])
}

const getPasswordStrength = (password, email = '') => {
  const normalizedPassword = String(password ?? '')
  const trimmedPassword = normalizedPassword.trim()
  const normalizedEmail = String(email ?? '').trim().toLowerCase()
  const emailLocalPart = normalizedEmail.includes('@') ? normalizedEmail.split('@', 1)[0] : ''
  const containsEmailName = emailLocalPart.length >= 4 && trimmedPassword.toLowerCase().includes(emailLocalPart)
  const hasLetter = /[a-z]/i.test(trimmedPassword)
  const hasLower = /[a-z]/.test(trimmedPassword)
  const hasUpper = /[A-Z]/.test(trimmedPassword)
  const hasDigit = /\d/.test(trimmedPassword)
  const hasSymbol = /[^A-Za-z0-9\s]/.test(trimmedPassword)
  const uniqueChars = new Set(trimmedPassword.toLowerCase()).size
  const repeatedCharacter = allCharactersIdentical(trimmedPassword)

  let score = 0
  if (trimmedPassword.length >= SIGNUP_PASSWORD_MIN_LENGTH) score += 2
  else if (trimmedPassword.length >= 8) score += 1
  if (hasLower && hasUpper) score += 1
  if (hasDigit) score += 1
  if (hasSymbol) score += 1
  if (uniqueChars >= 8) score += 1
  if (containsEmailName) score -= 2
  if (repeatedCharacter) score -= 2
  if (!hasLetter) score -= 1

  const normalizedScore = Math.max(0, Math.min(score, 5))
  const meetsPolicy =
    trimmedPassword.length >= SIGNUP_PASSWORD_MIN_LENGTH
    && hasLetter
    && hasDigit
    && hasSymbol
    && !repeatedCharacter
    && !containsEmailName

  if (!trimmedPassword) {
    return {
      score: 0,
      label: 'Add a password',
      detail: `Use at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters with a letter, number, and symbol.`,
      meetsPolicy: false,
    }
  }

  if (!meetsPolicy) {
    if (trimmedPassword.length < SIGNUP_PASSWORD_MIN_LENGTH) {
      return {
        score: normalizedScore,
        label: 'Too short',
        detail: `Use at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters with a letter, number, and symbol.`,
        meetsPolicy: false,
      }
    }
    if (!hasLetter) {
      return {
        score: normalizedScore,
        label: 'Too weak',
        detail: 'Include at least one letter.',
        meetsPolicy: false,
      }
    }
    if (!hasDigit) {
      return {
        score: normalizedScore,
        label: 'Too weak',
        detail: 'Include at least one digit.',
        meetsPolicy: false,
      }
    }
    if (!hasSymbol) {
      return {
        score: normalizedScore,
        label: 'Too weak',
        detail: 'Include at least one symbol.',
        meetsPolicy: false,
      }
    }
    if (repeatedCharacter) {
      return {
        score: normalizedScore,
        label: 'Too weak',
        detail: 'Avoid repeating the same character.',
        meetsPolicy: false,
      }
    }
    return {
      score: normalizedScore,
      label: 'Too weak',
      detail: 'Avoid using the email name in the password.',
      meetsPolicy: false,
    }
  }

  if (normalizedScore >= 5) {
    return {
      score: normalizedScore,
      label: 'Strong',
      detail: 'Good password. Keep it unique to this app.',
      meetsPolicy: true,
    }
  }
  if (normalizedScore >= 3) {
    return {
      score: normalizedScore,
      label: 'Good',
      detail: 'Solid baseline. More length makes it stronger.',
      meetsPolicy: true,
    }
  }
  return {
    score: normalizedScore,
    label: 'Fair',
    detail: 'Valid, but longer passphrases are better.',
    meetsPolicy: true,
  }
}

const getFocusableElements = (container) => {
  if (!container) return []
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
}

function useDialogAccessibility(open, containerRef, onClose) {
  useEffect(() => {
    if (!open) return undefined

    const previousActiveElement = document.activeElement
    const focusables = getFocusableElements(containerRef.current)
    const firstFocusable = focusables[0]
    const lastFocusable = focusables[focusables.length - 1]
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus()
    } else if (containerRef.current instanceof HTMLElement) {
      containerRef.current.focus()
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || focusables.length === 0) {
        return
      }

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault()
        lastFocusable.focus()
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus()
      }
    }
  }, [containerRef, onClose, open])
}

function CurvedSelect({ id, label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedIndex = Math.max(0, options.indexOf(value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  useEffect(() => {
    setActiveIndex(selectedIndex)
  }, [selectedIndex])

  useEffect(() => {
    if (!open) return undefined

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined

    const optionToFocus = optionRefs.current[activeIndex] ?? optionRefs.current[selectedIndex]
    if (optionToFocus instanceof HTMLElement) {
      optionToFocus.focus()
    }
  }, [activeIndex, open, selectedIndex])

  const closeMenu = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
  }

  const selectOption = (option) => {
    onChange(option)
    closeMenu()
  }

  const focusOptionAt = (index) => {
    const boundedIndex = Math.max(0, Math.min(options.length - 1, index))
    setActiveIndex(boundedIndex)
    optionRefs.current[boundedIndex]?.focus()
  }

  const handleTriggerKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      return
    }
    event.preventDefault()
    if (event.key === 'ArrowUp') {
      setActiveIndex(selectedIndex)
    } else {
      setActiveIndex(selectedIndex)
    }
    setOpen(true)
  }

  const handleOptionKeyDown = (event, index, option) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOptionAt(index + 1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOptionAt(index - 1)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusOptionAt(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusOptionAt(options.length - 1)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(option)
    }
  }

  return (
    <div className={`curved-select${open ? ' open' : ''}`} ref={rootRef}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className={`curved-select-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-label={label}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{value}</span>
        <span aria-hidden="true" className="curved-select-chevron">
          <svg viewBox="0 0 14 8" focusable="false">
            <path d="M1 1.5L7 6.5L13 1.5" />
          </svg>
        </span>
      </button>
      {open && (
        <ul id={`${id}-listbox`} role="listbox" className="curved-select-menu">
          {options.map((option, index) => (
            <li key={option} role="presentation">
              <button
                type="button"
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={option === value}
                ref={(element) => {
                  optionRefs.current[index] = element
                }}
                tabIndex={activeIndex === index ? 0 : -1}
                className={`curved-select-option${option === value ? ' selected' : ''}`}
                onClick={() => selectOption(option)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index, option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [authPanelOpen, setAuthPanelOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState(DEFAULT_AUTH_FORM)
  const [passwordRecovery, setPasswordRecovery] = useState(DEFAULT_PASSWORD_RECOVERY)
  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const [formState, setFormState] = useState(DEFAULT_FORM)
  const [result, setResult] = useState(null)
  const [lastPredictionPayload, setLastPredictionPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [animatedRiskPercent, setAnimatedRiskPercent] = useState(0)
  const [animatedRiskProbability, setAnimatedRiskProbability] = useState(0)

  const [riskRules, setRiskRules] = useState(DEFAULT_RULES)
  const [riskSettingsLoading, setRiskSettingsLoading] = useState(false)
  const [riskSettingsSaving, setRiskSettingsSaving] = useState(false)
  const [riskSettingsError, setRiskSettingsError] = useState('')
  const [riskSettingsMessage, setRiskSettingsMessage] = useState('')

  const [savedResults, setSavedResults] = useState([])
  const [selectedRiskLabels, setSelectedRiskLabels] = useState([])
  const [riskFiltersTouched, setRiskFiltersTouched] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [deletingResultId, setDeletingResultId] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteMessage, setDeleteMessage] = useState('')
  const [editingResultId, setEditingResultId] = useState('')
  const [editIdentity, setEditIdentity] = useState(DEFAULT_SAVE_IDENTITY)
  const [nameUpdateLoadingId, setNameUpdateLoadingId] = useState('')
  const [nameUpdateError, setNameUpdateError] = useState('')
  const [nameUpdateMessage, setNameUpdateMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(DEFAULT_CONFIRM_DIALOG)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveSuccessDialogOpen, setSaveSuccessDialogOpen] = useState(false)
  const [saveIdentity, setSaveIdentity] = useState(DEFAULT_SAVE_IDENTITY)
  const [batchFile, setBatchFile] = useState(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchError, setBatchError] = useState('')
  const [batchMessage, setBatchMessage] = useState('')
  const [batchResults, setBatchResults] = useState([])
  const [batchSaveLoading, setBatchSaveLoading] = useState(false)
  const [batchSaveError, setBatchSaveError] = useState('')
  const [batchSaveMessage, setBatchSaveMessage] = useState('')
  const [batchFileInputKey, setBatchFileInputKey] = useState(0)
  const confirmDialogRef = useRef(null)
  const saveSuccessDialogRef = useRef(null)
  const isSignupMode = authMode === 'signup'
  const isResetRequestMode = authMode === 'reset-request'
  const isResetConfirmMode = authMode === 'reset-confirm'
  const showPasswordPolicy = isSignupMode || isResetConfirmMode
  const passwordStrength = useMemo(
    () => getPasswordStrength(authForm.password, authForm.email),
    [authForm.email, authForm.password],
  )
  const passwordStrengthPercent = useMemo(
    () => Math.max(0, Math.min(100, (passwordStrength.score / 5) * 100)),
    [passwordStrength.score],
  )
  const passwordStrengthColor = useMemo(
    () => getPasswordStrengthColor(passwordStrength.score, passwordStrength.meetsPolicy),
    [passwordStrength.meetsPolicy, passwordStrength.score],
  )
  const confirmPasswordState = useMemo(() => {
    if (!(isSignupMode || isResetConfirmMode)) {
      return { text: '', tone: 'neutral', matches: false, visible: false }
    }
    if (!authForm.confirmPassword) {
      return { text: 'Re-enter the password to confirm it.', tone: 'neutral', matches: false, visible: true }
    }
    if (authForm.password === authForm.confirmPassword) {
      return { text: 'Passwords match.', tone: 'match', matches: true, visible: true }
    }
    return { text: 'Passwords do not match yet.', tone: 'mismatch', matches: false, visible: true }
  }, [authForm.confirmPassword, authForm.password, isResetConfirmMode, isSignupMode])
  useDialogAccessibility(confirmDialog.open, confirmDialogRef, () => setConfirmDialog(DEFAULT_CONFIRM_DIALOG))
  useDialogAccessibility(saveSuccessDialogOpen, saveSuccessDialogRef, () => setSaveSuccessDialogOpen(false))

  const confidenceRange = useMemo(() => {
    if (!result?.confidence_interval_95) return null
    return result.confidence_interval_95.map((value) => `${(value * 100).toFixed(2)}%`)
  }, [result])

  useEffect(() => {
    if (!result) {
      setAnimatedRiskPercent(0)
      setAnimatedRiskProbability(0)
      return
    }

    const targetPercent = Number(result.risk_percent)
    const targetProbability = Number(result.risk_probability)
    const safePercent = Number.isFinite(targetPercent) ? targetPercent : 0
    const safeProbability = Number.isFinite(targetProbability) ? targetProbability : 0
    const durationMs = 950
    const startAt = performance.now()
    let frameId = 0

    const tick = (now) => {
      const progress = Math.min((now - startAt) / durationMs, 1)
      const eased = 1 - (1 - progress) ** 3
      setAnimatedRiskPercent(safePercent * eased)
      setAnimatedRiskProbability(safeProbability * eased)

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => {
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [result])

  
  const createApiFetch = (baseUrl) => (path, options = {}) => {
    const shouldSetJsonHeader = options.body !== undefined && !(options.body instanceof FormData)
    return fetch(`${baseUrl}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(shouldSetJsonHeader ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers ?? {}),
      },
    })
  }
  const mlApiFetch = createApiFetch(ML_API_BASE)
  const crudApiFetch = createApiFetch(CRUD_API_BASE)

  const updateAuthMode = (nextMode, preserveEmail = true) => {
    setAuthMode(nextMode)
    setAuthError('')
    setAuthMessage('')
    setAuthForm((previous) => ({
      ...DEFAULT_AUTH_FORM,
      email: preserveEmail ? previous.email : '',
    }))
    if (nextMode !== 'reset-confirm') {
      setPasswordRecovery(DEFAULT_PASSWORD_RECOVERY)
    }
  }

  const hasZeroThreshold = (rules) =>
    Array.isArray(rules) && rules.some((rule) => Math.abs(Number(rule?.threshold)) <= ZERO_THRESHOLD_TOLERANCE)

  const normalizeRules = (rules) => {
    if (!Array.isArray(rules) || rules.length === 0) return DEFAULT_RULES
    const normalized = rules
      .map((rule) => ({ threshold: Number(rule?.threshold), label: String(rule?.label ?? '').trim() }))
      .filter((rule) => Number.isFinite(rule.threshold) && rule.threshold >= 0 && rule.threshold <= 1 && rule.label)
      .sort((a, b) => a.threshold - b.threshold)
    if (normalized.length < 2) return DEFAULT_RULES

    const uniqueByThreshold = []
    const seen = new Set()
    for (const rule of normalized) {
      const key = rule.threshold.toFixed(10)
      if (seen.has(key)) continue
      seen.add(key)
      uniqueByThreshold.push(rule)
    }
    if (uniqueByThreshold.length < 2 || !hasZeroThreshold(uniqueByThreshold)) return DEFAULT_RULES
    return uniqueByThreshold
  }

  const normalizeRiskLabel = (label) => {
    const normalized = String(label ?? '').trim()
    return normalized || 'Unlabeled'
  }

  const riskFilterOptions = useMemo(
    () => Array.from(new Set(savedResults.map((entry) => normalizeRiskLabel(entry?.risk_label)))),
    [savedResults],
  )

  const filteredSavedResults = useMemo(
    () => savedResults.filter((entry) => selectedRiskLabels.includes(normalizeRiskLabel(entry?.risk_label))),
    [savedResults, selectedRiskLabels],
  )

  const buildPredictionPayload = () =>
    Object.fromEntries(
      Object.entries(formState).map(([key, value]) => [
        key,
        typeof DEFAULT_FORM[key] === 'number' ? Number(value) : value,
      ]),
    )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    if (!hash) return

    const params = new URLSearchParams(hash)
    if (params.get('type') !== 'recovery') return

    const accessToken = params.get('access_token')
    const expiresIn = Number(params.get('expires_in'))
    if (!accessToken) return

    setPasswordRecovery({
      accessToken,
      expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : DEFAULT_PASSWORD_RECOVERY.expiresIn,
    })
    setAuthPanelOpen(true)
    setAuthMode('reset-confirm')
    setAuthMessage('Choose a new password for your account.')
    setAuthError('')
    setAuthForm((previous) => ({ ...DEFAULT_AUTH_FORM, email: previous.email }))

    const cleanUrl = `${window.location.pathname}${window.location.search}`
    window.history.replaceState({}, document.title, cleanUrl)
  }, [])

  const loadSavedResults = async () => {
    if (!authUser) {
      setSavedResults([])
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const response = await crudApiFetch('/results')
      const body = await response.json()
      if (!response.ok) {
        setHistoryError(body?.detail || 'Unable to load saved results.')
        return
      }
      setSavedResults(Array.isArray(body?.results) ? body.results : [])
    } catch {
      setHistoryError('Unable to load saved results.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const loadRiskRules = async () => {
    if (!authUser) {
      setRiskRules(DEFAULT_RULES)
      return
    }
    setRiskSettingsLoading(true)
    setRiskSettingsError('')
    try {
      const response = await crudApiFetch('/risk-settings')
      const body = await response.json()
      if (!response.ok) {
        setRiskSettingsError(body?.detail || 'Unable to load risk rules.')
        return
      }
      setRiskRules(normalizeRules(body?.rules))
    } catch {
      setRiskSettingsError('Unable to load risk rules.')
    } finally {
      setRiskSettingsLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const response = await crudApiFetch('/auth/me')
        if (response.ok) {
          const body = await response.json()
          setAuthUser(body?.authenticated ? body.user : null)
        } else {
          setAuthUser(null)
        }
      } catch {
        setAuthUser(null)
      } finally {
        setAuthChecked(true)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!authChecked || !authUser) {
      setRiskRules(DEFAULT_RULES)
      setSavedResults([])
      setSelectedRiskLabels([])
      setRiskFiltersTouched(false)
      setConfirmDialog(DEFAULT_CONFIRM_DIALOG)
      return
    }
    loadRiskRules()
    loadSavedResults()
  }, [authChecked, authUser])

  useEffect(() => {
    setSelectedRiskLabels((previous) => {
      if (riskFilterOptions.length === 0) return []
      if (!riskFiltersTouched && previous.length === 0) return riskFilterOptions

      const remaining = previous.filter((label) => riskFilterOptions.includes(label))
      const additions = riskFilterOptions.filter((label) => !previous.includes(label))
      return [...remaining, ...additions]
    })
  }, [riskFilterOptions, riskFiltersTouched])

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthMessage('')

    if ((isSignupMode || isResetConfirmMode) && authForm.password !== authForm.confirmPassword) {
      setAuthError('Passwords do not match.')
      return
    }
    if ((isSignupMode || isResetConfirmMode) && !passwordStrength.meetsPolicy) {
      setAuthError(passwordStrength.detail)
      return
    }

    setAuthLoading(true)
    try {
      let endpoint = '/auth/login'
      let requestBody = { email: authForm.email, password: authForm.password }

      if (isSignupMode) {
        endpoint = '/auth/signup'
      } else if (isResetRequestMode) {
        endpoint = '/auth/password-reset/request'
        requestBody = { email: authForm.email }
      } else if (isResetConfirmMode) {
        endpoint = '/auth/password-reset/confirm'
        requestBody = {
          accessToken: passwordRecovery.accessToken,
          expiresIn: passwordRecovery.expiresIn,
          password: authForm.password,
        }
      }

      const response = await crudApiFetch(endpoint, { method: 'POST', body: JSON.stringify(requestBody) })
      const responseBody = await response.json()
      if (!response.ok) {
        setAuthError(responseBody?.detail || 'Authentication failed.')
        return
      }
      if (isResetRequestMode) {
        updateAuthMode('login')
        setAuthMessage(responseBody?.message || 'If the email exists, a reset link has been sent.')
        return
      }
      if (responseBody?.authenticated && responseBody?.user) {
        setAuthUser(responseBody.user)
        setAuthForm(DEFAULT_AUTH_FORM)
        setAuthPanelOpen(false)
        setPasswordRecovery(DEFAULT_PASSWORD_RECOVERY)
      } else {
        updateAuthMode('login')
        setAuthMessage('Account created. Confirm your email, then sign in.')
      }
    } catch {
      setAuthError('Unable to connect to backend API.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await crudApiFetch('/auth/logout', { method: 'POST' })
    } finally {
      setAuthPanelOpen(false)
      setAuthMode('login')
      setAuthForm(DEFAULT_AUTH_FORM)
      setPasswordRecovery(DEFAULT_PASSWORD_RECOVERY)
      setAuthUser(null)
      setFormState(DEFAULT_FORM)
      setResult(null)
      setLastPredictionPayload(null)
      setLoading(false)
      setError('')
      setSavedResults([])
      setSelectedRiskLabels([])
      setRiskFiltersTouched(false)
      setHistoryLoading(false)
      setHistoryError('')
      setDeletingResultId('')
      setDeleteError('')
      setDeleteMessage('')
      setEditingResultId('')
      setEditIdentity(DEFAULT_SAVE_IDENTITY)
      setNameUpdateLoadingId('')
      setNameUpdateError('')
      setNameUpdateMessage('')
      setConfirmDialog(DEFAULT_CONFIRM_DIALOG)
      setRiskRules(DEFAULT_RULES)
      setRiskSettingsLoading(false)
      setRiskSettingsSaving(false)
      setRiskSettingsError('')
      setRiskSettingsMessage('')
      setSaveLoading(false)
      setSaveError('')
      setSaveMessage('')
      setSaveSuccessDialogOpen(false)
      setSaveIdentity(DEFAULT_SAVE_IDENTITY)
      setBatchFile(null)
      setBatchLoading(false)
      setBatchError('')
      setBatchMessage('')
      setBatchResults([])
      setBatchSaveLoading(false)
      setBatchSaveError('')
      setBatchSaveMessage('')
      setBatchFileInputKey((previous) => previous + 1)
    }
  }

  const validateForm = () => {
    for (const field of NUMERIC_FIELDS) {
      const numericValue = Number(formState[field.key])
      if (!Number.isFinite(numericValue)) return `${field.label} must be a valid number.`
      if (numericValue < field.min || numericValue > field.max) {
        return `${field.label} must be between ${field.min} and ${field.max}.`
      }
      if (field.step === 1 && !Number.isInteger(numericValue)) return `${field.label} must be a whole number.`
    }
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSaveError('')
    setSaveMessage('')
    setSaveSuccessDialogOpen(false)
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }
    setLoading(true)
    const payload = buildPredictionPayload()
    try {
      const response = await mlApiFetch('/predict', {
        method: 'POST',
        body: JSON.stringify({ clinical_inputs: payload, risk_rules: normalizeRules(riskRules) }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.detail || 'Prediction failed.')
        return
      }
      setResult(body)
      setLastPredictionPayload(payload)
    } catch {
      setError('Unable to connect to ML inference API. Make sure FastAPI is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveResult = async () => {
    setSaveError('')
    setSaveMessage('')
    if (!authUser) {
      setSaveError('Sign in first to save this result.')
      setAuthPanelOpen(true)
      return
    }
    if (!lastPredictionPayload) {
      setSaveError('Run prediction first.')
      return
    }
    if (!result) {
      setSaveError('Prediction output is missing. Run prediction again.')
      return
    }
    const firstName = saveIdentity.firstName.trim()
    const lastName = saveIdentity.lastName.trim()
    if (!firstName || !lastName) {
      setSaveError('Enter first and last name before saving.')
      return
    }
    const payload = {
      patient_first_name: firstName,
      patient_last_name: lastName,
      clinical_inputs: lastPredictionPayload,
      risk_probability: Number(result.risk_probability),
      risk_percent: Number(result.risk_percent),
      risk_label: String(result.risk_label ?? ''),
      uncertainty_std: Number(result.uncertainty_std),
      uncertainty_percent: Number(result.uncertainty_percent),
      confidence_interval_95: Array.isArray(result.confidence_interval_95)
        ? result.confidence_interval_95.map((value) => Number(value))
        : [],
    }
    setSaveLoading(true)
    try {
      const response = await crudApiFetch('/results', { method: 'POST', body: JSON.stringify(payload) })
      const body = await response.json()
      if (!response.ok) {
        setSaveError(body?.detail || 'Unable to save result.')
        return
      }
      setSavedResults((previous) => [body, ...previous.filter((entry) => entry.id !== body.id)])
      setSaveMessage('Saved.')
      setSaveSuccessDialogOpen(true)
    } catch {
      setSaveError('Unable to save result.')
    } finally {
      setSaveLoading(false)
    }
  }

  const clearPredictionView = () => {
    setResult(null)
    setLastPredictionPayload(null)
    setSaveError('')
    setSaveMessage('')
    setSaveIdentity(DEFAULT_SAVE_IDENTITY)
  }

  const downloadBatchCsvTemplate = () => {
    const csv = [BATCH_TEMPLATE_HEADERS, BATCH_TEMPLATE_EXAMPLE_ROW].map((row) => row.join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = downloadUrl
    link.download = 'batch_prediction_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  }

  const runBatchPrediction = async () => {
    setBatchError('')
    setBatchMessage('')
    setBatchSaveError('')
    setBatchSaveMessage('')
    if (!batchFile) {
      setBatchError('Upload a CSV file first.')
      return
    }
    if (!isCsvFile(batchFile)) {
      setBatchError('Uploaded batch file must be a CSV.')
      return
    }
    const formData = new FormData()
    formData.append('file', batchFile)
    formData.append('risk_rules_json', JSON.stringify(normalizeRules(riskRules)))

    setBatchLoading(true)
    try {
      const response = await mlApiFetch('/predict/batch-csv', { method: 'POST', body: formData })
      const body = await response.json()
      if (!response.ok) {
        setBatchError(body?.detail || 'Batch prediction failed.')
        return
      }
      const predictions = Array.isArray(body?.predictions) ? body.predictions : []
      setBatchResults(predictions)
      setBatchMessage(`Batch prediction complete. Processed ${Number(body?.total_rows) || predictions.length} row(s).`)
    } catch {
      setBatchError('Unable to connect to ML inference API for batch prediction.')
    } finally {
      setBatchLoading(false)
    }
  }

  const saveBatchResultsToHistory = async () => {
    setBatchSaveError('')
    setBatchSaveMessage('')
    if (!authUser) {
      setBatchSaveError('Sign in first to save batch results.')
      setAuthPanelOpen(true)
      return
    }
    if (batchResults.length === 0) {
      setBatchSaveError('Run batch prediction first.')
      return
    }

    const saveableRows = batchResults.filter((entry) => {
      const firstName = String(entry?.patient_first_name ?? '').trim()
      const lastName = String(entry?.patient_last_name ?? '').trim()
      return Boolean(firstName && lastName)
    })
    const skippedCount = batchResults.length - saveableRows.length
    if (saveableRows.length === 0) {
      setBatchSaveError('No batch rows include both patient first and last name.')
      return
    }

    setBatchSaveLoading(true)
    let successCount = 0
    let failedCount = 0
    const savedRecords = []

    for (const entry of saveableRows) {
      const payload = {
        patient_first_name: String(entry.patient_first_name).trim(),
        patient_last_name: String(entry.patient_last_name).trim(),
        clinical_inputs: entry.clinical_inputs,
        risk_probability: Number(entry?.prediction?.risk_probability),
        risk_percent: Number(entry?.prediction?.risk_percent),
        risk_label: String(entry?.prediction?.risk_label ?? ''),
        uncertainty_std: Number(entry?.prediction?.uncertainty_std),
        uncertainty_percent: Number(entry?.prediction?.uncertainty_percent),
        confidence_interval_95: Array.isArray(entry?.prediction?.confidence_interval_95)
          ? entry.prediction.confidence_interval_95.map((value) => Number(value))
          : [],
      }

      try {
        const response = await crudApiFetch('/results', { method: 'POST', body: JSON.stringify(payload) })
        const body = await response.json()
        if (!response.ok) {
          failedCount += 1
          continue
        }
        successCount += 1
        savedRecords.push(body)
      } catch {
        failedCount += 1
      }
    }

    if (savedRecords.length > 0) {
      setSavedResults((previous) => {
        const merged = [...savedRecords, ...previous]
        const seen = new Set()
        return merged.filter((entry) => {
          const id = String(entry?.id ?? '')
          if (!id || seen.has(id)) return false
          seen.add(id)
          return true
        })
      })
    }

    if (successCount === 0) {
      setBatchSaveError('No batch results were saved.')
    } else {
      const summaryParts = [`Saved ${successCount} batch result(s).`]
      if (skippedCount > 0) summaryParts.push(`Skipped ${skippedCount} row(s) without full patient name.`)
      if (failedCount > 0) summaryParts.push(`Failed ${failedCount} row(s).`)
      setBatchSaveMessage(summaryParts.join(' '))
    }
    setBatchSaveLoading(false)
  }

  const exportBatchResultsCsv = () => {
    if (batchResults.length === 0) return

    const headers = [
      'row_number',
      'patient_first_name',
      'patient_last_name',
      'age',
      'sex',
      'cp',
      'trestbps',
      'chol',
      'thalach',
      'oldpeak',
      'ca',
      'risk_probability',
      'risk_percent',
      'risk_label',
      'uncertainty_std',
      'uncertainty_percent',
      'confidence_interval_low',
      'confidence_interval_high',
    ]
    const rows = batchResults.map((entry) => {
      const clinical = entry?.clinical_inputs ?? {}
      const prediction = entry?.prediction ?? {}
      return [
        entry?.row_number ?? '',
        entry?.patient_first_name ?? '',
        entry?.patient_last_name ?? '',
        clinical.age ?? '',
        clinical.sex ?? '',
        clinical.cp ?? '',
        clinical.trestbps ?? '',
        clinical.chol ?? '',
        clinical.thalach ?? '',
        clinical.oldpeak ?? '',
        clinical.ca ?? '',
        prediction.risk_probability ?? '',
        prediction.risk_percent ?? '',
        prediction.risk_label ?? '',
        prediction.uncertainty_std ?? '',
        prediction.uncertainty_percent ?? '',
        prediction?.confidence_interval_95?.[0] ?? '',
        prediction?.confidence_interval_95?.[1] ?? '',
      ]
    })

    const csv = [headers, ...rows].map((row) => row.map((value) => toCsvValue(value)).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    link.href = downloadUrl
    link.download = `batch_prediction_results_${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  }

  const updateRiskRule = (index, key, value) => {
    setRiskRules((previous) => {
      const copy = [...previous]
      copy[index] = { ...copy[index], [key]: value }
      return copy
    })
  }

  const addRiskRule = () => {
    setRiskSettingsError('')
    setRiskSettingsMessage('')
    if (riskRules.length >= 20) {
      setRiskSettingsError('You can define up to 20 rules.')
      return
    }
    const sorted = [...riskRules].sort((a, b) => Number(a.threshold) - Number(b.threshold))
    const nextThreshold = sorted.length > 0 ? Math.min(Number(sorted[sorted.length - 1].threshold) + 0.1, 1) : 0
    setRiskRules((previous) => [...previous, { threshold: Number(nextThreshold.toFixed(2)), label: 'Custom Risk' }])
  }

  const removeRiskRule = (index) => {
    setRiskSettingsError('')
    setRiskSettingsMessage('')
    setRiskRules((previous) => {
      if (previous.length <= 2) {
        setRiskSettingsError('At least two rules are required.')
        return previous
      }
      const nextRules = previous.filter((_, i) => i !== index)
      if (!hasZeroThreshold(nextRules)) {
        setRiskSettingsError('One threshold must be 0.')
        return previous
      }
      return nextRules
    })
  }

  const handleRiskSettingsSave = async (event) => {
    event.preventDefault()
    setRiskSettingsError('')
    setRiskSettingsMessage('')
    const normalized = riskRules.map((rule) => ({
      threshold: Number(rule.threshold),
      label: String(rule.label ?? '').trim(),
    }))
    if (normalized.length < 2) {
      setRiskSettingsError('Add at least two rules.')
      return
    }
    for (const rule of normalized) {
      if (!Number.isFinite(rule.threshold) || rule.threshold < 0 || rule.threshold > 1) {
        setRiskSettingsError('Thresholds must be between 0 and 1.')
        return
      }
      if (!rule.label) {
        setRiskSettingsError('Labels cannot be empty.')
        return
      }
    }
    const unique = new Set(normalized.map((rule) => rule.threshold.toFixed(10)))
    if (unique.size !== normalized.length) {
      setRiskSettingsError('Thresholds must be unique.')
      return
    }
    if (!hasZeroThreshold(normalized)) {
      setRiskSettingsError('One threshold must be 0.')
      return
    }
    const sorted = [...normalized].sort((a, b) => a.threshold - b.threshold)
    setRiskSettingsSaving(true)
    try {
      const response = await crudApiFetch('/risk-settings', { method: 'PUT', body: JSON.stringify({ rules: sorted }) })
      const body = await response.json()
      if (!response.ok) {
        setRiskSettingsError(body?.detail || 'Unable to save risk rules.')
        return
      }
      setRiskRules(normalizeRules(body?.rules))
      setRiskSettingsMessage('Rules saved.')
    } catch {
      setRiskSettingsError('Unable to save risk rules.')
    } finally {
      setRiskSettingsSaving(false)
    }
  }

  const formatSavedDate = (isoDateTime) => {
    const parsed = new Date(isoDateTime)
    if (Number.isNaN(parsed.getTime())) return isoDateTime
    return parsed.toLocaleString()
  }

  const formatMetric = (value, digits = 2) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '-'
    return numeric.toFixed(digits)
  }

  const getClinicalInputValue = (entry, fieldKey) => {
    const value = entry?.clinical_inputs?.[fieldKey]
    if (value === null || value === undefined || value === '') return '-'
    return String(value)
  }

  const toCsvValue = (value) => {
    const raw = value === null || value === undefined ? '' : String(value)
    return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
  }

  const getRiskToneClass = (label, rules) => {
    const normalizedLabel = normalizeRiskLabel(label).toLowerCase()
    const sortedRules = normalizeRules(rules)
    if (sortedRules.length > 3) return ''

    const lookup = new Map()
    if (sortedRules.length === 2) {
      lookup.set(normalizeRiskLabel(sortedRules[0].label).toLowerCase(), 'low')
      lookup.set(normalizeRiskLabel(sortedRules[1].label).toLowerCase(), 'high')
    } else if (sortedRules.length === 3) {
      lookup.set(normalizeRiskLabel(sortedRules[0].label).toLowerCase(), 'low')
      lookup.set(normalizeRiskLabel(sortedRules[1].label).toLowerCase(), 'medium')
      lookup.set(normalizeRiskLabel(sortedRules[2].label).toLowerCase(), 'high')
    } else {
      return ''
    }

    return lookup.get(normalizedLabel) ?? ''
  }

  const toggleRiskLabelFilter = (label) => {
    setRiskFiltersTouched(true)
    setSelectedRiskLabels((previous) =>
      previous.includes(label) ? previous.filter((existing) => existing !== label) : [...previous, label],
    )
  }

  const selectAllRiskLabels = () => {
    setRiskFiltersTouched(true)
    setSelectedRiskLabels(riskFilterOptions)
  }

  const clearRiskLabels = () => {
    setRiskFiltersTouched(true)
    setSelectedRiskLabels([])
  }

  const closeConfirmDialog = () => {
    setConfirmDialog(DEFAULT_CONFIRM_DIALOG)
  }

  const handleDeleteSavedResult = (resultId) => {
    if (deletingResultId || confirmDialog.open) return
    const safeResultId = String(resultId ?? '').trim()
    if (!safeResultId) return
    if (!authUser) {
      setDeleteError('Sign in first to delete saved results.')
      setAuthPanelOpen(true)
      return
    }

    setDeleteError('')
    setDeleteMessage('')
    setNameUpdateError('')
    setNameUpdateMessage('')
    const target = savedResults.find((entry) => entry?.id === safeResultId)
    const patientName = [target?.patient_first_name, target?.patient_last_name].filter(Boolean).join(' ').trim()
    setConfirmDialog({
      open: true,
      type: 'delete',
      resultId: safeResultId,
      title: 'Delete Saved Result?',
      message: `Delete this saved result${patientName ? ` for ${patientName}` : ''}? This action cannot be undone.`,
    })
  }

  const performDeleteSavedResult = async (resultId) => {
    const safeResultId = String(resultId ?? '').trim()
    if (!safeResultId) return
    setDeletingResultId(safeResultId)
    try {
      const response = await crudApiFetch(`/results/${encodeURIComponent(safeResultId)}`, { method: 'DELETE' })
      if (!response.ok) {
        let body = null
        try {
          body = await response.json()
        } catch {
          body = null
        }
        setDeleteError(body?.detail || 'Unable to delete saved result.')
        return
      }

      setSavedResults((previous) => previous.filter((entry) => entry?.id !== safeResultId))
      setDeleteMessage('Saved result deleted.')
    } catch {
      setDeleteError('Unable to delete saved result.')
    } finally {
      setDeletingResultId('')
    }
  }

  const exportFilteredResultsAsCsv = () => {
    if (filteredSavedResults.length === 0) return

    const headers = [
      'id',
      'created_at',
      'patient_first_name',
      'patient_last_name',
      ...SAVED_INPUT_COLUMNS.map((column) => column.key),
      'risk_probability',
      'risk_percent',
      'risk_label',
    ]

    const rows = filteredSavedResults.map((entry) => {
      const clinical = entry?.clinical_inputs ?? {}
      return [
        entry?.id ?? '',
        entry?.created_at ?? '',
        entry?.patient_first_name ?? '',
        entry?.patient_last_name ?? '',
        ...SAVED_INPUT_COLUMNS.map((column) => clinical[column.key] ?? ''),
        entry?.risk_probability ?? '',
        entry?.risk_percent ?? '',
        normalizeRiskLabel(entry?.risk_label),
      ]
    })

    const csv = [headers, ...rows].map((row) => row.map((value) => toCsvValue(value)).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    link.href = downloadUrl
    link.download = `saved_results_${timestamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)
  }

  const ruleSummary = useMemo(() => {
    if (!Array.isArray(result?.risk_rules)) return ''
    const sorted = [...result.risk_rules].sort((a, b) => Number(a.threshold) - Number(b.threshold))
    return sorted.map((rule) => `${(Number(rule.threshold) * 100).toFixed(1)}% -> ${rule.label}`).join(', ')
  }, [result])

  const liveAnnouncement = useMemo(() => {
    if (loading) return 'Calculating risk prediction.'
    if (saveLoading) return 'Saving prediction result.'
    if (batchLoading) return 'Running batch prediction.'
    if (batchSaveLoading) return 'Saving batch prediction results.'
    if (riskSettingsSaving) return 'Saving risk classification rules.'
    if (deletingResultId) return 'Deleting saved result.'
    if (nameUpdateLoadingId) return 'Updating saved patient name.'
    if (confirmDialog.open) return confirmDialog.message
    if (historyLoading) return 'Loading saved results.'
    if (error) return `Prediction error. ${error}`
    if (authError) return `Authentication error. ${authError}`
    if (saveError) return `Save error. ${saveError}`
    if (deleteError) return `Delete error. ${deleteError}`
    if (nameUpdateError) return `Update error. ${nameUpdateError}`
    if (batchError) return `Batch prediction error. ${batchError}`
    if (batchSaveError) return `Batch save error. ${batchSaveError}`
    if (riskSettingsError) return `Risk settings error. ${riskSettingsError}`
    if (saveSuccessDialogOpen) return 'Prediction saved successfully. Choose whether to clear the result view.'
    if (deleteMessage) return deleteMessage
    if (nameUpdateMessage) return nameUpdateMessage
    if (batchSaveMessage) return batchSaveMessage
    if (saveMessage) return saveMessage
    if (riskSettingsMessage) return riskSettingsMessage
    if (result) return `Prediction complete. ${Number(result.risk_percent).toFixed(2)} percent risk, ${result.risk_label}.`
    return ''
  }, [
    loading,
    saveLoading,
    batchLoading,
    batchSaveLoading,
    riskSettingsSaving,
    deletingResultId,
    nameUpdateLoadingId,
    confirmDialog,
    historyLoading,
    error,
    authError,
    saveError,
    deleteError,
    nameUpdateError,
    batchError,
    batchSaveError,
    riskSettingsError,
    saveSuccessDialogOpen,
    deleteMessage,
    nameUpdateMessage,
    batchSaveMessage,
    saveMessage,
    riskSettingsMessage,
    result,
  ])

  const beginEditSavedResultName = (entry) => {
    if (!entry?.id || deletingResultId || nameUpdateLoadingId || confirmDialog.open) return
    setDeleteError('')
    setDeleteMessage('')
    setNameUpdateError('')
    setNameUpdateMessage('')
    setEditingResultId(entry.id)
    setEditIdentity({
      firstName: String(entry?.patient_first_name ?? ''),
      lastName: String(entry?.patient_last_name ?? ''),
    })
  }

  const cancelEditSavedResultName = () => {
    if (nameUpdateLoadingId) return
    setEditingResultId('')
    setEditIdentity(DEFAULT_SAVE_IDENTITY)
    setNameUpdateError('')
  }

  const handleSaveEditedName = (resultId) => {
    const safeResultId = String(resultId ?? '').trim()
    if (!safeResultId || nameUpdateLoadingId || confirmDialog.open) return

    const firstName = editIdentity.firstName.trim()
    const lastName = editIdentity.lastName.trim()
    if (!firstName || !lastName) {
      setNameUpdateError('Patient first and last name are required.')
      return
    }
    if (firstName.length > 80 || lastName.length > 80) {
      setNameUpdateError('Each name must be 80 characters or fewer.')
      return
    }

    setNameUpdateError('')
    setNameUpdateMessage('')
    setDeleteError('')
    setDeleteMessage('')
    setConfirmDialog({
      open: true,
      type: 'edit',
      resultId: safeResultId,
      title: 'Save Name Changes?',
      message: `Update this saved result to ${firstName} ${lastName}? This updates the database record.`,
    })
  }

  const performSaveEditedName = async (resultId) => {
    const safeResultId = String(resultId ?? '').trim()
    if (!safeResultId) return
    const firstName = editIdentity.firstName.trim()
    const lastName = editIdentity.lastName.trim()
    if (!firstName || !lastName) {
      setNameUpdateError('Patient first and last name are required.')
      return
    }

    setNameUpdateLoadingId(safeResultId)
    try {
      const response = await crudApiFetch(`/results/${encodeURIComponent(safeResultId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          patient_first_name: firstName,
          patient_last_name: lastName,
        }),
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (!response.ok) {
        setNameUpdateError(body?.detail || 'Unable to update patient name.')
        return
      }

      setSavedResults((previous) =>
        previous.map((entry) =>
          entry?.id === safeResultId
            ? {
                ...entry,
                patient_first_name: body?.patient_first_name ?? firstName,
                patient_last_name: body?.patient_last_name ?? lastName,
              }
            : entry,
        ),
      )
      setEditingResultId('')
      setEditIdentity(DEFAULT_SAVE_IDENTITY)
      setNameUpdateMessage('Patient name updated.')
    } catch {
      setNameUpdateError('Unable to update patient name.')
    } finally {
      setNameUpdateLoadingId('')
    }
  }

  const handleConfirmDialogAction = () => {
    const current = confirmDialog
    closeConfirmDialog()
    if (!current?.open || !current?.resultId) return
    if (current.type === 'delete') {
      void performDeleteSavedResult(current.resultId)
      return
    }
    if (current.type === 'edit') {
      void performSaveEditedName(current.resultId)
    }
  }

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">
        Skip to clinical input form
      </a>
      <p className="sr-only" role="status" aria-live="polite">
        {liveAnnouncement}
      </p>
      <header className="hero reveal">
        <div className="hero-top-row">
          <p className="eyebrow">Heart Disease Risk Prediction</p>
          {authUser ? (
            <button type="button" className="logout-button" onClick={handleLogout}>
              Log out
            </button>
          ) : (
            <button type="button" className="auth-cta-button" onClick={() => setAuthPanelOpen((prev) => !prev)}>
              {authPanelOpen ? 'Hide Login' : 'Sign In / Sign Up'}
            </button>
          )}
        </div>
        <h1>Causal Risk Predictor - Coronary Artery Disease</h1>
        <p className="subtitle">Guest users can predict. Sign in to save history and configure risk labels.</p>
      </header>

      {!authUser && authPanelOpen && (
        <section className="panel auth-inline-panel reveal delay-1" aria-live="polite">
          <h2>
            {authMode === 'login' && 'Sign in to save results'}
            {authMode === 'signup' && 'Create account to save results'}
            {authMode === 'reset-request' && 'Reset your password'}
            {authMode === 'reset-confirm' && 'Choose a new password'}
          </h2>
          <form className="auth-inline-form" onSubmit={handleAuthSubmit}>
            {!isResetConfirmMode && (
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                  autoComplete="email"
                  required
                />
              </label>
            )}
            {!isResetRequestMode && (
              <label className="field">
                <span>{isResetConfirmMode ? 'New Password' : 'Password'}</span>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  minLength={showPasswordPolicy ? SIGNUP_PASSWORD_MIN_LENGTH : 6}
                  aria-invalid={showPasswordPolicy && authForm.password ? !passwordStrength.meetsPolicy : undefined}
                  aria-describedby={showPasswordPolicy ? 'password-strength-copy' : undefined}
                  required
                />
              </label>
            )}
            {(isSignupMode || isResetConfirmMode) && (
              <>
                <label className="field">
                  <span>Confirm Password</span>
                  <input
                    type="password"
                    value={authForm.confirmPassword}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    autoComplete="new-password"
                    minLength={SIGNUP_PASSWORD_MIN_LENGTH}
                    aria-invalid={authForm.confirmPassword ? !confirmPasswordState.matches : undefined}
                    aria-describedby="confirm-password-status"
                    required
                  />
                </label>
                {confirmPasswordState.visible && (
                  <p
                    id="confirm-password-status"
                    data-testid="password-confirm-status"
                    className={`password-confirm-status ${confirmPasswordState.tone}`}
                    aria-live="polite"
                  >
                    {confirmPasswordState.text}
                  </p>
                )}
                <div className="password-meter" aria-live="polite">
                  <div className="password-meter-track" aria-hidden="true">
                    <span
                      data-testid="password-strength-fill"
                      className="password-meter-fill"
                      style={{
                        width: `${passwordStrengthPercent}%`,
                        backgroundColor: passwordStrengthColor,
                      }}
                    />
                  </div>
                  <p id="password-strength-copy" className="password-meter-copy">
                    <strong>{passwordStrength.label}</strong> {passwordStrength.detail}
                  </p>
                </div>
              </>
            )}
            <button type="submit" disabled={authLoading}>
              {authLoading && 'Please wait...'}
              {!authLoading && authMode === 'login' && 'Sign in'}
              {!authLoading && authMode === 'signup' && 'Create account'}
              {!authLoading && authMode === 'reset-request' && 'Send reset link'}
              {!authLoading && authMode === 'reset-confirm' && 'Update password'}
            </button>
          </form>
          {authError && <p className="error" role="alert">{authError}</p>}
          {authMessage && <p className="auth-message-inline">{authMessage}</p>}
          {authMode === 'login' && (
            <button
              type="button"
              className="auth-inline-link"
              onClick={() => updateAuthMode('reset-request')}
            >
              Forgot password?
            </button>
          )}
          {(authMode === 'login' || authMode === 'signup') && (
            <div className="auth-switch-card">
              <p className="auth-switch-caption">
                {authMode === 'login' ? 'New to the app?' : 'Already have an account?'}
              </p>
              <button
                type="button"
                className="auth-inline-toggle"
                onClick={() => updateAuthMode(authMode === 'login' ? 'signup' : 'login')}
              >
                <span>{authMode === 'login' ? 'Create account' : 'Sign in instead'}</span>
                <span aria-hidden="true" className="auth-toggle-icon">
                  <svg viewBox="0 0 20 20" focusable="false" aria-hidden="true">
                    <path d="M7 5.5L11.5 10L7 14.5" />
                  </svg>
                </span>
              </button>
            </div>
          )}
          {(authMode === 'reset-request' || authMode === 'reset-confirm') && (
            <button
              type="button"
              className="auth-inline-link"
              onClick={() => updateAuthMode('login', authMode === 'reset-request')}
            >
              Back to sign in
            </button>
          )}
        </section>
      )}

      {authUser && (
        <section className="panel risk-settings-panel reveal delay-1" aria-busy={riskSettingsLoading || riskSettingsSaving}>
          <h2>Custom Risk Classification</h2>
          <p className="auth-inline-copy">Highest crossed threshold determines the label.</p>
          <form className="risk-settings-form" onSubmit={handleRiskSettingsSave}>
            {riskRules.map((rule, index) => (
              <div key={`rule-${index}`} className="risk-rule-row">
                <label className="field">
                  <span>Threshold</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={rule.threshold}
                    onChange={(event) => updateRiskRule(index, 'threshold', event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Label</span>
                  <input
                    type="text"
                    maxLength={60}
                    value={rule.label}
                    onChange={(event) => updateRiskRule(index, 'label', event.target.value)}
                    required
                  />
                </label>
                <button type="button" className="remove-rule-button" onClick={() => removeRiskRule(index)}>
                  Remove
                </button>
              </div>
            ))}
            <div className="risk-rule-actions">
              <button type="button" className="add-rule-button" onClick={addRiskRule}>
                Add Rule
              </button>
              <button type="submit" disabled={riskSettingsSaving || riskSettingsLoading}>
                {riskSettingsSaving ? 'Saving...' : 'Save Rules'}
              </button>
            </div>
          </form>
          {riskSettingsError && <p className="error" role="alert">{riskSettingsError}</p>}
          {riskSettingsMessage && <p className="save-message">{riskSettingsMessage}</p>}
        </section>
      )}

      <main className="layout" id="main-content">
        <section className="panel clinical-input-panel reveal delay-2" aria-busy={loading}>
          <h2>Clinical Inputs</h2>
          <form onSubmit={handleSubmit} className="prediction-form">
            <div className="field-grid">
              {NUMERIC_FIELDS.map((field) => (
                <label key={field.key} className="field">
                  <span>{field.label}</span>
                  <input
                    type="number"
                    value={formState[field.key]}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(event) => setFormState((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    required
                  />
                </label>
              ))}
              {CATEGORICAL_FIELDS.map((field) => (
                <label key={field.key} className="field field-select">
                  <span>{field.label}</span>
                  <CurvedSelect
                    id={`input-${field.key}`}
                    label={field.label}
                    value={formState[field.key]}
                    options={field.options}
                    onChange={(value) => setFormState((prev) => ({ ...prev, [field.key]: value }))}
                  />
                </label>
              ))}
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Calculating...' : 'Predict Risk'}
            </button>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
        </section>

        <aside className="panel result-panel reveal delay-3" aria-live="polite" aria-busy={loading}>
          <h2>Prediction Result</h2>
          {loading ? (
            <div className="predicting-card" role="status" aria-live="polite">
              <div className="predicting-header">
                <span className="predict-dot" />
                <p>Running risk inference...</p>
              </div>
              <div className="predict-track">
                <span />
              </div>
              <p className="predicting-subtext">Calculating probability and uncertainty bounds.</p>
            </div>
          ) : result ? (
            <div className="result-content result-content-animate">
              <p className={`risk-label ${getRiskToneClass(result.risk_label, result?.risk_rules ?? riskRules)}`}>{result.risk_label}</p>
              <p className="risk-percent">{animatedRiskPercent.toFixed(2)}%</p>
              <div className="risk-meter">
                <span style={{ width: `${Math.max(0, Math.min(animatedRiskPercent, 100))}%` }} />
              </div>
              <p className="metric">Probability: {animatedRiskProbability.toFixed(4)}</p>
              <p className="metric">Uncertainty: {Number(result.uncertainty_percent).toFixed(2)}%</p>
              <p className="metric">95% interval: {confidenceRange?.[0]} - {confidenceRange?.[1]}</p>
              {ruleSummary && <p className="metric">Rules: {ruleSummary}</p>}
              <div className="divider" />
              {authUser ? (
                <>
                  <div className="save-identity-fields">
                    <label className="field">
                      <span>Patient First Name</span>
                      <input
                        type="text"
                        maxLength={80}
                        value={saveIdentity.firstName}
                        onChange={(event) => setSaveIdentity((prev) => ({ ...prev, firstName: event.target.value }))}
                        autoComplete="given-name"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Patient Last Name</span>
                      <input
                        type="text"
                        maxLength={80}
                        value={saveIdentity.lastName}
                        onChange={(event) => setSaveIdentity((prev) => ({ ...prev, lastName: event.target.value }))}
                        autoComplete="family-name"
                        required
                      />
                    </label>
                  </div>
                  <button type="button" className="save-result-button" onClick={handleSaveResult} disabled={saveLoading}>
                    {saveLoading ? 'Saving...' : 'Save This Result'}
                  </button>
                </>
              ) : (
                <p className="metric login-hint">Sign in to save this result and access your own history.</p>
              )}
              {saveError && <p className="error" role="alert">{saveError}</p>}
              {saveMessage && <p className="save-message">{saveMessage}</p>}
            </div>
          ) : (
            <p className="placeholder">Submit the form to see prediction output.</p>
          )}
        </aside>
      </main>

      <section className="panel batch-upload-panel reveal delay-4" aria-busy={batchLoading}>
        <div className="batch-upload-head">
          <h2>Batch Prediction (CSV)</h2>
          <button type="button" className="refresh-history-button" onClick={downloadBatchCsvTemplate}>
            Download CSV Template
          </button>
        </div>
        <p className="auth-inline-copy">
          Required CSV columns: {BATCH_TEMPLATE_HEADERS.join(', ')}
        </p>
        <div className="batch-upload-controls">
          <label className="field">
            <span>Patient CSV file</span>
            <input
              key={batchFileInputKey}
              type="file"
              accept=".csv,text/csv"
              aria-invalid={Boolean(batchError && batchError.toLowerCase().includes('csv'))}
              aria-describedby="batch-file-hint batch-file-error"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null
                setBatchFile(nextFile)
                setBatchError('')
                setBatchMessage('')
                setBatchSaveError('')
                setBatchSaveMessage('')
                if (nextFile && !isCsvFile(nextFile)) {
                  setBatchError('Uploaded batch file must be a CSV.')
                }
              }}
            />
            <span id="batch-file-hint" className="field-hint">Only `.csv` files are accepted for batch prediction.</span>
          </label>
          <button type="button" className="save-result-button" onClick={runBatchPrediction} disabled={batchLoading}>
            {batchLoading ? 'Running...' : 'Run Batch Prediction'}
          </button>
        </div>
        {batchError && <p className="error" id="batch-file-error" role="alert">{batchError}</p>}
        {batchMessage && <p className="save-message">{batchMessage}</p>}
        {batchSaveError && <p className="error" role="alert">{batchSaveError}</p>}
        {batchSaveMessage && <p className="save-message">{batchSaveMessage}</p>}

        {batchResults.length > 0 && (
          <>
            <div className="saved-results-head">
              <h3>Batch Results</h3>
              <div className="saved-results-actions">
                <button type="button" className="export-history-button" onClick={exportBatchResultsCsv}>
                  Export Batch CSV
                </button>
                {authUser ? (
                  <button
                    type="button"
                    className="save-result-button"
                    onClick={saveBatchResultsToHistory}
                    disabled={batchSaveLoading}
                  >
                    {batchSaveLoading ? 'Saving Batch...' : 'Save Batch Results'}
                  </button>
                ) : (
                  <p className="metric login-hint">Sign in to save batch results.</p>
                )}
              </div>
            </div>
            <div className="saved-results-table-shell">
              <table className="saved-results-table">
                <caption className="sr-only">Batch prediction output for uploaded CSV rows.</caption>
                <thead>
                  <tr>
                    <th scope="col">Classification</th>
                    <th scope="col">CSV Row</th>
                    <th scope="col">Patient First Name</th>
                    <th scope="col">Patient Last Name</th>
                    <th scope="col">Age</th>
                    <th scope="col">Sex</th>
                    <th scope="col">Chest Pain</th>
                    <th scope="col">Resting BP</th>
                    <th scope="col">Cholesterol</th>
                    <th scope="col">Max HR</th>
                    <th scope="col">Oldpeak</th>
                    <th scope="col">Vessels (CA)</th>
                    <th scope="col">Risk %</th>
                    <th scope="col">Risk Probability</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((entry) => {
                    const prediction = entry?.prediction ?? {}
                    const riskLabel = normalizeRiskLabel(prediction?.risk_label)
                    return (
                      <tr key={`batch-row-${entry.row_number}`}>
                        <td>
                          <span className={`saved-risk-chip ${getRiskToneClass(riskLabel, prediction?.risk_rules ?? riskRules)}`}>{riskLabel}</span>
                        </td>
                        <td>{entry?.row_number ?? '-'}</td>
                        <td>{entry?.patient_first_name || '-'}</td>
                        <td>{entry?.patient_last_name || '-'}</td>
                        <td>{entry?.clinical_inputs?.age ?? '-'}</td>
                        <td>{entry?.clinical_inputs?.sex ?? '-'}</td>
                        <td>{entry?.clinical_inputs?.cp ?? '-'}</td>
                        <td>{entry?.clinical_inputs?.trestbps ?? '-'}</td>
                        <td>{entry?.clinical_inputs?.chol ?? '-'}</td>
                        <td>{entry?.clinical_inputs?.thalach ?? '-'}</td>
                        <td>{entry?.clinical_inputs?.oldpeak ?? '-'}</td>
                        <td>{entry?.clinical_inputs?.ca ?? '-'}</td>
                        <td>{formatMetric(prediction?.risk_percent)}%</td>
                        <td>{formatMetric(prediction?.risk_probability, 4)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {authUser && (
        <section className="panel saved-results-panel reveal delay-4" aria-busy={historyLoading}>
          <div className="saved-results-head">
            <h2>My Saved Results</h2>
            <button type="button" className="refresh-history-button" onClick={loadSavedResults}>
              Refresh
            </button>
          </div>
          {historyLoading && <p className="placeholder">Loading...</p>}
          {historyError && <p className="error" role="alert">{historyError}</p>}
          {deleteError && <p className="error" role="alert">{deleteError}</p>}
          {deleteMessage && <p className="save-message">{deleteMessage}</p>}
          {nameUpdateError && <p className="error" role="alert">{nameUpdateError}</p>}
          {nameUpdateMessage && <p className="save-message">{nameUpdateMessage}</p>}
          {!historyLoading && !historyError && savedResults.length === 0 && <p className="placeholder">No saved results yet.</p>}
          {!historyLoading && savedResults.length > 0 && (
            <>
              <div className="saved-results-toolbar">
                <fieldset className="risk-filter-group">
                  <legend className="risk-filter-title">Show risk classifications</legend>
                  <div className="risk-filter-options">
                    {riskFilterOptions.map((label) => (
                      <label key={label} className="risk-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedRiskLabels.includes(label)}
                          onChange={() => toggleRiskLabelFilter(label)}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="saved-results-actions">
                  <button
                    type="button"
                    className="refresh-history-button"
                    onClick={selectAllRiskLabels}
                    disabled={riskFilterOptions.length === selectedRiskLabels.length}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="refresh-history-button"
                    onClick={clearRiskLabels}
                    disabled={selectedRiskLabels.length === 0}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="export-history-button"
                    onClick={exportFilteredResultsAsCsv}
                    disabled={filteredSavedResults.length === 0}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {filteredSavedResults.length === 0 ? (
                <p className="placeholder">No rows match the selected classifications.</p>
              ) : (
                <div className="saved-results-table-shell">
                  <table className="saved-results-table">
                    <caption className="sr-only">
                      Saved prediction results with clinical inputs, numerical risk, and classification.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Actions</th>
                        <th scope="col">Classification</th>
                        <th scope="col">Risk Probability</th>
                        <th scope="col">Risk %</th>
                        <th scope="col">Patient First Name</th>
                        <th scope="col">Patient Last Name</th>
                        {SAVED_INPUT_COLUMNS.map((column) => (
                          <th key={column.key} scope="col">{column.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSavedResults.map((entry) => {
                        const riskLabel = normalizeRiskLabel(entry?.risk_label)
                        const rowIsEditing = editingResultId === entry.id
                        const rowUpdating = nameUpdateLoadingId === entry.id
                        return (
                          <tr key={entry.id}>
                            <td className="saved-actions-cell">
                              {rowIsEditing ? (
                                <div className="saved-actions-group">
                                  <button
                                    type="button"
                                    className="save-name-button"
                                    onClick={() => handleSaveEditedName(entry.id)}
                                    disabled={rowUpdating || Boolean(deletingResultId) || confirmDialog.open}
                                  >
                                    {rowUpdating ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    className="cancel-edit-button"
                                    onClick={cancelEditSavedResultName}
                                    disabled={rowUpdating || confirmDialog.open}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="saved-actions-group">
                                  <button
                                    type="button"
                                    className="edit-result-button"
                                    onClick={() => beginEditSavedResultName(entry)}
                                    disabled={Boolean(deletingResultId) || Boolean(nameUpdateLoadingId) || confirmDialog.open}
                                  >
                                    Edit Name
                                  </button>
                                  <button
                                    type="button"
                                    className="delete-result-button"
                                    onClick={() => handleDeleteSavedResult(entry.id)}
                                    disabled={Boolean(deletingResultId) || Boolean(nameUpdateLoadingId) || confirmDialog.open}
                                  >
                                    {deletingResultId === entry.id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`saved-risk-chip ${getRiskToneClass(riskLabel, riskRules)}`}>{riskLabel}</span>
                            </td>
                            <td>{formatMetric(entry.risk_probability, 4)}</td>
                            <td>{formatMetric(entry.risk_percent)}%</td>
                            <td>
                              {rowIsEditing ? (
                                <input
                                  type="text"
                                  maxLength={80}
                                  value={editIdentity.firstName}
                                  onChange={(event) => setEditIdentity((prev) => ({ ...prev, firstName: event.target.value }))}
                                  className="inline-name-input"
                                  aria-label="Edit patient first name"
                                  disabled={rowUpdating}
                                />
                              ) : (
                                entry?.patient_first_name || '-'
                              )}
                            </td>
                            <td>
                              {rowIsEditing ? (
                                <input
                                  type="text"
                                  maxLength={80}
                                  value={editIdentity.lastName}
                                  onChange={(event) => setEditIdentity((prev) => ({ ...prev, lastName: event.target.value }))}
                                  className="inline-name-input"
                                  aria-label="Edit patient last name"
                                  disabled={rowUpdating}
                                />
                              ) : (
                                entry?.patient_last_name || '-'
                              )}
                            </td>
                            {SAVED_INPUT_COLUMNS.map((column) => (
                              <td key={column.key}>{getClinicalInputValue(entry, column.key)}</td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {confirmDialog.open && (
        <div className="action-confirm-backdrop" role="presentation">
          <section
            ref={confirmDialogRef}
            className="action-confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
            tabIndex={-1}
          >
            <h2 id="confirm-dialog-title">{confirmDialog.title}</h2>
            <p id="confirm-dialog-description">{confirmDialog.message}</p>
            <div className="action-confirm-actions">
              <button type="button" className="cancel-confirm-button" onClick={closeConfirmDialog}>
                Cancel
              </button>
              <button type="button" className="proceed-confirm-button" onClick={handleConfirmDialogAction}>
                {confirmDialog.type === 'delete' ? 'Delete Result' : 'Save Changes'}
              </button>
            </div>
          </section>
        </div>
      )}

      {saveSuccessDialogOpen && (
        <div className="save-success-backdrop" role="presentation">
          <section
            ref={saveSuccessDialogRef}
            className="save-success-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-success-title"
            aria-describedby="save-success-description"
            tabIndex={-1}
          >
            <h2 id="save-success-title">Prediction Saved</h2>
            <p id="save-success-description">Your prediction result was saved successfully.</p>
            <div className="save-success-actions">
              <button type="button" onClick={() => setSaveSuccessDialogOpen(false)}>
                Keep Result View
              </button>
              <button
                type="button"
                className="clear-view-button"
                onClick={() => {
                  clearPredictionView()
                  setSaveSuccessDialogOpen(false)
                }}
              >
                Clear Result View
              </button>
            </div>
          </section>
        </div>
      )}

    </div>
  )
}

export default App

