import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Bookmark,
  ClipboardCheck,
  CalendarDays,
  ChevronRight,
  FileAudio,
  Clock3,
  Download,
  Flame,
  Headphones,
  Layers3,
  ListFilter,
  LayoutDashboard,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Menu,
  Mic2,
  Moon,
  MoreHorizontal,
  Plus,
  Pin,
  Pencil,
  Podcast,
  Radio,
  Search,
  Save,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trophy,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { loadTestResults, saveTestResults } from '@/features/simulator/storage'
import { createAssessmentLesson } from '@/features/simulator/assessmentLesson'
import { SpeakiaAssistant, type CoachLaunchRequest } from '@/features/assistant/SpeakiaAssistant'
import {
  ASSISTANT_MODELS,
  DEFAULT_ASSISTANT_CHAT_MODEL,
  DEFAULT_ASSISTANT_TOOL_MODEL,
  type AssistantModel,
} from '@/features/assistant/models'
import { loadConversationAudioCopy, loadTestRecording, saveAssessmentLesson, saveConversationAudioCopy, saveTestRecording, saveTranscriptAudio } from '@/features/simulator/recordingStorage'
import { TranscriptAudioList } from '@/features/simulator/TranscriptAudioList'
import { groupTranscriptTurns } from '@/features/simulator/transcript'
import type { TestResult, TranscriptEntry } from '@/features/simulator/types'
import type { TestPart } from '@/features/simulator/types'
import { lexicalCategories, starterLexicalEntries, type LexicalCategory, type LexicalEntry } from '@/features/vault/lexicalEntries'
import { LexicalPronunciationButton } from '@/features/vault/LexicalPronunciationButton'
import { readGeminiApiKey, writeGeminiApiKey } from '@/features/simulator/apiKey'
import { assessSpeakingAudio, ASSESSMENT_MODELS, prepareAudioForAssessment, type AssessmentModel } from '@/features/simulator/gemini'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { AssignmentPage } from '@/features/assignments/AssignmentPage'
import { NotificationCenter } from '@/features/notifications/NotificationCenter'
import { FeatureTour } from '@/features/profile/FeatureTour'
import { chooseTomorrowAssignment } from '@/features/assignments/coach'
import { loadAssignments, saveAssignments } from '@/features/assignments/storage'
import type { AssignmentPerformanceReport } from '@/features/assignments/types'
import type { CoachAssignment } from '@/features/assignments/types'
import {
  authenticateLocalAccount,
  clearLocalSession,
  createLocalAccount,
  loadUserProfile,
  readLocalSession,
  saveLocalSession,
  saveUserProfile,
  type UserProfile,
} from '@/features/profile/localAccount'

const Simulator = lazy(() => import('@/features/simulator/Simulator').then((module) => ({ default: module.Simulator })))
const AssessmentView = lazy(() => import('@/features/simulator/AssessmentView').then((module) => ({ default: module.AssessmentView })))
const MediaAssessmentPage = lazy(() => import('@/features/mediaAssessments/MediaAssessmentPage').then((module) => ({ default: module.MediaAssessmentPage })))
const SmartLesson = lazy(() => import('@/features/learning/SmartLesson').then((module) => ({ default: module.SmartLesson })))
const PodcastsPage = lazy(() => import('@/features/podcasts/PodcastsPage').then((module) => ({ default: module.PodcastsPage })))
const TopicBankPage = lazy(() => import('@/features/topics/TopicBankPage').then((module) => ({ default: module.TopicBankPage })))
const CoachAssetsPage = lazy(() => import('@/features/assistant/CoachAssetsPage').then((module) => ({ default: module.CoachAssetsPage })))
const AiToAiSimulationPage = lazy(() => import('@/features/aiSimulation/AiToAiSimulationPage').then((module) => ({ default: module.AiToAiSimulationPage })))
const FlashcardsPage = lazy(() => import('@/features/flashcards/FlashcardsPage').then((module) => ({ default: module.FlashcardsPage })))

type Section = 'Dashboard' | 'Lexis & Topics' | 'Learning Library' | 'Topic Bank' | 'Smart lesson' | 'Speakia Coach Assets' | 'Assignments' | 'Speakia Flashcards' | 'Practice' | 'AI-to-AI Simulation' | 'Assessments' | 'Media assessments' | 'Speakia Podcasts' | 'Test history' | 'Lexical Vault' | 'Profile' | 'Settings'
type LearningLibraryTab = 'topic-bank' | 'lexical-vault'

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Practice', icon: Mic2 },
  { label: 'Speakia Flashcards', icon: Layers3 },
  { label: 'AI-to-AI Simulation', icon: Radio },
  { label: 'Test history', icon: Clock3 },
  { label: 'Assessments', icon: Target },
  { label: 'Lexis & Topics', icon: BookOpen },
  { label: 'Smart lesson', icon: Sparkles },
  { label: 'Speakia Coach Assets', icon: Layers3 },
  { label: 'Speakia Podcasts', icon: Podcast },
  { label: 'Media assessments', icon: FileAudio },
  { label: 'Assignments', icon: ClipboardCheck },
  { label: 'Settings', icon: Settings },
]
const sectionDisplayNames: Partial<Record<Section, string>> = {
  'Smart lesson': 'Smart Lesson',
  'Speakia Coach Assets': 'Coach Assets',
  'Test history': 'Test History',
  'Media assessments': 'Media Assessments',
}

const LEXICAL_ENTRIES_KEY = 'speakia-lexical-entries-v1'
const SAVED_LEXICAL_IDS_KEY = 'speakia-saved-lexical-ids-v1'
const PINNED_LEARNING_IDS_KEY = 'speakia-pinned-learning-ids-v1'

function loadPinnedLearningIds(): string[] {
  try {
    const stored = localStorage.getItem(PINNED_LEARNING_IDS_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('Saved pinned learning items are invalid.')
    }
    return parsed
  } catch (error) {
    console.error('Unable to load pinned Lexis & Topics items.', error)
    return []
  }
}

function loadLexicalEntries(): LexicalEntry[] {
  try {
    const stored = localStorage.getItem(LEXICAL_ENTRIES_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved Lexical Vault entries are not a list.')
    return parsed.filter((item): item is LexicalEntry =>
      typeof item === 'object' && item !== null
      && typeof item.id === 'string' && typeof item.term === 'string'
      && lexicalCategories.includes(item.category)
      && typeof item.meaning === 'string' && typeof item.example === 'string'
      && typeof item.topic === 'string'
      && (item.meanings === undefined || (Array.isArray(item.meanings) && item.meanings.every((value: unknown) => typeof value === 'string')))
      && (item.examples === undefined || (Array.isArray(item.examples) && item.examples.every((value: unknown) => typeof value === 'string')))
      && (item.parts === undefined || (Array.isArray(item.parts) && item.parts.every((value: unknown) => typeof value === 'string' && ['full', 'part1', 'part2', 'part3'].includes(value))))
      && (item.sampleQuestions === undefined || (Array.isArray(item.sampleQuestions) && item.sampleQuestions.every((value: unknown) => typeof value === 'string'))),
    )
  } catch (error) {
    console.error('Unable to load custom Lexical Vault entries.', error)
    return []
  }
}

function loadSavedLexicalIds(): string[] {
  try {
    const stored = localStorage.getItem(SAVED_LEXICAL_IDS_KEY)
    if (!stored) return ['bustling', 'picturesque']
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('Saved Lexical Vault bookmarks are invalid.')
    }
    return parsed
  } catch (error) {
    console.error('Unable to load saved Lexical Vault bookmarks.', error)
    return []
  }
}

const todayLabel = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}).format(new Date()).toUpperCase()

function dashboardCountdown(testDate: string): string {
  const days = daysUntil(testDate)
  if (days < 0) return 'Your planned IELTS test date has passed. Update it in your profile.'
  if (days === 0) return 'Your IELTS test is today. Take a breath and trust your preparation.'
  return `${days} days until your IELTS test. Every conversation brings you closer to your goal.`
}

function daysUntil(date: string): number {
  const target = new Date(`${date}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function App() {
  const [activeSection, setActiveSection] = useState<Section>('Dashboard')
  const [learningLibraryTab, setLearningLibraryTab] = useState<LearningLibraryTab>('topic-bank')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [savedWords, setSavedWords] = useState<string[]>(loadSavedLexicalIds)
  const [pinnedLearningIds, setPinnedLearningIds] = useState<string[]>(loadPinnedLearningIds)
  const [customLexicalEntries, setCustomLexicalEntries] = useState<LexicalEntry[]>(loadLexicalEntries)
  const [completedTests, setCompletedTests] = useState<TestResult[]>(loadTestResults)
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])
  const [assignmentBusy, setAssignmentBusy] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState<CoachAssignment | null>(null)
  const [coachLaunch, setCoachLaunch] = useState<CoachLaunchRequest | null>(null)
  const [practiceInitialPart, setPracticeInitialPart] = useState<Exclude<TestPart, 'full'> | undefined>()
  const [practiceStartImmediately, setPracticeStartImmediately] = useState(false)
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null)
  const [historyTargetTestId, setHistoryTargetTestId] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [assessmentModel, setAssessmentModel] = useState<AssessmentModel>(() => {
    try {
      const savedModel = localStorage.getItem('speakia-assessment-model') ?? localStorage.getItem('speakia-evaluation-model')
      return ASSESSMENT_MODELS.find((model) => model.id === savedModel)?.id ?? 'gemini-3.8-flash'
    } catch (error) {
      console.error('Unable to read the saved speaking assessment model.', error)
      return 'gemini-3.8-flash'
    }
  })
  const [assistantChatModel, setAssistantChatModel] = useState<AssistantModel>(() => {
    try {
      const savedModel = localStorage.getItem('speakia-assistant-chat-model')
      return ASSISTANT_MODELS.find((model) => model.id === savedModel)?.id ?? DEFAULT_ASSISTANT_CHAT_MODEL
    } catch (error) {
      console.error('Unable to read the saved Speakia assistant chat model.', error)
      return DEFAULT_ASSISTANT_CHAT_MODEL
    }
  })
  const [assistantToolModel, setAssistantToolModel] = useState<AssistantModel>(() => {
    try {
      const savedModel = localStorage.getItem('speakia-assistant-tool-model')
      return ASSISTANT_MODELS.find((model) => model.id === savedModel)?.id ?? DEFAULT_ASSISTANT_TOOL_MODEL
    } catch (error) {
      console.error('Unable to read the saved Speakia assistant tool model.', error)
      return DEFAULT_ASSISTANT_TOOL_MODEL
    }
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const storedTheme = localStorage.getItem('speakia-theme')
      if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
    } catch (error) {
      console.error('Unable to read the saved Speakia theme preference.', error)
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const shouldReduceMotion = useReducedMotion()
  const lexicalEntries = useMemo(() => [
    ...starterLexicalEntries.map((entry) => customLexicalEntries.find((saved) => saved.id === entry.id) ?? entry),
    ...customLexicalEntries.filter((entry) => entry.id.startsWith('custom-')),
  ], [customLexicalEntries])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('speakia-theme', theme)
    } catch (error) {
      console.error('Unable to save the Speakia theme preference.', error)
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(LEXICAL_ENTRIES_KEY, JSON.stringify(customLexicalEntries))
    } catch (error) {
      console.error('Unable to save custom Lexical Vault entries.', error)
    }
  }, [customLexicalEntries])

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_LEXICAL_IDS_KEY, JSON.stringify(savedWords))
    } catch (error) {
      console.error('Unable to save Lexical Vault bookmarks.', error)
    }
  }, [savedWords])

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_LEARNING_IDS_KEY, JSON.stringify(pinnedLearningIds))
    } catch (error) {
      console.error('Unable to save pinned Lexis & Topics items.', error)
    }
  }, [pinnedLearningIds])

  useEffect(() => {
    let isCurrent = true
    async function restoreSession() {
      try {
        const username = readLocalSession()
        if (username) {
          const profile = await loadUserProfile(username)
          if (isCurrent && profile) {
            setAssignments(loadAssignments(profile.username))
            setUserProfile(profile)
          }
          else if (isCurrent) clearLocalSession()
        }
      } catch (error) {
        console.error('Unable to restore the local Speakia account session.', error)
        if (isCurrent) setStorageWarning('Your local profile could not be loaded from this browser.')
      } finally {
        if (isCurrent) setAuthLoading(false)
      }
    }
    void restoreSession()
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    let isCurrent = true
    void readGeminiApiKey().then((savedKey) => {
      if (isCurrent) setApiKey(savedKey)
    }).catch((error: unknown) => {
      console.error('Unable to restore the Gemini API key from browser database storage.', error)
      if (isCurrent) setStorageWarning(error instanceof Error ? error.message : 'The saved Gemini API key could not be loaded from this browser.')
    })
    return () => { isCurrent = false }
  }, [])

  const navigate = (section: Section) => {
    if (section === 'Test history') setHistoryTargetTestId(null)
    if (section === 'Topic Bank' || section === 'Lexical Vault') {
      setLearningLibraryTab(section === 'Topic Bank' ? 'topic-bank' : 'lexical-vault')
      setActiveSection('Lexis & Topics')
    } else {
      setActiveSection(section === 'Learning Library' ? 'Lexis & Topics' : section)
    }
    setMobileMenuOpen(false)
    if (section === 'Assessments') {
      setSelectedResult((current) => current ?? completedTests[0] ?? null)
    }
  }

  function openTestInHistory(result: TestResult) {
    setHistoryTargetTestId(result.id)
    setMobileMenuOpen(false)
    setActiveSection('Test history')
  }

  function startTopicBankPractice(part: TestPart) {
    setSelectedAssignment(null)
    setPracticeInitialPart(part === 'full' ? undefined : part)
    navigate('Practice')
  }

  function startPracticeFromCoach(part: TestPart) {
    setSelectedAssignment(null)
    setPracticeInitialPart(part === 'full' ? undefined : part)
    setPracticeStartImmediately(true)
    navigate('Practice')
  }

  function startCoachLive(kind: CoachLaunchRequest['kind'], title: string, context: string) {
    setCoachLaunch({ id: crypto.randomUUID(), kind, title, context })
  }

  async function activatePageControl(section: Section, control: string, thenControl?: string) {
    const normalizedTarget = control.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
    if (!normalizedTarget) throw new Error('Name the visible control you want Speakia to activate.')
    navigate(section)

    async function clickControl(label: string) {
      const normalizedLabel = label.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
      await new Promise<void>((resolve, reject) => {
        const main = document.querySelector<HTMLElement>('.main-area')
        if (!main) {
          reject(new Error('The workspace page is not available yet.'))
          return
        }
        const mainElement = main
        let finished = false
        const observer = new MutationObserver(() => attempt())
        const timeout = window.setTimeout(() => {
          if (finished) return
          finished = true
          observer.disconnect()
          reject(new Error(`Could not find the visible “${label}” control on ${section}.`))
        }, 8000)
        function attempt() {
          if (finished) return
          const controls = Array.from(mainElement.querySelectorAll<HTMLElement>('button, [role="button"], [role="tab"], a'))
            .filter((element) => element.getClientRects().length > 0 && !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true')
          const getLabel = (element: HTMLElement) => (element.getAttribute('aria-label') || element.innerText || element.getAttribute('title') || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
          const exact = controls.find((element) => getLabel(element) === normalizedLabel)
          const matches = exact ? [exact] : controls.filter((element) => getLabel(element).includes(normalizedLabel))
          if (matches.length !== 1) return
          finished = true
          window.clearTimeout(timeout)
          observer.disconnect()
          matches[0].click()
          resolve()
        }
        observer.observe(mainElement, { childList: true, subtree: true, attributes: true })
        attempt()
      })
    }

    await clickControl(control)
    if (thenControl) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      await clickControl(thenControl)
    }
  }

  async function handleSaveApiKey(value: string) {
    await writeGeminiApiKey(value)
    setApiKey(value.trim())
    setStorageWarning('')
  }

  async function handleChooseTomorrowAssignment(): Promise<CoachAssignment> {
    if (assignmentBusy) throw new Error('Speakia is already choosing your assignment.')
    const profile = userProfile
    if (!profile) throw new Error('Sign in before asking Speakia to choose an assignment.')
    setAssignmentBusy(true)
    setAssignmentError('')
    try {
      const assignment = await chooseTomorrowAssignment(apiKey, profile, completedTests, assistantToolModel, assignments)
      const nextAssignments = [
        assignment,
        ...assignments.filter((item) => item.assignedFor !== assignment.assignedFor),
      ]
      saveAssignments(profile.username, nextAssignments)
      setAssignments(nextAssignments)
      return assignment
    } catch (error) {
      console.error('Unable to create tomorrow’s Speakia coach assignment.', error)
      const message = error instanceof Error ? error.message : 'Speakia could not choose your assignment.'
      setAssignmentError(message)
      throw error
    } finally {
      setAssignmentBusy(false)
    }
  }

  function updateAssignment(assignment: CoachAssignment) {
    if (!userProfile) {
      setAssignmentError('Sign in before updating an assignment.')
      return false
    }
    if (!assignments.some((item) => item.id === assignment.id)) {
      setAssignmentError('This assignment is no longer available. Refresh the page and try again.')
      return false
    }
    const nextAssignments = assignments.map((item) => item.id === assignment.id ? assignment : item)
    try {
      saveAssignments(userProfile.username, nextAssignments)
      setAssignments(nextAssignments)
      setAssignmentError('')
      return true
    } catch (error) {
      console.error('Unable to update the Speakia assignment.', error)
      setAssignmentError(error instanceof Error ? error.message : 'The assignment could not be updated.')
      return false
    }
  }

  function startAssignment(assignment: CoachAssignment) {
    setSelectedAssignment(assignment)
    setPracticeInitialPart(undefined)
    navigate('Practice')
  }

  function handleAssessmentModelChange(value: AssessmentModel) {
    setAssessmentModel(value)
    try {
      localStorage.setItem('speakia-assessment-model', value)
    } catch (error) {
      console.error('Unable to save the speaking assessment model preference.', error)
      setStorageWarning('Your assessment model changed for this session but could not be saved on this device.')
    }
  }

  function handleAssistantModelChange(kind: 'chat' | 'tool', value: AssistantModel) {
    const setModel = kind === 'chat' ? setAssistantChatModel : setAssistantToolModel
    const key = kind === 'chat' ? 'speakia-assistant-chat-model' : 'speakia-assistant-tool-model'
    const label = kind === 'chat' ? 'assistant chat model' : 'assistant tool-generation model'
    setModel(value)
    try {
      localStorage.setItem(key, value)
      setStorageWarning('')
    } catch (error) {
      console.error(`Unable to save the Speakia ${label}.`, error)
      setStorageWarning(`Your ${label} changed for this session but could not be saved on this device.`)
    }
  }

  const completeTest = async (result: TestResult, recording: Blob, audioCopy: Blob, transcriptAudio: TranscriptEntry[]) => {
    let audioAvailable = false
    let audioCopySaved = false
    let transcriptAudioSaved = transcriptAudio.length === 0
    try {
      await saveTestRecording(result.id, recording)
      audioAvailable = true
    } catch (error) {
      console.error('Unable to save the completed IELTS practice recording.', error)
    }
    try {
      await saveConversationAudioCopy(result.id, audioCopy)
      audioCopySaved = true
    } catch (error) {
      console.error('Unable to save the compiled conversation audio copy.', error)
    }
    try {
      await saveTranscriptAudio(result.id, transcriptAudio)
      transcriptAudioSaved = true
    } catch (error) {
      console.error('Unable to save original transcript turn audio.', error)
    }
    let assessmentLessonAvailable = false
    let assessmentLessonVersion: string | undefined
    let assessmentLessonError = ''
    try {
      const lesson = await createAssessmentLesson(apiKey, result, result.assessmentModel ?? assessmentModel)
      await saveAssessmentLesson(result.id, lesson)
      assessmentLessonAvailable = true
      assessmentLessonVersion = new Date().toISOString()
    } catch (error) {
      console.error(`Unable to create a personalized lesson for assessment ${result.id}.`, error)
      assessmentLessonError = error instanceof Error ? error.message : 'The personalized lesson could not be generated.'
    }
    const savedResult = { ...result, audioAvailable, audioCopyAvailable: audioCopySaved, assessmentLessonAvailable, assessmentLessonVersion }
    if (selectedAssignment?.status === 'assigned') {
      updateAssignment({ ...selectedAssignment, status: 'completed' })
      setSelectedAssignment(null)
    }
    const nextResults = [savedResult, ...completedTests]
    setCompletedTests(nextResults)
    setSelectedResult(savedResult)
    const resultSaved = saveTestResults(nextResults)
    setStorageWarning(!resultSaved
      ? 'This assessment could not be saved to browser storage.'
      : !audioAvailable
        ? 'Your assessment was saved, but this browser could not save its audio recording for playback.'
        : !audioCopySaved
          ? 'Your assessment was saved, but the compiled two-way conversation audio could not be saved.'
        : !transcriptAudioSaved
          ? 'Your assessment was saved, but original transcript turn audio could not be saved.'
          : !assessmentLessonAvailable
            ? `Your assessment was saved, but its personalized lesson could not be generated. ${assessmentLessonError}`
        : '')
    setActiveSection('Assessments')
  }

  async function handleAuthenticate(username: string, password: string, createAccount: boolean) {
    const profile = createAccount
      ? await createLocalAccount(username, password)
      : await authenticateLocalAccount(username, password)
    saveLocalSession(profile.username)
    setConfirmSignOut(false)
    setUserProfile(profile)
    setAssignments(loadAssignments(profile.username))
    setSelectedAssignment(null)
    setActiveSection(createAccount ? 'Profile' : 'Dashboard')
  }

  async function handleSaveProfile(profile: UserProfile) {
    await saveUserProfile(profile)
    setUserProfile(profile)
    setStorageWarning('')
  }

  async function reassessTest(result: TestResult, model: AssessmentModel): Promise<void> {
    if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings before reassessing a recording.')
    const audio = await loadConversationAudioCopy(result.id) ?? await loadTestRecording(result.id)
    if (!audio) throw new Error('The original recording is not available in this browser, so it cannot be reassessed.')
    const preparedAudio = await prepareAudioForAssessment(audio)
    const reassessed = await assessSpeakingAudio(apiKey, preparedAudio, result.transcript, result.part, result.durationSeconds, model)
    let assessmentLessonAvailable = false
    let assessmentLessonVersion: string | undefined
    let assessmentLessonError = ''
    const reassessedResult: TestResult = {
      ...reassessed,
      id: result.id,
      title: result.title,
      completedAt: result.completedAt,
      audioAvailable: result.audioAvailable,
      audioCopyAvailable: result.audioCopyAvailable,
    }
    try {
      const lesson = await createAssessmentLesson(apiKey, reassessedResult, model)
      await saveAssessmentLesson(result.id, lesson)
      assessmentLessonAvailable = true
      assessmentLessonVersion = new Date().toISOString()
    } catch (error) {
      console.error(`Unable to create a personalized lesson after reassessing test ${result.id}.`, error)
      assessmentLessonError = error instanceof Error ? error.message : 'The personalized lesson could not be generated.'
    }
    const updatedResult: TestResult = { ...reassessedResult, assessmentLessonAvailable, assessmentLessonVersion }
    const nextResults = completedTests.map((item) => item.id === result.id ? updatedResult : item)
    if (!saveTestResults(nextResults)) throw new Error('The new assessment could not be saved to browser storage.')
    setCompletedTests(nextResults)
    setSelectedResult(updatedResult)
    setStorageWarning(assessmentLessonAvailable
      ? ''
      : `The audio was reassessed successfully, but its personalized lesson could not be generated. ${assessmentLessonError}`)
  }

  function handleSignOut() {
    try {
      clearLocalSession()
      setConfirmSignOut(false)
      setUserProfile(null)
      setAssignments([])
      setSelectedAssignment(null)
      setActiveSection('Dashboard')
    } catch (error) {
      console.error('Unable to sign out of the local Speakia account.', error)
      setStorageWarning('Unable to clear the local session. Close this tab to end the session.')
    }
  }

  if (authLoading) return <div className="auth-loading" role="status">Loading your local Speakia profile…</div>
  if (!userProfile) return <LocalAuthPage onAuthenticate={handleAuthenticate} />

  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigate('Dashboard') }}>
          <span className="brand-mark"><AudioLines size={21} strokeWidth={2.4} /></span>
          <span className="brand-copy"><strong>Speakia IELTS</strong><small>Speaking Test Simulator</small><small>and High Precision Assessment</small></span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${activeSection === label ? 'nav-link-active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{sectionDisplayNames[label] ?? label}</span>
              {label === 'Assignments' && assignments.some((assignment) => assignment.status === 'assigned') && <span className="nav-count">{assignments.filter((assignment) => assignment.status === 'assigned').length}</span>}
              {label === 'Lexis & Topics' && <span className="nav-count">{starterLexicalEntries.length + customLexicalEntries.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-coach">
          <span className="coach-spark"><Sparkles size={16} /></span>
          <p className="coach-title">Your next band is closer.</p>
          <p className="coach-copy">A little practice every day goes a long way.</p>
          <div className="coach-progress"><span /></div>
          <div className="coach-progress-label"><span>Weekly goal</span><span>3 of 5 days</span></div>
        </div>
        <div className="profile-actions">
          <button className="profile-button" onClick={() => navigate('Profile')}>
            <span className="avatar">{(userProfile.displayName || userProfile.username).slice(0, 1).toLocaleUpperCase()}</span>
            <span className="profile-copy"><strong>{userProfile.displayName || userProfile.username}</strong><small>Local profile</small></span>
            <MoreHorizontal size={19} className="profile-more" />
          </button>
          <button className="profile-signout" onClick={() => setConfirmSignOut(true)} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><button className="mobile-menu-button" aria-label="Open menu" onClick={() => setMobileMenuOpen(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{sectionDisplayNames[activeSection] ?? activeSection}</strong></div>
          <div className="topbar-actions">
            <NotificationCenter username={userProfile.username} apiKeyAvailable={Boolean(apiKey.trim())} assignments={assignments} results={completedTests} onNavigate={navigate} />
            <button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}><motion.span key={theme} initial={shouldReduceMotion ? false : { opacity: 0, rotate: -35, scale: .8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: shouldReduceMotion ? 0 : .2 }}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</motion.span></button>
            <button className="avatar top-avatar top-avatar-button" onClick={() => navigate('Profile')} aria-label="Open your profile">{(userProfile.displayName || userProfile.username).slice(0, 1).toLocaleUpperCase()}</button>
          </div>
        </header>
        {storageWarning && <p className="storage-warning" role="status">{storageWarning}</p>}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
          >
            <Suspense fallback={<div className="page-loading" role="status">Loading your workspace…</div>}>
              {activeSection === 'Dashboard' && <Dashboard onNavigate={navigate} onOpenTest={openTestInHistory} completedTests={completedTests} savedLexicalCount={savedWords.length} profile={userProfile} />}
              {activeSection === 'Lexis & Topics' && <div className="learning-library-page">
                <div className="learning-library-tabs" role="tablist" aria-label="Lexis & Topics sections">
                  <button id="topic-bank-tab" type="button" role="tab" tabIndex={learningLibraryTab === 'topic-bank' ? 0 : -1} aria-selected={learningLibraryTab === 'topic-bank'} aria-controls="topic-bank-panel" className={`learning-library-tab ${learningLibraryTab === 'topic-bank' ? 'learning-library-tab-active' : ''}`} onClick={() => setLearningLibraryTab('topic-bank')} onKeyDown={(event) => {
                    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                      event.preventDefault()
                      setLearningLibraryTab('lexical-vault')
                      document.getElementById('lexical-vault-tab')?.focus()
                    }
                  }}><span className="learning-library-tab-icon topic-bank-tab-icon"><ListFilter size={18} /></span><span className="learning-library-tab-copy"><strong>Topic Bank</strong><small>Questions &amp; cue cards</small></span><span className="learning-library-tab-arrow"><ArrowRight size={15} /></span></button>
                  <button id="lexical-vault-tab" type="button" role="tab" tabIndex={learningLibraryTab === 'lexical-vault' ? 0 : -1} aria-selected={learningLibraryTab === 'lexical-vault'} aria-controls="lexical-vault-panel" className={`learning-library-tab ${learningLibraryTab === 'lexical-vault' ? 'learning-library-tab-active' : ''}`} onClick={() => setLearningLibraryTab('lexical-vault')} onKeyDown={(event) => {
                    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                      event.preventDefault()
                      setLearningLibraryTab('topic-bank')
                      document.getElementById('topic-bank-tab')?.focus()
                    }
                  }}><span className="learning-library-tab-icon lexical-vault-tab-icon"><BookOpen size={18} /></span><span className="learning-library-tab-copy"><strong>Lexical Vault</strong><small>Words &amp; expressions</small></span><span className="learning-library-tab-count">{starterLexicalEntries.length + customLexicalEntries.length}</span></button>
                </div>
                <div id="topic-bank-panel" role="tabpanel" aria-labelledby="topic-bank-tab" hidden={learningLibraryTab !== 'topic-bank'}><TopicBankPage apiKey={apiKey} pinnedIds={pinnedLearningIds} onTogglePin={(id) => setPinnedLearningIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onPractice={startTopicBankPractice} onStartCoachLive={(title, context) => startCoachLive('topic', title, context)} /></div>
                <div id="lexical-vault-panel" role="tabpanel" aria-labelledby="lexical-vault-tab" hidden={learningLibraryTab !== 'lexical-vault'}><WordVaultPage entries={lexicalEntries} savedIds={savedWords} pinnedIds={pinnedLearningIds} apiKey={apiKey} onTogglePin={(id) => setPinnedLearningIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onOpenFlashcards={() => navigate('Speakia Flashcards')} onAdd={(entry) => setCustomLexicalEntries((current) => [entry, ...current])} onUpdate={(entry) => setCustomLexicalEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)])} onToggleSave={(id) => setSavedWords((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onStartCoachLive={(item) => startCoachLive('lexical', item.term, [
                  `Word or expression: ${item.term}${item.partOfSpeech ? ` (${item.partOfSpeech})` : ''}`,
                  `Meaning: ${(item.meanings?.length ? item.meanings : [item.meaning]).join('; ')}`,
                  `Topic: ${item.topic || 'general IELTS Speaking'}`,
                  `Examples: ${(item.examples?.length ? item.examples : [item.example]).join('; ')}`,
                  `Category: ${item.category}`,
                ].join('\n'))} /></div>
              </div>}
              {activeSection === 'Smart lesson' && <SmartLesson />}
              {activeSection === 'Speakia Coach Assets' && <CoachAssetsPage onOpenCoach={() => window.dispatchEvent(new Event('speakia:open-coach'))} onAdapt={(asset) => window.dispatchEvent(new CustomEvent('speakia:coach-adapt-asset', { detail: asset }))} />}
              {activeSection === 'Assignments' && <AssignmentPage assignments={assignments} busy={assignmentBusy} error={assignmentError} apiKey={apiKey} onOpenSettings={() => navigate('Settings')} onChoose={handleChooseTomorrowAssignment} onComplete={(assignment) => updateAssignment({ ...assignment, status: 'completed' })} onStart={startAssignment} onSubmit={(assignment, report: AssignmentPerformanceReport) => {
                if (!updateAssignment({ ...assignment, status: 'completed', report })) {
                  throw new Error('The assignment report could not be saved. Please free browser storage and submit again.')
                }
              }} />}
              {activeSection === 'Speakia Flashcards' && <FlashcardsPage username={userProfile.username} entries={lexicalEntries} savedIds={savedWords} apiKey={apiKey} onOpenSettings={() => navigate('Settings')} onOpenLexis={() => navigate('Lexical Vault')} />}
              {activeSection === 'Practice' && <Simulator onComplete={completeTest} apiKey={apiKey} assessmentModel={assessmentModel} onOpenSettings={() => navigate('Settings')} initialPart={selectedAssignment?.part ?? practiceInitialPart} assignment={selectedAssignment} startImmediately={practiceStartImmediately} onStartRequestHandled={() => setPracticeStartImmediately(false)} />}
              {activeSection === 'AI-to-AI Simulation' && <AiToAiSimulationPage username={userProfile.username} apiKey={apiKey} onOpenSettings={() => navigate('Settings')} />}
              {activeSection === 'Assessments' && <AssessmentView result={selectedResult ?? completedTests[0] ?? null} results={completedTests} onSelect={setSelectedResult} onPractice={() => navigate('Practice')} apiKey={apiKey} assessmentModel={assessmentModel} onAssessmentModelChange={handleAssessmentModelChange} onReassess={reassessTest} />}
              {activeSection === 'Media assessments' && <MediaAssessmentPage apiKey={apiKey} onOpenSettings={() => navigate('Settings')} />}
              {activeSection === 'Speakia Podcasts' && <PodcastsPage username={userProfile.username} profile={userProfile} apiKey={apiKey} results={completedTests} lexicalEntries={lexicalEntries} assignments={assignments} />}
              {activeSection === 'Test history' && <HistoryPage onNavigate={navigate} results={completedTests} initialExpandedTestId={historyTargetTestId} onSelect={(result) => { setSelectedResult(result); setActiveSection('Assessments') }} />}
              {activeSection === 'Profile' && <ProfilePage profile={userProfile} onSave={handleSaveProfile} />}
              {activeSection === 'Settings' && <SettingsPage apiKey={apiKey} onSaveApiKey={handleSaveApiKey} assessmentModel={assessmentModel} onAssessmentModelChange={handleAssessmentModelChange} assistantChatModel={assistantChatModel} assistantToolModel={assistantToolModel} onAssistantModelChange={handleAssistantModelChange} theme={theme} onThemeChange={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      {confirmSignOut && <div className="signout-dialog-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setConfirmSignOut(false)
      }} onKeyDown={(event) => {
        if (event.key === 'Escape') setConfirmSignOut(false)
      }} tabIndex={-1}>
        <section className="signout-dialog" role="alertdialog" aria-modal="true" aria-labelledby="signout-dialog-title" aria-describedby="signout-dialog-description">
          <span className="signout-dialog-icon"><LogOut size={20} /></span>
          <h2 id="signout-dialog-title">Sign out of Speakia?</h2>
          <p id="signout-dialog-description">Your saved practice stays on this browser. You’ll need to sign in again to continue.</p>
          <div><Button type="button" variant="outline" onClick={() => setConfirmSignOut(false)}>Stay signed in</Button><Button type="button" className="signout-confirm-button" onClick={handleSignOut}>Sign out</Button></div>
        </section>
      </div>}
      <SpeakiaAssistant
        activeSection={activeSection}
        results={completedTests}
        lexicalEntries={lexicalEntries}
        profile={userProfile}
        apiKey={apiKey}
        chatModel={assistantChatModel}
        toolModel={assistantToolModel}
        onChatModelChange={(model) => handleAssistantModelChange('chat', model)}
        onStartPractice={startPracticeFromCoach}
        onNavigate={navigate}
        onActivateControl={activatePageControl}
        assignments={assignments}
        onChooseTomorrowAssignment={handleChooseTomorrowAssignment}
        assignmentBusy={assignmentBusy}
        coachLaunch={coachLaunch}
      />
    </div>
  )
}

function LocalAuthPage({ onAuthenticate }: { onAuthenticate: (username: string, password: string, createAccount: boolean) => Promise<void> }) {
  const [mode, setMode] = useState<'signin' | 'create'>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onAuthenticate(username, password, mode === 'create')
    } catch (caughtError) {
      console.error('Local Speakia authentication failed.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to authenticate this local account.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page">
    <div className="auth-layout">
      <FeatureTour />
      <motion.section className="auth-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
      <div className="auth-brand"><span className="brand-mark"><AudioLines size={23} /></span><div><strong>Speakia IELTS</strong><span>Speaking Test Simulator</span></div></div>
      <p className="eyebrow">YOUR PERSONAL SPEAKING STUDIO</p>
      <h1>{mode === 'signin' ? 'Welcome back' : 'Set up your local account'}</h1>
      <p className="auth-description">{mode === 'signin' ? 'Sign in to access your IELTS practice and profile on this browser.' : 'Create a username to save your profile and practice locally on this browser.'}</p>
      <div className="auth-mode-tabs" role="tablist" aria-label="Local account options">
        <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'auth-mode-active' : ''} onClick={() => { setMode('signin'); setError('') }}>Sign in</button>
        <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'auth-mode-active' : ''} onClick={() => { setMode('create'); setError('') }}>Create account</button>
      </div>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>Username<input autoComplete="username" minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Choose a username" required /></label>
        <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your local password" required /></label>
        {mode === 'create' && <p className="auth-password-hint">Prototype password: <strong>letsspeakia</strong></p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <Button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create local account'} <ArrowRight size={16} /></Button>
      </form>
      <div className="auth-local-notice"><LockKeyhole size={15} /><p>Local prototype only: accounts and profile data stay in this browser. This is not server authentication; anyone with browser access can inspect or alter local data. Do not reuse a sensitive password.</p></div>
      </motion.section>
    </div>
  </main>
}

function ProfilePage({ profile, onSave }: { profile: UserProfile; onSave: (profile: UserProfile) => Promise<void> }) {
  const [form, setForm] = useState<UserProfile>(profile)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const testDays = form.testDate ? daysUntil(form.testDate) : null

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const cleanedProfile = {
        ...form,
        displayName: form.displayName.trim() || form.username,
        location: form.location.trim(),
        firstLanguage: form.firstLanguage.trim(),
        studyGoal: form.studyGoal.trim(),
      }
      await onSave(cleanedProfile)
      setMessage('Your profile was saved in this browser.')
    } catch (error) {
      console.error('Unable to save the local IELTS profile.', error)
      setMessage(error instanceof Error ? error.message : 'Unable to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return <div className="page-content inner-page profile-page">
    <PageHeading eyebrow="YOUR PERSONAL SETTINGS" title="Your profile" description="Set your IELTS target and personalize your local speaking practice." />
    <Card className="profile-summary-card"><span className="profile-summary-avatar">{(form.displayName || form.username).slice(0, 1).toLocaleUpperCase()}</span><div><span className="section-kicker">LOCAL ACCOUNT</span><strong>{form.displayName || form.username}</strong><p>@{form.username}</p></div><Badge className="local-account-badge"><LockKeyhole size={13} /> Stored on this browser</Badge></Card>
    <Card className="profile-form-card"><div className="profile-form-heading"><span className="section-kicker">IELTS PREPARATION</span><h2>Profile details</h2><p>Your test timeline helps make your practice plan more relevant.</p></div>
      {form.testDate && <div className={`test-countdown ${testDays !== null && testDays < 0 ? 'test-countdown-past' : ''}`}><CalendarDays size={19} /><div><strong>{testDays === null ? 'Set your test date' : testDays < 0 ? 'Test date has passed' : testDays === 0 ? 'Your test is today' : `${testDays} days to your test`}</strong><span>{new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(`${form.testDate}T00:00:00`))}</span></div></div>}
      <form className="profile-form" onSubmit={(event) => void submit(event)}>
        <label>Display name<input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="How should we address you?" /></label>
        <label>IELTS test date<input type="date" value={form.testDate} onChange={(event) => update('testDate', event.target.value)} /></label>
        <label>Target speaking band<select value={form.targetBand} onChange={(event) => update('targetBand', event.target.value)}><option value="">Not set</option>{[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((band) => <option key={band} value={band}>Band {band.toFixed(1)}</option>)}</select></label>
        <label>IELTS test type<select value={form.testType} onChange={(event) => update('testType', event.target.value as UserProfile['testType'])}><option>Academic</option><option>General Training</option></select></label>
        <label>Location<input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="City or time zone" /></label>
        <label>First language<input value={form.firstLanguage} onChange={(event) => update('firstLanguage', event.target.value)} placeholder="Optional" /></label>
        <label className="profile-goal-field">Speaking study goal<textarea value={form.studyGoal} onChange={(event) => update('studyGoal', event.target.value)} placeholder="What would you most like to improve?" rows={3} /></label>
        {message && <p className={`profile-save-message ${message.startsWith('Your profile') ? 'profile-save-success' : 'auth-error'}`} role="status">{message}</p>}
        <div className="profile-form-actions"><Button className="start-button" type="submit" disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save profile'}</Button></div>
      </form>
    </Card>
    <p className="profile-storage-note"><LockKeyhole size={14} /> Your profile is stored in this browser’s IndexedDB. Clearing site data removes the local account and profile.</p>
  </div>
}

function Dashboard({ onNavigate, onOpenTest, completedTests, savedLexicalCount, profile }: { onNavigate: (section: Section) => void; onOpenTest: (result: TestResult) => void; completedTests: TestResult[]; savedLexicalCount: number; profile: UserProfile }) {
  const [today] = useState(() => new Date())
  const shouldReduceMotion = useReducedMotion()
  const todayKey = localDateKey(today)
  const sortedTests = [...completedTests].sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
  const latestTest = sortedTests[0]
  const bestBand = completedTests.length ? Math.max(...completedTests.map((result) => result.overallBand)).toFixed(1) : '—'
  const testDates = new Set(completedTests.map((result) => localDateKey(new Date(result.completedAt))))
  const streakStart = new Date(today)
  if (!testDates.has(localDateKey(streakStart))) streakStart.setDate(streakStart.getDate() - 1)
  let practiceStreak = 0
  while (testDates.has(localDateKey(streakStart))) {
    practiceStreak += 1
    streakStart.setDate(streakStart.getDate() - 1)
  }
  const weekStart = new Date(today)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + index)
    const dayTests = completedTests.filter((result) => localDateKey(new Date(result.completedAt)) === localDateKey(day))
    return {
      key: localDateKey(day),
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day).slice(0, 1),
      minutes: Math.round(dayTests.reduce((total, result) => total + result.durationSeconds, 0) / 60),
      count: dayTests.length,
      today: localDateKey(day) === todayKey,
    }
  })
  const weeklyMinutes = weeklyActivity.reduce((total, day) => total + day.minutes, 0)
  const maxDailyMinutes = Math.max(1, ...weeklyActivity.map((day) => day.minutes))
  const criterionAverages = completedTests.flatMap((result) => result.criteria)
    .reduce((totals, criterion) => {
      const current = totals.get(criterion.id) ?? { name: criterion.name, total: 0, count: 0 }
      current.total += criterion.band
      current.count += 1
      totals.set(criterion.id, current)
      return totals
    }, new Map<string, { name: string; total: number; count: number }>())
  const weakestCriterion = [...criterionAverages.values()]
    .sort((left, right) => left.total / left.count - right.total / right.count)[0]
  const latestImprovement = latestTest?.nextSteps[0]
    ?? (weakestCriterion ? `Focus your next practice on ${weakestCriterion.name.toLocaleLowerCase()}.` : 'Complete an assessment to get a personalized focus area.')
  const recentTests = sortedTests.slice(0, 3).map((result) => ({
    result,
    part: result.part === 'full' ? 'Full test' : result.part.replace('part', 'Part '),
    topic: result.title,
    date: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(result.completedAt)),
    band: result.overallBand.toFixed(1),
    tone: 'lavender',
  }))
  return (
    <div className="page-content">
      <div className="welcome-row">
      <div><p className="eyebrow">{todayLabel}</p><h1>Welcome, {profile.displayName || profile.username} <span className="wave">✳</span></h1><p className="page-subtitle">{profile.testDate ? dashboardCountdown(profile.testDate) : 'Every conversation brings you closer to your goal.'}</p></div>
        <Button className="start-button" onClick={() => onNavigate('Practice')}><Mic2 size={17} /> Start a practice test <ArrowRight size={16} /></Button>
      </div>
      <section className="hero-card">
        <div className="hero-copy">
          <Badge className="hero-badge"><Sparkles size={13} /> YOUR SPEAKING OVERVIEW</Badge>
          <h2>{latestTest ? <>Your progress,<br />in <em>focus.</em></> : <>Build your<br /><em>baseline.</em></>}</h2>
          <p>{latestTest ? 'Review your latest assessment, track your strongest skills, and choose one clear next step.' : 'Complete your first speaking assessment to create a personal progress baseline and get tailored feedback.'}</p>
          <Button className="hero-button" onClick={() => latestTest ? onNavigate('Assessments') : onNavigate('Practice')}>{latestTest ? 'Review latest assessment' : 'Start your first practice'} <ArrowRight size={16} /></Button>
          {profile.targetBand && <span className="dashboard-target-label">Your target speaking band: <strong>{profile.targetBand}</strong></span>}
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <span className="hero-star star-one">✳</span><span className="hero-star star-two">✦</span>
          <div className="voice-card"><AudioLines size={51} strokeWidth={1.2} /><span>your voice, your pace</span></div>
          <div className="floating-score"><Trophy size={16} /><span><strong>{bestBand}</strong><small>{latestTest ? 'your best estimate' : 'best estimate'}</small></span></div>
        </div>
        <span className="hero-decoration">SPEAK WITH CONFIDENCE</span>
      </section>
      <section className="stats-grid" aria-label="Your progress">
        <StatCard icon={Trophy} tone="purple" label="Latest estimate" value={latestTest ? latestTest.overallBand.toFixed(1) : '—'} detail={<>{latestTest ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(latestTest.completedAt)) : 'Complete a test to set your baseline'}</>} />
        <StatCard icon={AudioLines} tone="coral" label="Tests completed" value={`${completedTests.length}`} detail={<>Saved practice assessments</>} />
        <StatCard icon={Flame} tone="amber" label="Practice streak" value={`${practiceStreak} ${practiceStreak === 1 ? 'day' : 'days'}`} detail={<>Consecutive days with a test</>} />
        <StatCard icon={Target} tone="blue" label="Best estimate" value={bestBand} detail={<>Your highest practice band</>} />
      </section>
      <div className="dashboard-columns">
        <Card className="recent-card">
          <CardHeader className="section-card-header">
            <div><p className="section-kicker">YOUR JOURNEY</p><CardTitle>Recent practice</CardTitle></div>
            <Button variant="ghost" size="sm" className="view-all" onClick={() => onNavigate('Test history')}>View all <ArrowRight size={15} /></Button>
          </CardHeader>
          <CardContent className="recent-list">
            {recentTests.length ? recentTests.map((test) => <div className="test-row" key={test.result.id}>
              <div className={`test-icon test-icon-${test.tone}`}><Headphones size={18} /></div>
              <div className="test-info"><strong>{test.topic}</strong><span>{test.part} <i /> {test.date}</span></div>
              <div className="test-score"><strong>{test.band}</strong><span>band</span></div>
              <Badge className="change-badge">Review</Badge>
              <button className="row-arrow" aria-label={`Open ${test.topic} in test history`} title="Open this session in assessment report" onClick={() => onOpenTest(test.result)}><ArrowUpRight size={16} /></button>
            </div>) : <div className="dashboard-empty-state"><span><AudioLines size={19} /></span><strong>Your first practice starts here</strong><p>Complete a speaking test and your recent results will appear in this space.</p><Button variant="outline" size="sm" onClick={() => onNavigate('Practice')}>Start practice <ArrowRight size={14} /></Button></div>}
          </CardContent>
        </Card>
        <Card className="weekly-card">
          <CardHeader className="section-card-header">
            <div><p className="section-kicker">A LITTLE EVERY DAY</p><CardTitle>This week</CardTitle></div>
            <span className="dashboard-week-range">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(weekStart)} – {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6))}</span>
          </CardHeader>
          <CardContent>
            <div className="weekly-summary"><strong>{weeklyMinutes >= 60 ? <>{(weeklyMinutes / 60).toFixed(1)} <span>hrs</span></> : <>{weeklyMinutes} <span>min</span></>}</strong><small>{weeklyActivity.reduce((total, day) => total + day.count, 0)} saved tests this week</small></div>
            <div className="chart" role="img" aria-label={`Assessment minutes this week: ${weeklyActivity.map((day) => `${new Intl.DateTimeFormat('en', { weekday: 'long' }).format(new Date(`${day.key}T12:00:00`))} ${day.minutes} minutes`).join(', ')}`}>
              {weeklyActivity.map((day, index) => <div className="chart-column" key={day.key} tabIndex={0} aria-label={`${new Intl.DateTimeFormat('en', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${day.key}T12:00:00`))}: ${day.minutes} minutes`}>
                <motion.div className={`chart-bar ${day.today ? 'chart-bar-active' : ''}`} initial={shouldReduceMotion ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} whileHover={shouldReduceMotion ? undefined : { scaleX: 1.16 }} transition={{ duration: shouldReduceMotion ? 0 : .42, delay: shouldReduceMotion ? 0 : index * .045, ease: 'easeOut' }} style={{ height: `${day.minutes ? Math.max(8, day.minutes / maxDailyMinutes * 100) : 4}%`, transformOrigin: 'bottom' }} />
                {day.minutes > 0 && <span className="chart-tooltip">{day.minutes} min</span>}<small>{day.label}</small>
              </div>)}
            </div>
            <div className="weekly-footer"><span><span className="legend-dot" /> Saved assessment time</span><span>Activity this week</span></div>
          </CardContent>
        </Card>
      </div>
      <div className="bottom-grid">
        <Card className="focus-card">
          <div className="focus-icon"><Lightbulb size={19} /></div>
          <div className="focus-copy"><span>RECOMMENDED NEXT STEP</span><strong>{weakestCriterion?.name ?? 'Your speaking baseline'}</strong><p>{latestImprovement}</p></div>
          <button className="focus-action" aria-label="View assessment recommendations" onClick={() => onNavigate(latestTest ? 'Assessments' : 'Practice')}><ArrowRight size={17} /></button>
        </Card>
        <Card className="vocab-card">
          <div className="vocab-icon"><BookOpen size={19} /></div>
          <div className="vocab-copy"><span>YOUR LEXICAL VAULT</span><strong>{savedLexicalCount} saved {savedLexicalCount === 1 ? 'word' : 'words'}</strong><p>Keep useful vocabulary close and bring it into your next speaking response.</p></div>
          <Button variant="outline" size="sm" className="save-word" onClick={() => onNavigate('Lexical Vault')}><Plus size={14} /> Explore vault</Button>
        </Card>
      </div>
      <footer className="page-footer"><span>Made for the words you haven’t found yet.</span><span>Need a hand? <button>We’re here for you <ArrowUpRight size={12} /></button></span></footer>
    </div>
  )
}

function StatCard({ icon: Icon, tone, label, value, detail }: { icon: typeof Trophy; tone: string; label: string; value: string; detail: React.ReactNode }) {
  return <Card className="stat-card"><div className={`stat-icon stat-${tone}`}><Icon size={17} strokeWidth={1.9} /></div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></Card>
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="inner-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{description}</p></div>{action}</div>
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function HistoryPage({ onNavigate, results, onSelect, initialExpandedTestId }: { onNavigate: (section: Section) => void; results: TestResult[]; onSelect: (result: TestResult) => void; initialExpandedTestId: string | null }) {
  const [today] = useState(() => new Date())
  const todayKey = localDateKey(today)
  const [expandedTranscriptId, setExpandedTranscriptId] = useState<string | null>(initialExpandedTestId)
  const [partFilter, setPartFilter] = useState<TestPart | 'all'>('all')
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState('')
  const testsByDate = new Map<string, number>()
  for (const result of results) {
    const key = localDateKey(new Date(result.completedAt))
    testsByDate.set(key, (testsByDate.get(key) ?? 0) + 1)
  }
  const calendarDays = (() => {
    if (calendarView === 'week') {
      const start = new Date(calendarDate)
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start)
        day.setDate(start.getDate() + index)
        return day
      })
    }
    const firstOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1)
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(firstOfMonth.getDate() - ((firstOfMonth.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart)
      day.setDate(gridStart.getDate() + index)
      return day
    })
  })()
  const visibleResults = results.filter((result) => {
    if (partFilter !== 'all' && result.part !== partFilter) return false
    return !selectedDate || localDateKey(new Date(result.completedAt)) === selectedDate
  })
  useEffect(() => {
    if (!initialExpandedTestId) return
    const frame = window.requestAnimationFrame(() => {
      const entry = Array.from(document.querySelectorAll<HTMLElement>('.history-entry'))
        .find((element) => element.dataset.testId === initialExpandedTestId)
      entry?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [initialExpandedTestId])
  const averageBand = visibleResults.length
    ? (visibleResults.reduce((sum, result) => sum + result.overallBand, 0) / visibleResults.length).toFixed(1)
    : '—'
  const bestBand = visibleResults.length
    ? Math.max(...visibleResults.map((result) => result.overallBand)).toFixed(1)
    : '—'
  const calendarHeading = calendarView === 'month'
    ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(calendarDate)
    : `${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(calendarDays[0])} – ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(calendarDays[6])}`
  function moveCalendar(direction: -1 | 1) {
    setCalendarDate((current) => {
      const next = new Date(current)
      if (calendarView === 'month') {
        next.setDate(1)
        next.setMonth(next.getMonth() + direction)
      }
      else next.setDate(next.getDate() + direction * 7)
      return next
    })
    setSelectedDate('')
  }
  return <div className="page-content inner-page"><PageHeading eyebrow="EVERY STEP COUNTS" title="Test history" description="Explore your practice by date and revisit any assessment." action={<Button className="start-button" onClick={() => onNavigate('Practice')}><Mic2 size={17} /> New practice</Button>} />
    <div className="history-overview"><div><span>Matching tests</span><strong>{visibleResults.length}</strong></div><div><span>Average estimate</span><strong>{averageBand}</strong></div><div><span>Best estimate</span><strong>{bestBand}</strong></div><div><span>Rubric criteria</span><strong>4</strong></div></div>
    {results.length > 0 && <section className="history-calendar" aria-labelledby="history-calendar-heading">
      <div className="history-calendar-header">
        <div className="history-calendar-title"><span className="history-calendar-icon"><CalendarDays size={18} /></span><div><p className="section-kicker">YOUR PRACTICE ACTIVITY</p><h2 id="history-calendar-heading">Browse by date</h2></div></div>
        <div className="history-calendar-controls">
          <div className="history-calendar-view-toggle" role="group" aria-label="Calendar view">
            <button type="button" className={calendarView === 'month' ? 'history-calendar-view-active' : ''} aria-pressed={calendarView === 'month'} onClick={() => { setCalendarView('month'); setSelectedDate('') }}>Month</button>
            <button type="button" className={calendarView === 'week' ? 'history-calendar-view-active' : ''} aria-pressed={calendarView === 'week'} onClick={() => { setCalendarView('week'); setSelectedDate('') }}>Week</button>
          </div>
          <button type="button" className="history-calendar-nav" aria-label="Previous month or week" onClick={() => moveCalendar(-1)}><ChevronRight size={16} className="history-calendar-chevron-back" /></button>
          <strong className="history-calendar-period">{calendarHeading}</strong>
          <button type="button" className="history-calendar-nav" aria-label="Next month or week" onClick={() => moveCalendar(1)}><ChevronRight size={16} /></button>
          <button type="button" className="history-calendar-today" onClick={() => { setCalendarDate(new Date()); setSelectedDate('') }}>Today</button>
        </div>
      </div>
      <div className={`history-calendar-grid ${calendarView === 'week' ? 'history-calendar-grid-week' : ''}`}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span className="history-calendar-weekday" key={day}>{day}</span>)}
        {calendarDays.map((day) => {
          const key = localDateKey(day)
          const count = testsByDate.get(key) ?? 0
          const inCurrentMonth = calendarView === 'week' || day.getMonth() === calendarDate.getMonth()
          const isToday = key === todayKey
          return <button type="button" key={key} className={`history-calendar-day ${inCurrentMonth ? '' : 'history-calendar-day-outside'} ${isToday ? 'history-calendar-day-today' : ''} ${selectedDate === key ? 'history-calendar-day-selected' : ''} ${count ? 'history-calendar-day-has-tests' : ''}`} disabled={!count} aria-pressed={selectedDate === key} aria-label={`${new Intl.DateTimeFormat('en', { dateStyle: 'full' }).format(day)}${count ? `, ${count} ${count === 1 ? 'test' : 'tests'}` : ', no tests'}`} onClick={() => { setCalendarDate(day); setSelectedDate((current) => current === key ? '' : key) }}>
            <span>{day.getDate()}</span>{count > 0 && <small>{count} {count === 1 ? 'test' : 'tests'}</small>}
          </button>
        })}
      </div>
      <div className="history-calendar-footer">
        <span><i /> Dates with a saved test</span>
        {selectedDate
          ? <button type="button" onClick={() => setSelectedDate('')}>Showing {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(`${selectedDate}T00:00:00`))} · Clear date</button>
          : <span>Select a marked date to filter history</span>}
      </div>
    </section>}
    {results.length > 0 && <div className="history-filter-row"><label htmlFor="history-part-filter"><ListFilter size={16} /> Filter by test</label><select id="history-part-filter" value={partFilter} onChange={(event) => setPartFilter(event.target.value as TestPart | 'all')}><option value="all">All tests</option><option value="part1">Part 1</option><option value="part2">Part 2</option><option value="part3">Part 3</option><option value="full">Full test</option></select></div>}
    {results.length > 0
      ? visibleResults.length
        ? <div className="history-table"><div className="history-table-head"><span>TEST</span><span>DATE</span><span>FORMAT</span><span>ESTIMATE</span><span>REVIEW</span></div>{visibleResults.map((result) => {
        const transcriptTurns = groupTranscriptTurns(result.transcript)
        return <div className="history-entry" key={result.id} data-test-id={result.id}><div className="history-table-row"><div className="history-test-name"><div className="test-icon test-icon-lavender"><Headphones size={17} /></div><div><strong>{result.title}</strong><small>{transcriptTurns.filter((entry) => entry.role === 'candidate').length} responses · {Math.floor(result.durationSeconds / 60)} min</small></div></div><span className="history-date"><time dateTime={result.completedAt}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(result.completedAt))}</time><small className="history-timestamp">{new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(result.completedAt))}</small></span><span><Badge className="type-badge">{result.part === 'full' ? 'Full test' : result.part.replace('part', 'Part ')}</Badge></span><span className="history-band">{result.overallBand.toFixed(1)}</span><div className="history-row-actions"><button className="history-action-button" aria-label={`${expandedTranscriptId === result.id ? 'Hide' : 'Read'} transcript for ${result.title}`} aria-expanded={expandedTranscriptId === result.id} onClick={() => setExpandedTranscriptId((current) => current === result.id ? null : result.id)}><BookOpen size={16} /><span>Transcript</span></button><button className="row-arrow" aria-label={`Open assessment for ${result.title}`} onClick={() => onSelect(result)}><ArrowUpRight size={16} /></button></div></div>{expandedTranscriptId === result.id && <div className="history-detail"><RecordingPlayer key={result.id} test={result} /><div className="history-transcript"><div className="history-detail-heading"><div><span className="section-kicker">SESSION TRANSCRIPT</span><h3>Full conversation</h3></div><span>{transcriptTurns.length} turns</span></div>{transcriptTurns.length ? <TranscriptAudioList turns={transcriptTurns} variant="history" testId={result.id} /> : <p className="history-no-transcript">No transcript was captured for this session.</p>}</div></div>}</div>
      })}</div>
        : <Card className="history-empty history-filter-empty"><h2>No tests match these filters.</h2><p>Clear the selected date or choose a different test part to see more results.</p></Card>
      : <Card className="history-empty"><span className="evaluation-empty-icon"><Clock3 size={23} /></span><h2>Your practice history will show up here.</h2><p>Complete a speaking session to save your answers and practice feedback in this browser.</p><Button className="start-button" onClick={() => onNavigate('Practice')}>Start a practice test <ArrowRight size={16} /></Button></Card>}
  </div>
}

function RecordingPlayer({ test }: { test: TestResult }) {
  const [recordingUrl, setRecordingUrl] = useState('')
  const [recordingType, setRecordingType] = useState('audio/webm')
  const [audioCopyUrl, setAudioCopyUrl] = useState('')
  const [audioCopyError, setAudioCopyError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
  }, [recordingUrl])

  useEffect(() => {
    let isCurrent = true
    let objectUrl: string | null = null
    void loadConversationAudioCopy(test.id).then((audioCopy) => {
      if (isCurrent && audioCopy) {
        objectUrl = URL.createObjectURL(audioCopy)
        setAudioCopyUrl(objectUrl)
      }
    }).catch((caughtError: unknown) => {
      console.error(`Unable to load the compiled audio copy for test ${test.id}.`, caughtError)
      if (isCurrent) setAudioCopyError('The compiled conversation audio copy could not be loaded.')
    })
    return () => {
      isCurrent = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [test.id])

  async function loadRecording() {
    setLoading(true)
    setError('')
    try {
      const recording = await loadTestRecording(test.id)
      if (!recording) {
        setError('This recording is not available in this browser.')
        return
      }
      if (recordingUrl) URL.revokeObjectURL(recordingUrl)
      setRecordingType(recording.type || 'audio/webm')
      setRecordingUrl(URL.createObjectURL(recording))
    } catch (caughtError) {
      console.error(`Unable to load the audio recording for test ${test.id}.`, caughtError)
      setError('Unable to load this recording from browser storage.')
    } finally {
      setLoading(false)
    }
  }

  const recordingExtension = recordingType.includes('ogg') ? 'ogg' : recordingType.includes('mp4') ? 'm4a' : 'webm'
  const downloadName = `speakia-${test.id}-interview.${recordingExtension}`

  return <>
  <section className="history-recording" aria-label="Test audio recording">
    <span className="history-recording-icon"><Headphones size={19} /></span>
    <div className="history-recording-copy"><span className="section-kicker">AUDIO PLAYBACK</span><strong>{recordingUrl ? 'Your session recording' : test.audioAvailable ? 'Replay your speaking test' : 'Recording unavailable'}</strong><p>{test.audioAvailable ? 'Saved privately in this browser.' : 'This session has no saved recording.'}</p></div>
    {recordingUrl
      ? <><audio controls preload="metadata" src={recordingUrl} aria-label={`Audio recording of ${test.title}`} /><a className="history-download-button" href={recordingUrl} download={downloadName}><Download size={15} />Download audio copy</a></>
      : <Button className="history-play-button" disabled={!test.audioAvailable || loading} onClick={() => void loadRecording()}><Headphones size={16} />{loading ? 'Loading…' : 'Load recording & create copy'}</Button>}
    {error && <p className="history-audio-error" role="alert">{error}</p>}
  </section>
  {(audioCopyUrl || audioCopyError) && <section className="history-recording conversation-audio-copy" aria-label="Compiled conversation audio copy">
    <span className="history-recording-icon"><AudioLines size={19} /></span>
    <div className="history-recording-copy"><span className="section-kicker">COMPILED AUDIO COPY</span><strong>Examiner and candidate voices in conversation order</strong><p>Generated when this test finished and saved in this browser.</p></div>
    {audioCopyUrl && <><audio controls preload="metadata" src={audioCopyUrl} aria-label={`Compiled two-way conversation audio for ${test.title}`} /><a className="history-download-button" href={audioCopyUrl} download={`speakia-${test.id}-conversation-copy.wav`}><Download size={15} />Download compiled copy</a></>}
    {audioCopyError && <p className="history-audio-error" role="alert">{audioCopyError}</p>}
  </section>}
  </>
}

function WordVaultPage({ entries, savedIds, pinnedIds, apiKey, onOpenFlashcards, onAdd, onUpdate, onToggleSave, onTogglePin, onStartCoachLive }: { entries: LexicalEntry[]; savedIds: string[]; pinnedIds: string[]; apiKey: string; onOpenFlashcards: () => void; onAdd: (entry: LexicalEntry) => void; onUpdate: (entry: LexicalEntry) => void; onToggleSave: (id: string) => void; onTogglePin: (id: string) => void; onStartCoachLive: (entry: LexicalEntry) => void }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<LexicalCategory | 'All'>('All')
  const [topicFilter, setTopicFilter] = useState('All topics')
  const [savedOnly, setSavedOnly] = useState(false)
  const [pinFilter, setPinFilter] = useState<'all' | 'pinned' | 'unpinned'>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editError, setEditError] = useState('')
  const [draft, setDraft] = useState<LexicalEntry | null>(null)
  const [newEntry, setNewEntry] = useState({ term: '', category: 'Word' as LexicalCategory, partOfSpeech: '', meaning: '', example: '', topic: '', meanings: '', examples: '', parts: [] as TestPart[] })
  const topics = [...new Set(entries.map((entry) => entry.topic))].filter(Boolean).sort((a, b) => a.localeCompare(b))
  const parts: { value: TestPart | 'all'; label: string }[] = [
    { value: 'all', label: 'All parts' },
    { value: 'part1', label: 'Part 1' },
    { value: 'part2', label: 'Part 2' },
    { value: 'part3', label: 'Part 3' },
    { value: 'full', label: 'Full test' },
  ]

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return entries.filter((entry) => {
      if (category !== 'All' && entry.category !== category) return false
      if (topicFilter !== 'All topics' && entry.topic !== topicFilter) return false
      if (savedOnly && !savedIds.includes(entry.id)) return false
      if (pinFilter !== 'all' && pinnedIds.includes(`lexical:${entry.id}`) !== (pinFilter === 'pinned')) return false
      if (!normalizedSearch) return true
      return [entry.term, entry.meaning, entry.example, entry.topic, entry.category, entry.partOfSpeech ?? '',
        ...(entry.meanings ?? []), ...(entry.examples ?? [])]
        .some((field) => field.toLocaleLowerCase().includes(normalizedSearch))
    })
  }, [category, entries, pinnedIds, pinFilter, savedIds, savedOnly, search, topicFilter])

  function beginEditing(entry: LexicalEntry) {
    setEditingId(entry.id)
    setDraft({
      ...entry,
      meanings: entry.meanings?.length ? entry.meanings : [entry.meaning],
      examples: entry.examples?.length ? entry.examples : [entry.example],
      parts: entry.parts ?? [],
    })
    setEditError('')
  }

  function saveEditedEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    const term = draft.term.trim()
    const meanings = (draft.meanings ?? []).map((item) => item.trim()).filter(Boolean)
    const examples = (draft.examples ?? []).map((item) => item.trim()).filter(Boolean)
    if (!term || !meanings.length || !examples.length) {
      setEditError('Keep a term, at least one definition, and at least one example sentence.')
      return
    }
    if (entries.some((entry) => entry.id !== draft.id && entry.term.toLocaleLowerCase() === term.toLocaleLowerCase())) {
      setEditError('That term is already in your Lexical Vault.')
      return
    }
    onUpdate({
      ...draft,
      term,
      meaning: meanings[0],
      meanings,
      example: examples[0],
      examples,
      topic: draft.topic.trim() || 'My vocabulary',
    })
    setEditingId(null)
    setDraft(null)
    setEditError('')
  }

  function handleAddEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = newEntry.term.trim()
    const meanings = [newEntry.meaning, ...newEntry.meanings.split('\n')].map((item) => item.trim()).filter(Boolean)
    const examples = [newEntry.example, ...newEntry.examples.split('\n')].map((item) => item.trim()).filter(Boolean)
    if (!term || !meanings.length || !examples.length) {
      setFormError('Add a term, at least one meaning, and an example sentence.')
      return
    }
    if (entries.some((entry) => entry.term.toLocaleLowerCase() === term.toLocaleLowerCase())) {
      setFormError('That term is already in your Lexical Vault.')
      return
    }
    onAdd({
      ...newEntry,
      id: `custom-${crypto.randomUUID()}`,
      term,
      meaning: meanings[0],
      meanings,
      example: examples[0],
      examples,
      topic: newEntry.topic.trim() || 'My vocabulary',
      partOfSpeech: newEntry.partOfSpeech.trim() || undefined,
      parts: newEntry.parts,
      custom: true,
    })
    setNewEntry({ term: '', category: 'Word', partOfSpeech: '', meaning: '', example: '', topic: '', meanings: '', examples: '', parts: [] })
    setFormError('')
    setShowAddForm(false)
  }

  return <div className="page-content inner-page lexical-vault-page">
    <PageHeading eyebrow="BUILD IELTS-READY LANGUAGE" title="Lexical Vault" description="Explore useful vocabulary, expressions, collocations and discourse markers—and collect language that sounds natural in your speaking." action={<div className="lexical-heading-actions"><Button variant="outline" onClick={onOpenFlashcards}><Layers3 size={15} /> Study with flashcards</Button><Button className="start-button" onClick={() => { setShowAddForm((current) => !current); setFormError('') }}>{showAddForm ? <X size={17} /> : <Plus size={17} />}{showAddForm ? 'Close form' : 'Add lexical resource'}</Button></div>} />
    <Card className="vault-summary"><div className="vault-summary-icon"><BookOpen size={21} /></div><div><span className="section-kicker">YOUR IELTS LANGUAGE BANK</span><strong>{entries.length} resources <small>across {lexicalCategories.length} categories</small></strong></div><div className="vault-summary-progress"><span>Saved for practice</span><div className="coach-progress"><span style={{ width: `${Math.min(100, savedIds.length / Math.max(entries.length, 1) * 100)}%` }} /></div><small>{savedIds.length} saved resources</small></div></Card>
    {showAddForm && <Card className="lexical-form-card"><div className="lexical-form-heading"><span className="vault-summary-icon"><Plus size={19} /></span><div><span className="section-kicker">PERSONAL VOCABULARY</span><h2>Add to your Lexical Vault</h2><p>Save a useful word, phrase, expression, collocation, or discourse marker.</p></div></div><form className="lexical-entry-form" onSubmit={handleAddEntry}>
      <label>Word or expression<input autoFocus value={newEntry.term} onChange={(event) => setNewEntry((current) => ({ ...current, term: event.target.value }))} placeholder="e.g. play a pivotal role" required /></label>
      <label>Resource type<select value={newEntry.category} onChange={(event) => {
        const selectedCategory = lexicalCategories.find((item) => item === event.target.value)
        if (selectedCategory) setNewEntry((current) => ({ ...current, category: selectedCategory }))
      }}>{lexicalCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Part of speech <span>(optional)</span><input value={newEntry.partOfSpeech} onChange={(event) => setNewEntry((current) => ({ ...current, partOfSpeech: event.target.value }))} placeholder="e.g. verb phrase" /></label>
      <label>Meaning<input value={newEntry.meaning} onChange={(event) => setNewEntry((current) => ({ ...current, meaning: event.target.value }))} placeholder="What does it mean?" required /></label>
      <label className="lexical-example-field">Example sentence<input value={newEntry.example} onChange={(event) => setNewEntry((current) => ({ ...current, example: event.target.value }))} placeholder="Use it naturally in an IELTS-style response" required /></label>
      <label>Vocabulary topic <span>(optional)</span><input value={newEntry.topic} onChange={(event) => setNewEntry((current) => ({ ...current, topic: event.target.value }))} placeholder="e.g. education, environment" /></label>
      <label>Additional definitions <span>(one per line, optional)</span><textarea value={newEntry.meanings} onChange={(event) => setNewEntry((current) => ({ ...current, meanings: event.target.value }))} rows={2} placeholder="Add another meaning" /></label>
      <label>Additional examples <span>(one per line, optional)</span><textarea value={newEntry.examples} onChange={(event) => setNewEntry((current) => ({ ...current, examples: event.target.value }))} rows={2} placeholder="Add another example sentence" /></label>
      <fieldset className="lexical-part-field"><legend>Relevant test parts</legend>{parts.slice(1).map(({ value, label }) => <label key={value}><input type="checkbox" checked={newEntry.parts.includes(value as TestPart)} onChange={(event) => setNewEntry((current) => ({ ...current, parts: event.target.checked ? [...current.parts, value as TestPart] : current.parts.filter((part) => part !== value) }))} />{label}</label>)}<small>Leave unselected to make the resource available across all parts.</small></fieldset>
      {formError && <p className="lexical-form-error" role="alert">{formError}</p>}
      <div className="lexical-form-actions"><Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button><Button type="submit" className="start-button"><Plus size={15} /> Save resource</Button></div>
    </form></Card>}
    <div className="lexical-controls"><label className="lexical-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search terms, meanings, examples…" aria-label="Search lexical resources" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={15} /></button>}</label><label className="lexical-select-filter">Vocabulary topic<select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}><option>All topics</option>{topics.map((topic) => <option key={topic}>{topic}</option>)}</select></label><button className={`lexical-saved-toggle ${savedOnly ? 'lexical-filter-active' : ''}`} aria-pressed={savedOnly} onClick={() => setSavedOnly((current) => !current)}><Bookmark size={15} fill={savedOnly ? 'currentColor' : 'none'} /> Saved <span>{savedIds.length}</span></button></div>
    <div className="lexical-pin-filters" role="group" aria-label="Filter pinned vocabulary">
      {([{ id: 'all', label: 'All resources' }, { id: 'pinned', label: 'Pinned' }, { id: 'unpinned', label: 'Unpinned' }] as const).map((filter) => <button key={filter.id} type="button" className={pinFilter === filter.id ? 'lexical-pin-filter-active' : ''} aria-pressed={pinFilter === filter.id} onClick={() => setPinFilter(filter.id)}><Pin size={14} />{filter.label}<span>{filter.id === 'all' ? entries.length : entries.filter((item) => pinnedIds.includes(`lexical:${item.id}`) === (filter.id === 'pinned')).length}</span></button>)}
    </div>
    <div className="lexical-category-bar" aria-label="Filter by resource type"><span><ListFilter size={15} /> FILTER BY TYPE</span><button className={`lexical-category ${category === 'All' ? 'lexical-category-active' : ''}`} onClick={() => setCategory('All')}>All <span>{entries.length}</span></button>{lexicalCategories.map((item) => <button key={item} className={`lexical-category ${category === item ? 'lexical-category-active' : ''}`} onClick={() => setCategory(item)}>{item} <span>{entries.filter((entry) => entry.category === item).length}</span></button>)}</div>
    <div className="lexical-results-heading"><div><h2>{savedOnly ? 'Saved resources' : category === 'All' ? 'IELTS speaking resources' : category + 's'}</h2><p>{filteredEntries.length} {filteredEntries.length === 1 ? 'resource' : 'resources'}{topicFilter !== 'All topics' && <> for {topicFilter}</>}{search && <> matching “{search}”</>}</p></div><span><Layers3 size={15} /> Context-first language</span></div>
    {filteredEntries.length
      ? <div className="word-grid">{filteredEntries.map((item) => <Card className={`word-card lexical-word-card ${pinnedIds.includes(`lexical:${item.id}`) ? 'lexical-word-card-pinned' : ''}`} key={item.id}><div className="word-card-top"><Badge className="word-tag">{item.category}</Badge><div className="lexical-card-actions"><button className={`lexical-pin-card-button ${pinnedIds.includes(`lexical:${item.id}`) ? 'lexical-pin-card-active' : ''}`} aria-label={`${pinnedIds.includes(`lexical:${item.id}`) ? 'Unpin' : 'Pin'} ${item.term}`} aria-pressed={pinnedIds.includes(`lexical:${item.id}`)} onClick={() => onTogglePin(`lexical:${item.id}`)}><Pin size={15} fill={pinnedIds.includes(`lexical:${item.id}`) ? 'currentColor' : 'none'} /></button><button className="lexical-edit-button" onClick={() => beginEditing(item)} aria-label={`Edit ${item.term}`}><Pencil size={15} /> Edit</button><button className={`bookmark-button ${savedIds.includes(item.id) ? 'bookmark-saved' : ''}`} aria-label={savedIds.includes(item.id) ? `Remove ${item.term} from saved resources` : `Save ${item.term}`} onClick={() => onToggleSave(item.id)}><Bookmark size={17} fill={savedIds.includes(item.id) ? 'currentColor' : 'none'} /></button><LexicalPronunciationButton term={item.term} apiKey={apiKey} /><button className="lexical-coach-button" aria-label={`Discuss ${item.term} with Speakia Coach live`} title="Go live with Speakia Coach" onClick={() => onStartCoachLive(item)}><AudioLines size={15} /><span>Go live</span></button></div></div>
        {editingId === item.id && draft
          ? <form className="lexical-inline-editor" onSubmit={saveEditedEntry}><label>Word or expression<input value={draft.term} onChange={(event) => setDraft({ ...draft, term: event.target.value })} required /></label><label>Part of speech<input value={draft.partOfSpeech ?? ''} onChange={(event) => setDraft({ ...draft, partOfSpeech: event.target.value })} /></label><label>Definitions <span>(one per line)</span><textarea rows={3} value={(draft.meanings ?? [draft.meaning]).join('\n')} onChange={(event) => setDraft({ ...draft, meanings: event.target.value.split('\n') })} required /></label><label>Example sentences <span>(one per line)</span><textarea rows={3} value={(draft.examples ?? [draft.example]).join('\n')} onChange={(event) => setDraft({ ...draft, examples: event.target.value.split('\n') })} required /></label><label>Vocabulary topic<input value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label><fieldset className="lexical-part-field"><legend>Relevant test parts</legend>{parts.slice(1).map(({ value, label }) => <label key={value}><input type="checkbox" checked={(draft.parts ?? []).includes(value as TestPart)} onChange={(event) => setDraft({ ...draft, parts: event.target.checked ? [...draft.parts ?? [], value as TestPart] : (draft.parts ?? []).filter((part) => part !== value) })} />{label}</label>)}</fieldset>{editError && <p className="lexical-form-error" role="alert">{editError}</p>}<div className="lexical-form-actions"><Button type="button" variant="outline" onClick={() => { setEditingId(null); setDraft(null); setEditError('') }}>Cancel</Button><Button type="submit" className="start-button"><Save size={15} /> Save changes</Button></div></form>
          : <><h2>{item.term} {item.partOfSpeech && <i>{item.partOfSpeech}</i>}</h2><div className="lexical-word-meta"><span>{item.topic}</span>{item.parts?.length ? item.parts.map((part) => <span key={part}>{part === 'full' ? 'Full test' : part.replace('part', 'Part ')}</span>) : <span>All parts</span>}{item.custom && <span className="lexical-custom-tag">Added by you</span>}</div><div className="lexical-card-content"><div><strong>DEFINITIONS</strong><ul>{(item.meanings?.length ? item.meanings : [item.meaning]).map((meaning, index) => <li key={`${meaning}-${index}`}>{meaning}</li>)}</ul></div><div><strong>EXAMPLE SENTENCES</strong><ul>{(item.examples?.length ? item.examples : [item.example]).map((example, index) => <li key={`${example}-${index}`}>“{example}”</li>)}</ul></div></div></>}
      </Card>)}</div>
      : <Card className="lexical-empty"><span className="evaluation-empty-icon"><Search size={22} /></span><h2>No matching resources</h2><p>Try another search, change the resource type or vocabulary topic, or add a new entry to your Lexical Vault.</p><Button variant="outline" onClick={() => { setSearch(''); setCategory('All'); setTopicFilter('All topics'); setSavedOnly(false); setPinFilter('all') }}>Clear filters</Button></Card>}
    <div className="tip-box lexical-tip"><Sparkles size={18} /><p><strong>Use language with precision</strong><br />Choose expressions that fit your meaning and speaking style. Natural, accurate use is more valuable than forcing advanced vocabulary into every answer.</p></div>
  </div>
}

export default App
