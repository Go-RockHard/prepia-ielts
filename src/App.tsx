import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Bookmark,
  Check,
  ClipboardCheck,
  CalendarDays,
  ChevronRight,
  FileAudio,
  Clock3,
  Download,
  Eye,
  EyeOff,
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
  PenLine,
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
import { GeminiQuotaNotice } from '@/components/GeminiQuotaNotice'
import { ProdiaModelPicker } from '@/components/ProdiaModelPicker'
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
import { formatAssessmentDuration, getAssessmentModelLabel } from '@/features/simulator/assessmentDuration'
import { lexicalCategories, starterLexicalEntries, type LexicalCategory, type LexicalEntry } from '@/features/vault/lexicalEntries'
import { topicCategories } from '@/features/topics/types'
import type { TopicBankPrompt } from '@/features/topics/types'
import { LexicalPronunciationButton } from '@/features/vault/LexicalPronunciationButton'
import { readGeminiApiKeys, writeGeminiApiKeys } from '@/features/simulator/apiKey'
import { configureGeminiFallbackApiKeys } from '@/lib/geminiClient'
import { assessSpeakingAudio, ASSESSMENT_MODELS, prepareAudioForAssessment, type AssessmentModel } from '@/features/simulator/gemini'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { AssignmentPage } from '@/features/assignments/AssignmentPage'
import { NotificationCenter } from '@/features/notifications/NotificationCenter'
import { WritiaNotificationCenter } from '@/features/notifications/WritiaNotificationCenter'
import { FeatureTour } from '@/features/profile/FeatureTour'
import { chooseTomorrowAssignment } from '@/features/assignments/coach'
import { loadAssignments, saveAssignments } from '@/features/assignments/storage'
import { loadFlashcardProgress } from '@/features/flashcards/storage'
import { vocabularyMemory } from '@/features/flashcards/memoryStrength'
import type { GuidedPracticeLaunchRequest, PracticeModeId } from '@/features/practiceModes/PracticeModesPage'
import type { AssignmentPerformanceReport } from '@/features/assignments/types'
import type { CoachAssignment } from '@/features/assignments/types'
import { writaNavItems, type WritaModuleId } from '@/features/writing/navigation'
import { EMPTY_WRITIA_LEARNER_CONTEXT, loadWritiaLearnerContext, type WritiaLearnerContext } from '@/features/writing/learnerContext'
import {
  authenticateLocalAccount,
  clearLocalSession,
  createLocalAccount,
  loadUserProfile,
  readRememberedUsername,
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
const TalkingTemplatesPage = lazy(() => import('@/features/talkingTemplates/TalkingTemplatesPage').then((module) => ({ default: module.TalkingTemplatesPage })))
const FlashcardsPage = lazy(() => import('@/features/flashcards/FlashcardsPage').then((module) => ({ default: module.FlashcardsPage })))
const PracticeModesPage = lazy(() => import('@/features/practiceModes/PracticeModesPage').then((module) => ({ default: module.PracticeModesPage })))
const SpeakingDrillsPage = lazy(() => import('@/features/drills/SpeakingDrillsPage').then((module) => ({ default: module.SpeakingDrillsPage })))
const VocabularyUpgradePage = lazy(() => import('@/features/vault/VocabularyUpgradePage').then((module) => ({ default: module.VocabularyUpgradePage })))
const WritiaPage = lazy(() => import('@/features/writia/WritiaPage').then((module) => ({ default: module.WritiaPage })))
const WritaPlatform = lazy(() => import('@/features/writing/WritaPlatform').then((module) => ({ default: module.WritaPlatform })))
const SpeakiaLearnerProfilePage = lazy(() => import('@/features/profile/SpeakiaLearnerProfilePage').then((module) => ({ default: module.SpeakiaLearnerProfilePage })))
const BandDescriptorsPage = lazy(() => import('@/features/bandDescriptors/BandDescriptorsPage').then((module) => ({ default: module.BandDescriptorsPage })))
const PlacementAssessmentPage = lazy(() => import('@/features/placement/PlacementAssessmentPage').then((module) => ({ default: module.PlacementAssessmentPage })))

type Section = 'Dashboard' | 'Learner Profile' | 'Vocabulary Studio' | 'Learning Library' | 'Topic Bank' | 'Vocabulary Bank' | 'Vocabulary Upgrade' | 'Smart lesson' | 'Speakia Coach Assets' | 'Assignments' | 'Speakia Flashcards' | 'Practice' | 'Speaking Drills' | 'Guided Practice' | 'Writia' | 'AI-to-AI Simulation' | 'Answer Builder' | 'Performance History' | 'Media assessments' | 'Speakia Podcasts' | 'Band Descriptors' | 'Placement Assessment' | 'Lexical Vault' | 'Profile' | 'Settings'
type LearningLibraryTab = 'topic-bank' | 'lexical-vault' | 'vocabulary-builder'
type PracticeTab = 'actual' | 'guided'
type HistoryReviewAction = 'open' | 'transcript' | 'report' | 'reassess'
type CoachHistoryAction = { requestId: string; testId: string; action: HistoryReviewAction }

const practiceModeTitlePrefixes = ['Live Feedback', 'Live Tips & Suggestions', 'Drill Mode', 'Timed Challenge', 'Guided Practice', 'Performance Analysis', 'Retry & Improve', 'Live Model Answer', 'Coach & Refine', 'Criterion Builder', 'Timed Response', 'Guided Confidence', 'Independent Recording', 'Answer Replay', 'Model & Mirror', 'Full Mock Test', 'Cue Card Studio', 'Part 3 Perspective Lab', 'Scoring Skill Coach', 'Timed Response Coach', 'Part Practice Coach', 'Model & Mirror Coach', 'Full Guided Test']
function isPracticeModeAssessment(result: TestResult): boolean {
  return practiceModeTitlePrefixes.some((prefix) => result.title.startsWith(`${prefix} ·`) || result.title === prefix)
}

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Learner Profile', icon: Sparkles },
  { label: 'Vocabulary Studio', icon: BookOpen },
  { label: 'Speakia Flashcards', icon: Layers3 },
  { label: 'Speaking Drills', icon: AudioLines },
  { label: 'Practice', icon: Mic2 },
  { label: 'Answer Builder', icon: AudioLines },
  { label: 'Assignments', icon: ClipboardCheck },
  { label: 'Performance History', icon: Clock3 },
  { label: 'Media assessments', icon: FileAudio },
  { label: 'Speakia Coach Assets', icon: Layers3 },
  { label: 'Speakia Podcasts', icon: Podcast },
  { label: 'AI-to-AI Simulation', icon: Radio },
  { label: 'Band Descriptors', icon: BookOpen },
  { label: 'Placement Assessment', icon: Target },
  { label: 'Writia', icon: PenLine },
  { label: 'Settings', icon: Settings },
]
const sectionDisplayNames: Partial<Record<Section, string>> = {
  'Vocabulary Studio': 'Topics & Vocabulary',
  'Smart lesson': 'Smart Lesson',
  'Speakia Coach Assets': 'Speakia Coach Assets',
  'Performance History': 'Performance History',
  'Media assessments': 'Media Assessments',
}

const LEXICAL_ENTRIES_KEY = 'speakia-lexical-entries-v1'
const CUSTOM_TOPIC_PROMPTS_KEY = 'speakia-custom-topic-prompts-v1'
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
    console.error('Unable to load pinned Vocabulary Studio items.', error)
    return []
  }
}

function loadLexicalEntries(): LexicalEntry[] {
  try {
    const stored = localStorage.getItem(LEXICAL_ENTRIES_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Saved Vocabulary Bank entries are not a list.')
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
    console.error('Unable to load custom Vocabulary Bank entries.', error)
    return []
  }
}

function loadCustomTopicPrompts(): TopicBankPrompt[] {
  try {
    const stored = localStorage.getItem(CUSTOM_TOPIC_PROMPTS_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'object' && item !== null
      && typeof item.id === 'string' && item.id.startsWith('custom-topic-')
      && typeof item.topic === 'string' && typeof item.question === 'string'
      && ['part1', 'part2', 'part3'].includes(item.part)
      && topicCategories.includes(item.category)
      && Array.isArray(item.vocabulary) && item.vocabulary.every((value: unknown) => typeof value === 'string')
      && (item.cuePoints === undefined || (Array.isArray(item.cuePoints) && item.cuePoints.every((value: unknown) => typeof value === 'string')))
      && (item.sampleAnswer === undefined || typeof item.sampleAnswer === 'string'))) {
      throw new Error('Saved custom Topic Bank prompts are not in a supported format.')
    }
    return parsed as TopicBankPrompt[]
  } catch (error) {
    console.error('Unable to load custom Topic Bank prompts.', error)
    return []
  }
}

function loadSavedLexicalIds(): string[] {
  try {
    const stored = localStorage.getItem(SAVED_LEXICAL_IDS_KEY)
    if (!stored) return ['bustling', 'picturesque']
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error('Saved Vocabulary Bank bookmarks are invalid.')
    }
    return parsed
  } catch (error) {
    console.error('Unable to load saved Vocabulary Bank bookmarks.', error)
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
  const [activePlatform, setActivePlatform] = useState<'speakia' | 'writa'>('speakia')
  const [writaModule, setWritaModule] = useState<WritaModuleId>('dashboard')
  const [writaExamLaunchRequest, setWritaExamLaunchRequest] = useState<string | null>(null)
  const [bandDescriptorFocus, setBandDescriptorFocus] = useState<{ criterion: string; band: number } | null>(null)
  const [learningLibraryTab, setLearningLibraryTab] = useState<LearningLibraryTab>('topic-bank')
  const [practiceTab, setPracticeTab] = useState<PracticeTab>('actual')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [showPlatformLauncher, setShowPlatformLauncher] = useState(false)
  const [savedWords, setSavedWords] = useState<string[]>(loadSavedLexicalIds)
  const [pinnedLearningIds, setPinnedLearningIds] = useState<string[]>(loadPinnedLearningIds)
  const [customLexicalEntries, setCustomLexicalEntries] = useState<LexicalEntry[]>(loadLexicalEntries)
  const [customTopicPrompts, setCustomTopicPrompts] = useState<TopicBankPrompt[]>(loadCustomTopicPrompts)
  const [completedTests, setCompletedTests] = useState<TestResult[]>(loadTestResults)
  const practiceModuleTests = useMemo(() => completedTests.filter((result) => !isPracticeModeAssessment(result)), [completedTests])
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])
  const [writiaLearnerContext, setWritiaLearnerContext] = useState<WritiaLearnerContext>(EMPTY_WRITIA_LEARNER_CONTEXT)
  const [assignmentBusy, setAssignmentBusy] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [selectedAssignment, setSelectedAssignment] = useState<CoachAssignment | null>(null)
  const [coachLaunch, setCoachLaunch] = useState<CoachLaunchRequest | null>(null)
  const [guidedPracticeLaunch, setGuidedPracticeLaunch] = useState<GuidedPracticeLaunchRequest | null>(null)
  const [recommendedDrillId, setRecommendedDrillId] = useState('')
  const [recommendedDrillPrompt, setRecommendedDrillPrompt] = useState('')
  const [recommendedDrillRequestKey, setRecommendedDrillRequestKey] = useState(0)
  const [practiceInitialPart, setPracticeInitialPart] = useState<TestPart | undefined>()
  const [practiceStartImmediately, setPracticeStartImmediately] = useState(false)
  const [practiceTopicPrompt, setPracticeTopicPrompt] = useState<TopicBankPrompt | null>(null)
  const [practiceLaunchId, setPracticeLaunchId] = useState('')
  const [historyTargetTestId, setHistoryTargetTestId] = useState<string | null>(null)
  const [coachHistoryAction, setCoachHistoryAction] = useState<CoachHistoryAction | null>(null)
  const [storageWarning, setStorageWarning] = useState('')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [showAuthPage, setShowAuthPage] = useState(false)
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'create'>('signin')
  const [apiKey, setApiKey] = useState('')
  const [fallbackApiKeys, setFallbackApiKeys] = useState<string[]>([])
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
  const customLexicalEntriesRef = useRef(customLexicalEntries)
  const customTopicPromptsRef = useRef(customTopicPrompts)

  useEffect(() => { customLexicalEntriesRef.current = customLexicalEntries }, [customLexicalEntries])
  useEffect(() => { customTopicPromptsRef.current = customTopicPrompts }, [customTopicPrompts])

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
      console.error('Unable to save custom Vocabulary Bank entries.', error)
    }
  }, [customLexicalEntries])

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_TOPIC_PROMPTS_KEY, JSON.stringify(customTopicPrompts))
    } catch (error) {
      console.error('Unable to save custom Topic Bank prompts.', error)
    }
  }, [customTopicPrompts])

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_LEXICAL_IDS_KEY, JSON.stringify(savedWords))
    } catch (error) {
      console.error('Unable to save Vocabulary Bank bookmarks.', error)
    }
  }, [savedWords])

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_LEARNING_IDS_KEY, JSON.stringify(pinnedLearningIds))
    } catch (error) {
      console.error('Unable to save pinned Vocabulary Studio items.', error)
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
    setWritiaLearnerContext(userProfile ? loadWritiaLearnerContext(userProfile.username) : EMPTY_WRITIA_LEARNER_CONTEXT)
  }, [userProfile?.username])

  useEffect(() => {
    let isCurrent = true
    void readGeminiApiKeys().then((savedKeys) => {
      if (isCurrent) {
        setApiKey(savedKeys.primary)
        setFallbackApiKeys(savedKeys.fallbacks)
        configureGeminiFallbackApiKeys(savedKeys.fallbacks)
      }
    }).catch((error: unknown) => {
      console.error('Unable to restore the Speakia AI API key from browser database storage.', error)
      if (isCurrent) setStorageWarning(error instanceof Error ? error.message : 'The saved Speakia AI API key could not be loaded from this browser.')
    })
    return () => { isCurrent = false }
  }, [])

  const navigate = (section: Section, topicPrompt?: TopicBankPrompt) => {
    if (section === 'Practice') {
      setPracticeTab('actual')
      setPracticeTopicPrompt(topicPrompt ?? null)
    }
    if (section === 'Guided Practice') {
      setPracticeTab('guided')
      setActiveSection('Practice')
      setMobileMenuOpen(false)
      return
    }
    if (section === 'Performance History') {
      setHistoryTargetTestId(null)
      setCoachHistoryAction(null)
    }
    if (section === 'Topic Bank' || section === 'Vocabulary Bank' || section === 'Lexical Vault' || section === 'Vocabulary Upgrade') {
      setLearningLibraryTab(section === 'Topic Bank' ? 'topic-bank' : section === 'Vocabulary Upgrade' ? 'vocabulary-builder' : 'lexical-vault')
      setActiveSection('Vocabulary Studio')
    } else {
      setActiveSection(section === 'Learning Library' ? 'Vocabulary Studio' : section)
    }
    setMobileMenuOpen(false)
  }

  function moveLearningLibraryTab(event: React.KeyboardEvent<HTMLButtonElement>, current: LearningLibraryTab) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const tabs: LearningLibraryTab[] = ['topic-bank', 'lexical-vault', 'vocabulary-builder']
    const nextIndex = (tabs.indexOf(current) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
    const nextTab = tabs[nextIndex]
    const tabIds: Record<LearningLibraryTab, string> = {
      'topic-bank': 'topic-bank-tab',
      'lexical-vault': 'lexical-vault-tab',
      'vocabulary-builder': 'vocabulary-builder-tab',
    }
    setLearningLibraryTab(nextTab)
    document.getElementById(tabIds[nextTab])?.focus()
  }

  function openTestInHistory(result: TestResult) {
    setHistoryTargetTestId(result.id)
    setCoachHistoryAction(null)
    setMobileMenuOpen(false)
    setActiveSection('Performance History')
  }

  const reviewHistoryTestFromCoach = useCallback((testId: string, action: HistoryReviewAction): boolean => {
    if (!practiceModuleTests.some((test) => test.id === testId)) return false
    setHistoryTargetTestId(testId)
    setCoachHistoryAction({ requestId: crypto.randomUUID(), testId, action })
    setMobileMenuOpen(false)
    setActiveSection('Performance History')
    return true
  }, [practiceModuleTests])

  const finishCoachHistoryAction = useCallback((requestId: string) => {
    setCoachHistoryAction((current) => current?.requestId === requestId ? null : current)
  }, [])

  function startTopicBankPractice(part: TestPart, prompt?: TopicBankPrompt) {
    setSelectedAssignment(null)
    setPracticeInitialPart(part)
    setPracticeLaunchId(crypto.randomUUID())
    navigate('Practice', prompt)
  }

  function startPracticeFromCoach(part: TestPart) {
    setSelectedAssignment(null)
    setPracticeInitialPart(part)
    setPracticeLaunchId(crypto.randomUUID())
    setPracticeStartImmediately(true)
    navigate('Practice')
  }

  function startGuidedPracticeFromCoach(mode: PracticeModeId, part?: TestPart, question?: string) {
    setSelectedAssignment(null)
    setGuidedPracticeLaunch({ id: crypto.randomUUID(), mode, ...(part ? { part } : {}), ...(question ? { question } : {}) })
    navigate('Guided Practice')
  }

  function startWritaExamFromAssistant() {
    setActivePlatform('writa')
    setWritaModule('studio')
    setWritaExamLaunchRequest(crypto.randomUUID())
  }

  function openRecommendedDrill(drillId: string, context?: string) {
    setRecommendedDrillId(drillId)
    setRecommendedDrillPrompt(context?.trim() ?? '')
    setRecommendedDrillRequestKey((current) => current + 1)
    navigate('Speaking Drills')
  }

  function startCoachLive(kind: CoachLaunchRequest['kind'], title: string, context: string) {
    setCoachLaunch({ id: crypto.randomUUID(), kind, title, context })
  }

  function addLexicalEntryFromCoach(entry: Omit<LexicalEntry, 'id' | 'custom'>): LexicalEntry {
    if ([...starterLexicalEntries, ...customLexicalEntriesRef.current].some((saved) => saved.term.toLocaleLowerCase() === entry.term.toLocaleLowerCase())) {
      throw new Error(`“${entry.term}” is already in your Vocabulary Bank.`)
    }
    const savedEntry: LexicalEntry = { ...entry, id: `custom-${crypto.randomUUID()}`, custom: true }
    const updatedEntries = [savedEntry, ...customLexicalEntriesRef.current]
    try {
      localStorage.setItem(LEXICAL_ENTRIES_KEY, JSON.stringify(updatedEntries))
    } catch (error) {
      console.error('Unable to save a Vocabulary Bank entry from Speakia Coach.', error)
      throw new Error('The entry could not be saved on this device.')
    }
    customLexicalEntriesRef.current = updatedEntries
    setCustomLexicalEntries(updatedEntries)
    setSavedWords((current) => current.includes(savedEntry.id) ? current : [...current, savedEntry.id])
    return savedEntry
  }

  function addTopicPromptFromCoach(prompt: Omit<TopicBankPrompt, 'id'>): TopicBankPrompt {
    if (customTopicPromptsRef.current.some((saved) => saved.question.trim().toLocaleLowerCase() === prompt.question.trim().toLocaleLowerCase())) {
      throw new Error('That question is already in your Topic Bank.')
    }
    const savedPrompt: TopicBankPrompt = { ...prompt, id: `custom-topic-${crypto.randomUUID()}` }
    const updatedPrompts = [savedPrompt, ...customTopicPromptsRef.current]
    try {
      localStorage.setItem(CUSTOM_TOPIC_PROMPTS_KEY, JSON.stringify(updatedPrompts))
    } catch (error) {
      console.error('Unable to save a Topic Bank card from Speakia Coach.', error)
      throw new Error('The topic card could not be saved on this device.')
    }
    customTopicPromptsRef.current = updatedPrompts
    setCustomTopicPrompts(updatedPrompts)
    return savedPrompt
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

  async function handleSaveApiKeys(primary: string, fallbacks: string[]) {
    await writeGeminiApiKeys(primary, fallbacks)
    const normalizedPrimary = primary.trim()
    const normalizedFallbacks = [...new Set(fallbacks.map((key) => key.trim()).filter((key) => key && key !== normalizedPrimary))]
    setApiKey(normalizedPrimary)
    setFallbackApiKeys(normalizedFallbacks)
    configureGeminiFallbackApiKeys(normalizedFallbacks)
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

  const completeTest = async (result: TestResult, recording: Blob, audioCopy: Blob, transcriptAudio: TranscriptEntry[], stayOnCurrentPage = false) => {
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
    setHistoryTargetTestId(savedResult.id)
    if (!stayOnCurrentPage) setActiveSection('Performance History')
  }

  async function handleAuthenticate(username: string, password: string, createAccount: boolean, rememberMe: boolean) {
    const profile = createAccount
      ? await createLocalAccount(username, password)
      : await authenticateLocalAccount(username, password)
    saveLocalSession(profile.username, !createAccount && rememberMe)
    setConfirmSignOut(false)
    setUserProfile(profile)
    setAssignments(loadAssignments(profile.username))
    setSelectedAssignment(null)
    setActiveSection('Dashboard')
    setActivePlatform('speakia')
    setShowPlatformLauncher(true)
  }

  async function handleSaveProfile(profile: UserProfile) {
    await saveUserProfile(profile)
    setUserProfile(profile)
    setStorageWarning('')
  }

  async function reassessTest(result: TestResult, model: AssessmentModel): Promise<void> {
    if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings before reassessing a recording.')
    const audio = await loadConversationAudioCopy(result.id) ?? await loadTestRecording(result.id)
    if (!audio) throw new Error('The original recording is not available in this browser, so it cannot be reassessed.')
    const preparedAudio = await prepareAudioForAssessment(audio)
    const assessmentStartedAt = performance.now()
    const reassessed = await assessSpeakingAudio(apiKey, preparedAudio, result.transcript, result.part, result.durationSeconds, model)
    const assessmentDurationMs = Math.round(performance.now() - assessmentStartedAt)
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
      assessmentModel: model,
      assessmentDurationMs,
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
      setActivePlatform('speakia')
      setMobileMenuOpen(false)
    } catch (error) {
      console.error('Unable to sign out of the local Speakia account.', error)
      setStorageWarning('Unable to clear the local session. Close this tab to end the session.')
    }
  }

  if (authLoading) return <div className="auth-loading" role="status">Loading your Prodia learning workspace…</div>
  if (!userProfile) return showAuthPage
    ? <LocalAuthPage
      initialMode={authInitialMode}
      onAuthenticate={handleAuthenticate}
      onBack={() => setShowAuthPage(false)}
    />
    : <ProdiaHomePage onGetStarted={() => { setAuthInitialMode('create'); setShowAuthPage(true) }} onSignIn={() => { setAuthInitialMode('signin'); setShowAuthPage(true) }} />
  if (showPlatformLauncher) return (
    <main className="platform-launcher-page">
      <motion.section className="platform-launcher-card" initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: shouldReduceMotion ? 0 : .38, ease: 'easeOut' }}>
        <div className="platform-launcher-art" aria-hidden="true">
          <span className="platform-launcher-orbit platform-launcher-orbit-one" />
          <span className="platform-launcher-orbit platform-launcher-orbit-two" />
          <span className="platform-launcher-star platform-launcher-star-one">✦</span>
          <span className="platform-launcher-star platform-launcher-star-two">✧</span>
          <span className="platform-launcher-art-speak"><AudioLines size={22} /></span>
          <span className="platform-launcher-art-write"><PenLine size={21} /></span>
          <span className="platform-launcher-art-core"><Sparkles size={24} /></span>
        </div>
        <div className="platform-launcher-brand"><span className="platform-launcher-brand-mark"><AudioLines size={19} /><PenLine size={17} /></span><span>PRODIA IELTS</span></div>
        <p className="platform-launcher-eyebrow">TWO PRODUCTIVE SKILLS. ONE SMARTER ROUTE.</p>
        <h1>Make every practice session <em>count.</em></h1>
        <p className="platform-launcher-description">Purpose-built AI coaching for IELTS Speaking and Writing—personalised to your goals, evidence, and next best step.</p>
        <div className="platform-launcher-divider"><span />CHOOSE YOUR WORKSPACE<span /></div>
        <div className="platform-launcher-options">
          <button type="button" className="platform-launcher-option platform-launcher-speaking" onClick={() => { setActivePlatform('speakia'); setActiveSection('Dashboard'); setMobileMenuOpen(false); setShowPlatformLauncher(false) }}>
            <span className="platform-launcher-option-icon"><AudioLines size={19} /></span>
            <span className="platform-launcher-option-copy"><strong>Speakia IELTS</strong><small>Build confident, fluent speaking</small><span>Practise live · Get precise feedback</span></span>
            <ArrowRight size={20} className="platform-launcher-option-arrow" />
          </button>
          <button type="button" className="platform-launcher-option platform-launcher-writing" onClick={() => { setActivePlatform('writa'); setWritaModule('dashboard'); setMobileMenuOpen(false); setShowPlatformLauncher(false) }}>
            <span className="platform-launcher-option-icon"><PenLine size={19} /></span>
            <span className="platform-launcher-option-copy"><strong>Writia IELTS</strong><small>Write with clarity and control</small><span>Plan · Draft · Improve</span></span>
            <ArrowRight size={20} className="platform-launcher-option-arrow" />
          </button>
        </div>
        <p className="platform-launcher-footnote"><Sparkles size={13} /> Two productive skills. One connected learning journey.</p>
      </motion.section>
    </main>
  )

  return (
    <div className="app-shell">
      <GeminiQuotaNotice platform={activePlatform} />
      {mobileMenuOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`sidebar ${activePlatform === 'writa' ? 'writa-sidebar' : ''} ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); if (activePlatform === 'writa') setWritaModule('studio'); else navigate('Dashboard') }}>
          <span className="brand-mark">{activePlatform === 'writa' ? <PenLine size={21} strokeWidth={2.4} /> : <AudioLines size={21} strokeWidth={2.4} />}</span>
          <span className="brand-copy"><strong>{activePlatform === 'writa' ? 'Writia IELTS' : 'Speakia IELTS'}</strong>{activePlatform === 'writa' ? <><small>Writing Practice Studio</small><small>Plan · Write · Improve</small></> : <><small>Realistic Test Simulation.</small><small>Accurate Band Assessment</small></>}</span>
        </a>
        <div className="workspace-label">{activePlatform === 'writa' ? 'WRITING WORKSPACE' : 'YOUR WORKSPACE'}</div>
        <nav className="main-nav" aria-label={activePlatform === 'writa' ? 'Writia navigation' : 'Main navigation'}>
          {activePlatform === 'writa'
            ? <>
              {writaNavItems.map(({ id, label, icon: Icon }) => (
                <button key={id} className={`nav-link ${writaModule === id ? 'nav-link-active' : ''}`} aria-current={writaModule === id ? 'page' : undefined} onClick={() => { setWritaModule(id); setMobileMenuOpen(false) }}>
                  <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
                </button>
              ))}
              <button className="nav-link" onClick={() => { setActivePlatform('speakia'); navigate('Settings') }}><Settings size={18} strokeWidth={1.8} /><span>Shared Settings</span></button>
            </>
            : navItems.map(({ label, icon: Icon }) => (
              <button key={label} className={`nav-link ${activeSection === label ? 'nav-link-active' : ''}`} onClick={() => navigate(label)}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{sectionDisplayNames[label] ?? label}</span>
                {label === 'Assignments' && assignments.some((assignment) => assignment.status === 'assigned') && <span className="nav-count">{assignments.filter((assignment) => assignment.status === 'assigned').length}</span>}
                {label === 'Vocabulary Studio' && <span className="nav-count">{starterLexicalEntries.length + customLexicalEntries.length}</span>}
              </button>
            ))}
        </nav>
        <div className="profile-actions">
          <button className="profile-button" onClick={() => { if (activePlatform === 'writa') setActivePlatform('speakia'); navigate('Profile') }}>
            <span className="avatar">{(userProfile.displayName || userProfile.username).slice(0, 1).toLocaleUpperCase()}</span>
            <span className="profile-copy"><strong>{userProfile.displayName || userProfile.username}</strong><small>Local profile</small></span>
            <MoreHorizontal size={19} className="profile-more" />
          </button>
          <button className="profile-signout" onClick={() => setConfirmSignOut(true)} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>
      <main className={`main-area ${activePlatform === 'writa' ? 'main-area-writa' : ''}`}>
        <header className="topbar">
          <div className="breadcrumb"><button className="mobile-menu-button" aria-label={`Open ${activePlatform} navigation`} onClick={() => setMobileMenuOpen(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{activePlatform === 'writa' ? writaNavItems.find((item) => item.id === writaModule)?.label ?? 'Writia' : sectionDisplayNames[activeSection] ?? activeSection}</strong></div>
          <div className="topbar-actions">
            <ProdiaModelPicker />
            <div className="platform-switch" role="group" aria-label="Switch platform">
              <button type="button" className={activePlatform === 'speakia' ? 'platform-switch-active' : ''} aria-pressed={activePlatform === 'speakia'} onClick={() => { setActivePlatform('speakia'); setMobileMenuOpen(false) }}><AudioLines size={15} /><span>Speakia</span></button>
              <button type="button" className={activePlatform === 'writa' ? 'platform-switch-active' : ''} aria-pressed={activePlatform === 'writa'} onClick={() => { setActivePlatform('writa'); setMobileMenuOpen(false) }}><PenLine size={15} /><span>Writia</span></button>
            </div>
            {activePlatform === 'speakia'
              ? <NotificationCenter username={userProfile.username} apiKeyAvailable={Boolean(apiKey.trim())} assignments={assignments} results={practiceModuleTests} placementCompleted={Boolean(userProfile.speakingPlacementAssessment)} onNavigate={navigate} />
              : <WritiaNotificationCenter key={userProfile.username} username={userProfile.username} apiKeyAvailable={Boolean(apiKey.trim())} assignments={writiaLearnerContext.assignments} assessments={writiaLearnerContext.assessments} placementCompleted={Boolean(userProfile.writingPlacementAssessment)} onNavigate={setWritaModule} onOpenSettings={() => { setActivePlatform('speakia'); navigate('Settings') }} />}
            <button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}><motion.span key={theme} initial={shouldReduceMotion ? false : { opacity: 0, rotate: -35, scale: .8 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} transition={{ duration: shouldReduceMotion ? 0 : .2 }}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</motion.span></button>
            <button className="avatar top-avatar top-avatar-button" onClick={() => { if (activePlatform === 'writa') setActivePlatform('speakia'); navigate('Profile') }} aria-label="Open your profile">{(userProfile.displayName || userProfile.username).slice(0, 1).toLocaleUpperCase()}</button>
          </div>
        </header>
        {storageWarning && <p className="storage-warning" role="status">{storageWarning}</p>}
        <AnimatePresence mode="wait">
          <motion.div
            key={activePlatform === 'writa' ? 'writa-platform' : activeSection}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
          >
            <Suspense fallback={null}>
              {activePlatform === 'writa' ? <WritaPlatform apiKey={apiKey} username={userProfile.username} profile={userProfile} speakingResults={practiceModuleTests} module={writaModule} onModuleChange={setWritaModule} onOpenSettings={() => { setActivePlatform('speakia'); navigate('Settings') }} onOpenProfile={() => { setActivePlatform('speakia'); navigate('Profile') }} onSavePlacementAssessment={(assessment) => handleSaveProfile({ ...userProfile, writingPlacementAssessment: assessment })} onLearnerDataChange={setWritiaLearnerContext} examLaunchRequest={writaExamLaunchRequest} onExamLaunchHandled={() => setWritaExamLaunchRequest(null)} /> : <>
              {activeSection === 'Dashboard' && <Dashboard onNavigate={navigate} onOpenTest={openTestInHistory} completedTests={practiceModuleTests} savedLexicalCount={savedWords.length} profile={userProfile} />}
              {activeSection === 'Learner Profile' && <SpeakiaLearnerProfilePage speakingResults={completedTests} profile={userProfile} onNavigate={navigate} onOpenPlacement={() => navigate('Placement Assessment')} onOpenAssessment={openTestInHistory} />}
              {activeSection === 'Placement Assessment' && <PlacementAssessmentPage skill="speaking" apiKey={apiKey} speakingModel={assessmentModel} testType={userProfile.testType} result={userProfile.speakingPlacementAssessment} onComplete={(assessment) => handleSaveProfile({ ...userProfile, speakingPlacementAssessment: assessment })} />}
              {activeSection === 'Vocabulary Studio' && <div className="learning-library-page">
                <div className="learning-library-tabs" role="tablist" aria-label="Topics and Vocabulary sections">
                  <button id="topic-bank-tab" type="button" role="tab" tabIndex={learningLibraryTab === 'topic-bank' ? 0 : -1} aria-selected={learningLibraryTab === 'topic-bank'} aria-controls="topic-bank-panel" className={`learning-library-tab ${learningLibraryTab === 'topic-bank' ? 'learning-library-tab-active' : ''}`} onClick={() => setLearningLibraryTab('topic-bank')} onKeyDown={(event) => moveLearningLibraryTab(event, 'topic-bank')}><span className="learning-library-tab-icon topic-bank-tab-icon"><ListFilter size={18} /></span><span className="learning-library-tab-copy"><strong>Topic Bank</strong><small>Questions &amp; cue cards</small></span><span className="learning-library-tab-arrow"><ArrowRight size={15} /></span></button>
                  <button id="lexical-vault-tab" type="button" role="tab" tabIndex={learningLibraryTab === 'lexical-vault' ? 0 : -1} aria-selected={learningLibraryTab === 'lexical-vault'} aria-controls="lexical-vault-panel" className={`learning-library-tab ${learningLibraryTab === 'lexical-vault' ? 'learning-library-tab-active' : ''}`} onClick={() => setLearningLibraryTab('lexical-vault')} onKeyDown={(event) => moveLearningLibraryTab(event, 'lexical-vault')}><span className="learning-library-tab-icon lexical-vault-tab-icon"><BookOpen size={18} /></span><span className="learning-library-tab-copy"><strong>Vocabulary Bank</strong><small>Words &amp; expressions</small></span><span className="learning-library-tab-count">{starterLexicalEntries.length + customLexicalEntries.length}</span></button>
                  <button id="vocabulary-builder-tab" type="button" role="tab" tabIndex={learningLibraryTab === 'vocabulary-builder' ? 0 : -1} aria-selected={learningLibraryTab === 'vocabulary-builder'} aria-controls="vocabulary-builder-panel" className={`learning-library-tab ${learningLibraryTab === 'vocabulary-builder' ? 'learning-library-tab-active' : ''}`} onClick={() => setLearningLibraryTab('vocabulary-builder')} onKeyDown={(event) => moveLearningLibraryTab(event, 'vocabulary-builder')}><span className="learning-library-tab-icon vocab-builder-tab-icon"><Sparkles size={18} /></span><span className="learning-library-tab-copy"><strong>Vocabulary Upgrade</strong><small>Upgrade everyday words for IELTS</small></span><span className="learning-library-tab-arrow"><ArrowRight size={15} /></span></button>
                </div>
                <div id="topic-bank-panel" role="tabpanel" aria-labelledby="topic-bank-tab" hidden={learningLibraryTab !== 'topic-bank'}><TopicBankPage apiKey={apiKey} customPrompts={customTopicPrompts} pinnedIds={pinnedLearningIds} onTogglePin={(id) => setPinnedLearningIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onPractice={startTopicBankPractice} onStartCoachLive={(title, context) => startCoachLive('topic', title, context)} /></div>
                <div id="lexical-vault-panel" role="tabpanel" aria-labelledby="lexical-vault-tab" hidden={learningLibraryTab !== 'lexical-vault'}><WordVaultPage username={userProfile.username} entries={lexicalEntries} savedIds={savedWords} pinnedIds={pinnedLearningIds} apiKey={apiKey} onTogglePin={(id) => setPinnedLearningIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onOpenFlashcards={() => navigate('Speakia Flashcards')} onAdd={(entry) => setCustomLexicalEntries((current) => [entry, ...current])} onUpdate={(entry) => setCustomLexicalEntries((current) => [entry, ...current.filter((item) => item.id !== entry.id)])} onStartCoachLive={(item) => startCoachLive('lexical', item.term, [
                  `Word or expression: ${item.term}${item.partOfSpeech ? ` (${item.partOfSpeech})` : ''}`,
                  `Meaning: ${(item.meanings?.length ? item.meanings : [item.meaning]).join('; ')}`,
                  `Topic: ${item.topic || 'general IELTS Speaking'}`,
                  `Examples: ${(item.examples?.length ? item.examples : [item.example]).join('; ')}`,
                  `Category: ${item.category}`,
                ].join('\n'))} /></div>
                <div id="vocabulary-builder-panel" role="tabpanel" aria-labelledby="vocabulary-builder-tab" hidden={learningLibraryTab !== 'vocabulary-builder'}><VocabularyUpgradePage apiKey={apiKey} username={userProfile.username} onStartCoachLive={(title, context) => startCoachLive('lexical', title, context)} /></div>
              </div>}
              {activeSection === 'Smart lesson' && <SmartLesson />}
              {activeSection === 'Speakia Coach Assets' && <CoachAssetsPage onOpenCoach={() => window.dispatchEvent(new Event('speakia:open-coach'))} onAdapt={(asset) => window.dispatchEvent(new CustomEvent('speakia:coach-adapt-asset', { detail: asset }))} />}
              {activeSection === 'Assignments' && <AssignmentPage assignments={assignments} busy={assignmentBusy} error={assignmentError} apiKey={apiKey} onOpenSettings={() => navigate('Settings')} onChoose={handleChooseTomorrowAssignment} onComplete={(assignment) => updateAssignment({ ...assignment, status: 'completed' })} onStart={startAssignment} onSubmit={(assignment, report: AssignmentPerformanceReport) => {
                if (!updateAssignment({ ...assignment, status: 'completed', report })) {
                  throw new Error('The assignment report could not be saved. Please free browser storage and submit again.')
                }
              }} />}
              {activeSection === 'Speakia Flashcards' && <FlashcardsPage username={userProfile.username} entries={lexicalEntries} savedIds={savedWords} apiKey={apiKey} onOpenSettings={() => navigate('Settings')} onOpenLexis={() => navigate('Vocabulary Bank')} />}
              {activeSection === 'Practice' && <div className="practice-hub">
                <div className="learning-library-tabs practice-tabs" role="tablist" aria-label="Practice sections">
                  <button id="actual-practice-tab" type="button" role="tab" tabIndex={practiceTab === 'actual' ? 0 : -1} aria-selected={practiceTab === 'actual'} aria-controls="actual-practice-panel" className={`learning-library-tab ${practiceTab === 'actual' ? 'learning-library-tab-active' : ''}`} onClick={() => setPracticeTab('actual')}><span className="learning-library-tab-icon topic-bank-tab-icon"><Mic2 size={18} /></span><span className="learning-library-tab-copy"><strong>Exam Simulation</strong><small>Live examiner led speaking tests</small></span><span className="learning-library-tab-arrow"><ArrowRight size={15} /></span></button>
                  <button id="guided-practice-tab" type="button" role="tab" tabIndex={practiceTab === 'guided' ? 0 : -1} aria-selected={practiceTab === 'guided'} aria-controls="guided-practice-panel" className={`learning-library-tab ${practiceTab === 'guided' ? 'learning-library-tab-active' : ''}`} onClick={() => setPracticeTab('guided')}><span className="learning-library-tab-icon lexical-vault-tab-icon"><AudioLines size={18} /></span><span className="learning-library-tab-copy"><strong>Guided Practice</strong><small>Focused modes and skill building</small></span><span className="learning-library-tab-arrow"><ArrowRight size={15} /></span></button>
                </div>
                <div id="actual-practice-panel" role="tabpanel" aria-labelledby="actual-practice-tab" hidden={practiceTab !== 'actual'}><Simulator key={practiceLaunchId} onComplete={completeTest} apiKey={apiKey} assessmentModel={assessmentModel} onAssessmentModelChange={handleAssessmentModelChange} onOpenSettings={() => navigate('Settings')} initialPart={selectedAssignment?.part ?? practiceInitialPart} assignment={selectedAssignment} topicBankPrompts={customTopicPrompts} selectedTopicBankPrompt={practiceTopicPrompt ?? undefined} startImmediately={practiceStartImmediately} onStartRequestHandled={() => setPracticeStartImmediately(false)} /></div>
                <div id="guided-practice-panel" role="tabpanel" aria-labelledby="guided-practice-tab" hidden={practiceTab !== 'guided'}><PracticeModesPage apiKey={apiKey} results={completedTests} username={userProfile.username} onOpenSettings={() => navigate('Settings')} onOpenDrills={() => navigate('Speaking Drills')} onOpenDrill={openRecommendedDrill} launchRequest={guidedPracticeLaunch} onLaunchHandled={(id) => setGuidedPracticeLaunch((current) => current?.id === id ? null : current)} /></div>
              </div>}
              {activeSection === 'Speaking Drills' && <SpeakingDrillsPage key={recommendedDrillRequestKey} apiKey={apiKey} username={userProfile.username} onOpenSettings={() => navigate('Settings')} onOpenDrill={openRecommendedDrill} initialDrillId={recommendedDrillId} initialPrompt={recommendedDrillPrompt} onInitialDrillHandled={() => { setRecommendedDrillId(''); setRecommendedDrillPrompt('') }} />}
              {activeSection === 'Writia' && <WritiaPage apiKey={apiKey} username={userProfile.username} onOpenSettings={() => navigate('Settings')} />}
              {activeSection === 'AI-to-AI Simulation' && <AiToAiSimulationPage username={userProfile.username} apiKey={apiKey} lexicalTerms={lexicalEntries.map((entry) => entry.term)} onAddLexicalEntry={addLexicalEntryFromCoach} onOpenSettings={() => navigate('Settings')} />}
              {activeSection === 'Answer Builder' && <TalkingTemplatesPage username={userProfile.username} apiKey={apiKey} lexicalTerms={lexicalEntries.map((entry) => entry.term)} customPrompts={customTopicPrompts} onAddLexicalEntry={addLexicalEntryFromCoach} onOpenSettings={() => navigate('Settings')} onOpenDrill={openRecommendedDrill} />}
              {activeSection === 'Performance History' && <HistoryPage apiKey={apiKey} assessmentModel={assessmentModel} onAssessmentModelChange={handleAssessmentModelChange} onReassess={reassessTest} onNavigate={navigate} onOpenBandDescriptors={(criterion, band) => { setBandDescriptorFocus({ criterion, band }); navigate('Band Descriptors') }} results={practiceModuleTests} initialExpandedTestId={historyTargetTestId} coachAction={coachHistoryAction} onCoachActionHandled={finishCoachHistoryAction} />}
              {activeSection === 'Band Descriptors' && <BandDescriptorsPage product="speaking" initialCriterion={bandDescriptorFocus?.criterion} initialBand={bandDescriptorFocus?.band} />}
              {activeSection === 'Media assessments' && <MediaAssessmentPage apiKey={apiKey} onOpenSettings={() => navigate('Settings')} />}
              {activeSection === 'Speakia Podcasts' && <PodcastsPage username={userProfile.username} profile={userProfile} apiKey={apiKey} results={completedTests} lexicalEntries={lexicalEntries} assignments={assignments} />}
              {activeSection === 'Profile' && <ProfilePage profile={userProfile} onSave={handleSaveProfile} />}
              {activeSection === 'Settings' && <SettingsPage apiKey={apiKey} fallbackApiKeys={fallbackApiKeys} onSaveApiKeys={handleSaveApiKeys} assessmentModel={assessmentModel} onAssessmentModelChange={handleAssessmentModelChange} assistantChatModel={assistantChatModel} assistantToolModel={assistantToolModel} onAssistantModelChange={handleAssistantModelChange} theme={theme} onThemeChange={() => setTheme((current) => current === 'light' ? 'dark' : 'light')} />}
              </>}
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
      {<SpeakiaAssistant
        key={activePlatform}
        platform={activePlatform === 'writa' ? 'writing' : 'speaking'}
        activeSection={activePlatform === 'writa' ? 'Writia' : activeSection}
        activeWritaModule={activePlatform === 'writa' ? writaModule : undefined}
        results={practiceModuleTests}
        lexicalEntries={lexicalEntries}
        profile={userProfile}
        writingContext={writiaLearnerContext}
        apiKey={apiKey}
        chatModel={assistantChatModel}
        toolModel={assistantToolModel}
        onChatModelChange={(model) => handleAssistantModelChange('chat', model)}
        onNavigateWrita={activePlatform === 'writa' ? (module) => { setWritaModule(module); setMobileMenuOpen(false) } : undefined}
        onStartWritingExam={startWritaExamFromAssistant}
        onStartPractice={startPracticeFromCoach}
        onStartGuidedPractice={startGuidedPracticeFromCoach}
        onNavigate={navigate}
        onReviewPerformanceTest={reviewHistoryTestFromCoach}
        onActivateControl={activatePageControl}
        assignments={assignments}
        onChooseTomorrowAssignment={handleChooseTomorrowAssignment}
        assignmentBusy={assignmentBusy}
        coachLaunch={coachLaunch}
        onAddLexicalEntry={addLexicalEntryFromCoach}
        onAddTopicPrompt={addTopicPromptFromCoach}
      />}
    </div>
  )
}

function ProdiaHomePage({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  return <main className="prodia-home">
    <header className="prodia-home-nav">
      <a className="prodia-home-brand" href="#home" aria-label="Prodia IELTS home">
        <span className="prodia-home-brand-mark"><AudioLines size={19} /><PenLine size={17} /></span>
        <span><strong>prodia<span>.</span></strong><small>IELTS PREPARATION PLATFORM</small></span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#platforms">Platforms</a>
        <a href="#how-it-works">How it works</a>
      </nav>
      <div className="prodia-home-nav-actions">
        <button type="button" className="prodia-home-signin" onClick={onSignIn}>Sign in</button>
        <button type="button" className="prodia-home-cta prodia-home-cta-small" onClick={onGetStarted}>Get started <ArrowRight size={15} /></button>
      </div>
    </header>

    <section className="prodia-home-hero" id="home">
      <div className="prodia-home-hero-copy">
        <span className="prodia-home-eyebrow"><Sparkles size={14} /> SPEAKING · WRITING · ASSESSMENT</span>
        <h1>Your IELTS journey,<br /><em>intelligently guided.</em></h1>
        <p className="prodia-home-tagline">Prepare for IELTS with purpose. Perform with confidence.</p>
        <p className="prodia-home-intro">Practise with AI coaches, experience realistic IELTS simulations, receive personalised feedback, and build the skills to move towards your target band.</p>
        <div className="prodia-home-hero-actions">
          <button type="button" className="prodia-home-cta" onClick={onGetStarted}>Start your journey <ArrowRight size={17} /></button>
          <a className="prodia-home-text-link" href="#platforms">Explore the platforms <ChevronRight size={16} /></a>
        </div>
        <div className="prodia-home-trust-line"><span><Check size={14} /> Personalised practice</span><i /><span><Check size={14} /> Skill-specific coaching</span><i /><span><Check size={14} /> Meaningful progress</span></div>
      </div>
      <div className="prodia-home-hero-visual" aria-label="Prodia connects focused IELTS speaking and writing practice">
        <div className="prodia-home-visual-glow" />
        <div className="prodia-home-visual-orbit prodia-home-visual-orbit-one" />
        <div className="prodia-home-visual-orbit prodia-home-visual-orbit-two" />
        <div className="prodia-home-visual-center"><span className="prodia-home-brand-mark"><AudioLines size={24} /><PenLine size={21} /></span><strong>prodia<span>.</span></strong><small>IELTS, intelligently guided</small></div>
        <div className="prodia-home-float-card prodia-home-float-speaking"><span><AudioLines size={17} /></span><div><strong>Speakia</strong><small>Speak with confidence</small></div></div>
        <div className="prodia-home-float-card prodia-home-float-writing"><span><PenLine size={17} /></span><div><strong>Writia</strong><small>Write with purpose</small></div></div>
        <span className="prodia-home-visual-spark prodia-home-spark-one">✦</span>
        <span className="prodia-home-visual-spark prodia-home-spark-two">✧</span>
      </div>
    </section>

    <section className="prodia-home-platforms" id="platforms">
      <div className="prodia-home-section-heading">
        <span className="prodia-home-eyebrow">TWO SPECIALISED PLATFORMS</span>
        <h2>One goal. <em>Two skills to master.</em></h2>
        <p>Choose the focused IELTS practice you need today. Your Prodia journey brings both productive skills together.</p>
      </div>
      <div className="prodia-home-product-grid">
        <article className="prodia-home-product prodia-home-product-speaking">
          <div className="prodia-home-product-top"><span className="prodia-home-product-icon"><AudioLines size={21} /></span><span className="prodia-home-product-label">IELTS SPEAKING</span></div>
          <h3>Speakia</h3>
          <p className="prodia-home-product-promise">Your personal AI Speaking Coach &amp; Examiner</p>
          <p>Build fluency and confidence through realistic speaking practice, live coaching, and thoughtful performance feedback.</p>
          <ul><li><Check size={15} /> Live examiner-led test simulations</li><li><Check size={15} /> Guided practice for every speaking part</li><li><Check size={15} /> Indicative, criterion-based feedback</li></ul>
          <button type="button" className="prodia-home-product-link" onClick={onGetStarted}>Explore Speakia <ArrowRight size={16} /></button>
        </article>
        <article className="prodia-home-product prodia-home-product-writing">
          <div className="prodia-home-product-top"><span className="prodia-home-product-icon"><PenLine size={20} /></span><span className="prodia-home-product-label">IELTS WRITING</span></div>
          <h3>Writia</h3>
          <p className="prodia-home-product-promise">Your personal AI Writing Coach &amp; Evaluator</p>
          <p>Develop stronger responses with task-aware guidance, purposeful writing practice, and feedback that helps you revise.</p>
          <ul><li><Check size={15} /> Academic and General Training tasks</li><li><Check size={15} /> Plan, compose, and refine your writing</li><li><Check size={15} /> Writing-specific practice and feedback</li></ul>
          <button type="button" className="prodia-home-product-link" onClick={onGetStarted}>Explore Writia <ArrowRight size={16} /></button>
        </article>
      </div>
    </section>

    <section className="prodia-home-method" id="how-it-works">
      <div className="prodia-home-section-heading">
        <span className="prodia-home-eyebrow">A CLEARER WAY FORWARD</span>
        <h2>Learn. Practise. <em>Improve.</em></h2>
        <p>Turn preparation into a purposeful cycle—guided by your goals and grounded in your own practice.</p>
      </div>
      <div className="prodia-home-steps">
        <article><span>01</span><div><strong>Find your focus</strong><p>Choose a skill, task, or learning goal that matters to you.</p></div></article>
        <article><span>02</span><div><strong>Practise with guidance</strong><p>Use specialised AI coaching, realistic simulations, and structured activities.</p></div></article>
        <article><span>03</span><div><strong>Use feedback to grow</strong><p>Understand what is working and decide on a practical next step.</p></div></article>
      </div>
      <p className="prodia-home-disclaimer">Prodia’s AI-generated assessment feedback is an indicative learning estimate, not an official IELTS result.</p>
    </section>

    <footer className="prodia-home-footer">
      <a className="prodia-home-brand" href="#home"><span className="prodia-home-brand-mark"><AudioLines size={17} /><PenLine size={15} /></span><span><strong>prodia<span>.</span></strong><small>PREPARE WITH PURPOSE.</small></span></a>
      <span>Personalised learning. Intelligent coaching. Meaningful progress.</span>
      <button type="button" onClick={onSignIn}>Sign in to Prodia <ArrowRight size={14} /></button>
    </footer>
  </main>
}

function LocalAuthPage({ onAuthenticate, initialMode, onBack }: { onAuthenticate: (username: string, password: string, createAccount: boolean, rememberMe: boolean) => Promise<void>; initialMode: 'signin' | 'create'; onBack: () => void }) {
  const [mode, setMode] = useState<'signin' | 'create'>(initialMode)
  const [username, setUsername] = useState(readRememberedUsername)
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => Boolean(readRememberedUsername()))
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [featureTourOpen, setFeatureTourOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onAuthenticate(username, password, mode === 'create', rememberMe)
    } catch (caughtError) {
      console.error('Local Speakia authentication failed.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to authenticate this local account.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-page">
    <div className="auth-layout auth-layout-solo">
      <motion.section className="auth-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25 }}>
      <button type="button" className="auth-back-home" onClick={onBack}><ArrowRight size={15} /> Back to Prodia IELTS</button>
      <div className="auth-brand"><span className="brand-mark"><AudioLines size={23} /></span><div><strong>Prodia IELTS</strong><span>Your personalised AI IELTS learning platform</span><span>Speakia · Speaking &nbsp;|&nbsp; Writia · Writing</span></div></div>
      <p className="eyebrow">ONE IELTS JOURNEY · TWO PRODUCTIVE SKILLS</p>
      <h1>{mode === 'signin' ? 'Welcome back' : 'Set up your local account'}</h1>
      <p className="auth-description">{mode === 'signin' ? 'Sign in once to reach Speakia for Speaking and Writia for Writing, the productive half of IELTS’ four skills.' : 'Create one local account for Speakia (Speaking) and Writia (Writing), your two productive IELTS skills.'}</p>
      <div className="auth-mode-tabs" role="tablist" aria-label="Local account options">
        <button role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'auth-mode-active' : ''} onClick={() => { setMode('signin'); setError('') }}>Sign in</button>
        <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'auth-mode-active' : ''} onClick={() => { setMode('create'); setError('') }}>Create account</button>
      </div>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>Username<input autoComplete="username" minLength={3} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Choose a username" required /></label>
        <label>Password<span className="auth-password-field"><input type={passwordVisible ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your local password" required /><button type="button" className="auth-password-toggle" aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        {mode === 'signin' && <label className="auth-remember-option"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span><strong>Remember me on this device</strong><small>Stay signed in and remember your username. Your password itself is never stored by Prodia.</small></span></label>}
        <p className={`auth-password-hint ${mode !== 'create' ? 'auth-password-hint-hidden' : ''}`}>Choose any password you’ll remember.</p>
        <p className={`auth-error auth-error-slot ${error ? '' : 'auth-error-hidden'}`} role={error ? 'alert' : undefined}>{error || ' '}</p>
        <Button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create local account'} <ArrowRight size={16} /></Button>
      </form>
      <div className="auth-local-notice"><LockKeyhole size={15} /><p>Local prototype only: accounts and profile data stay in this browser. This is not server authentication; anyone with browser access can inspect or alter local data. Do not reuse a sensitive password.</p></div>
      <button type="button" className="auth-tour-toggle" aria-haspopup="dialog" onClick={() => setFeatureTourOpen(true)}><Sparkles size={15} /> Explore Prodia’s feature tour <ArrowRight size={14} /></button>
      </motion.section>
    </div>
    {featureTourOpen && <div className="auth-tour-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setFeatureTourOpen(false)
    }} onKeyDown={(event) => {
      if (event.key === 'Escape') setFeatureTourOpen(false)
    }} role="presentation" tabIndex={-1}>
      <section className="auth-tour-dialog" role="dialog" aria-modal="true" aria-label="Prodia IELTS feature tour">
        <button type="button" className="auth-tour-close" aria-label="Close feature tour" onClick={() => setFeatureTourOpen(false)}><X size={18} /></button>
        <FeatureTour />
      </section>
    </div>}
  </main>
}

function ProfilePage({ profile, onSave }: { profile: UserProfile; onSave: (profile: UserProfile) => Promise<void> }) {
  const [form, setForm] = useState<UserProfile>(profile)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const testDays = form.speakingTestDate ? daysUntil(form.speakingTestDate) : null

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
        testDate: form.speakingTestDate,
        targetBand: form.speakingTargetBand,
        location: form.location.trim(),
        firstLanguage: form.firstLanguage.trim(),
        studyGoal: form.speakingStudyGoal.trim(),
        speakingStudyGoal: form.speakingStudyGoal.trim(),
        writingStudyGoal: form.writingStudyGoal.trim(),
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
    <PageHeading eyebrow="YOUR PERSONAL SETTINGS" title="Your profile" description="Manage your shared IELTS details and separate Speaking and Writing preparation goals." />
    <Card className="profile-summary-card"><span className="profile-summary-avatar">{(form.displayName || form.username).slice(0, 1).toLocaleUpperCase()}</span><div><span className="section-kicker">LOCAL ACCOUNT</span><strong>{form.displayName || form.username}</strong><p>@{form.username}</p></div><Badge className="local-account-badge"><LockKeyhole size={13} /> Stored on this browser</Badge></Card>
    <Card className="profile-form-card"><div className="profile-form-heading"><span className="section-kicker">SPEAKING &amp; WRITING PREPARATION</span><h2>Combined IELTS profile</h2><p>Share your IELTS test type while keeping each skill’s date, target band, and learning goal distinct.</p></div>
      {form.speakingTestDate && <div className={`test-countdown ${testDays !== null && testDays < 0 ? 'test-countdown-past' : ''}`}><CalendarDays size={19} /><div><strong>{testDays === null ? 'Set your Speaking test date' : testDays < 0 ? 'Speaking test date has passed' : testDays === 0 ? 'Your Speaking test is today' : `${testDays} days to your Speaking test`}</strong><span>{new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(`${form.speakingTestDate}T00:00:00`))}</span></div></div>}
      <form className="profile-form" onSubmit={(event) => void submit(event)}>
        <label>Display name<input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="How should we address you?" /></label>
        <label>Location<input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="City or time zone" /></label>
        <label>First language<input value={form.firstLanguage} onChange={(event) => update('firstLanguage', event.target.value)} placeholder="Optional" /></label>
        <fieldset className="profile-form-section">
          <legend>IELTS test details</legend>
          <div className="profile-form-section-grid">
            <label>Test type<select value={form.testType} onChange={(event) => update('testType', event.target.value as UserProfile['testType'])}><option>Academic</option><option>General Training</option></select></label>
            <label>Speaking test date<input type="date" value={form.speakingTestDate} onChange={(event) => setForm((current) => ({ ...current, speakingTestDate: event.target.value, testDate: event.target.value }))} /></label>
            <label>Writing test date<input type="date" value={form.writingTestDate} onChange={(event) => update('writingTestDate', event.target.value)} /></label>
          </div>
        </fieldset>
        <fieldset className="profile-form-section">
          <legend>Speaking preparation</legend>
          <div className="profile-form-section-grid">
            <label>Target Speaking band<select value={form.speakingTargetBand} onChange={(event) => setForm((current) => ({ ...current, speakingTargetBand: event.target.value, targetBand: event.target.value }))}><option value="">Not set</option>{[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((band) => <option key={band} value={band}>Band {band.toFixed(1)}</option>)}</select></label>
            <label className="profile-goal-field">Speaking study goal<textarea value={form.speakingStudyGoal} onChange={(event) => setForm((current) => ({ ...current, speakingStudyGoal: event.target.value, studyGoal: event.target.value }))} placeholder="What would you most like to improve in Speaking?" rows={3} /></label>
          </div>
        </fieldset>
        <fieldset className="profile-form-section">
          <legend>Writing preparation</legend>
          <div className="profile-form-section-grid">
            <label>Target Writing band<select value={form.writingTargetBand} onChange={(event) => update('writingTargetBand', event.target.value)}><option value="">Not set</option>{[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map((band) => <option key={band} value={band}>Band {band.toFixed(1)}</option>)}</select></label>
            <label className="profile-goal-field">Writing study goal<textarea value={form.writingStudyGoal} onChange={(event) => update('writingStudyGoal', event.target.value)} placeholder="What would you most like to improve in Writing?" rows={3} /></label>
          </div>
        </fieldset>
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
    ?? profile.speakingPlacementAssessment?.priority
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
      {!profile.speakingPlacementAssessment && <section className="placement-dashboard-invitation"><span><Target size={18} /></span><div><strong>Not sure where to begin?</strong><p>Take an optional Speaking placement assessment to get a starting band and a focused first practice step.</p></div><Button variant="outline" onClick={() => onNavigate('Placement Assessment')}>Find my starting point <ArrowRight size={14} /></Button></section>}
      <section className="hero-card">
        <div className="hero-copy">
          <Badge className="hero-badge"><Sparkles size={13} /> YOUR SPEAKING OVERVIEW</Badge>
          <h2>{latestTest ? <>Your progress,<br />in <em>focus.</em></> : profile.speakingPlacementAssessment ? <>Your starting point,<br />in <em>focus.</em></> : <>Build your<br /><em>baseline.</em></>}</h2>
          <p>{latestTest ? 'Review your latest assessment, track your strongest skills, and choose one clear next step.' : profile.speakingPlacementAssessment ? 'Use your placement results to choose a focused first practice; later assessments will show your learning progress.' : 'Complete an optional placement assessment or start practice to establish your current speaking level.'}</p>
          <Button className="hero-button" onClick={() => latestTest ? onOpenTest(latestTest) : profile.speakingPlacementAssessment ? onNavigate('Learner Profile') : onNavigate('Placement Assessment')}>{latestTest ? 'Review latest assessment' : profile.speakingPlacementAssessment ? 'Review placement baseline' : 'Find my starting point'} <ArrowRight size={16} /></Button>
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
            <Button variant="ghost" size="sm" className="view-all" onClick={() => onNavigate('Performance History')}>View all <ArrowRight size={15} /></Button>
          </CardHeader>
          <CardContent className="recent-list">
            {recentTests.length ? recentTests.map((test) => <div className="test-row" key={test.result.id}>
              <div className={`test-icon test-icon-${test.tone}`}><Headphones size={18} /></div>
              <div className="test-info"><strong>{test.topic}</strong><span>{test.part} <i /> {test.date}</span></div>
              <div className="test-score"><strong>{test.band}</strong><span>band</span></div>
              <Badge className="change-badge">Review</Badge>
              <button className="row-arrow" aria-label={`Open ${test.topic} in Performance History`} title="Review transcript and assessment" onClick={() => onOpenTest(test.result)}><ArrowUpRight size={16} /></button>
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
          <button className="focus-action" aria-label="View assessment recommendations" onClick={() => latestTest ? onOpenTest(latestTest) : onNavigate('Practice')}><ArrowRight size={17} /></button>
        </Card>
        <Card className="vocab-card">
          <div className="vocab-icon"><BookOpen size={19} /></div>
          <div className="vocab-copy"><span>YOUR LEXICAL VAULT</span><strong>{savedLexicalCount} saved {savedLexicalCount === 1 ? 'word' : 'words'}</strong><p>Keep useful vocabulary close and bring it into your next speaking response.</p></div>
          <Button variant="outline" size="sm" className="save-word" onClick={() => onNavigate('Vocabulary Bank')}><Plus size={14} /> Explore Vocabulary Bank</Button>
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

function HistoryPage({ apiKey, assessmentModel, onAssessmentModelChange, onReassess, onNavigate, onOpenBandDescriptors, results, initialExpandedTestId, coachAction, onCoachActionHandled }: {
  apiKey: string
  assessmentModel: AssessmentModel
  onAssessmentModelChange: (model: AssessmentModel) => void
  onReassess: (result: TestResult, model: AssessmentModel) => Promise<void>
  onNavigate: (section: Section) => void
  onOpenBandDescriptors: (criterion: string, band: number) => void
  results: TestResult[]
  initialExpandedTestId: string | null
  coachAction: CoachHistoryAction | null
  onCoachActionHandled: (requestId: string) => void
}) {
  const [today] = useState(() => new Date())
  const todayKey = localDateKey(today)
  const [expandedReview, setExpandedReview] = useState<{ testId: string; section: 'transcript' | 'assessment' } | null>(initialExpandedTestId ? { testId: initialExpandedTestId, section: 'assessment' } : null)
  const [autoReassessRequest, setAutoReassessRequest] = useState<{ requestId: string; testId: string } | null>(null)
  const [partFilter, setPartFilter] = useState<TestPart | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')
  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState('')
  useEffect(() => {
    if (!coachAction) return
    if (!results.some((result) => result.id === coachAction.testId)) {
      onCoachActionHandled(coachAction.requestId)
      return
    }
    const section = coachAction.action === 'transcript' ? 'transcript' : 'assessment'
    setPartFilter('all')
    setSearchTerm('')
    setSelectedDate('')
    setExpandedReview({ testId: coachAction.testId, section })
    if (coachAction.action === 'reassess') setAutoReassessRequest({ requestId: coachAction.requestId, testId: coachAction.testId })
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`.history-entry[data-test-id="${CSS.escape(coachAction.testId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        onCoachActionHandled(coachAction.requestId)
      })
    })
    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame) window.cancelAnimationFrame(secondFrame)
    }
  }, [coachAction, onCoachActionHandled, results])
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
    if (selectedDate && localDateKey(new Date(result.completedAt)) !== selectedDate) return false
    const query = searchTerm.trim().toLocaleLowerCase()
    if (!query) return true
    const transcript = groupTranscriptTurns(result.transcript).map((turn) => turn.text).join(' ')
    return `${result.title} ${result.part} ${transcript}`.toLocaleLowerCase().includes(query)
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
  const latestBand = visibleResults[0]?.overallBand.toFixed(1) ?? '—'
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
  return <div className="page-content inner-page"><PageHeading eyebrow="YOUR SPEAKING JOURNEY" title="Performance History" description="Every practice test, transcript, and AI-estimated report together in one place." action={<Button className="start-button" onClick={() => onNavigate('Practice')}><Mic2 size={17} /> New practice</Button>} />
    <div className="history-overview"><div><span>Tests completed</span><strong>{results.length}</strong></div><div><span>Matching reports</span><strong>{visibleResults.length}</strong></div><div><span>Latest estimate</span><strong>{latestBand}</strong></div><div><span>Average estimate</span><strong>{averageBand}</strong></div></div>
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
    {results.length > 0 && <div className="history-filter-row"><label htmlFor="history-search"><Search size={16} /> Search tests</label><input id="history-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search test titles or transcripts" /><label htmlFor="history-part-filter"><ListFilter size={16} /> Test type</label><select id="history-part-filter" value={partFilter} onChange={(event) => setPartFilter(event.target.value as TestPart | 'all')}><option value="all">All tests</option><option value="part1">Part 1</option><option value="part2">Part 2</option><option value="part3">Part 3</option><option value="full">Full test</option></select></div>}
    {results.length > 0
      ? visibleResults.length
        ? <div className="history-table"><div className="history-table-head"><span>TEST</span><span>DATE</span><span>FORMAT</span><span>ESTIMATE</span><span>REVIEW</span></div>{visibleResults.map((result) => {
        const transcriptTurns = groupTranscriptTurns(result.transcript)
        const transcriptExpanded = expandedReview?.testId === result.id && expandedReview.section === 'transcript'
        const assessmentExpanded = expandedReview?.testId === result.id && expandedReview.section === 'assessment'
        return <div className="history-entry" key={result.id} data-test-id={result.id}><div className="history-table-row"><div className="history-test-name"><div className="test-icon test-icon-lavender"><Headphones size={17} /></div><div><strong>{result.title}</strong><small>{transcriptTurns.filter((entry) => entry.role === 'candidate').length} responses · {Math.floor(result.durationSeconds / 60)} min</small><small className="history-assessment-duration">{getAssessmentModelLabel(result.assessmentModel)}{result.assessmentDurationMs === undefined ? '' : ` · ${formatAssessmentDuration(result.assessmentDurationMs)}`}</small></div></div><span className="history-date"><time dateTime={result.completedAt}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(result.completedAt))}</time><small className="history-timestamp">{new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(result.completedAt))}</small></span><span><Badge className="type-badge">{result.part === 'full' ? 'Full test' : result.part.replace('part', 'Part ')}</Badge></span><span className="history-band">{result.overallBand.toFixed(1)}</span><div className="history-row-actions"><button className={`history-action-button ${transcriptExpanded ? 'history-action-button-active' : ''}`} aria-label={`${transcriptExpanded ? 'Hide' : 'Read'} transcript for ${result.title}`} aria-expanded={transcriptExpanded} onClick={() => setExpandedReview((current) => current?.testId === result.id && current.section === 'transcript' ? null : { testId: result.id, section: 'transcript' })}><BookOpen size={16} /><span>Transcript</span></button><button className={`history-action-button ${assessmentExpanded ? 'history-action-button-active' : ''}`} aria-label={`${assessmentExpanded ? 'Hide' : 'View'} assessment for ${result.title}`} aria-expanded={assessmentExpanded} onClick={() => setExpandedReview((current) => current?.testId === result.id && current.section === 'assessment' ? null : { testId: result.id, section: 'assessment' })}><Target size={16} /><span>Report</span></button></div></div>{transcriptExpanded && <div className="history-detail"><RecordingPlayer key={result.id} test={result} /><div className="history-transcript"><div className="history-detail-heading"><div><span className="section-kicker">SESSION TRANSCRIPT</span><h3>Full conversation</h3></div><span>{transcriptTurns.length} turns</span></div>{transcriptTurns.length ? <TranscriptAudioList turns={transcriptTurns} variant="history" testId={result.id} /> : <p className="history-no-transcript">No transcript was captured for this session.</p>}</div></div>}{assessmentExpanded && <div className="history-assessment-detail">        <AssessmentView compact result={result} results={results} onPractice={() => onNavigate('Practice')} onOpenBandDescriptors={onOpenBandDescriptors} apiKey={apiKey} assessmentModel={assessmentModel} onAssessmentModelChange={onAssessmentModelChange} onReassess={onReassess} autoReassessRequestId={autoReassessRequest?.testId === result.id ? autoReassessRequest.requestId : ''} /></div>}</div>
      })}</div>
        : <Card className="history-empty history-filter-empty"><h2>No tests match these filters.</h2><p>Try a different search term, test part, or date filter.</p></Card>
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

function WordVaultPage({ username, entries, savedIds, pinnedIds, apiKey, onOpenFlashcards, onAdd, onUpdate, onTogglePin, onStartCoachLive }: { username: string; entries: LexicalEntry[]; savedIds: string[]; pinnedIds: string[]; apiKey: string; onOpenFlashcards: () => void; onAdd: (entry: LexicalEntry) => void; onUpdate: (entry: LexicalEntry) => void; onTogglePin: (id: string) => void; onStartCoachLive: (entry: LexicalEntry) => void }) {
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
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'needs-practice' | 'building' | 'strong'>('all')
  const [memoryNow, setMemoryNow] = useState(() => new Date())
  const flashcardProgress = useMemo(() => loadFlashcardProgress(username), [username])
  const progressById = useMemo(() => new Map(flashcardProgress.items.map((item) => [item.sourceId, item])), [flashcardProgress.items])
  const [newEntry, setNewEntry] = useState({ term: '', category: 'Word' as LexicalCategory, partOfSpeech: '', meaning: '', example: '', topic: '', meanings: '', examples: '', parts: [] as TestPart[] })
  useEffect(() => {
    const timer = window.setInterval(() => setMemoryNow(new Date()), 60000)
    return () => window.clearInterval(timer)
  }, [])
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
      const memory = vocabularyMemory(progressById.get(entry.id), memoryNow)
      if (memoryFilter === 'needs-practice' && !['new', 'weak'].includes(memory.level)) return false
      if (memoryFilter === 'building' && !['building', 'steady'].includes(memory.level)) return false
      if (memoryFilter === 'strong' && !['strong', 'mastered'].includes(memory.level)) return false
      if (!normalizedSearch) return true
      return [entry.term, entry.meaning, entry.example, entry.topic, entry.category, entry.partOfSpeech ?? '',
        ...(entry.meanings ?? []), ...(entry.examples ?? [])]
        .some((field) => field.toLocaleLowerCase().includes(normalizedSearch))
    })
  }, [category, entries, memoryFilter, memoryNow, pinnedIds, pinFilter, progressById, savedIds, savedOnly, search, topicFilter])

  const memoryCounts = useMemo(() => {
    const counts: Record<'needs-practice' | 'building' | 'strong', number> = { 'needs-practice': 0, building: 0, strong: 0 }
    for (const entry of entries) {
      const { level } = vocabularyMemory(progressById.get(entry.id), memoryNow)
      if (level === 'new' || level === 'weak') counts['needs-practice'] += 1
      else if (level === 'building' || level === 'steady') counts.building += 1
      else counts.strong += 1
    }
    return counts
  }, [entries, memoryNow, progressById])

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
      setEditError('That term is already in your Vocabulary Bank.')
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
      setFormError('That term is already in your Vocabulary Bank.')
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
    <PageHeading eyebrow="BUILD IELTS-READY LANGUAGE" title="Vocabulary Bank" description="Explore useful vocabulary, expressions, collocations and discourse markers—and collect language that sounds natural in your speaking." action={<div className="lexical-heading-actions"><Button variant="outline" onClick={onOpenFlashcards}><Layers3 size={15} /> Study with flashcards</Button><Button className="start-button" onClick={() => { setShowAddForm((current) => !current); setFormError('') }}>{showAddForm ? <X size={17} /> : <Plus size={17} />}{showAddForm ? 'Close form' : 'Add lexical resource'}</Button></div>} />
    <Card className="vault-summary"><div className="vault-summary-icon"><BookOpen size={21} /></div><div><span className="section-kicker">YOUR IELTS LANGUAGE BANK</span><strong>{entries.length} resources <small>across {lexicalCategories.length} categories</small></strong></div><div className="vault-summary-progress"><span>Saved for practice</span><div className="coach-progress"><span style={{ width: `${Math.min(100, savedIds.length / Math.max(entries.length, 1) * 100)}%` }} /></div><small>{savedIds.length} saved resources</small></div></Card>
    <section className="lexical-memory-overview" aria-label="FSRS vocabulary memory overview">
      <div><span className="lexical-memory-overview-mark"><Sparkles size={16} /></span><div><strong>Memory grows with every review</strong><small>Based on your FSRS recall ratings and estimated retrievability in Speakia Flashcards.</small></div></div>
      <div className="lexical-memory-overview-stats">
        <span className="memory-needs-practice"><i />Needs practice <strong>{memoryCounts['needs-practice']}</strong></span>
        <span className="memory-building"><i />Building <strong>{memoryCounts.building}</strong></span>
        <span className="memory-strong"><i />Strong <strong>{memoryCounts.strong}</strong></span>
      </div>
      {flashcardProgress.error && <p role="alert">Flashcard memory data could not be loaded: {flashcardProgress.error}</p>}
    </section>
    {showAddForm && <Card className="lexical-form-card"><div className="lexical-form-heading"><span className="vault-summary-icon"><Plus size={19} /></span><div><span className="section-kicker">PERSONAL VOCABULARY</span><h2>Add to your Vocabulary Bank</h2><p>Save a useful word, phrase, expression, collocation, or discourse marker.</p></div></div><form className="lexical-entry-form" onSubmit={handleAddEntry}>
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
    <div className="lexical-memory-filters" role="group" aria-label="Filter vocabulary by FSRS memory strength">
      {([
        { id: 'all', label: 'All memory', count: entries.length },
        { id: 'needs-practice', label: 'Needs practice', count: memoryCounts['needs-practice'] },
        { id: 'building', label: 'Building', count: memoryCounts.building },
        { id: 'strong', label: 'Strong memory', count: memoryCounts.strong },
      ] as const).map((filter) => <button key={filter.id} type="button" className={`lexical-memory-filter lexical-memory-filter-${filter.id} ${memoryFilter === filter.id ? 'is-active' : ''}`} aria-pressed={memoryFilter === filter.id} onClick={() => setMemoryFilter(filter.id)}><i />{filter.label}<span>{filter.count}</span></button>)}
    </div>
    <div className="lexical-category-bar" aria-label="Filter by resource type"><span><ListFilter size={15} /> FILTER BY TYPE</span><button className={`lexical-category ${category === 'All' ? 'lexical-category-active' : ''}`} onClick={() => setCategory('All')}>All <span>{entries.length}</span></button>{lexicalCategories.map((item) => <button key={item} className={`lexical-category ${category === item ? 'lexical-category-active' : ''}`} onClick={() => setCategory(item)}>{item} <span>{entries.filter((entry) => entry.category === item).length}</span></button>)}</div>
    <div className="lexical-results-heading"><div><h2>{savedOnly ? 'Saved resources' : category === 'All' ? 'IELTS speaking resources' : category + 's'}</h2><p>{filteredEntries.length} {filteredEntries.length === 1 ? 'resource' : 'resources'}{topicFilter !== 'All topics' && <> for {topicFilter}</>}{search && <> matching “{search}”</>}</p></div><span><Layers3 size={15} /> Context-first language</span></div>
    {filteredEntries.length
      ? <div className="word-grid">{filteredEntries.map((item) => {
        const memory = vocabularyMemory(progressById.get(item.id), memoryNow)
        const isPinned = pinnedIds.includes(`lexical:${item.id}`)
        return <Card className={`word-card lexical-word-card lexical-memory-${memory.level} ${isPinned ? 'lexical-word-card-pinned' : ''}`} key={item.id}>
          <div className="word-card-top"><Badge className="word-tag">{item.category}</Badge><div className="lexical-card-actions">
            <button className={`lexical-pin-card-button ${isPinned ? 'lexical-pin-card-active' : ''}`} aria-label={`${isPinned ? 'Unpin' : 'Pin'} ${item.term}`} title={`${isPinned ? 'Unpin' : 'Pin'} this resource`} aria-pressed={isPinned} onClick={() => onTogglePin(`lexical:${item.id}`)}><Pin size={15} fill={isPinned ? 'currentColor' : 'none'} /></button>
            <button className="lexical-edit-button" onClick={() => beginEditing(item)} aria-label={`Edit ${item.term}`}><Pencil size={15} /> Edit</button>
            <LexicalPronunciationButton term={item.term} apiKey={apiKey} />
            <button className="lexical-coach-button" aria-label={`Ask Speakia about ${item.term}`} title="Ask Speakia" onClick={() => onStartCoachLive(item)}><AudioLines size={15} /><span>Ask Speakia</span></button>
          </div></div>
        {editingId === item.id && draft
          ? <form className="lexical-inline-editor" onSubmit={saveEditedEntry}><label>Word or expression<input value={draft.term} onChange={(event) => setDraft({ ...draft, term: event.target.value })} required /></label><label>Part of speech<input value={draft.partOfSpeech ?? ''} onChange={(event) => setDraft({ ...draft, partOfSpeech: event.target.value })} /></label><label>Definitions <span>(one per line)</span><textarea rows={3} value={(draft.meanings ?? [draft.meaning]).join('\n')} onChange={(event) => setDraft({ ...draft, meanings: event.target.value.split('\n') })} required /></label><label>Example sentences <span>(one per line)</span><textarea rows={3} value={(draft.examples ?? [draft.example]).join('\n')} onChange={(event) => setDraft({ ...draft, examples: event.target.value.split('\n') })} required /></label><label>Vocabulary topic<input value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} /></label><fieldset className="lexical-part-field"><legend>Relevant test parts</legend>{parts.slice(1).map(({ value, label }) => <label key={value}><input type="checkbox" checked={(draft.parts ?? []).includes(value as TestPart)} onChange={(event) => setDraft({ ...draft, parts: event.target.checked ? [...draft.parts ?? [], value as TestPart] : (draft.parts ?? []).filter((part) => part !== value) })} />{label}</label>)}</fieldset>{editError && <p className="lexical-form-error" role="alert">{editError}</p>}<div className="lexical-form-actions"><Button type="button" variant="outline" onClick={() => { setEditingId(null); setDraft(null); setEditError('') }}>Cancel</Button><Button type="submit" className="start-button"><Save size={15} /> Save changes</Button></div></form>
          : <><div className="lexical-memory-indicator" title={`${memory.label}${memory.reviewed ? ` · estimated recall ${Math.round(memory.score * 100)}%` : ' · study with Flashcards to build recall'}`}><span className={`lexical-memory-status-dot memory-${memory.level}`} /><span>{memory.label}</span><div className="lexical-memory-meter" role="meter" aria-label={`${item.term} estimated memory strength`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(memory.score * 100)}><i style={{ width: `${memory.score * 100}%` }} /></div><small>{memory.reviewed ? `${Math.round(memory.score * 100)}%` : '—'}</small></div>
            <h2>{item.term} {item.partOfSpeech && <i>{item.partOfSpeech}</i>}</h2><div className="lexical-word-meta"><span>{item.topic}</span>{item.parts?.length ? item.parts.map((part) => <span key={part}>{part === 'full' ? 'Full test' : part.replace('part', 'Part ')}</span>) : <span>All parts</span>}{item.custom && <span className="lexical-custom-tag">Added by you</span>}</div><div className="lexical-card-content"><div><strong>DEFINITIONS</strong><ul>{(item.meanings?.length ? item.meanings : [item.meaning]).map((meaning, index) => <li key={`${meaning}-${index}`}>{meaning}</li>)}</ul></div><div><strong>EXAMPLE SENTENCES</strong><ul>{(item.examples?.length ? item.examples : [item.example]).map((example, index) => <li key={`${example}-${index}`}>“{example}”</li>)}</ul></div></div></>}
        </Card>
      })}</div>
      : <Card className="lexical-empty"><span className="evaluation-empty-icon"><Search size={22} /></span><h2>No matching resources</h2><p>Try another search, change the resource type or vocabulary topic, or adjust your memory filter.</p><Button variant="outline" onClick={() => { setSearch(''); setCategory('All'); setTopicFilter('All topics'); setSavedOnly(false); setPinFilter('all'); setMemoryFilter('all') }}>Clear filters</Button></Card>}
    <div className="tip-box lexical-tip"><Sparkles size={18} /><p><strong>Use language with precision</strong><br />Choose expressions that fit your meaning and speaking style. Natural, accurate use is more valuable than forcing advanced vocabulary into every answer.</p></div>
  </div>
}

export default App
