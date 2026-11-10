import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Modality, ThinkingLevel, type LiveServerMessage, type Session } from '@google/genai'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronDown,
  FileCheck2,
  HelpCircle,
  Lightbulb,
  LoaderCircle,
  ListFilter,
  Mic,
  MicOff,
  MessageCircle,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  Timer,
  Workflow,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaLiveModel } from '@/lib/geminiModels'
import {
  ASSISTANT_MODELS,
  DEFAULT_ASSISTANT_CHAT_MODEL,
  GEMINI_LIVE_VOICES,
  type AssistantModel,
  type GeminiLiveVoice,
} from '@/features/assistant/models'
import { reportGeminiQuota } from '@/lib/geminiQuota'
import { mergeTranscriptText } from '@/features/simulator/transcript'
import { ASSESSMENT_MODELS, type AssessmentModel } from '@/features/simulator/gemini'
import {
  DEFAULT_WRITIA_LIVE_VOICE,
  WRITIA_ASSESSMENT_MODEL_KEY,
  WRITIA_COACH_LANGUAGE_KEY,
  WRITIA_COACH_LANGUAGES,
  WRITIA_COACH_TEXT_MODEL_KEY,
  WRITIA_COACH_VOICE_KEY,
  WRITIA_REALTIME_SCAFFOLD_KEY,
  type WritiaCoachLanguage,
} from './preferences'
import type { WritaModuleId } from './navigation'
import { WritaAssignments, type WritingAssignment, type WritingAssignmentFeedback } from './WritaAssignments'
import type { UserProfile } from '@/features/profile/localAccount'
import type { TestResult } from '@/features/simulator/types'
import type { WritiaLearnerContext } from './learnerContext'
import { WritaTask1ImageBuilder } from './WritaTask1ImageBuilder'
import { WritaWritingDrills } from './WritaWritingDrills'
import { WritaAdaptiveAssessmentLesson } from './WritaAdaptiveAssessmentLesson'
import { BandDescriptorsPage } from '@/features/bandDescriptors/BandDescriptorsPage'
import { PlacementAssessmentPage } from '@/features/placement/PlacementAssessmentPage'
import type { PlacementAssessment } from '@/features/placement/types'
import { isTaskVisualSpec, loadVisualTaskImage, loadVisualTaskRecords, saveVisualTaskRecord, visualImageToBase64, WritaTaskVisual, type TaskVisualSpec, type VisualTaskRecord } from './taskVisuals'

const WritiaFlashcardsPage = lazy(() => import('@/features/flashcards/FlashcardsPage').then((module) => ({ default: module.FlashcardsPage })))
const PodcastsPage = lazy(() => import('@/features/podcasts/PodcastsPage').then((module) => ({ default: module.PodcastsPage })))
const CoachAssetsPage = lazy(() => import('@/features/assistant/CoachAssetsPage').then((module) => ({ default: module.CoachAssetsPage })))

export type { WritaModuleId } from './navigation'
type WritingMode = 'guided' | 'exam'
type CriterionId = 'task' | 'coherence' | 'lexical' | 'grammar'
type CriterionResult = { id: CriterionId; label: string; band: number; evidence: string; nextStep: string }
type CoachMessage = { id: string; role: 'learner' | 'coach'; text: string }
type ScaffoldKind = 'task' | 'ideas' | 'outline' | 'vocabulary' | 'sentence' | 'cohesion'
type ScaffoldCard = { id: string; kind: ScaffoldKind; title: string; reason: string; support: string; example: string; tryNext: string }
type ScaffoldRequest = (kind: ScaffoldKind | 'adaptive', snapshot?: string, automatic?: boolean, coachRequest?: string) => Promise<void>
type Assessment = {
  id: string
  taskId: string
  taskLabel: string
  mode?: WritingMode
  overallBand: number
  criteria: CriterionResult[]
  summary: string
  priority: string
  wordCount: number
  createdAt: number
  response?: string
  taskPrompt?: string
  assessmentLessonStatus?: 'generating' | 'ready' | 'failed'
}
type WritingVocab = { id: string; term: string; meaning: string; example: string; topic: string; category: string }
type SavedWriting = { drafts: Record<string, string>; assessments: Assessment[]; customTasks: WritingTask[]; customVocabulary: WritingVocab[]; assignments: WritingAssignment[]; taskVisuals: Record<string, TaskVisualSpec> }
type WritingTask = { id: string; type: string; label: string; prompt: string; minimumWords: number }

const moduleHeroContent: Record<WritaModuleId, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'YOUR WRITING PLAN',
    title: 'A clearer next step for every study session.',
    description: 'Bring your goals, writing evidence, and recommended practice together in one adaptive workspace.',
  },
  studio: {
    eyebrow: 'WRITE · REVIEW · IMPROVE',
    title: 'Build your response, one deliberate move at a time.',
    description: 'Practise independently under exam timing or work with live coaching, task visuals, and focused feedback.',
  },
  guided: {
    eyebrow: 'SCAFFOLDED WRITING PRACTICE',
    title: 'Move from understanding the task to writing independently.',
    description: 'Work through a sequence of planning, drafting, and revision stages with support that keeps the writing yours.',
  },
  drills: {
    eyebrow: 'FOCUSED SKILL-BUILDING',
    title: 'Practise the writing moves that make the difference.',
    description: 'Build accuracy and control through short, targeted exercises, responsive feedback, and live coach support.',
  },
  assignments: {
    eyebrow: 'PERSONALISED WRITING PLAN',
    title: 'Turn your learning priorities into purposeful practice.',
    description: 'Complete focused writing tasks, submit your work, and use evidence-based feedback to shape your next step.',
  },
  'writing-bank': {
    eyebrow: 'TOPICS & VOCABULARY STUDIO',
    title: 'Find the task. Develop the language. Apply it.',
    description: 'Explore IELTS prompts, build a writing vocabulary bank, create your own resources, and practise precise upgrades.',
  },
  flashcards: {
    eyebrow: 'SPACED VOCABULARY PRACTICE',
    title: 'Make useful writing vocabulary stick.',
    description: 'Use active recall and adaptive review scheduling to strengthen the words and phrases you need for writing.',
  },
  podcasts: {
    eyebrow: 'PERSONALISED AUDIO LEARNING',
    title: 'Learn writing strategy through guided listening.',
    description: 'Listen to tailored lessons and podcast conversations shaped around your writing goals and recent practice.',
  },
  'coach-assets': {
    eyebrow: 'YOUR WRITIA ASSISTANT LIBRARY',
    title: 'Return to the learning tools your coach created.',
    description: 'Revisit your writing lessons, flashcards, slide decks, quizzes, and audio lessons—saved from your Writia Assistant conversations.',
  },
  assessment: {
    eyebrow: 'WRITING PERFORMANCE HISTORY',
    title: 'Understand your evidence and decide what to improve.',
    description: 'Review criterion-level practice estimates, track recurring strengths and needs, and open adaptive lessons for your work.',
  },
  resources: {
    eyebrow: 'JUST-IN-TIME LEARNING',
    title: 'Learn a writing skill you can use right away.',
    description: 'Explore concise, practical lessons and carry each technique straight into your current writing task.',
  },
  progress: {
    eyebrow: 'YOUR WRITIA LEARNER PROFILE',
    title: 'See how your writing is developing over time.',
    description: 'Connect your goals and placement baseline with assessment trends, demonstrated strengths, and your next practice priority.',
  },
  'band-descriptors': {
    eyebrow: 'IELTS WRITING ASSESSMENT GUIDE',
    title: 'Know what each writing band asks you to demonstrate.',
    description: 'Explore the four criteria, compare adjacent bands, and use clear explanations to interpret practice feedback.',
  },
  'placement-assessment': {
    eyebrow: 'OPTIONAL WRITING BASELINE',
    title: 'Find the right place to begin your writing practice.',
    description: 'Complete a short baseline to estimate your starting point and help Writia focus your first learning steps.',
  },
}

const tasks: WritingTask[] = [
  {
    id: 'task2-technology', type: 'IELTS Academic & General Training · Task 2', label: 'Technology and social connection', minimumWords: 250,
    prompt: 'Some people believe that technology has made people less socially active. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.',
  },
  {
    id: 'task2-education', type: 'IELTS Academic & General Training · Task 2', label: 'University education', minimumWords: 250,
    prompt: 'Some people think that university education should be free for everyone. Others believe students should pay for their own studies. Discuss both views and give your own opinion.',
  },
  {
    id: 'task2-environment', type: 'IELTS Academic & General Training · Task 2', label: 'Individual action and the environment', minimumWords: 250,
    prompt: 'Some people think individuals can do little to improve the environment, while others believe individual action can make a significant difference. Discuss both views and give your opinion.',
  },
  {
    id: 'task2-work', type: 'IELTS Academic & General Training · Task 2', label: 'Remote work and modern life', minimumWords: 250,
    prompt: 'More employees are now able to work from home rather than travel to a workplace every day. Do the advantages of this development outweigh the disadvantages?',
  },
  {
    id: 'task2-public-transport', type: 'IELTS Academic & General Training · Task 2', label: 'Public transport investment', minimumWords: 250,
    prompt: 'Governments should invest more in public transport than in building new roads. To what extent do you agree or disagree?',
  },
  {
    id: 'task2-children', type: 'IELTS Academic & General Training · Task 2', label: 'Children and screen time', minimumWords: 250,
    prompt: 'Some people believe that children should have limited access to digital devices, while others think these devices help children learn. Discuss both views and give your opinion.',
  },
  {
    id: 'task2-cities', type: 'IELTS Academic & General Training · Task 2', label: 'Life in large cities', minimumWords: 250,
    prompt: 'As cities grow, more people experience problems such as congestion and a lack of affordable housing. What problems does this cause, and what measures could governments and individuals take to address them?',
  },
  {
    id: 'task2-heritage', type: 'IELTS Academic & General Training · Task 2', label: 'Protecting historic buildings', minimumWords: 250,
    prompt: 'Some people think old buildings should be protected even when they could be replaced by modern developments. To what extent do you agree or disagree?',
  },
  {
    id: 'task2-health', type: 'IELTS Academic & General Training · Task 2', label: 'Public health and personal choice', minimumWords: 250,
    prompt: 'Some people think governments should be responsible for improving public health, while others believe individuals should take responsibility for their own health. Discuss both views and give your opinion.',
  },
  {
    id: 'task2-tourism', type: 'IELTS Academic & General Training · Task 2', label: 'Tourism and local communities', minimumWords: 250,
    prompt: 'International tourism can bring economic benefits to a country, but it can also affect local communities and the environment. Do the advantages of tourism outweigh the disadvantages?',
  },
  {
    id: 'task1-academic', type: 'IELTS Academic · Task 1', label: 'Household energy use', minimumWords: 150,
    prompt: 'The table shows the percentage of household energy used for heating, hot water and appliances in three countries. Country A: heating 52%, hot water 24%, appliances 24%. Country B: heating 38%, hot water 31%, appliances 31%. Country C: heating 61%, hot water 19%, appliances 20%. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  },
  {
    id: 'task1-academic-line', type: 'IELTS Academic · Task 1', label: 'City cycling levels', minimumWords: 150,
    prompt: 'The line graph shows the percentage of commuters cycling to work in three cities between 2010 and 2020. City A: 12%, 14%, 18%, 23%, 29% in 2010, 2012, 2015, 2018 and 2020 respectively. City B: 20%, 19%, 18%, 17%, 16%. City C: 8%, 11%, 15%, 19%, 24%. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  },
  {
    id: 'task1-academic-bar', type: 'IELTS Academic · Task 1', label: 'Museum visitors by season', minimumWords: 150,
    prompt: 'The bar chart shows the number of visitors (in thousands) to three museums in winter and summer. Museum A: 35 in winter and 70 in summer; Museum B: 55 in winter and 60 in summer; Museum C: 25 in winter and 50 in summer. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  },
  {
    id: 'task1-academic-pie', type: 'IELTS Academic · Task 1', label: 'Household spending', minimumWords: 150,
    prompt: 'The pie charts compare how households in Country X allocated their monthly spending in 2000 and 2020. In 2000: housing 30%, food 25%, transport 15%, leisure 12%, utilities 10%, other 8%. In 2020: housing 35%, food 18%, transport 20%, leisure 14%, utilities 7%, other 6%. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  },
  {
    id: 'task1-academic-table', type: 'IELTS Academic · Task 1', label: 'Regional water use', minimumWords: 150,
    prompt: 'The table shows average daily water use per person, in litres, in three regions in 2005 and 2025. North: 180 and 150; Central: 210 and 190; South: 160 and 175. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  },
  {
    id: 'task1-academic-process', type: 'IELTS Academic · Task 1', label: 'Recycling plastic bottles', minimumWords: 150,
    prompt: 'The diagram shows how plastic bottles are recycled. Used bottles are placed in collection bins, transported to a sorting centre, separated by type, compressed into blocks, crushed into small pieces, washed, melted into raw material, and manufactured into new products. Summarise the information by selecting and reporting the main features.',
  },
  {
    id: 'task1-academic-map', type: 'IELTS Academic · Task 1', label: 'Riverside park redevelopment', minimumWords: 150,
    prompt: 'The maps show a riverside park before and after redevelopment. Previously, the northern entrance led to a central path, with a large lawn in the west, a pond in the east, and a small car park in the southeast. Afterwards, the lawn became a playground and café, the pond was retained, a cycle path was added along the river, and the car park was expanded; a second entrance was added in the south. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  },
  {
    id: 'task1-academic-combination', type: 'IELTS Academic · Task 1', label: 'Electricity generation and sources', minimumWords: 150,
    prompt: 'The table shows total electricity generation in a country and the share from renewable sources in 2010 and 2020. Total generation rose from 240 to 310 billion kWh. The renewable share increased from 18% to 34%; coal fell from 48% to 30%, gas changed from 27% to 25%, and nuclear power changed from 7% to 11%. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
  },
  {
    id: 'task1-general', type: 'IELTS General Training · Task 1', label: 'Letter about a local facility', minimumWords: 150,
    prompt: 'You recently visited a local sports centre and were unhappy with some of its facilities. Write a letter to the manager. In your letter, describe what you were unhappy about, explain how this affected your visit, and say what you would like the manager to do.',
  },
  {
    id: 'task1-general-advice', type: 'IELTS General Training · Task 1', label: 'Advice for a new neighbour', minimumWords: 150,
    prompt: 'A new neighbour has recently moved into your area and has asked you about local activities. Write a letter to your neighbour. In your letter, describe an activity they might enjoy, explain how they can take part, and invite them to join you.',
  },
  {
    id: 'task1-general-work', type: 'IELTS General Training · Task 1', label: 'Requesting a change to work hours', minimumWords: 150,
    prompt: 'You would like to change your working hours for a period of time. Write a letter to your manager. In your letter, explain why you need the change, describe the hours you would prefer, and say how you will ensure your work is completed.',
  },
  {
    id: 'task1-general-complaint', type: 'IELTS General Training · Task 1', label: 'Complaint about a delayed delivery', minimumWords: 150,
    prompt: 'An item you ordered online arrived much later than expected and was damaged. Write a letter to the company. In your letter, describe the order and the problem, explain how it affected you, and state what action you would like the company to take.',
  },
  {
    id: 'task1-general-invitation', type: 'IELTS General Training · Task 1', label: 'Inviting a friend to visit', minimumWords: 150,
    prompt: 'A friend from another town is planning to visit you. Write a letter to your friend. In your letter, suggest a suitable time to visit, describe some places you could go together, and explain what arrangements you can make.',
  },
]

const starterWritingVocabulary: WritingVocab[] = [
  { id: 'increase-significantly', term: 'increase significantly', meaning: 'To rise by a large or important amount.', example: 'The proportion of commuters using bicycles increased significantly over the period.', topic: 'Task 1 trends', category: 'Trend language' },
  { id: 'remain-relatively-stable', term: 'remain relatively stable', meaning: 'To stay at approximately the same level.', example: 'Water consumption remained relatively stable between 2015 and 2020.', topic: 'Task 1 trends', category: 'Trend language' },
  { id: 'peak-at', term: 'peak at', meaning: 'To reach the highest point or value.', example: 'Visitor numbers peaked at 72,000 in July.', topic: 'Task 1 trends', category: 'Trend language' },
  { id: 'approximately-twice', term: 'approximately twice as high as', meaning: 'A comparison showing one figure is close to double another.', example: 'Spending on housing was approximately twice as high as spending on transport.', topic: 'Task 1 comparisons', category: 'Comparison' },
  { id: 'account-for', term: 'account for', meaning: 'To represent a proportion or share of a total.', example: 'Renewable sources accounted for just over one third of electricity generation.', topic: 'Task 1 data', category: 'Data description' },
  { id: 'overall-pattern', term: 'overall pattern', meaning: 'The main direction or shape of the information as a whole.', example: 'Overall, the data show an upward pattern in all three regions.', topic: 'Task 1 overview', category: 'Overview language' },
  { id: 'whereas', term: 'whereas', meaning: 'Used to show a clear contrast between two facts.', example: 'The figure for the north declined, whereas the southern region recorded a modest rise.', topic: 'Task 1 comparisons', category: 'Cohesion' },
  { id: 'undergo-gradual', term: 'undergo a gradual decline', meaning: 'To decrease slowly over time.', example: 'The share of coal-fired power underwent a gradual decline across the decade.', topic: 'Task 1 trends', category: 'Trend language' },
  { id: 'widely-debated', term: 'a widely debated issue', meaning: 'A subject that many people discuss and disagree about.', example: 'Whether university education should be publicly funded is a widely debated issue.', topic: 'Task 2 education', category: 'Academic collocation' },
  { id: 'compelling-reason', term: 'a compelling reason', meaning: 'A strong and convincing reason.', example: 'A compelling reason to expand public transport is that it can reduce urban congestion.', topic: 'Task 2 arguments', category: 'Academic collocation' },
  { id: 'long-term-implications', term: 'long-term implications', meaning: 'The effects or consequences that may appear over an extended period.', example: 'Policymakers should consider the long-term implications of relying on private cars.', topic: 'Task 2 arguments', category: 'Academic collocation' },
  { id: 'address-underlying', term: 'address the underlying cause', meaning: 'To deal with the fundamental reason a problem exists.', example: 'Affordable housing policies can address the underlying causes of overcrowding.', topic: 'Task 2 problem and solution', category: 'Problem and solution' },
  { id: 'balanced-perspective', term: 'take a balanced perspective', meaning: 'To consider relevant sides of an issue fairly before reaching a view.', example: 'A balanced perspective recognises both the convenience and the social costs of remote work.', topic: 'Task 2 discussion', category: 'Argument structure' },
  { id: 'plays-pivotal-role', term: 'play a pivotal role in', meaning: 'To have a central or particularly important effect.', example: 'Reliable public transport plays a pivotal role in making cities more accessible.', topic: 'Task 2 society', category: 'Academic collocation' },
  { id: 'from-this-perspective', term: 'from this perspective', meaning: 'A linking phrase that signals the viewpoint being considered.', example: 'From this perspective, investment in libraries benefits residents of every age.', topic: 'Task 2 cohesion', category: 'Discourse marker' },
  { id: 'formal-request', term: 'I would be grateful if you could', meaning: 'A polite formal phrase for making a request in a letter.', example: 'I would be grateful if you could arrange for the damaged item to be replaced.', topic: 'General Training letters', category: 'Formal letter' },
  { id: 'letter-apology', term: 'Please accept my apologies for', meaning: 'A polite formal expression used to apologise in a letter.', example: 'Please accept my apologies for the short notice regarding the change of date.', topic: 'General Training letters', category: 'Formal letter' },
  { id: 'letter-follow-up', term: 'I am writing to follow up on', meaning: 'A formal phrase for referring to an earlier message or matter.', example: 'I am writing to follow up on my request for information about the course.', topic: 'General Training letters', category: 'Formal letter' },
]

const writingVocabularyComparisons: Record<string, { everyday: string; note: string }> = {
  'increase-significantly': { everyday: 'go up a lot', note: 'Use only when the figures support a substantial increase.' },
  'remain-relatively-stable': { everyday: 'stay the same', note: 'Useful when a value changes very little, rather than remaining exactly identical.' },
  'peak-at': { everyday: 'be the highest', note: 'Names the point at which a value reaches its maximum.' },
  'approximately-twice': { everyday: 'be a lot more than', note: 'Use only when the data show a value close to double the comparison.' },
  'account-for': { everyday: 'be part of', note: 'Best for describing a component as a share of a stated total.' },
  'overall-pattern': { everyday: 'what happens in general', note: 'Helps introduce the main trend across the information, not a minor detail.' },
  whereas: { everyday: 'but', note: 'Connects two contrasting facts within the same sentence.' },
  'undergo-gradual': { everyday: 'go down slowly', note: 'A formal, concise description of a slow downward trend.' },
  'widely-debated': { everyday: 'something people argue about', note: 'A concise academic collocation for a topic with substantial public discussion.' },
  'compelling-reason': { everyday: 'a very good reason', note: 'Signals a persuasive reason; make sure your explanation supports that strength.' },
  'long-term-implications': { everyday: 'effects in the future', note: 'Useful for consequences that may develop over an extended period.' },
  'address-underlying': { everyday: 'fix the problem', note: 'Emphasises dealing with the root cause, not only its visible effects.' },
  'balanced-perspective': { everyday: 'look at both sides', note: 'Use when your discussion genuinely considers relevant perspectives fairly.' },
  'plays-pivotal-role': { everyday: 'is very important', note: 'A formal alternative when something has a central influence; avoid overstating its importance.' },
  'from-this-perspective': { everyday: 'looking at it this way', note: 'Signals a viewpoint clearly; use it only when the sentence develops that perspective.' },
  'formal-request': { everyday: 'please can you', note: 'A suitably polite, formal request for a letter to an organisation or manager.' },
  'letter-apology': { everyday: 'sorry for', note: 'A more formal apology suited to a letter; keep the reason clear and specific.' },
  'letter-follow-up': { everyday: 'I am asking again about', note: 'A concise formal way to refer back to a previous message or request.' },
}

const criteria: Array<{ id: CriterionId; label: string; shortLabel: string }> = [
  { id: 'task', label: 'Task Achievement / Response', shortLabel: 'Task response' },
  { id: 'coherence', label: 'Coherence and Cohesion', shortLabel: 'Coherence' },
  { id: 'lexical', label: 'Lexical Resource', shortLabel: 'Vocabulary' },
  { id: 'grammar', label: 'Grammatical Range and Accuracy', shortLabel: 'Grammar' },
]

const guidedStages = [
  { title: 'Decode the task', detail: 'Identify the instruction, topic boundaries, and every part you need to address.', prompt: 'Help me decode this IELTS Writing prompt. Ask me to identify the instruction words and task requirements before giving me a hint.' },
  { title: 'Explore ideas', detail: 'Generate possible positions and reasons, then choose ideas you can explain with confidence.', prompt: 'Guide me through brainstorming for this prompt. Ask what I think first, then scaffold my ideas without writing them for me.' },
  { title: 'Build an outline', detail: 'Give each paragraph a clear purpose and connect it to your position.', prompt: 'Help me create a flexible outline. Elicit my thesis and paragraph points one at a time; do not write a complete essay.' },
  { title: 'Draft with purpose', detail: 'Develop one idea at a time with explanation, support, and a clear link to the task.', prompt: 'Coach me as I draft. Focus on the paragraph I am writing and ask one useful question at a time.' },
  { title: 'Revise and transfer', detail: 'Use evidence from your draft to choose one revision, then apply the skill in a new sentence.', prompt: 'Help me revise my draft and choose one transferable skill to practise next. Do not silently rewrite my work.' },
]

const justInTimeHelps: Array<{ kind: ScaffoldKind; label: string; icon: typeof Lightbulb }> = [
  { kind: 'task', label: 'Understand task', icon: HelpCircle },
  { kind: 'ideas', label: 'Find ideas', icon: Lightbulb },
  { kind: 'outline', label: 'Plan outline', icon: Workflow },
  { kind: 'vocabulary', label: 'Useful vocabulary', icon: BookOpen },
  { kind: 'sentence', label: 'Build a sentence', icon: PenLine },
  { kind: 'cohesion', label: 'Connect ideas', icon: Workflow },
]

const resources = [
  { title: 'Understand the task', category: 'Task analysis', detail: 'Underline the command words, count the separate requirements, and turn each requirement into a checklist. For Task 2, make your position explicit and sustain it throughout.' },
  { title: 'Build a body paragraph', category: 'Paragraph craft', detail: 'Start with one controlling idea. Explain why it is true, add a relevant example or consequence, then connect it back to the question. Every sentence should advance the same point.' },
  { title: 'Write an Academic overview', category: 'Task 1', detail: 'Select the most important overall patterns before describing detail. Compare major highs, lows, changes, or stages; do not list every number or add an unsupported explanation.' },
  { title: 'Choose precise vocabulary', category: 'Lexical resource', detail: 'Prefer accurate, natural collocations over rare words used for display. Check whether each word expresses the intended meaning and fits the formality of the task.' },
]

function readCoachLanguage(): WritiaCoachLanguage {
  try {
    const saved = localStorage.getItem(WRITIA_COACH_LANGUAGE_KEY)
    return WRITIA_COACH_LANGUAGES.find((language) => language === saved) ?? 'English'
  } catch (error) {
    console.error('Unable to load Writia coach language.', error)
    return 'English'
  }
}

function readWritingAssessmentModel(): AssessmentModel {
  try {
    const saved = localStorage.getItem(WRITIA_ASSESSMENT_MODEL_KEY)
    return ASSESSMENT_MODELS.find((model) => model.id === saved)?.id ?? 'gemini-3.8-flash'
  } catch (error) {
    console.error('Unable to load Writia assessment preference.', error)
    return 'gemini-3.8-flash'
  }
}

function readWritingCoachTextModel(): AssistantModel {
  try {
    const saved = localStorage.getItem(WRITIA_COACH_TEXT_MODEL_KEY)
    return ASSISTANT_MODELS.find((model) => model.id === saved)?.id ?? DEFAULT_ASSISTANT_CHAT_MODEL
  } catch (error) {
    console.error('Unable to load Writia text model preference.', error)
    return DEFAULT_ASSISTANT_CHAT_MODEL
  }
}

function readCoachVoice(): GeminiLiveVoice {
  try {
    const saved = localStorage.getItem(WRITIA_COACH_VOICE_KEY)
    return GEMINI_LIVE_VOICES.find((voice) => voice.id === saved)?.id ?? DEFAULT_WRITIA_LIVE_VOICE
  } catch (error) {
    console.error('Unable to load Writia live voice.', error)
    return DEFAULT_WRITIA_LIVE_VOICE
  }
}

function readRealtimeScaffoldMode(): boolean {
  try {
    return localStorage.getItem(WRITIA_REALTIME_SCAFFOLD_KEY) === 'true'
  } catch (error) {
    console.error('Unable to load Writia real-time scaffold preference.', error)
    return false
  }
}

function coachLanguageInstruction(language: WritiaCoachLanguage): string {
  if (language === 'Urdu') return 'Speak and explain in natural Pakistani Urdu, using Pakistani Urdu vocabulary and pronunciation, never Hindi. Keep IELTS writing examples and target English sentences in English. Use Urdu Perso-Arabic script when displaying Urdu.'
  if (language === 'Pakistani Punjabi') return 'Speak and explain in natural Pakistani Punjabi, using Pakistani Punjabi vocabulary and pronunciation, never Indian Punjabi. Keep IELTS writing examples and target English sentences in English. Use Shahmukhi when displaying Punjabi.'
  if (language === 'Mixed Code') return 'Naturally code-switch between English, Pakistani Urdu, and Pakistani Punjabi to make explanations clear. Use Pakistani vocabulary and pronunciation, never Hindi or Indian Punjabi. Keep IELTS writing examples and target English sentences in English; use Urdu Perso-Arabic script for Urdu and Shahmukhi for Punjabi when displaying them.'
  return 'Speak and explain in clear, supportive English. Keep IELTS writing examples and target sentences in English.'
}

function readSavedWriting(username: string): SavedWriting {
  try {
    const raw = localStorage.getItem(`writa-writing-v1:${username}`)
    if (!raw) return { drafts: {}, assessments: [], customTasks: [], customVocabulary: [], assignments: [], taskVisuals: {} }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { drafts: {}, assessments: [], customTasks: [], customVocabulary: [], assignments: [], taskVisuals: {} }
    const record = parsed as Record<string, unknown>
    const drafts = typeof record.drafts === 'object' && record.drafts !== null && !Array.isArray(record.drafts)
      ? Object.fromEntries(Object.entries(record.drafts).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
      : {}
    const assessments = Array.isArray(record.assessments) ? record.assessments.filter(isAssessment) : []
    const customTasks = Array.isArray(record.customTasks) ? record.customTasks.filter(isWritingTask) : []
    const customVocabulary = Array.isArray(record.customVocabulary) ? record.customVocabulary.filter(isWritingVocab) : []
    const assignments = Array.isArray(record.assignments) ? record.assignments.filter(isWritingAssignment) : []
    const taskVisuals = typeof record.taskVisuals === 'object' && record.taskVisuals !== null && !Array.isArray(record.taskVisuals)
      ? Object.fromEntries(Object.entries(record.taskVisuals).filter((entry): entry is [string, TaskVisualSpec] => isTaskVisualSpec(entry[1])))
      : {}
    return { drafts, assessments, customTasks, customVocabulary, assignments, taskVisuals }
  } catch (error) {
    console.error('Unable to load Writia writing history.', error)
    return { drafts: {}, assessments: [], customTasks: [], customVocabulary: [], assignments: [], taskVisuals: {} }
  }
}

function parseGeneratedTaskVisual(text: string): TaskVisualSpec {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    console.error('Writia returned invalid Task 1 visual JSON.', error)
    throw new Error('Writia could not read the generated Task 1 visual. Please try again.')
  }
  if (!isTaskVisualSpec(value) || value.kind === 'uploaded') {
    throw new Error('Writia returned an incomplete Task 1 visual. Please try again.')
  }
  return value
}

function tableTaskVisualSvg(visual: TaskVisualSpec): Blob {
  const columns = visual.columns ?? []
  const rows = visual.rows ?? []
  const tableWidth = 1160
  const cellWidth = tableWidth / columns.length
  const horizontalPadding = 14
  const fontSize = 18
  const maxCharacters = Math.max(8, Math.floor((cellWidth - horizontalPadding * 2) / (fontSize * 0.56)))
  const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character)
  const wrapCell = (value: string) => {
    const lines: string[] = []
    let line = ''
    for (const word of value.split(/\s+/)) {
      const fragments = word.match(new RegExp(`.{1,${maxCharacters}}`, 'g')) ?? ['']
      for (const fragment of fragments) {
        const nextLine = line ? `${line} ${fragment}` : fragment
        if (nextLine.length > maxCharacters && line) {
          lines.push(line)
          line = fragment
        } else {
          line = nextLine
        }
      }
    }
    if (line) lines.push(line)
    return lines
  }
  const tableRows = [columns, ...rows]
  const rowHeights = tableRows.map((row) => Math.max(70, ...row.map((cell) => wrapCell(cell).length * 26 + 28)))
  const headerHeight = 96
  const tableTop = headerHeight
  const captionHeight = visual.caption ? 66 : 24
  const tableHeight = rowHeights.reduce((total, height) => total + height, 0)
  let currentY = tableTop
  const renderedRows = tableRows.map((row, rowIndex) => {
    const height = rowHeights[rowIndex]
    const rowMarkup = row.map((cell, cellIndex) => {
      const x = cellIndex * cellWidth
      const lines = wrapCell(cell)
      const text = lines.map((line, lineIndex) => `<tspan x="${x + horizontalPadding}" dy="${lineIndex === 0 ? 0 : 24}">${escapeXml(line)}</tspan>`).join('')
      return `<rect x="${x}" y="${currentY}" width="${cellWidth}" height="${height}" fill="${rowIndex === 0 ? '#eeedf5' : rowIndex % 2 ? '#ffffff' : '#f8f7fb'}" stroke="#d7d4e2" stroke-width="2"/><text x="${x + horizontalPadding}" y="${currentY + 36}" fill="#38364b" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${rowIndex === 0 ? 700 : 400}">${text}</text>`
    }).join('')
    currentY += height
    return rowMarkup
  }).join('')
  const captionY = tableTop + tableHeight + 40
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${tableTop + tableHeight + captionHeight}" viewBox="0 0 1200 ${tableTop + tableHeight + captionHeight}"><rect width="100%" height="100%" fill="#ffffff"/><text x="20" y="52" fill="#39364e" font-family="Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(visual.title)}</text>${renderedRows}${visual.caption ? `<text x="20" y="${captionY}" fill="#5f5c70" font-family="Arial, sans-serif" font-size="17">${escapeXml(visual.caption)}</text>` : ''}</svg>`
  return new Blob([svg], { type: 'image/svg+xml' })
}

async function taskVisualForLiveCoach(username: string, task: WritingTask, visual: TaskVisualSpec): Promise<string> {
  let sourceImage: Blob
  if (visual.kind === 'uploaded') {
    const savedImage = await loadVisualTaskImage(username, visual.sourceImageId ?? task.id)
    if (!savedImage) throw new Error('The saved Task 1 image is unavailable, so Writia Coach cannot inspect the visual.')
    sourceImage = savedImage
  } else if (visual.kind === 'table') {
    sourceImage = tableTaskVisualSvg(visual)
  } else {
    const findTaskSvg = () => {
      const figure = Array.from(document.querySelectorAll<HTMLElement>('.writa-task-visual'))
        .find((element) => element.dataset.taskVisualTaskId === task.id)
      return figure?.querySelector('svg') ?? null
    }
    let svg = findTaskSvg()
    const renderDeadline = performance.now() + 1500
    while (!svg && performance.now() < renderDeadline) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      svg = findTaskSvg()
    }
    if (!svg) throw new Error('The Task 1 visual is not ready to share with Writia Coach. Wait for it to appear and reconnect.')
    const bounds = svg.getBoundingClientRect()
    const viewBox = svg.viewBox.baseVal
    const width = bounds.width || viewBox.width
    const height = bounds.height || viewBox.height
    if (!width || !height) throw new Error('The Task 1 visual has no visible size to share with Writia Coach.')

    const clonedSvg = svg.cloneNode(true) as SVGSVGElement
    const sourceElements: SVGElement[] = [svg, ...Array.from(svg.querySelectorAll<SVGElement>('*'))]
    const clonedElements: SVGElement[] = [clonedSvg, ...Array.from(clonedSvg.querySelectorAll<SVGElement>('*'))]
    const inlineProperties = ['display', 'visibility', 'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'color']
    sourceElements.forEach((element, index) => {
      const computed = window.getComputedStyle(element)
      for (const property of inlineProperties) {
        const value = computed.getPropertyValue(property)
        if (value) clonedElements[index].style.setProperty(property, value)
      }
    })
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clonedSvg.setAttribute('width', String(Math.ceil(width * 2)))
    clonedSvg.setAttribute('height', String(Math.ceil(height * 2)))
    sourceImage = new Blob([new XMLSerializer().serializeToString(clonedSvg)], { type: 'image/svg+xml' })
  }

  const objectUrl = URL.createObjectURL(sourceImage)
  let drawable: CanvasImageSource | null = null
  let width = 0
  let height = 0
  let bitmap: ImageBitmap | null = null
  try {
    try {
      const image = new Image()
      drawable = await new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('The saved Task 1 image could not be decoded by the browser.'))
        image.src = objectUrl
      })
      width = image.naturalWidth
      height = image.naturalHeight
    } catch (imageError) {
      try {
        bitmap = await createImageBitmap(sourceImage)
        drawable = bitmap
        width = bitmap.width
        height = bitmap.height
      } catch (bitmapError) {
        console.error('Both browser image decoders failed for the Writia Task 1 visual.', { imageError, bitmapError })
        throw new Error('Writia could not decode the saved Task 1 image. Re-upload it as a PNG, JPEG, or WebP image.')
      }
    }
    if (!drawable || !width || !height) {
      throw new Error('Writia could not decode the saved Task 1 image. Re-upload it as a PNG, JPEG, or WebP image.')
    }
    const scale = Math.min(1, 2048 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Writia could not prepare the Task 1 visual for its live session.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(drawable, 0, 0, canvas.width, canvas.height)
    const jpeg = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Writia could not encode the Task 1 visual for its live session.'))
      }, 'image/jpeg', 0.9)
    })
    return await visualImageToBase64(jpeg)
  } finally {
    URL.revokeObjectURL(objectUrl)
    bitmap?.close()
  }
}

function isWritingTask(value: unknown): value is WritingTask {
  if (typeof value !== 'object' || value === null) return false
  const task = value as Record<string, unknown>
  return typeof task.id === 'string' && task.id.startsWith('custom-')
    && typeof task.type === 'string' && typeof task.label === 'string'
    && typeof task.prompt === 'string' && typeof task.minimumWords === 'number'
    && (task.minimumWords === 150 || task.minimumWords === 250)
}

function isWritingVocab(value: unknown): value is WritingVocab {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.term === 'string'
    && typeof item.meaning === 'string' && typeof item.example === 'string'
    && typeof item.topic === 'string' && typeof item.category === 'string'
}

function isAssessment(value: unknown): value is Assessment {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.taskId === 'string'
    && typeof record.taskLabel === 'string' && typeof record.overallBand === 'number'
    && (record.mode === undefined || record.mode === 'exam' || record.mode === 'guided')
    && Array.isArray(record.criteria) && typeof record.summary === 'string'
    && typeof record.priority === 'string' && typeof record.wordCount === 'number'
    && (record.response === undefined || typeof record.response === 'string' && record.response.length <= 5000)
    && (record.taskPrompt === undefined || typeof record.taskPrompt === 'string' && record.taskPrompt.length <= 1800)
    && (record.assessmentLessonStatus === undefined || record.assessmentLessonStatus === 'generating' || record.assessmentLessonStatus === 'ready' || record.assessmentLessonStatus === 'failed')
    && typeof record.createdAt === 'number'
}

function isWritingAssignmentFeedback(value: unknown): value is WritingAssignmentFeedback {
  if (typeof value !== 'object' || value === null) return false
  const feedback = value as Record<string, unknown>
  return typeof feedback.score === 'number' && feedback.score >= 0 && feedback.score <= 9
    && typeof feedback.summary === 'string'
    && Array.isArray(feedback.strengths) && feedback.strengths.length <= 6 && feedback.strengths.every((item) => typeof item === 'string')
    && Array.isArray(feedback.priorities) && feedback.priorities.length <= 6 && feedback.priorities.every((item) => typeof item === 'string')
    && typeof feedback.nextRevision === 'string'
}

function isWritingAssignment(value: unknown): value is WritingAssignment {
  if (typeof value !== 'object' || value === null) return false
  const assignment = value as Record<string, unknown>
  return typeof assignment.id === 'string'
    && typeof assignment.assignedFor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(assignment.assignedFor)
    && typeof assignment.createdAt === 'string' && Number.isFinite(Date.parse(assignment.createdAt))
    && (assignment.status === 'assigned' || assignment.status === 'completed')
    && typeof assignment.title === 'string' && typeof assignment.prompt === 'string'
    && (assignment.taskType === 'task1' || assignment.taskType === 'task2')
    && typeof assignment.focus === 'string' && typeof assignment.rationale === 'string'
    && Array.isArray(assignment.instructions) && assignment.instructions.length >= 2 && assignment.instructions.length <= 5
    && assignment.instructions.every((item) => typeof item === 'string')
    && typeof assignment.durationMinutes === 'number' && Number.isInteger(assignment.durationMinutes) && assignment.durationMinutes >= 5 && assignment.durationMinutes <= 60
    && typeof assignment.minimumWords === 'number' && (assignment.minimumWords === 150 || assignment.minimumWords === 250)
    && typeof assignment.response === 'string'
    && (assignment.feedback === undefined || isWritingAssignmentFeedback(assignment.feedback))
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function dateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function parseWritingAssignment(text: string): Omit<WritingAssignment, 'id' | 'assignedFor' | 'createdAt' | 'status' | 'response'> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    console.error('Writia returned invalid assignment JSON.', error)
    throw new Error('Writia could not prepare a readable assignment. Please try again.')
  }
  if (typeof value !== 'object' || value === null) throw new Error('Writia returned an incomplete assignment. Please try again.')
  const record = value as Record<string, unknown>
  if ((record.taskType !== 'task1' && record.taskType !== 'task2')
    || typeof record.title !== 'string' || !record.title.trim() || record.title.length > 100
    || typeof record.prompt !== 'string' || record.prompt.trim().length < 40 || record.prompt.length > 1600
    || typeof record.focus !== 'string' || !record.focus.trim() || record.focus.length > 180
    || typeof record.rationale !== 'string' || !record.rationale.trim() || record.rationale.length > 500
    || !Array.isArray(record.instructions) || record.instructions.length < 2 || record.instructions.length > 5
    || !record.instructions.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 240)
    || typeof record.durationMinutes !== 'number' || !Number.isInteger(record.durationMinutes) || record.durationMinutes < 10 || record.durationMinutes > 60) {
    throw new Error('Writia returned an incomplete assignment. Please try again.')
  }
  return {
    title: record.title.trim(),
    taskType: record.taskType,
    prompt: record.prompt.trim(),
    focus: record.focus.trim(),
    rationale: record.rationale.trim(),
    instructions: record.instructions.map((item) => (item as string).trim()),
    durationMinutes: record.durationMinutes,
    minimumWords: record.taskType === 'task1' ? 150 : 250,
  }
}

function parseWritingAssignmentFeedback(text: string): WritingAssignmentFeedback {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    console.error('Writia returned invalid assignment feedback JSON.', error)
    throw new Error('Writia could not read the assignment review. Please try again.')
  }
  if (typeof value !== 'object' || value === null) throw new Error('Writia returned an incomplete assignment review.')
  const record = value as Record<string, unknown>
  if (typeof record.score !== 'number' || record.score < 0 || record.score > 9
    || typeof record.summary !== 'string' || !record.summary.trim()
    || !Array.isArray(record.strengths) || !record.strengths.length || record.strengths.length > 6
    || !record.strengths.every((item) => typeof item === 'string' && item.trim())
    || !Array.isArray(record.priorities) || !record.priorities.length || record.priorities.length > 6
    || !record.priorities.every((item) => typeof item === 'string' && item.trim())
    || typeof record.nextRevision !== 'string' || !record.nextRevision.trim()) {
    throw new Error('Writia returned an incomplete assignment review.')
  }
  return {
    score: record.score,
    summary: record.summary.trim(),
    strengths: record.strengths.map((item) => (item as string).trim()),
    priorities: record.priorities.map((item) => (item as string).trim()),
    nextRevision: record.nextRevision.trim(),
  }
}

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

function safeLiveDiagnostic(value: string): string {
  return value
    .replace(/([?&]key=)[^&\s]+/gi, '$1[redacted]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[redacted]')
    .replace(/Gemini Live/gi, 'Writia Coach')
    .replace(/\bGemini\b/gi, 'Writia')
    .slice(0, 180)
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

function audioBufferFromPcm(context: AudioContext, pcm: ArrayBuffer, sampleRate: number): AudioBuffer {
  const samples = new Int16Array(pcm, 0, Math.floor(pcm.byteLength / 2))
  const audio = context.createBuffer(1, samples.length, sampleRate)
  const channel = audio.getChannelData(0)
  for (let index = 0; index < samples.length; index += 1) channel[index] = samples[index] / 32768
  return audio
}

function resampleTo16k(samples: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === 16000) return samples
  const targetLength = Math.max(1, Math.round(samples.length * 16000 / sampleRate))
  const resampled = new Float32Array(targetLength)
  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = index * sampleRate / 16000
    const left = Math.floor(sourceIndex)
    const right = Math.min(left + 1, samples.length - 1)
    const fraction = sourceIndex - left
    resampled[index] = samples[left] + (samples[right] - samples[left]) * fraction
  }
  return resampled
}

function float32ToPcmBase64(samples: Float32Array): string {
  const buffer = new ArrayBuffer(samples.length * 2)
  const view = new DataView(buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function parseAssessment(responseText: string, task: WritingTask, count: number, mode: WritingMode, response: string): Assessment {
  const parsed: unknown = JSON.parse(responseText)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Writia received an invalid assessment. Please try again.')
  const record = parsed as Record<string, unknown>
  const rawCriteria = Array.isArray(record.criteria) ? record.criteria : []
  const results = rawCriteria.flatMap((item): CriterionResult[] => {
    if (typeof item !== 'object' || item === null) return []
    const value = item as Record<string, unknown>
    if (!criteria.some((criterion) => criterion.id === value.id)
      || typeof value.band !== 'number' || value.band < 0 || value.band > 9
      || typeof value.evidence !== 'string' || typeof value.nextStep !== 'string') return []
    const criterion = criteria.find((candidate) => candidate.id === value.id)!
    return [{ id: criterion.id, label: criterion.label, band: value.band, evidence: value.evidence, nextStep: value.nextStep }]
  })
  if (criteria.some((criterion) => !results.some((result) => result.id === criterion.id))
    || typeof record.overallBand !== 'number' || record.overallBand < 0 || record.overallBand > 9
    || typeof record.summary !== 'string' || typeof record.priority !== 'string') {
    throw new Error('Writia could not validate the assessment details. Please run the assessment again.')
  }
  return {
    id: crypto.randomUUID(), taskId: task.id, taskLabel: task.label, mode,
    overallBand: record.overallBand, criteria: results, summary: record.summary,
    priority: record.priority, wordCount: count, createdAt: Date.now(), response: response.slice(0, 5000), taskPrompt: task.prompt,
    assessmentLessonStatus: 'generating',
  }
}

function parseScaffoldCards(responseText: string): ScaffoldCard[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    throw new Error('Writia could not read the writing support response. Please try again.')
  }
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as Record<string, unknown>).cards)) {
    throw new Error('Writia returned an invalid writing support response. Please try again.')
  }
  const cards = (parsed as { cards: unknown[] }).cards
  return cards.slice(0, 2).flatMap((card): ScaffoldCard[] => {
    if (typeof card !== 'object' || card === null) return []
    const value = card as Record<string, unknown>
    const kinds: ScaffoldKind[] = ['task', 'ideas', 'outline', 'vocabulary', 'sentence', 'cohesion']
    if (!kinds.includes(value.kind as ScaffoldKind)
      || typeof value.title !== 'string'
      || typeof value.reason !== 'string'
      || typeof value.support !== 'string'
      || typeof value.example !== 'string'
      || typeof value.tryNext !== 'string') return []
    return [{
      id: crypto.randomUUID(),
      kind: value.kind as ScaffoldKind,
      title: value.title.slice(0, 80),
      reason: value.reason.slice(0, 200),
      support: value.support.slice(0, 700),
      example: value.example.slice(0, 300),
      tryNext: value.tryNext.slice(0, 200),
    }]
  })
}

function getRequestedScaffoldKind(message: string): ScaffoldKind | 'adaptive' | null {
  const text = message.toLocaleLowerCase()
  const asksForHelp = /\b(?:show|give|provide|suggest|share|display|put|add|create|make|generate|need|want|like|could|can|would|please|help|offer|present|tell me)\b/.test(text)
    || /\b(?:what|which|how)\b.{0,60}\b(?:vocab(?:ulary)?|outline|plan|ideas?|sentence|scaffold|card|task|cohesion|transition|linking)\b/.test(text)
  if (!asksForHelp) return null
  if (/\b(?:vocab(?:ulary)?|lexical|collocations?|synonyms?|word bank)\b/.test(text)) return 'vocabulary'
  if (/\b(?:outline|plan|structure)\b/.test(text)) return 'outline'
  if (/\b(?:ideas?|brainstorm(?:ing)?|examples?|reasons|arguments|positions)\b/.test(text)) return 'ideas'
  if (/\b(?:cohesion|connect(?:ing)?|transition|linking words?|cohesive devices)\b/.test(text)) return 'cohesion'
  if (/\b(?:sentence|sentence frame|phrase|grammar|paraphrase|rephrase)\b/.test(text)) return 'sentence'
  if (/\b(?:task|prompt|command words?|requirements?)\b/.test(text)) return 'task'
  if (/\b(?:scaffold|card|written support|written help)\b/.test(text)) return 'adaptive'
  return null
}

const WRITIA_CHART_COLORS = { exam: '#36785f', guided: '#d58a61' }

function WritingAssessmentCharts({ assessment, assessments }: { assessment: Assessment; assessments: Assessment[] }) {
  const criteriaData = assessment.criteria.map((criterion) => ({
    criterion: criterion.id === 'task' ? 'Task response' : criterion.id === 'coherence' ? 'Coherence' : criterion.id === 'lexical' ? 'Vocabulary' : 'Grammar',
    band: criterion.band,
  }))
  const historyData = [...assessments].reverse().map((item, index) => ({
    attempt: index + 1,
    band: item.overallBand,
    task: item.taskLabel,
    mode: item.mode === 'exam' ? 'Exam simulation' : 'Guided practice',
  }))
  const attemptMix = [
    { name: 'Exam simulation', value: assessments.filter((item) => item.mode === 'exam').length },
    { name: 'Guided practice', value: assessments.filter((item) => item.mode !== 'exam').length },
  ].filter((item) => item.value > 0)

  return <>
    <div className="writa-report-charts">
      <article className="writa-report-chart-card">
        <div><span className="writa-kicker">CRITERION PROFILE</span><strong>Writing skill balance</strong></div>
        <div className="writa-radar-chart" role="img" aria-label="Radar chart showing IELTS writing criterion bands">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={criteriaData} outerRadius="72%">
              <PolarGrid stroke="var(--writa-chart-grid)" />
              <PolarAngleAxis dataKey="criterion" tick={{ fill: 'var(--writa-chart-text)', fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 9]} tickCount={4} axisLine={false} tick={{ fill: 'var(--writa-chart-text)', fontSize: 8 }} />
              <Radar dataKey="band" stroke="#36785f" fill="#6ba77d" fillOpacity={0.28} strokeWidth={2} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 9`, 'Practice estimate']} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="writa-report-chart-card">
        <div><span className="writa-kicker">CRITERION SCORES</span><strong>At-a-glance breakdown</strong></div>
        <div className="writa-criterion-chart" role="img" aria-label="Bar chart comparing IELTS writing criterion bands">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={criteriaData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--writa-chart-grid)" vertical={false} />
              <XAxis dataKey="criterion" interval={0} tick={{ fill: 'var(--writa-chart-text)', fontSize: 8 }} axisLine={false} tickLine={false} />
              <YAxis type="number" domain={[0, 9]} ticks={[0, 3, 6, 9]} width={28} tick={{ fill: 'var(--writa-chart-text)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 9`, 'Practice estimate']} cursor={{ fill: 'var(--writa-chart-hover)' }} />
              <Bar dataKey="band" fill="#4d8a6b" radius={[5, 5, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </div>
    <div className="writa-history-visuals">
      <article className="writa-report-chart-card">
        <div><span className="writa-kicker">ASSESSMENT HISTORY</span><strong>Overall band trend</strong></div>
        {historyData.length > 1 ? <div className="writa-history-chart" role="img" aria-label="Area chart showing assessment band over completed writing attempts">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyData} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
              <defs><linearGradient id="writiaBandTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d8a6b" stopOpacity={0.25} /><stop offset="100%" stopColor="#4d8a6b" stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid stroke="var(--writa-chart-grid)" vertical={false} />
              <XAxis dataKey="attempt" tickFormatter={(value) => `#${value}`} tick={{ fill: 'var(--writa-chart-text)', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} tick={{ fill: 'var(--writa-chart-text)', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(value) => `Attempt ${value}`} formatter={(value) => [`${Number(value).toFixed(1)} / 9`, 'Overall practice estimate']} />
              <Area type="monotone" dataKey="band" stroke="#36785f" strokeWidth={2.5} fill="url(#writiaBandTrend)" activeDot={{ r: 5, fill: '#36785f' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div> : <p className="writa-chart-empty">Complete another assessment to reveal your writing progress trend.</p>}
      </article>
      <article className="writa-report-chart-card writa-attempt-mix">
        <div><span className="writa-kicker">PRACTICE MIX</span><strong>How you have practised</strong></div>
        {attemptMix.length ? <div className="writa-mix-content">
          <div className="writa-mix-chart" role="img" aria-label="Donut chart showing exam simulation and guided practice assessment counts">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={attemptMix} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="84%" paddingAngle={4} stroke="none">{attemptMix.map((item) => <Cell key={item.name} fill={item.name === 'Exam simulation' ? WRITIA_CHART_COLORS.exam : WRITIA_CHART_COLORS.guided} />)}</Pie><Tooltip formatter={(value, name) => [Number(value), name]} /></PieChart>
            </ResponsiveContainer>
          </div>
          <div className="writa-mix-legend">{attemptMix.map((item) => <span key={item.name}><i style={{ backgroundColor: item.name === 'Exam simulation' ? WRITIA_CHART_COLORS.exam : WRITIA_CHART_COLORS.guided }} /><strong>{item.value}</strong>{item.name}</span>)}</div>
        </div> : <p className="writa-chart-empty">Your exam and guided assessment mix will appear here.</p>}
      </article>
    </div>
  </>
}

function formatLearnerDate(value: string): string {
  if (!value) return 'Not set'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 'Not set' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function dashboardDateLabel(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date()).toUpperCase()
}

function dashboardTestCountdown(testDate: string): string {
  if (!testDate) return 'Every conversation brings you closer to your goal.'
  const target = new Date(`${testDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) return 'Every conversation brings you closer to your goal.'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.ceil((target.getTime() - today.getTime()) / 86400000)
  if (days < 0) return 'Your planned IELTS test date has passed. Update it in your profile.'
  if (days === 0) return 'Your IELTS test is today. Take a breath and trust your preparation.'
  return `${days} days until your IELTS test. Every conversation brings you closer to your goal.`
}

export function WritaPlatform({ apiKey, username, profile, speakingResults, module, onModuleChange, onOpenSettings, onOpenProfile, onSavePlacementAssessment, onLearnerDataChange, examLaunchRequest, onExamLaunchHandled }: {
  apiKey: string
  username: string
  profile: UserProfile
  speakingResults: TestResult[]
  module: WritaModuleId
  onModuleChange: (module: WritaModuleId) => void
  onOpenSettings: () => void
  onOpenProfile: () => void
  onSavePlacementAssessment: (assessment: PlacementAssessment) => Promise<void>
  onLearnerDataChange: (data: WritiaLearnerContext) => void
  examLaunchRequest?: string | null
  onExamLaunchHandled?: () => void
}) {
  const [saved] = useState(() => readSavedWriting(username))
  const [customTasks, setCustomTasks] = useState<WritingTask[]>(saved.customTasks)
  const [taskVisuals, setTaskVisuals] = useState<Record<string, TaskVisualSpec>>(saved.taskVisuals)
  const [visualBusyId, setVisualBusyId] = useState<string | null>(null)
  const [visualError, setVisualError] = useState('')
  const [customVocabulary, setCustomVocabulary] = useState<WritingVocab[]>(saved.customVocabulary)
  const [assignments, setAssignments] = useState<WritingAssignment[]>(saved.assignments)
  const [assignmentBusy, setAssignmentBusy] = useState(false)
  const [assignmentSubmittingId, setAssignmentSubmittingId] = useState<string | null>(null)
  const [assignmentError, setAssignmentError] = useState('')
  const [taskId, setTaskId] = useState(() => [...tasks, ...saved.customTasks].find((task) => task.id === saved.drafts['active-task'])?.id ?? 'task2-technology')
  const [drafts, setDrafts] = useState<Record<string, string>>(saved.drafts)
  const [assessments, setAssessments] = useState<Assessment[]>(saved.assessments)
  const [assessment, setAssessment] = useState<Assessment | null>(() => saved.assessments[0] ?? null)
  const [writingMode, setWritingMode] = useState<WritingMode>('guided')
  const handledAssistantExamLaunchRef = useRef<string | null>(null)
  const [examStarted, setExamStarted] = useState(false)
  const [examFinished, setExamFinished] = useState(false)
  const [busy, setBusy] = useState(false)
  const [assessmentProgress, setAssessmentProgress] = useState<'idle' | 'assessing' | 'lesson' | 'complete' | 'assessment-failed' | 'lesson-failed'>('idle')
  const [bandDescriptorFocus, setBandDescriptorFocus] = useState<{ criterion: string; band: number } | null>(null)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('Saved on this device')
  const [liveConnected, setLiveConnected] = useState(false)
  const [liveConnecting, setLiveConnecting] = useState(false)
  const [livePending, setLivePending] = useState(false)
  const [liveStatus, setLiveStatus] = useState('Text coach ready')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [coachTextPending, setCoachTextPending] = useState(false)
  const [coachTextModel, setCoachTextModel] = useState<AssistantModel>(readWritingCoachTextModel)
  const [coachLanguage, setCoachLanguage] = useState<WritiaCoachLanguage>(readCoachLanguage)
  const [liveVoice, setLiveVoice] = useState<GeminiLiveVoice>(readCoachVoice)
  const [writingAssessmentModel] = useState<AssessmentModel>(readWritingAssessmentModel)
  const [realtimeScaffoldEnabled, setRealtimeScaffoldEnabled] = useState(readRealtimeScaffoldMode)
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([])
  const [coachInput, setCoachInput] = useState('')
  const [scaffoldCards, setScaffoldCards] = useState<ScaffoldCard[]>([])
  const [scaffoldPending, setScaffoldPending] = useState(false)
  const [scaffoldError, setScaffoldError] = useState('')
  const [guidedStage, setGuidedStage] = useState(0)
  const [resourceIndex, setResourceIndex] = useState(0)
  const [writingBankTab, setWritingBankTab] = useState<'topics' | 'vocabulary' | 'builder' | 'upgrades'>('topics')
  const [writingBankSearch, setWritingBankSearch] = useState('')
  const [customTaskType, setCustomTaskType] = useState<'academic1' | 'general1' | 'task2'>('task2')
  const [customTaskTitle, setCustomTaskTitle] = useState('')
  const [customTaskPrompt, setCustomTaskPrompt] = useState('')
  const [newVocabTerm, setNewVocabTerm] = useState('')
  const [newVocabMeaning, setNewVocabMeaning] = useState('')
  const [newVocabExample, setNewVocabExample] = useState('')
  const [newVocabTopic, setNewVocabTopic] = useState('')
  const [vocabPracticeSentence, setVocabPracticeSentence] = useState('')
  const [studioHint, setStudioHint] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(40 * 60)
  const scaffoldRequestIdRef = useRef(0)
  const writingModeRef = useRef<WritingMode>('guided')
  const sessionRef = useRef<Session | null>(null)
  const liveTaskVisualRef = useRef<{ taskId: string; data: string } | null>(null)
  const coachTextRequestRef = useRef<AbortController | null>(null)
  const scaffoldRequestRef = useRef<ScaffoldRequest | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const nextAudioTimeRef = useRef(0)
  const coachTextRef = useRef('')
  const voiceTranscriptRef = useRef('')
  const voiceModeRef = useRef(false)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const microphoneCaptureRef = useRef<AudioWorkletNode | null>(null)
  const microphoneGainRef = useRef<GainNode | null>(null)
  const liveConnectedRef = useRef(false)
  const livePendingRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const lastSharedDraftRef = useRef('')
  const queuedDraftRef = useRef<string | null>(null)
  const draftSnapshotVersionRef = useRef(0)
  const lastRealtimeSnapshotAtRef = useRef(0)
  const writingTasks = useMemo(() => [...tasks, ...customTasks], [customTasks])
  const activeTask = writingTasks.find((task) => task.id === taskId) ?? writingTasks[0]
  const activeTaskVisual = taskVisuals[activeTask.id]
  const availableWritingVocabulary = useMemo(() => [...customVocabulary, ...starterWritingVocabulary], [customVocabulary])
  const writingFlashcardEntries = useMemo(() => availableWritingVocabulary.map(({ id, term, meaning, example, topic, category }) => ({
    id,
    term,
    meaning,
    example,
    topic,
    category,
  })), [availableWritingVocabulary])
  const filteredWritingTasks = useMemo(() => {
    const query = writingBankSearch.trim().toLocaleLowerCase()
    return writingTasks.filter((task) => !query || `${task.type} ${task.label} ${task.prompt}`.toLocaleLowerCase().includes(query))
  }, [writingBankSearch, writingTasks])
  const filteredWritingVocabulary = useMemo(() => {
    const query = writingBankSearch.trim().toLocaleLowerCase()
    return availableWritingVocabulary.filter((entry) => !query || `${entry.term} ${entry.meaning} ${entry.example} ${entry.topic} ${entry.category}`.toLocaleLowerCase().includes(query))
  }, [availableWritingVocabulary, writingBankSearch])
  const draftKey = writingMode === 'exam' ? `exam:${taskId}` : taskId
  const draft = drafts[draftKey] ?? ''
  const count = useMemo(() => wordCount(draft), [draft])
  const latestAssessment = assessments[0] ?? null
  const writingPlacementAssessment = profile.writingPlacementAssessment
  const placementFocusCriterion = writingPlacementAssessment
    ? writingPlacementAssessment.criteria.reduce((lowest, item) => item.band < lowest.band ? item : lowest, writingPlacementAssessment.criteria[0])
    : undefined
  const focusCriterion = latestAssessment?.criteria.reduce((lowest, item) => item.band < lowest.band ? item : lowest, latestAssessment.criteria[0])
    ?? (placementFocusCriterion ? {
      id: criteria.find((item) => item.id === placementFocusCriterion.id)?.id ?? 'task',
      label: placementFocusCriterion.label,
      band: placementFocusCriterion.band,
      evidence: placementFocusCriterion.evidence,
      nextStep: placementFocusCriterion.nextStep,
    } : undefined)
  const scaffoldLevel = !focusCriterion ? 1
    : focusCriterion.band <= 5 ? 4
      : focusCriterion.band <= 5.5 ? 3
        : focusCriterion.band <= 6.5 ? 2
          : focusCriterion.band <= 7.5 ? 1
            : 0
  const scaffoldLabels = ['Independent', 'Prompting', 'Hints', 'Framework', 'Guided construction', 'Modelling']

  function learnerCoachingContext(): string {
    const writing = {
      assessmentCount: assessments.length,
      recentAssessments: assessments.slice(0, 5).map(({ taskLabel, overallBand, summary, priority, mode, criteria }) => ({
        task: taskLabel,
        practiceEstimate: overallBand,
        mode: mode ?? 'guided',
        summary,
        priority,
        criteria: criteria.map(({ label, band, evidence, nextStep }) => ({ criterion: label, band, evidence, nextStep })),
      })),
      assignedTasks: assignments.filter((item) => item.status === 'assigned').slice(0, 5).map(({ title, taskType, focus, assignedFor }) => ({ title, taskType, focus, assignedFor })),
      currentEvidence: focusCriterion ? {
        focus: focusCriterion?.label ?? null,
        evidence: focusCriterion?.evidence ?? null,
        nextStep: focusCriterion.nextStep ?? latestAssessment?.priority ?? profile.writingPlacementAssessment?.priority ?? null,
      } : null,
    }
    const speaking = speakingResults.slice(0, 3).map((result) => ({
      part: result.part,
      practiceEstimate: result.overallBand,
      completedAt: result.completedAt,
      strengths: result.strengths.slice(0, 2),
      nextSteps: result.nextSteps.slice(0, 2),
      criteria: result.criteria.map(({ name, band, note }) => ({ criterion: name, practiceEstimate: band, feedback: note })),
    }))
    return JSON.stringify({
      learnerProfile: {
        displayName: profile.displayName || profile.username,
        testType: profile.testType,
        firstLanguage: profile.firstLanguage || null,
        speaking: {
          targetBand: profile.speakingTargetBand || profile.targetBand || null,
          testDate: profile.speakingTestDate || profile.testDate || null,
          studyGoal: profile.speakingStudyGoal || profile.studyGoal || null,
          placementBaseline: profile.speakingPlacementAssessment ? {
            overallBand: profile.speakingPlacementAssessment.overallBand,
            completedAt: new Date(profile.speakingPlacementAssessment.createdAt).toISOString(),
            summary: profile.speakingPlacementAssessment.summary,
            priority: profile.speakingPlacementAssessment.priority,
            criteria: profile.speakingPlacementAssessment.criteria.map(({ label, band, evidence, nextStep }) => ({ label, band, evidence, nextStep })),
          } : null,
        },
        writing: {
          targetBand: profile.writingTargetBand || null,
          testDate: profile.writingTestDate || null,
          studyGoal: profile.writingStudyGoal || null,
          placementBaseline: profile.writingPlacementAssessment ? {
            overallBand: profile.writingPlacementAssessment.overallBand,
            completedAt: new Date(profile.writingPlacementAssessment.createdAt).toISOString(),
            summary: profile.writingPlacementAssessment.summary,
            priority: profile.writingPlacementAssessment.priority,
            criteria: profile.writingPlacementAssessment.criteria.map(({ label, band, evidence, nextStep }) => ({ label, band, evidence, nextStep })),
          } : null,
        },
      },
      writingProgress: writing,
      recentSpeakingEvidence: speaking,
      placementUse: 'Use each skill-specific placement baseline only as the initial starting point. Prioritize later practice evidence as it accumulates; never treat a baseline as progress or an official IELTS score.',
    })
  }

  function taskVisualContext(task: WritingTask): string {
    const visual = taskVisuals[task.id]
    if (!visual) return ''
    return visual.kind === 'uploaded'
      ? `\n\nTask visual: ${visual.title}\nVisible information: ${visual.dataSummary ?? visual.caption}`
      : `\n\nTask visual data: ${JSON.stringify(visual)}`
  }

  useEffect(() => {
    try {
      localStorage.setItem(`writa-writing-v1:${username}`, JSON.stringify({
        drafts: { ...drafts, 'active-task': taskId },
        assessments: assessments.slice(0, 30),
        customTasks,
        customVocabulary,
        assignments: assignments.slice(0, 60),
        taskVisuals,
      }))
      setSaveStatus('Saved on this device')
    } catch (caughtError) {
      console.error('Unable to save Writia writing history.', caughtError)
      setSaveStatus('Could not save')
    }
  }, [assignments, assessments, customTasks, customVocabulary, drafts, taskId, taskVisuals, username])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onLearnerDataChange({
        activeDraft: {
          taskLabel: activeTask.label,
          mode: writingMode,
          content: draft.slice(0, 6000),
          wordCount: wordCount(draft),
        },
        assignments: assignments.map(({ id, title, status, taskType, focus, assignedFor }) => ({ id, title, status, taskType, focus, assignedFor })),
        assessments: assessments.slice(0, 12).map(({ id, taskLabel, overallBand, createdAt, summary, priority, mode, wordCount, criteria }) => ({
          id, taskLabel, overallBand, createdAt, summary, priority, mode, wordCount,
          criteria: criteria.map(({ label, band, evidence, nextStep }) => ({ label, band, evidence, nextStep })),
        })),
      })
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [activeTask.label, assignments, assessments, draft, onLearnerDataChange, writingMode])

  useEffect(() => {
    let active = true
    void loadVisualTaskRecords(username).then((records) => {
      if (!active) return
      const restoredCustomTasks = records.map((record) => record.task).filter((task): task is WritingTask => task.id.startsWith('custom-task1-') && isWritingTask(task))
      setCustomTasks((current) => {
        const existingIds = new Set(current.map((task) => task.id))
        return [...current, ...restoredCustomTasks.filter((task) => !existingIds.has(task.id))]
      })
      setTaskVisuals((current) => ({ ...current, ...Object.fromEntries(records.map((record) => [record.task.id, record.visual])) }))
    }).catch((caughtError: unknown) => {
      console.error('Unable to restore visual IELTS Task 1 prompts from browser storage.', caughtError)
      if (active) setVisualError(caughtError instanceof Error ? safeLiveDiagnostic(caughtError.message) : 'Writia could not restore saved visual writing tasks.')
    })
    return () => { active = false }
  }, [username])

  useEffect(() => {
    if (!timerRunning) return
    const timer = window.setInterval(() => setTimerSeconds((current) => {
      if (current <= 1) {
        setTimerRunning(false)
        if (writingModeRef.current === 'exam') setExamFinished(true)
        return 0
      }
      return current - 1
    }), 1000)
    return () => window.clearInterval(timer)
  }, [timerRunning])

  useEffect(() => {
    if (writingMode !== 'guided' || !realtimeScaffoldEnabled || !liveConnected || !draft.trim() || draft === lastSharedDraftRef.current) return
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      if (!liveConnectedRef.current) return
      const currentWords = wordCount(draft)
      const previousWords = wordCount(lastSharedDraftRef.current)
      const recentText = draft.startsWith(lastSharedDraftRef.current)
        ? draft.slice(lastSharedDraftRef.current.length)
        : draft
      const meaningfulPause = /[.!?]["')\]]?$/.test(draft.trim()) || /\n\s*\n/.test(recentText)
      if (currentWords - previousWords < 14 && !meaningfulPause) return
      const cooldown = 12000 - (Date.now() - lastRealtimeSnapshotAtRef.current)
      if (cooldown > 0) {
        debounceRef.current = window.setTimeout(() => sendRealtimeDraftSnapshot(draft), cooldown)
        return
      }
      sendRealtimeDraftSnapshot(draft)
    }, 3200)
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    }
  }, [activeTask.prompt, draft, liveConnected, realtimeScaffoldEnabled, taskId, writingMode])

  function releaseMicrophone() {
    voiceModeRef.current = false
    const capture = microphoneCaptureRef.current
    microphoneCaptureRef.current = null
    if (capture) {
      capture.port.onmessage = null
      capture.port.close()
      capture.disconnect()
    }
    microphoneSourceRef.current?.disconnect()
    microphoneSourceRef.current = null
    microphoneGainRef.current?.disconnect()
    microphoneGainRef.current = null
    microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
    microphoneStreamRef.current = null
  }

  function releaseVoiceResources() {
    releaseMicrophone()
    for (const source of audioSourcesRef.current) {
      try { source.stop() } catch { /* The response may already have ended. */ }
    }
    audioSourcesRef.current = []
    nextAudioTimeRef.current = 0
    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext && audioContext.state !== 'closed') void audioContext.close()
  }

  useEffect(() => () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
    coachTextRequestRef.current?.abort()
    liveConnectedRef.current = false
    liveTaskVisualRef.current = null
    sessionRef.current?.close()
    releaseVoiceResources()
  }, [])

  function sendLiveTaskVisual(session: Session) {
    const taskVisual = liveTaskVisualRef.current
    if (taskVisual?.taskId === activeTask.id) {
      session.sendRealtimeInput({ video: { mimeType: 'image/jpeg', data: taskVisual.data } })
    }
  }

  function handleLiveMessage(message: LiveServerMessage) {
    const content = message.serverContent
    if (!content) return
    if (content.interrupted) {
      for (const source of audioSourcesRef.current) {
        try {
          source.stop()
        } catch (caughtError) {
          if (!(caughtError instanceof DOMException && caughtError.name === 'InvalidStateError')) {
            console.error('Unable to stop interrupted Writia Live audio.', caughtError)
          }
        }
      }
      audioSourcesRef.current = []
      nextAudioTimeRef.current = audioContextRef.current?.currentTime ?? 0
      coachTextRef.current = ''
      livePendingRef.current = false
      setLivePending(false)
      setLiveStatus('Listening · coach interrupted')
    }
    const inputTranscription = content.inputTranscription
    if (voiceModeRef.current && inputTranscription?.text) {
      const startsNewTurn = !voiceTranscriptRef.current
      if (startsNewTurn && sessionRef.current) {
        try {
          sendLiveTaskVisual(sessionRef.current)
        } catch (caughtError) {
          console.error('Unable to refresh the Task 1 visual in the Writia Live session.', caughtError)
          setError(caughtError instanceof Error
            ? safeLiveDiagnostic(caughtError.message)
            : 'Writia could not refresh the Task 1 visual for this voice turn.')
        }
      }
      voiceTranscriptRef.current = mergeTranscriptText(voiceTranscriptRef.current, inputTranscription.text)
      const currentTranscript = voiceTranscriptRef.current
      setCoachMessages((current) => {
        const lastMessage = current[current.length - 1]
        if (startsNewTurn || lastMessage?.role !== 'learner') {
          const nextMessage: CoachMessage = { id: crypto.randomUUID(), role: 'learner', text: currentTranscript }
          return [...current, nextMessage].slice(-8)
        }
        return [...current.slice(0, -1), { ...lastMessage, text: currentTranscript }].slice(-8)
      })
      if (inputTranscription.finished !== false) {
        voiceTranscriptRef.current = ''
        const requestedKind = getRequestedScaffoldKind(currentTranscript)
        if (requestedKind) void scaffoldRequestRef.current?.(requestedKind, undefined, false, currentTranscript)
      }
    }
    const text = content.outputTranscription?.text
      ?? content.modelTurn?.parts?.map((part) => part.text ?? '').join('')
      ?? ''
    if (text.trim()) {
      const startsNewTurn = !coachTextRef.current
      coachTextRef.current = mergeTranscriptText(coachTextRef.current, text)
      const currentReply = coachTextRef.current
      setCoachMessages((current) => {
        const lastMessage = current[current.length - 1]
        if (startsNewTurn || lastMessage?.role !== 'coach') {
          const nextMessage: CoachMessage = { id: crypto.randomUUID(), role: 'coach', text: currentReply }
          return [...current, nextMessage].slice(-8)
        }
        return [...current.slice(0, -1), { ...lastMessage, text: currentReply }].slice(-8)
      })
    }
    const audioContext = audioContextRef.current
    for (const part of content.modelTurn?.parts ?? []) {
      const audioData = part.inlineData?.data
      if (!audioData || !audioContext) continue
      try {
        const sampleRate = Number(part.inlineData?.mimeType?.match(/rate=(\d+)/i)?.[1]) || 24000
        const audio = audioBufferFromPcm(audioContext, decodeBase64(audioData), sampleRate)
        const source = audioContext.createBufferSource()
        source.buffer = audio
        source.connect(audioContext.destination)
        const startAt = Math.max(audioContext.currentTime + 0.025, nextAudioTimeRef.current)
        nextAudioTimeRef.current = startAt + audio.duration
        audioSourcesRef.current.push(source)
        source.onended = () => {
          audioSourcesRef.current = audioSourcesRef.current.filter((item) => item !== source)
        }
        source.start(startAt)
      } catch (caughtError) {
        console.error('Unable to play Writia Live audio feedback.', caughtError)
        setError('Writia’s spoken feedback could not be played. Check your audio output and reconnect if needed.')
      }
    }
    if (content.turnComplete) {
      coachTextRef.current = ''
      livePendingRef.current = false
      setLivePending(false)
      setLiveStatus(voiceModeRef.current ? 'Voice mode on · speak or type' : 'Live coach ready · text mode')
      const queuedDraft = queuedDraftRef.current
      queuedDraftRef.current = null
      if (realtimeScaffoldEnabled && queuedDraft && queuedDraft !== lastSharedDraftRef.current) {
        window.setTimeout(() => sendRealtimeDraftSnapshot(queuedDraft), 180)
      }
    }
  }

  function sendRealtimeDraftSnapshot(snapshot: string) {
    const session = sessionRef.current
    const currentDraft = snapshot.trim()
    if (!currentDraft || currentDraft === lastSharedDraftRef.current) return
    if (!session || !liveConnectedRef.current) return
    if (livePendingRef.current) {
      queuedDraftRef.current = snapshot
      return
    }
    const previousDraft = lastSharedDraftRef.current
    const newDraftText = currentDraft.startsWith(previousDraft) ? currentDraft.slice(previousDraft.length).trim() : currentDraft
    const newWordCount = wordCount(newDraftText)
    const version = draftSnapshotVersionRef.current + 1
    draftSnapshotVersionRef.current = version
    try {
      sendLiveTaskVisual(session)
      session.sendRealtimeInput({
        text: `Real-time Writia draft checkpoint ${version}. This complete draft replaces the earlier snapshot. The learner paused after a sentence, paragraph, or meaningful revision. Current learner profile and cross-platform progress context (JSON): ${learnerCoachingContext()}\n\nTask type: ${activeTask.type}. Task: ${activeTask.prompt}${taskVisualContext(activeTask)}\n\nLatest draft (${wordCount(currentDraft)} words):\n${currentDraft}\n\nCoach like a skilled teacher beside the learner: notice one specific decision or pattern in the latest writing, quote only a short exact phrase when useful, explain its effect on the reader, and offer one concrete next move. For Task 1, check descriptions against the visual and its data; do not reward inaccurate readings or invent values. Prioritize task response, paragraph logic, precise vocabulary, or sentence control based on actual evidence and the current focus. Be warm, concise, and specific. Do not invent errors, rewrite the essay, or score it. If this checkpoint does not need intervention, briefly affirm the learner's progress and invite them to continue. Ask no more than one question.`,
      })
      lastSharedDraftRef.current = snapshot
      lastRealtimeSnapshotAtRef.current = Date.now()
      livePendingRef.current = true
      setLivePending(true)
      setLiveStatus('Draft shared · Writia is coaching')
      if (newWordCount >= 28 || /\n\s*\n/.test(newDraftText)) {
        void requestScaffoldHelp('adaptive', snapshot, true)
      }
    } catch (caughtError) {
      console.error('Unable to stream the Writia draft to Writia Coach.', caughtError)
      setError(caughtError instanceof Error
        ? safeLiveDiagnostic(caughtError.message)
        : 'Writia could not share this draft update with the live coach.')
    }
  }

  async function requestScaffoldHelp(kind: ScaffoldKind | 'adaptive', snapshot = draft, automatic = false, coachRequest?: string) {
    const writing = snapshot.trim()
    if (writingMode !== 'guided' || (automatic && !writing) || (scaffoldPending && !automatic && !coachRequest)) return
    if (!apiKey.trim()) {
      if (automatic || coachRequest) setScaffoldError('Add your shared AI service key in Settings to receive written scaffolds.')
      else setError('Add your shared AI service key in Settings to get just-in-time writing help.')
      return
    }

    const requestId = scaffoldRequestIdRef.current + 1
    scaffoldRequestIdRef.current = requestId
    if (!automatic) setScaffoldCards([])
    setScaffoldError('')
    setScaffoldPending(true)
    try {
      const request = coachRequest
        ? kind === 'adaptive'
          ? `The learner explicitly asked the live coach for written scaffold cards but did not specify a type. Infer the most relevant type from their request and draft, and return exactly one useful card. Learner's request: ${coachRequest}`
          : `The learner explicitly requested a written ${kind} scaffold through the live coach. Use their exact request to shape one concise, relevant card. Learner's request: ${coachRequest}`
        : kind === 'adaptive'
          ? 'Review this paused draft for a clear sign the learner is stuck or missing an important next step. Return zero cards if no targeted help is needed. If help is needed, choose one or two relevant types: task, ideas, outline, vocabulary, sentence, or cohesion.'
          : `The learner explicitly requested ${kind} support. Create one concise, directly relevant written scaffold of type ${kind}.`
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: writingAssessmentModel,
        contents: [{ role: 'user', parts: [{ text: `You are Writia Coach's quiet, just-in-time writing scaffold. Do not write the learner's essay or complete paragraph. Give practical support that leaves the thinking and writing to the learner. Use accurate IELTS Academic or General Training guidance based on the task. Do not invent evidence or personal examples. Keep vocabulary natural, useful, and contextual; sentence frames must have a meaningful blank or choice for the learner to complete. ${request}\n\nLearner profile and recent progress context (JSON): ${learnerCoachingContext()}\n\nReturn only valid JSON with this shape: {"cards":[{"kind":"task|ideas|outline|vocabulary|sentence|cohesion","title":"short card title","reason":"brief evidence-based reason this help fits the draft","support":"the scaffold, steps, short list, or contextual vocabulary with meanings","example":"optional short phrase or incomplete sentence frame; empty string if not useful","tryNext":"one small action for the learner"}]}. ${coachRequest ? 'Always return exactly one card for an explicit request.' : 'Use an empty cards array when the adaptive check finds no clear need.'} No markdown.\n\nIELTS task type: ${activeTask.type}\nTask prompt: ${activeTask.prompt}${taskVisualContext(activeTask)}\nRequested support: ${kind}\nDraft (${wordCount(writing)} words):\n${writing}` }] }],
        config: { temperature: 0.25, responseMimeType: 'application/json', systemInstruction: `Use this learner profile and recent cross-platform progress only when relevant to the requested scaffold. Prioritize Writing goals and evidence; Speaking scores are not Writing evidence. Adapt the amount of support to demonstrated independence and preserve learner agency.\n${learnerCoachingContext()}` },
      })
      const text = response.text?.trim()
      if (!text) throw new Error('Writia could not prepare a writing scaffold. Please try again.')
      const cards = parseScaffoldCards(text)
      if (coachRequest && !cards.length) throw new Error('Writia could not prepare the requested written scaffold. Please try again.')
      if (requestId !== scaffoldRequestIdRef.current || writingModeRef.current !== 'guided') return
      if (cards.length || !automatic) setScaffoldCards(cards)
    } catch (caughtError) {
      console.error('Writia just-in-time writing scaffold failed.', caughtError)
      reportGeminiQuota(caughtError)
      if (requestId === scaffoldRequestIdRef.current) {
        const message = caughtError instanceof Error ? safeLiveDiagnostic(caughtError.message) : 'Writia could not prepare writing help.'
        if (automatic || coachRequest) setScaffoldError(message)
        else setError(message)
      }
    } finally {
      if (requestId === scaffoldRequestIdRef.current) setScaffoldPending(false)
    }
  }

  useEffect(() => {
    scaffoldRequestRef.current = requestScaffoldHelp
  })

  function addScaffoldExample(example: string) {
    const separator = draft.trim() ? `${draft.trim()}\n\n` : ''
    updateDraft(`${separator}${example}`)
  }

  function sendLiveTurn(text: string, learnerText?: string): boolean {
    const session = sessionRef.current
    if (!session || !liveConnectedRef.current || livePendingRef.current) return false
    try {
      coachTextRef.current = ''
      livePendingRef.current = true
      setLivePending(true)
      setLiveStatus('Writia is thinking')
      sendLiveTaskVisual(session)
      session.sendClientContent({ turns: [{ role: 'user', parts: [{ text: `${text}\n\nCurrent learner profile and cross-platform progress context (JSON): ${learnerCoachingContext()}` }] }], turnComplete: true })
      if (learnerText?.trim()) {
        const learnerMessage: CoachMessage = { id: crypto.randomUUID(), role: 'learner', text: learnerText.trim() }
        setCoachMessages((current) => [...current, learnerMessage].slice(-8))
      }
      return true
    } catch (caughtError) {
      livePendingRef.current = false
      setLivePending(false)
      reportGeminiQuota(caughtError)
      setError(caughtError instanceof Error ? safeLiveDiagnostic(caughtError.message) : 'Writia Coach could not receive that message.')
      return false
    }
  }

  async function startLiveCoach(drillContext?: string) {
    if (liveConnecting || coachTextPending) return
    if (liveConnectedRef.current) {
      if (drillContext) sendLiveTurn(drillContext)
      return
    }
    if (!apiKey.trim()) {
      setError('Add your shared AI service key in Settings to start Writia Coach.')
      return
    }
    setError('')
    setLiveConnecting(true)
    setLiveStatus('Connecting Writia Coach')
    liveTaskVisualRef.current = null
    try {
      const academicTask1 = !drillContext && activeTask.minimumWords === 150 && activeTask.type.includes('Academic')
      const taskVisual = academicTask1 ? taskVisuals[activeTask.id] : undefined
      const taskVisualImage = taskVisual
        ? await taskVisualForLiveCoach(username, activeTask, taskVisual)
        : undefined
      liveTaskVisualRef.current = taskVisualImage ? { taskId: activeTask.id, data: taskVisualImage } : null
      const outputContext = new AudioContext()
      audioContextRef.current = outputContext
      await outputContext.resume()
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const liveModel = getProdiaLiveModel()
      const session = await client.live.connect({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          ...(liveModel === 'gemini-3.8-live-extended-thinking'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          realtimeInputConfig: { automaticActivityDetection: { disabled: false } },
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: liveVoice } } },
          systemInstruction: `You are Writia, a highly skilled IELTS Academic and General Training writing tutor. ${coachLanguageInstruction(coachLanguage)} Learner profile and cross-platform progress context (JSON): ${learnerCoachingContext()}. Use Writing goals, test timeline, recent writing evidence, and active assignments to adapt practice. Speaking evidence can suggest transferable skills but must not be used to score or infer Writing ability. Treat first language as optional context; do not assume proficiency or switch languages unless helpful and requested. Speak every coach response aloud and provide a clear transcription. Coach writing with adaptive pedagogy and gradual release: begin with a prompt or question, then offer a hint, then a flexible framework, then guided sentence construction only if needed. Let the learner do the thinking and writing. The learner's current evidence-based scaffold is Level ${scaffoldLevel} (${scaffoldLabels[scaffoldLevel]}). Start at this level, increase support only after signs of struggle, and reduce support when the learner demonstrates the skill independently. ${focusCriterion ? `Prioritise the learner's current area for growth, ${focusCriterion.label}; evidence: ${focusCriterion.evidence}.` : 'Gather evidence before deciding which skill needs the most support.'} Give concise, evidence-based feedback, one teaching point at a time, aligned with task achievement/response, coherence and cohesion, lexical resource, and grammatical range and accuracy. Never silently rewrite learner work or claim to give an official IELTS score. Distinguish Task 1 from Task 2. Treat each supplied draft as private learning context and do not invent facts or personal examples. Ask one useful question at a time.${drillContext ? ' The learner is working through a short Writia writing drill. Stay focused on its named skill and current exercise, coach conversationally without taking over the response, and treat any drill indicator as practice feedback rather than an official IELTS score.' : ''}`,
        },
        callbacks: {
          onopen: () => setLiveStatus('Live coach ready'),
          onmessage: (message) => handleLiveMessage(message),
          onerror: (event) => {
            console.error('Writia Coach connection failed.', event)
            reportGeminiQuota(event)
            queuedDraftRef.current = null
            liveTaskVisualRef.current = null
            liveConnectedRef.current = false
            setLiveConnected(false)
            setLiveConnecting(false)
            setVoiceEnabled(false)
            releaseVoiceResources()
            setLiveStatus('Connection failed')
            const detail = safeLiveDiagnostic(
              event.error instanceof Error && event.error.message
                ? event.error.message
                : event.message || 'The browser reported a WebSocket error.',
            )
            setError(`Writia Coach connection error: ${detail}. Check shared AI access, model availability, quota, and network.`)
          },
          onclose: (event) => {
            queuedDraftRef.current = null
            liveTaskVisualRef.current = null
            liveConnectedRef.current = false
            setLiveConnected(false)
            setLiveConnecting(false)
            setLivePending(false)
            livePendingRef.current = false
            setVoiceEnabled(false)
            releaseVoiceResources()
            const reason = safeLiveDiagnostic(event.reason)
            setLiveStatus(event.code === 1000 ? 'Text coach ready' : `Connection closed · ${event.code}`)
            if (event.code !== 1000 && event.code !== 1001) {
              setError(`Writia Coach closed the connection (${event.code})${reason ? `: ${reason}` : ''}. Check shared AI access, model availability, quota, and network.`)
            }
          },
        },
      })
      if (!drillContext && writingModeRef.current === 'exam') {
        session.close()
        liveTaskVisualRef.current = null
        setLiveConnecting(false)
        setLiveStatus('Text coach ready')
        releaseVoiceResources()
        return
      }
      sessionRef.current = session
      liveConnectedRef.current = true
      setLiveConnected(true)
      setLiveConnecting(false)
      setLiveStatus('Live coach ready')
      const recentConversation = coachMessages.slice(-8)
        .map((message) => `${message.role === 'learner' ? 'Learner' : 'Writia'}: ${message.text}`)
        .join('\n')
      const openingInstruction = drillContext
        ? 'Welcome the learner briefly to their writing drill. Give one concise, spoken prompt grounded in the drill context, then listen and guide without writing the answer for them.'
        : recentConversation
          ? `Continue naturally from this recent text conversation. Do not repeat a welcome; acknowledge the learner's latest point and ask one helpful next question.\n\nRecent conversation:\n${recentConversation}`
          : 'Welcome the learner briefly and invite them to work on this IELTS writing task. Ask what they think the question requires before suggesting ideas.'
      const greetingSent = sendLiveTurn(drillContext
        ? `${openingInstruction}\n\n${drillContext}`
        : `${openingInstruction}\n\nFor Task 1, use the attached image and its visual details as the source of truth; inspect the actual labels, units, dates, values, and relationships, and do not invent or infer data that is not visible.${taskVisualImage ? '\n\nThe original Task 1 visual is attached to this live session as an image. Refer to it directly when helping the learner interpret the task or check their draft.' : ''}\n\nTask: ${activeTask.prompt}${taskVisualContext(activeTask)}\n\nCurrent draft:\n${draft || '(No draft yet)'}`)
      if (greetingSent) void toggleVoiceMode(true)
    } catch (caughtError) {
      console.error('Unable to start Writia Coach.', caughtError)
      reportGeminiQuota(caughtError)
      const failedSession = sessionRef.current
      sessionRef.current = null
      liveTaskVisualRef.current = null
      liveConnectedRef.current = false
      failedSession?.close()
      setLiveConnected(false)
      queuedDraftRef.current = null
      setLiveConnecting(false)
      setLiveStatus('Text coach ready')
      setVoiceEnabled(false)
      releaseVoiceResources()
      setError(caughtError instanceof Error
        ? safeLiveDiagnostic(caughtError.message)
        : 'The live writing coach could not be started.')
    }
  }

  function stopLiveCoach() {
    queuedDraftRef.current = null
    liveTaskVisualRef.current = null
    liveConnectedRef.current = false
    livePendingRef.current = false
    setLiveConnected(false)
    setLivePending(false)
    setVoiceEnabled(false)
    setLiveStatus('Text coach ready')
    const session = sessionRef.current
    sessionRef.current = null
    session?.close()
    releaseVoiceResources()
  }

  async function toggleVoiceMode(enabled: boolean) {
    if (!enabled) {
      try {
        sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true })
      } catch (caughtError) {
        console.error('Unable to close Writia microphone input cleanly.', caughtError)
      }
      voiceModeRef.current = false
      setVoiceEnabled(false)
      voiceTranscriptRef.current = ''
      releaseMicrophone()
      if (liveConnectedRef.current) setLiveStatus('Live coach ready · text mode')
      return
    }
    if (!liveConnectedRef.current || !sessionRef.current) {
      setError('Connect the live coach before enabling Voice mode.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not available in this browser.')
      return
    }

    setVoiceBusy(true)
    setError('')
    try {
      const context = audioContextRef.current ?? new AudioContext()
      audioContextRef.current = context
      await context.resume()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      microphoneStreamRef.current = stream
      await context.audioWorklet.addModule('/pcm-capture-processor.js')

      const session = sessionRef.current
      if (!session) throw new Error('The live coach disconnected before Voice mode could start.')
      const microphone = context.createMediaStreamSource(stream)
      const capture = new AudioWorkletNode(context, 'speakia-pcm-capture', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'discrete',
      })
      const silentGain = context.createGain()
      silentGain.gain.value = 0
      microphone.connect(capture)
      capture.connect(silentGain)
      silentGain.connect(context.destination)
      microphoneSourceRef.current = microphone
      microphoneCaptureRef.current = capture
      microphoneGainRef.current = silentGain
      voiceTranscriptRef.current = ''
      voiceModeRef.current = true
      setVoiceEnabled(true)
      setLiveStatus('Voice mode on · speak or type')
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (sessionRef.current !== session || !voiceModeRef.current) return
        try {
          session.sendRealtimeInput({
            audio: {
              data: float32ToPcmBase64(resampleTo16k(event.data, context.sampleRate)),
              mimeType: 'audio/pcm;rate=16000',
            },
          })
        } catch (caughtError) {
          console.error('Unable to send microphone audio to Writia Live.', caughtError)
          setError(caughtError instanceof Error
            ? safeLiveDiagnostic(caughtError.message)
            : 'Writia could not receive microphone audio.')
          voiceModeRef.current = false
          setVoiceEnabled(false)
          releaseMicrophone()
        }
      }
    } catch (caughtError) {
      console.error('Unable to enable Writia Live voice mode.', caughtError)
      const sessionStillConnected = liveConnectedRef.current
      voiceModeRef.current = false
      setVoiceEnabled(false)
      releaseMicrophone()
      if (sessionStillConnected) {
        reportGeminiQuota(caughtError)
        setError(caughtError instanceof Error
          ? safeLiveDiagnostic(caughtError.message)
          : 'Writia could not enable microphone input.')
      }
    } finally {
      setVoiceBusy(false)
    }
  }

  function changeCoachLanguage(value: string) {
    const language = WRITIA_COACH_LANGUAGES.find((item) => item === value)
    if (!language) return
    setCoachLanguage(language)
    try {
      localStorage.setItem(WRITIA_COACH_LANGUAGE_KEY, language)
    } catch (caughtError) {
      console.error('Unable to save Writia coach language.', caughtError)
      setError('The coach language could not be saved in this browser.')
    }
  }

  function changeCoachTextModel(value: string) {
    const model = ASSISTANT_MODELS.find((item) => item.id === value)
    if (!model) return
    setCoachTextModel(model.id)
    try {
      localStorage.setItem(WRITIA_COACH_TEXT_MODEL_KEY, model.id)
    } catch (caughtError) {
      console.error('Unable to save Writia text model preference.', caughtError)
      setError('The text model changed for this session, but could not be saved on this device.')
    }
  }

  async function sendTextCoachMessage(message: string) {
    if (coachTextPending) return
    if (!apiKey.trim()) {
      setError('Add your shared AI service key in Settings to chat with Writia Coach.')
      return
    }

    const trimmed = message.trim()
    if (!trimmed) return
    const controller = new AbortController()
    coachTextRequestRef.current = controller
    const previousMessages = coachMessages
    const learnerMessage: CoachMessage = { id: crypto.randomUUID(), role: 'learner', text: trimmed }
    setCoachMessages((current) => [...current, learnerMessage].slice(-8))
    setCoachInput('')
    setCoachTextPending(true)
    setError('')

    try {
      const academicTask1 = activeTask.minimumWords === 150 && activeTask.type.includes('Academic')
      const taskVisual = academicTask1 ? taskVisuals[activeTask.id] : undefined
      const taskVisualImage = taskVisual
        ? await taskVisualForLiveCoach(username, activeTask, taskVisual)
        : undefined
      if (controller.signal.aborted) return

      const context = `Learner profile and recent progress context (JSON): ${learnerCoachingContext()}\n\nCurrent IELTS task (${activeTask.type}): ${activeTask.prompt}${taskVisualContext(activeTask)}\n\nCurrent draft (${wordCount(draft)} words):\n${draft || '(No draft yet)'}`
      const userParts = [
        { text: `Learner request: ${trimmed}\n\n${context}` },
        ...(taskVisualImage ? [{ inlineData: { mimeType: 'image/jpeg', data: taskVisualImage } }] : []),
      ]
      const contents = [
        ...previousMessages.slice(-11).map(({ role, text }) => ({
          role: role === 'coach' ? 'model' as const : 'user' as const,
          parts: [{ text }],
        })),
        { role: 'user' as const, parts: userParts },
      ]
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: coachTextModel,
        contents,
        config: {
          systemInstruction: `You are Writia, a highly skilled IELTS Academic and General Training writing tutor. ${coachLanguageInstruction(coachLanguage)} Learner profile and cross-platform progress context (JSON): ${learnerCoachingContext()}. Use the learner's Writing goal, target, timeline, recent evidence, active assignment, and demonstrated strengths to adapt the next teaching step. Speaking evidence may inform transferable language or confidence support, but must never be treated as evidence of Writing ability. Treat first language as optional context, not a basis for assumptions; use it only when requested or clearly useful. The learner is working on the task and draft included in their latest message. For Academic Task 1, use the attached image as the source of truth for labels, units, dates, values, and relationships; do not invent or infer unseen data. Coach with adaptive pedagogy and gradual release: begin with a prompt or question, then offer a hint, then a flexible framework, then guided sentence construction only if needed. Let the learner do the thinking and writing. Give concise, evidence-based feedback, one teaching point at a time, aligned with task achievement/response, coherence and cohesion, lexical resource, and grammatical range and accuracy. Never silently rewrite learner work or claim to give an official IELTS score. Distinguish Task 1 from Task 2. Treat each supplied draft as private learning context and do not invent facts or personal examples. Ask one useful question at a time.`,
          abortSignal: controller.signal,
        },
      })
      if (controller.signal.aborted) return
      const answer = response.text?.trim()
      if (!answer) throw new Error('Writia Coach returned an empty text response. Please try again.')
      const coachMessage: CoachMessage = { id: crypto.randomUUID(), role: 'coach', text: answer }
      setCoachMessages((current) => [...current, coachMessage].slice(-8))
      const requestedKind = getRequestedScaffoldKind(trimmed)
      if (requestedKind) void requestScaffoldHelp(requestedKind, draft, false, trimmed)
    } catch (caughtError) {
      if (controller.signal.aborted) return
      console.error('Writia text coach request failed.', caughtError)
      reportGeminiQuota(caughtError)
      setError(caughtError instanceof Error
        ? safeLiveDiagnostic(caughtError.message)
        : 'Writia Coach could not prepare a text response.')
    } finally {
      if (coachTextRequestRef.current === controller) {
        coachTextRequestRef.current = null
        setCoachTextPending(false)
      }
    }
  }

  function changeLiveVoice(value: string) {
    const voice = GEMINI_LIVE_VOICES.find((item) => item.id === value)
    if (!voice) return
    setLiveVoice(voice.id)
    try {
      localStorage.setItem(WRITIA_COACH_VOICE_KEY, voice.id)
    } catch (caughtError) {
      console.error('Unable to save Writia live voice.', caughtError)
      setError('The live voice could not be saved in this browser.')
    }
  }

  function toggleRealtimeScaffold(enabled: boolean) {
    setRealtimeScaffoldEnabled(enabled)
    queuedDraftRef.current = null
    try {
      localStorage.setItem(WRITIA_REALTIME_SCAFFOLD_KEY, String(enabled))
    } catch (caughtError) {
      console.error('Unable to save Writia real-time scaffold preference.', caughtError)
      setError('The real-time coaching preference could not be saved in this browser.')
    }
    if (!enabled) {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current)
      debounceRef.current = null
      return
    }
    if (liveConnectedRef.current && draft.trim()) {
      lastSharedDraftRef.current = ''
      sendRealtimeDraftSnapshot(draft)
    }
  }

  function changeWritingMode(mode: WritingMode) {
    if (mode === writingMode) return
    const leavingActiveExam = writingMode === 'exam' && examStarted
    scaffoldRequestIdRef.current += 1
    setScaffoldCards([])
    setScaffoldPending(false)
    setScaffoldError('')
    writingModeRef.current = mode
    setWritingMode(mode)
    setTimerRunning(false)
    setExamStarted(false)
    setExamFinished(false)
    setAssessment(null)
    setStudioHint('')
    setTimerSeconds(activeTask.minimumWords === 250 ? 40 * 60 : 20 * 60)
    if (mode === 'exam') {
      stopLiveCoach()
      queuedDraftRef.current = null
      lastSharedDraftRef.current = ''
    }
    if (leavingActiveExam) setError('The timed attempt ended when you left Exam Simulation. Your response is saved on this device.')
  }

  function startExam() {
    if (activeTask.minimumWords === 150 && activeTask.type.includes('Academic') && !taskVisuals[activeTask.id]) {
      setVisualError('Generate and review the Academic Task 1 visual before starting an independent timed attempt.')
      return
    }
    const examDraftKey = `exam:${taskId}`
    if (drafts[examDraftKey]?.trim() && !window.confirm('Starting a new timed attempt will replace the saved Exam Simulation response for this task. Continue?')) return
    setDrafts((current) => ({ ...current, [examDraftKey]: '' }))
    setAssessment(null)
    setError('')
    setTimerSeconds(activeTask.minimumWords === 250 ? 40 * 60 : 20 * 60)
    setExamFinished(false)
    setExamStarted(true)
    setTimerRunning(true)
  }

  useEffect(() => {
    if (!examLaunchRequest || handledAssistantExamLaunchRef.current === examLaunchRequest) return
    handledAssistantExamLaunchRef.current = examLaunchRequest
    onExamLaunchHandled?.()
    if (writingMode !== 'exam') changeWritingMode('exam')
    startExam()
  }, [examLaunchRequest, onExamLaunchHandled, writingMode])

  function submitExam() {
    setExamStarted(false)
    setExamFinished(true)
    setTimerRunning(false)
    void requestAssessment('exam')
  }

  function updateAssessmentLessonStatus(assessmentId: string, status: 'generating' | 'ready' | 'failed') {
    setAssessment((current) => current?.id === assessmentId ? { ...current, assessmentLessonStatus: status } : current)
    setAssessments((current) => current.map((item) => item.id === assessmentId ? { ...item, assessmentLessonStatus: status } : item))
    setAssessmentProgress(status === 'ready' ? 'complete' : status === 'failed' ? 'lesson-failed' : 'lesson')
  }

  async function requestAssessment(mode: WritingMode = writingMode) {
    if (!apiKey.trim()) {
      setError('Add your shared AI service key in Settings before requesting a writing assessment.')
      return
    }
    if (count < (mode === 'exam' ? 1 : 20)) {
      setError(mode === 'exam'
        ? 'Write a response before submitting your exam for assessment.'
        : 'Write at least 20 words before requesting a useful diagnostic assessment.')
      return
    }
    setError('')
    setBusy(true)
    setAssessmentProgress('assessing')
    setAssessment(null)
    onModuleChange('assessment')
    try {
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const assessmentParts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [{
        text: `Assess this IELTS writing response as a learning diagnostic, not an official IELTS score. ${mode === 'exam' ? 'This is an independent timed Exam Simulation submission. Assess only the candidate response; do not infer or reward any coaching, hints, or assistance.' : 'This is a guided-practice response.'} Evaluate the correct Task 1 or Task 2 criterion for task achievement/response, plus coherence and cohesion, lexical resource, and grammatical range and accuracy. For Academic Task 1, use the attached task visual and its visible data when checking accuracy and task achievement. Estimate a 0-9 band for each criterion and overall, grounded in evidence from the response. Be honest about limitations if the task is incomplete or under-length. Give one concise, actionable next step for each criterion and one priority skill to transfer into a new task. Return only JSON with this shape: {"overallBand": number, "summary": string, "priority": string, "criteria": [{"id":"task|coherence|lexical|grammar", "band": number, "evidence": string, "nextStep": string}]}\n\nTask type: ${activeTask.type}\nPrompt: ${activeTask.prompt}\n${taskVisualContext(activeTask)}\nRequired minimum words: ${activeTask.minimumWords}\nActual word count: ${count}\nResponse:\n${draft}`,
      }]
      const taskVisual = taskVisuals[activeTask.id]
      if (taskVisual?.kind === 'uploaded') {
        const image = await loadVisualTaskImage(username, taskVisual.sourceImageId ?? activeTask.id)
        if (!image) throw new Error('The saved Task 1 image is unavailable, so Writia cannot check the response against its visual.')
        assessmentParts.push({ inlineData: { mimeType: image.type, data: await visualImageToBase64(image) } })
      }
      const response = await client.models.generateContent({
        model: writingAssessmentModel,
        contents: [{ role: 'user', parts: assessmentParts }],
        config: { temperature: 0.2, responseMimeType: 'application/json' },
      })
      const text = response.text?.trim()
      if (!text) throw new Error('Writia could not prepare an assessment. Please try again.')
      const result = parseAssessment(text, activeTask, count, mode, draft)
      setAssessment(result)
      setAssessments((current) => [result, ...current].slice(0, 30))
      setAssessmentProgress('lesson')
      setLiveStatus(liveConnected ? 'Live coach ready' : liveStatus)
    } catch (caughtError) {
      console.error('Writia writing assessment failed.', caughtError)
      reportGeminiQuota(caughtError)
      setError(caughtError instanceof Error ? safeLiveDiagnostic(caughtError.message) : 'Writia could not assess this response.')
      setAssessmentProgress('assessment-failed')
    } finally {
      setBusy(false)
    }
  }

  async function createWritingAssignment() {
    if (!apiKey.trim()) {
      setAssignmentError('Add your shared AI service key in Settings before asking Writia to create an assignment.')
      return
    }
    setAssignmentBusy(true)
    setAssignmentError('')
    try {
      const recentFocus = latestAssessment?.priority
        ?? assignments.find((item) => item.feedback)?.feedback?.priorities[0]
        ?? 'balanced development across the four IELTS writing criteria'
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const recentAssignments = assignments.slice(0, 6).map((item) => ({
        title: item.title,
        taskType: item.taskType,
        focus: item.focus,
        prompt: item.prompt.slice(0, 180),
      }))
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: writingAssessmentModel,
        contents: [{ role: 'user', parts: [{ text: `Create one original, self-contained IELTS Writing assignment for tomorrow. The learner's latest priority is: ${recentFocus}. Their recent assignment history is: ${JSON.stringify(recentAssignments)}. Vary Task 1 and Task 2 when possible; do not repeat recent topics or prompts. Make the task authentic to IELTS Academic Writing: Task 1 must specify a coherent chart/table/map/process dataset in words or use a realistic General Training letter situation; Task 2 must be a clear, answerable IELTS essay question. Ask for the learner's own writing, never a model answer. Include a short motivating title, one assessable skill focus, a brief rationale grounded in the supplied priority, 2–4 practical steps, and a 15–45 minute estimate. Return only JSON: {"title":"string","taskType":"task1|task2","prompt":"complete candidate-facing prompt with any needed data","focus":"one skill","rationale":"why this fits their practice evidence","instructions":["step 1","step 2"],"durationMinutes":number}. No markdown. Do not invent personal learner results.` }] }],
        config: { temperature: 0.55, responseMimeType: 'application/json' },
      })
      const text = response.text?.trim()
      if (!text) throw new Error('Writia did not return an assignment. Please try again.')
      const assignment = parseWritingAssignment(text)
      const nextAssignment: WritingAssignment = {
        ...assignment,
        id: crypto.randomUUID(),
        assignedFor: dateKey(tomorrow),
        createdAt: new Date().toISOString(),
        status: 'assigned',
        response: '',
      }
      setAssignments((current) => [nextAssignment, ...current].slice(0, 60))
    } catch (caughtError) {
      console.error('Unable to create a Writia writing assignment.', caughtError)
      reportGeminiQuota(caughtError)
      setAssignmentError(caughtError instanceof Error ? safeLiveDiagnostic(caughtError.message) : 'Writia could not prepare an assignment.')
    } finally {
      setAssignmentBusy(false)
    }
  }

  function updateAssignmentResponse(assignmentId: string, response: string) {
    setAssignments((current) => current.map((item) => item.id === assignmentId ? { ...item, response } : item))
  }

  async function submitWritingAssignment(assignment: WritingAssignment) {
    const responseText = assignment.response.trim()
    const responseWordCount = wordCount(responseText)
    if (responseWordCount < 20) {
      setAssignmentError('Write at least 20 words before asking Writia to review this assignment.')
      return
    }
    if (!apiKey.trim()) {
      setAssignmentError('Add your shared AI service key in Settings before requesting assignment feedback.')
      return
    }
    setAssignmentSubmittingId(assignment.id)
    setAssignmentError('')
    try {
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const result = await client.models.generateContent({
        model: writingAssessmentModel,
        contents: [{ role: 'user', parts: [{ text: `Review this IELTS Writing assignment as a supportive, precise teacher. This is practice feedback, not an official IELTS score. Apply IELTS Writing criteria appropriate to the task type; ground every observation in the candidate's actual response. Be honest about under-length or incomplete work. Give a cautious holistic 0–9 practice estimate, not false precision. Identify at least one specific strength, up to three prioritized improvements, and one small revision action the learner can complete. Never rewrite the full response or invent evidence. Return only JSON: {"score":number,"summary":"specific overall feedback","strengths":["evidence-based strength"],"priorities":["actionable improvement"],"nextRevision":"one small revision task"}.\n\nAssignment focus: ${assignment.focus}\nTask type: IELTS Writing ${assignment.taskType === 'task1' ? 'Task 1' : 'Task 2'}\nPrompt: ${assignment.prompt}\nRequired minimum words: ${assignment.minimumWords}\nActual word count: ${responseWordCount}\nCandidate response:\n${responseText}` }] }],
        config: { temperature: 0.2, responseMimeType: 'application/json' },
      })
      const text = result.text?.trim()
      if (!text) throw new Error('Writia did not return assignment feedback. Please try again.')
      const feedback = parseWritingAssignmentFeedback(text)
      setAssignments((current) => current.map((item) => item.id === assignment.id
        ? { ...item, status: 'completed', response: responseText, feedback }
        : item))
    } catch (caughtError) {
      console.error('Unable to review a Writia assignment response.', caughtError)
      reportGeminiQuota(caughtError)
      setAssignmentError(caughtError instanceof Error ? safeLiveDiagnostic(caughtError.message) : 'Writia could not review this assignment.')
    } finally {
      setAssignmentSubmittingId(null)
    }
  }

  function updateDraft(value: string) {
    scaffoldRequestIdRef.current += 1
    setScaffoldPending(false)
    setScaffoldCards([])
    setScaffoldError('')
    setDrafts((current) => ({ ...current, [draftKey]: value }))
    setSaveStatus('Saving')
    setError('')
  }

  function addCustomWritingTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const label = customTaskTitle.trim()
    const prompt = customTaskPrompt.trim()
    if (label.length < 3 || prompt.length < 30) {
      setError('Add a task title and a complete prompt (at least 30 characters).')
      return
    }
    const taskType = customTaskType === 'academic1'
      ? 'IELTS Academic · Task 1'
      : customTaskType === 'general1'
        ? 'IELTS General Training · Task 1'
        : 'IELTS Academic & General Training · Task 2'
    const minimumWords = customTaskType === 'task2' ? 250 : 150
    const task: WritingTask = {
      id: `custom-${crypto.randomUUID()}`,
      type: taskType,
      label,
      prompt,
      minimumWords,
    }
    setCustomTasks((current) => [task, ...current])
    setCustomTaskTitle('')
    setCustomTaskPrompt('')
    setWritingBankTab('topics')
    setWritingBankSearch('')
    setError('')
  }

  async function generateTaskVisual(task: WritingTask = activeTask) {
    if (task.minimumWords !== 150 || !task.type.includes('Academic')) {
      setVisualError('Visual tasks are available for IELTS Academic Writing Task 1, not Task 2 essays or General Training letters.')
      return
    }
    if (taskVisuals[task.id]) return
    if (!apiKey.trim()) {
      setVisualError('Add your shared AI service key in Settings before generating a Task 1 visual.')
      return
    }
    setVisualBusyId(task.id)
    setVisualError('')
    try {
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: writingAssessmentModel,
        contents: [{ role: 'user', parts: [{ text: `Create a clean IELTS Academic Writing Task 1 visual specification for this candidate-facing task. Preserve every numeric value, category, date, and relationship explicitly present in the prompt. If no complete dataset is supplied, create a small, internally consistent illustrative practice dataset that fits the prompt and label it as illustrative in the caption; do not imply it is official IELTS material. Select the most suitable visual kind: line, bar, pie, table, process, or map. For maps, return clearly marked before/after features with relative x/y positions from 0 to 100 and make the visual schematic, not to scale. For process diagrams, return the actual ordered stages. Return only JSON with this shape (include only fields used by the selected kind): {"kind":"line|bar|pie|table|process|map","title":"short chart title","caption":"units or illustrative-data notice","xAxisLabel":"optional horizontal-axis label with unit","yAxisLabel":"optional vertical-axis label with unit","categories":["labels for line/bar"],"series":[{"name":"series label","values":[1,2]}],"segments":[{"label":"category","value":25}],"columns":["column"],"rows":[["cell"]],"steps":["step"],"before":[{"label":"feature","x":25,"y":50}],"after":[{"label":"feature","x":50,"y":50}]}. Use 2–8 categories/rows/steps, 1–4 series, and only data needed to answer the task. Numeric chart values must be finite and non-negative. No markdown.\n\nTask title: ${task.label}\nTask prompt: ${task.prompt}` }] }],
        config: { temperature: 0.2, responseMimeType: 'application/json' },
      })
      const text = response.text?.trim()
      if (!text) throw new Error('Writia did not return a Task 1 visual. Please try again.')
      const visual = parseGeneratedTaskVisual(text)
      const record: VisualTaskRecord = {
        key: `${username}:${task.id}`,
        username,
        task,
        visual,
      }
      await saveVisualTaskRecord(record)
      setTaskVisuals((current) => ({ ...current, [task.id]: visual }))
    } catch (caughtError) {
      console.error('Unable to generate a visual for the IELTS Task 1 prompt.', caughtError)
      reportGeminiQuota(caughtError)
      setVisualError(caughtError instanceof Error ? safeLiveDiagnostic(caughtError.message) : 'Writia could not generate a visual for this task.')
    } finally {
      setVisualBusyId(null)
    }
  }

  function addGeneratedImageTask(task: WritingTask, visual: TaskVisualSpec) {
    setCustomTasks((current) => [task, ...current.filter((item) => item.id !== task.id)])
    setTaskVisuals((current) => ({ ...current, [task.id]: visual }))
    setTaskId(task.id)
    setAssessment(null)
    setWritingMode('guided')
    writingModeRef.current = 'guided'
    setVisualError('')
    onModuleChange('studio')
  }

  function addWritingVocabulary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = newVocabTerm.trim()
    const meaning = newVocabMeaning.trim()
    const example = newVocabExample.trim()
    if (term.length < 2 || meaning.length < 5 || example.length < 12) {
      setError('Add a vocabulary item with a clear meaning and example sentence.')
      return
    }
    const entry: WritingVocab = {
      id: `custom-vocab-${crypto.randomUUID()}`,
      term,
      meaning,
      example,
      topic: newVocabTopic.trim() || 'My vocabulary',
      category: 'My vocabulary',
    }
    setCustomVocabulary((current) => [entry, ...current])
    setNewVocabTerm('')
    setNewVocabMeaning('')
    setNewVocabExample('')
    setNewVocabTopic('')
    setError('')
  }

  function selectWritingTask(task: WritingTask) {
    resetCoachForTaskChange()
    lastSharedDraftRef.current = ''
    queuedDraftRef.current = null
    setTaskId(task.id)
    setAssessment(null)
    setTimerRunning(false)
    setExamStarted(false)
    setExamFinished(false)
    setTimerSeconds(task.minimumWords === 250 ? 40 * 60 : 20 * 60)
    setWritingMode('guided')
    writingModeRef.current = 'guided'
    onModuleChange('studio')
  }

  function resetCoachForTaskChange() {
    if (liveConnectedRef.current) stopLiveCoach()
    coachTextRequestRef.current?.abort()
    coachTextRequestRef.current = null
    setCoachTextPending(false)
    setCoachMessages([])
    setCoachInput('')
  }

  function addVocabularyToDraft(term: string) {
    if (writingMode === 'exam') {
      setError('Vocabulary support is unavailable in Exam Simulation. Switch to AI-Guided Writing to use the vocabulary bank.')
      return
    }
    const separator = draft.trim() ? `${draft.trim()}\n\n` : ''
    updateDraft(`${separator}${term}`)
    onModuleChange('studio')
  }

  function openGuidedStage(index: number) {
    setGuidedStage(index)
    setStudioHint(guidedStages[index].detail)
    onModuleChange('studio')
    if (liveConnectedRef.current) sendLiveTurn(
      `${guidedStages[index].prompt}\n\nTask: ${activeTask.prompt}${taskVisualContext(activeTask)}\n\nDraft so far:\n${draft || '(No draft yet)'}`,
      guidedStages[index].title,
    )
  }

  function submitCoachMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = coachInput.trim()
    if (!message || coachTextPending || liveConnecting) return
    if (liveConnected) {
      if (sendLiveTurn(
        `Learner request: ${message}\n\nCurrent IELTS task: ${activeTask.prompt}${taskVisualContext(activeTask)}\n\nCurrent draft:\n${draft || '(No draft yet)'}`,
        message,
      )) {
        setCoachInput('')
        const requestedKind = getRequestedScaffoldKind(message)
        if (requestedKind) void requestScaffoldHelp(requestedKind, draft, false, message)
      }
      return
    }
    void sendTextCoachMessage(message)
  }

  function moveWritingBankTab(event: React.KeyboardEvent<HTMLButtonElement>, current: typeof writingBankTab) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const tabs = ['topics', 'vocabulary', 'builder', 'upgrades'] as const
    const nextIndex = (tabs.indexOf(current) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
    const nextTab = tabs[nextIndex]
    setWritingBankTab(nextTab)
    document.getElementById(`writa-bank-tab-${nextTab}`)?.focus()
  }

  const averageBand = assessments.length
    ? assessments.reduce((sum, item) => sum + item.overallBand, 0) / assessments.length
    : null
  function openWritingReview(item: Assessment | null = latestAssessment) {
    if (!item) {
      onModuleChange('studio')
      return
    }
    setAssessment(item)
    setAssessmentProgress(item.assessmentLessonStatus === 'ready' ? 'complete' : item.assessmentLessonStatus === 'failed' ? 'lesson-failed' : item.assessmentLessonStatus === 'generating' ? 'lesson' : 'idle')
    onModuleChange('assessment')
  }
  const writingCriterionAverages = criteria.map((criterion) => {
    const scores = assessments.flatMap((item) => item.criteria
      .filter((result) => result.id === criterion.id)
      .map((result) => result.band))
    return {
      criterion: criterion.shortLabel,
      band: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    }
  }).filter((item): item is { criterion: string; band: number } => item.band !== null)
  const writingBandTrend = [...assessments].slice(0, 8).reverse().map((item, index) => ({
    attempt: index + 1,
    band: item.overallBand,
    task: item.taskLabel,
  }))
  const chartAssessment = assessment ?? assessments[0] ?? null
  const hero = moduleHeroContent[module]

  return (
    <div className="writa-page page-content">
      {module !== 'coach-assets' && <div className="writa-heading">
        <div>
          <p className="writa-eyebrow"><span /> {hero.eyebrow}</p>
          <h1>Writia <span>{hero.title}</span></h1>
          <p className="writa-subtitle">{hero.description}</p>
        </div>
      </div>}

      {error && <div className="writa-alert" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss message" onClick={() => setError('')}><X size={15} /></button></div>}

      {module === 'dashboard' && <section className="writa-module-view writa-dashboard" aria-labelledby="writa-dashboard-heading">
        <div className="writa-dashboard-welcome">
          <div><p className="writa-kicker">{dashboardDateLabel()}</p><h1 id="writa-dashboard-heading">Welcome, {profile.displayName || profile.username} <span aria-hidden="true">✳</span></h1><p>{dashboardTestCountdown(profile.writingTestDate || profile.speakingTestDate || profile.testDate)}</p></div>
          <Button className="writa-primary-button" onClick={() => onModuleChange('studio')}><PenLine size={15} /> Continue writing <ArrowRight size={14} /></Button>
        </div>
        {!profile.writingPlacementAssessment && <article className="writa-placement-invitation"><div><span className="writa-kicker">OPTIONAL STARTING POINT</span><strong>Find your current Writing level</strong><p>A short, untimed baseline can help Writia choose a useful first focus. You can skip it and start practising now.</p></div><Button className="writa-primary-button" onClick={() => onModuleChange('placement-assessment')}>Take placement assessment <ArrowRight size={14} /></Button></article>}
        <div className="writa-dashboard-metrics">
          <article><span><FileCheck2 size={16} /> WRITING REVIEWS</span><strong>{assessments.length}</strong><small>Criterion-based practice assessments</small></article>
          <article><span><PenLine size={16} /> WORDS PRACTISED</span><strong>{Object.entries(drafts).reduce((sum, [key, value]) => key === 'active-task' ? sum : sum + wordCount(value), 0).toLocaleString()}</strong><small>Across your saved drafts</small></article>
          <article><span><CalendarCheck size={16} /> ASSIGNMENTS</span><strong>{assignments.filter((item) => item.status === 'completed').length}/{assignments.length}</strong><small>Completed writing tasks</small></article>
          <article><span><Target size={16} /> PRACTICE ESTIMATE</span><strong>{averageBand === null ? '--' : averageBand.toFixed(1)}</strong><small>{latestAssessment ? `Next focus: ${latestAssessment.priority}` : 'Complete a review to find your focus'}</small></article>
        </div>
        <div className="writa-dashboard-grid">
          <article className="writa-dashboard-next">
            <div className="writa-dashboard-card-heading"><span className="writa-dashboard-icon"><Sparkles size={17} /></span><div><span className="writa-kicker">YOUR NEXT STEP</span><h3>{assignments.find((item) => item.status === 'assigned')?.title ?? (focusCriterion ? `Strengthen ${focusCriterion.label.toLocaleLowerCase()}` : 'Build your writing baseline')}</h3></div></div>
            <p>{assignments.find((item) => item.status === 'assigned')?.focus ?? focusCriterion?.nextStep ?? 'Start with a short guided task. Writia will use evidence from your writing to recommend what to practise next.'}</p>
            <div className="writa-dashboard-actions">
              <Button className="writa-primary-button" onClick={() => onModuleChange(assignments.some((item) => item.status === 'assigned') ? 'assignments' : 'guided')}>{assignments.some((item) => item.status === 'assigned') ? 'Open assignment' : 'Start guided practice'} <ArrowRight size={14} /></Button>
              <button type="button" onClick={() => onModuleChange('assessment')}>View feedback history</button>
            </div>
          </article>
          <article className="writa-dashboard-plan">
            <div><span className="writa-kicker">A SMART PRACTICE LOOP</span><h3>Plan · write · improve</h3></div>
            <button type="button" onClick={() => onModuleChange('guided')}><span>01</span><div><strong>Learn the move</strong><small>Understand the task and plan a response</small></div><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onModuleChange('studio')}><span>02</span><div><strong>Write with purpose</strong><small>Practise guided or timed, independently</small></div><ArrowRight size={15} /></button>
            <button type="button" onClick={() => onModuleChange('assessment')}><span>03</span><div><strong>Use the evidence</strong><small>Review your criteria and choose one next step</small></div><ArrowRight size={15} /></button>
          </article>
        </div>
        {latestAssessment && <article className="writa-dashboard-review"><div><span className="writa-kicker">LATEST WRITING REVIEW</span><h3>{latestAssessment.taskLabel}</h3><p>{latestAssessment.summary}</p></div><span className="writa-dashboard-band">{latestAssessment.overallBand.toFixed(1)}<small>practice estimate</small></span><Button variant="outline" onClick={() => onModuleChange('assessment')}>Review details <ArrowRight size={14} /></Button></article>}
      </section>}

      {module === 'studio' && <>
        <div className="writa-studio-modes" role="tablist" aria-label="Writing practice mode">
          <button type="button" role="tab" aria-selected={writingMode === 'exam'} className={writingMode === 'exam' ? 'writa-studio-mode-active' : ''} onClick={() => changeWritingMode('exam')}>
            <Timer size={16} /><span><strong>Exam Simulation</strong><small>Independent · timed · assessed after submission</small></span>
          </button>
          <button type="button" role="tab" aria-selected={writingMode === 'guided'} className={writingMode === 'guided' ? 'writa-studio-mode-active' : ''} onClick={() => changeWritingMode('guided')}>
            <Sparkles size={16} /><span><strong>AI-Guided Writing</strong><small>Live coaching · scaffolds · practice feedback</small></span>
          </button>
        </div>
        <div className="writa-taskbar">
          <label htmlFor="writa-task-select"><span className="writa-kicker">CURRENT TASK</span><strong>{activeTask.type}</strong></label>
          <div className="writa-task-select-wrap"><select id="writa-task-select" value={taskId} disabled={liveConnecting || writingMode === 'exam' && examStarted} onChange={(event) => { const task = writingTasks.find((item) => item.id === event.target.value); if (task) { resetCoachForTaskChange(); scaffoldRequestIdRef.current += 1; setScaffoldCards([]); setScaffoldPending(false); setScaffoldError(''); lastSharedDraftRef.current = ''; queuedDraftRef.current = null; setTaskId(task.id); setAssessment(null); setTimerRunning(false); setExamStarted(false); setExamFinished(false); setTimerSeconds(task.minimumWords === 250 ? 40 * 60 : 20 * 60) } }}>
            <optgroup label="Task 1">{writingTasks.filter((task) => task.type.includes('Task 1')).map((task) => <option key={task.id} value={task.id}>{task.type.replace('IELTS Academic & General Training · ', '')} · {task.label}</option>)}</optgroup>
            <optgroup label="Task 2">{writingTasks.filter((task) => task.type.includes('Task 2')).map((task) => <option key={task.id} value={task.id}>{task.type.replace('IELTS Academic & General Training · ', '')} · {task.label}</option>)}</optgroup>
          </select><ChevronDown size={16} /></div>
          <div className="writa-task-target"><Target size={15} /><span>{activeTask.minimumWords}+ words</span></div>
        </div>
        {writingMode === 'exam' && <div className={`writa-exam-notice ${examStarted ? 'writa-exam-notice-live' : ''}`}>
          <span><FileCheck2 size={17} /></span>
          <div><strong>{examStarted ? 'Exam in progress — work independently' : examFinished ? assessment ? 'Exam submitted' : 'Time is up — submit your response for assessment' : 'Realistic IELTS writing simulation'}</strong><p>{examStarted ? 'The writing coach, hints, and scaffolded assistance are disabled for this attempt.' : examFinished && assessment ? 'Your assessment is saved in your writing history. Start another attempt when you are ready.' : `You have ${activeTask.minimumWords === 250 ? '40' : '20'} minutes. Your response is kept separate from guided practice and assessed after submission.`}</p></div>
        </div>}
        <div className={`writa-studio-grid ${writingMode === 'exam' ? 'writa-studio-grid-exam' : ''}`}>
          <section className="writa-editor-panel" aria-label="Writing studio">
            <div className="writa-prompt"><span className="writa-kicker">QUESTION</span><p>{activeTask.prompt}</p></div>
            {activeTask.minimumWords === 150 && activeTask.type.includes('Academic') && <div className="writa-task-visual-area">
              {activeTaskVisual
                ? <WritaTaskVisual username={username} taskId={activeTask.id} visual={activeTaskVisual} />
                : <div className="writa-task-visual-empty"><div><FileCheck2 size={17} /><span><strong>Task 1 visual</strong><small>Generate a chart, table, process, or schematic from this prompt.</small></span></div><Button className="writa-primary-button" onClick={() => void generateTaskVisual(activeTask)} disabled={visualBusyId !== null || examStarted}>{visualBusyId === activeTask.id ? <><LoaderCircle className="writa-spin" size={14} /> Creating visual…</> : <><Sparkles size={14} /> Generate visual</>}</Button></div>}
              {visualError && <p className="writa-alert" role="alert">{visualError}</p>}
            </div>}
            {writingMode === 'guided' && studioHint && <div className="writa-stage-hint"><Lightbulb size={15} /><span>{studioHint}</span><button type="button" aria-label="Dismiss scaffold" onClick={() => setStudioHint('')}><X size={14} /></button></div>}
            <div className="writa-editor-toolbar"><span><PenLine size={14} /> {writingMode === 'exam' ? 'Exam response' : 'Practice draft'}</span><span className="writa-save-status"><Check size={13} /> {saveStatus}</span></div>
            <textarea className="writa-editor" value={draft} onChange={(event) => updateDraft(event.target.value)} disabled={writingMode === 'exam' && (!examStarted || examFinished)} placeholder={writingMode === 'exam' ? examStarted ? 'Write your response independently. Your coach is disabled during Exam Simulation.' : 'Start the timed attempt to begin writing.' : 'Start with your own ideas. Your coach will guide, not write for you.'} aria-label={writingMode === 'exam' ? 'Your IELTS exam response' : 'Your IELTS writing draft'} maxLength={12000} />
            {writingMode === 'guided' && <div className="writa-just-in-time-help">
              <div className="writa-help-toolbar"><span><Sparkles size={13} /> JUST-IN-TIME HELP</span><small>Choose a written scaffold for this task and draft</small></div>
              <div className="writa-help-buttons">{justInTimeHelps.map(({ kind, label, icon: Icon }) => <button type="button" key={kind} onClick={() => void requestScaffoldHelp(kind)} disabled={scaffoldPending} title={`Get help with ${label.toLocaleLowerCase()}`}><Icon size={13} />{label}</button>)}</div>
              {scaffoldPending && <div className="writa-help-pending" role="status"><LoaderCircle className="writa-spin" size={14} /> Writia is finding a useful next step…</div>}
              {scaffoldError && <p className="writa-help-error" role="status">{scaffoldError}</p>}
              {scaffoldCards.map((card) => <article className="writa-scaffold-card" key={card.id}>
                <div className="writa-scaffold-card-heading"><span><Sparkles size={14} /><strong>{card.title}</strong></span><button type="button" onClick={() => setScaffoldCards((current) => current.filter((item) => item.id !== card.id))} aria-label="Dismiss writing scaffold"><X size={14} /></button></div>
                <p className="writa-scaffold-reason">{card.reason}</p>
                <p className="writa-scaffold-support">{card.support}</p>
                {card.example && <div className="writa-scaffold-example"><span>TRY THIS FRAME</span><p>{card.example}</p><button type="button" onClick={() => addScaffoldExample(card.example)}>Add frame to draft <ArrowRight size={13} /></button></div>}
                <p className="writa-scaffold-next"><strong>Your next step:</strong> {card.tryNext}</p>
              </article>)}
            </div>}
            <div className="writa-editor-footer"><span><strong>{count}</strong> words <i /> {Math.max(0, activeTask.minimumWords - count)} to minimum</span><div className="writa-editor-actions">{writingMode === 'guided' ? <><button type="button" className={`writa-timer ${timerRunning ? 'writa-timer-on' : ''}`} onClick={() => setTimerRunning((current) => !current)}><Timer size={15} />{formatTime(timerSeconds)}</button><button type="button" className="writa-reset-timer" title="Reset timer" aria-label="Reset timer" onClick={() => { setTimerRunning(false); setTimerSeconds(activeTask.minimumWords === 250 ? 40 * 60 : 20 * 60) }}><RotateCcw size={14} /></button></> : <span className={`writa-timer writa-exam-clock ${timerRunning ? 'writa-timer-on' : ''}`} aria-live="polite"><Timer size={15} />{formatTime(timerSeconds)}</span>}</div></div>
            <div className="writa-studio-actions">{writingMode === 'guided'
              ? <><Button className="writa-assess-button" onClick={() => void requestAssessment('guided')} disabled={busy}><FileCheck2 size={16} />{busy ? 'Assessing…' : 'Review my writing'}<ArrowRight size={15} /></Button><span>AI estimate for practice only</span></>
              : !examStarted && (!examFinished || assessment)
                ? <><Button className="writa-assess-button" onClick={startExam}><Timer size={16} />{examFinished ? 'Start another attempt' : 'Start timed attempt'}<ArrowRight size={15} /></Button><span>Starting a new attempt replaces this task’s saved exam response.</span></>
                : <><Button className="writa-assess-button" onClick={submitExam} disabled={busy || count === 0}>{busy ? 'Assessing…' : examStarted ? 'End exam & submit' : 'Submit for assessment'}<ArrowRight size={15} /></Button><span>{count === 0 ? 'Write a response before submitting.' : 'Independent attempt · practice estimate only'}</span></>}</div>
          </section>

          {writingMode === 'guided' && <aside className="writa-coach-panel" aria-label="Writia writing coach">
            <div className="writa-coach-heading"><span className="writa-coach-icon"><Sparkles size={17} /></span><div><h2>Writa Coach</h2><small className="writa-coach-tagline">Your personal IELTS writing coach</small><p><i className={liveConnected ? 'writa-live-dot writa-live-dot-on' : 'writa-live-dot'} />{liveStatus}</p></div><label className={`writa-voice-toggle ${voiceEnabled ? 'writa-voice-toggle-on' : ''}`} title={liveConnected ? 'Toggle microphone input for live voice guidance' : 'Start a live voice session first'}><input type="checkbox" aria-label="Voice mode" checked={voiceEnabled} disabled={!liveConnected || voiceBusy} onChange={(event) => void toggleVoiceMode(event.target.checked)} /><span>{voiceBusy ? <LoaderCircle className="writa-spin" size={14} /> : voiceEnabled ? <Mic size={14} /> : <MicOff size={14} />}</span><small>Voice</small></label>{liveConnected ? <button type="button" className="writa-disconnect" onClick={stopLiveCoach} aria-label="End live voice session" title="End live voice session"><X size={15} /></button> : <button type="button" className="writa-connect" onClick={() => void startLiveCoach()} disabled={liveConnecting || coachTextPending} aria-label="Start live voice conversation" title="Start a live voice conversation">{liveConnecting ? <LoaderCircle className="writa-spin" size={15} /> : <AudioLines size={15} />}{liveConnecting ? 'Connecting' : 'Go live'}</button>}</div>
            <div className="writa-coach-preferences">
              <label><span>LANGUAGE</span><select aria-label="Writia coach language" value={coachLanguage} disabled={liveConnected || liveConnecting} onChange={(event) => changeCoachLanguage(event.target.value)}>{WRITIA_COACH_LANGUAGES.map((language) => <option key={language} value={language}>{language === 'Urdu' ? 'Urdu (Pakistan)' : language}</option>)}</select></label>
              <label><span>TEXT MODEL</span><select aria-label="Writia coach text model" value={coachTextModel} disabled={coachTextPending} onChange={(event) => changeCoachTextModel(event.target.value)}>{ASSISTANT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.description}</option>)}</select></label>
              <label><span>LIVE VOICE</span><select aria-label="Writia coach voice" value={liveVoice} disabled={liveConnected || liveConnecting} onChange={(event) => changeLiveVoice(event.target.value)}>{GEMINI_LIVE_VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}</select></label>
            </div>
            <p className="writa-coach-audio-note">{liveConnected ? voiceEnabled ? 'Live voice is on. You can also type a message at any time.' : 'Live session connected in text mode. Turn on Voice to speak.' : 'Text chat is ready. Go live for spoken, real-time guidance.'}</p>
            <label className={`writa-scaffold-mode ${realtimeScaffoldEnabled ? 'writa-scaffold-mode-on' : ''}`}>
              <input type="checkbox" aria-label="Real-time Scaffolded Coaching" checked={realtimeScaffoldEnabled} onChange={(event) => toggleRealtimeScaffold(event.target.checked)} />
              <span><Sparkles size={14} /></span>
              <strong>Real-time Scaffolded Coaching</strong>
            </label>
            <div className="writa-scaffold-level"><div><span className="writa-kicker">ADAPTIVE SCAFFOLD · LEVEL {scaffoldLevel}</span><strong>{focusCriterion ? `Focus: ${focusCriterion.label}` : 'Start with a guiding question'}</strong></div><span className="writa-level-badge">{scaffoldLabels[scaffoldLevel].toUpperCase()}</span></div>
            <p className="writa-coach-explainer">Ask about the current task or draft in text, or go live for conversational voice guidance. Writia asks before it explains and never edits your work without you.</p>
            <div className="writa-coach-conversation" aria-live="polite">
              {coachMessages.length ? coachMessages.map((message) => <div className={`writa-coach-message writa-coach-message-${message.role}`} key={message.id}>{message.role === 'coach' ? <Sparkles size={13} /> : <MessageCircle size={13} />}<p>{message.text}</p></div>) : <div className="writa-coach-empty"><Lightbulb size={19} /><p>Ask a question about this task or draft to start a text chat. For spoken, real-time help, go live and talk through your writing with Writia.</p></div>}
              {(livePending || coachTextPending) && <span className="writa-coach-thinking"><LoaderCircle className="writa-spin" size={14} /> Thinking through your next step</span>}
            </div>
            <form className="writa-coach-input" onSubmit={submitCoachMessage}><input value={coachInput} onChange={(event) => setCoachInput(event.target.value)} placeholder={liveConnected && voiceEnabled ? 'Type a message or speak…' : 'Ask Writia about your task or draft…'} aria-label="Message Writia Coach" /><button type="submit" disabled={!coachInput.trim() || liveConnecting || coachTextPending || liveConnected && livePending} aria-label="Send message"><Send size={16} /></button></form>
          </aside>}
        </div>
      </>}

      {module === 'guided' && <section className="writa-module-view"><div className="writa-section-title"><div><p className="writa-kicker">SCAFFOLDED COMPOSITION</p><h2>Build the skill, then the essay.</h2><p>Move from task understanding to independent revision. Writa gives only the support this stage needs.</p></div><span className="writa-module-number">01 / 05</span></div><div className="writa-guided-layout"><div className="writa-stage-list">{guidedStages.map((stage, index) => <button type="button" key={stage.title} className={guidedStage === index ? 'writa-stage-active' : ''} onClick={() => setGuidedStage(index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage.title}</strong><ArrowRight size={15} /></button>)}</div><article className="writa-stage-detail"><span className="writa-kicker">STAGE {String(guidedStage + 1).padStart(2, '0')}</span><h3>{guidedStages[guidedStage].title}</h3><p>{guidedStages[guidedStage].detail}</p><div className="writa-guided-task"><span>YOUR CURRENT PROMPT</span><strong>{activeTask.label}</strong><p>{activeTask.prompt}</p></div><Button className="writa-primary-button" onClick={() => openGuidedStage(guidedStage)}>Continue in writing studio <ArrowRight size={15} /></Button></article></div></section>}

      {module === 'drills' && <WritaWritingDrills
        apiKey={apiKey}
        username={username}
        model={writingAssessmentModel}
        recommendedFocus={latestAssessment?.priority ?? focusCriterion?.nextStep ?? ''}
        liveConnected={liveConnected}
        liveConnecting={liveConnecting}
        livePending={livePending}
        liveStatus={liveStatus}
        onStartLiveCoach={(context) => void startLiveCoach(context)}
        onSendLiveDraftUpdate={(context) => sendLiveTurn(context)}
        onStopLiveCoach={stopLiveCoach}
        onOpenStudio={() => onModuleChange('studio')}
      />}

      {module === 'assignments' && <WritaAssignments
        assignments={assignments}
        busy={assignmentBusy}
        submittingId={assignmentSubmittingId}
        error={assignmentError}
        onCreate={() => void createWritingAssignment()}
        onResponseChange={updateAssignmentResponse}
        onSubmit={(item) => void submitWritingAssignment(item)}
      />}
      {module === 'podcasts' && <Suspense fallback={<section className="writa-module-view" role="status">Loading Writia Podcasts…</section>}>
        <PodcastsPage
          username={username}
          profile={profile}
          apiKey={apiKey}
          results={[]}
          lexicalEntries={[]}
          assignments={[]}
          product="writia"
          writingAssessments={assessments}
          writingAssignments={assignments.map(({ title, focus, status }) => ({ title, focus, status }))}
        />
      </Suspense>}

      {module === 'flashcards' && <Suspense fallback={<section className="writa-module-view writa-flashcards-loading" role="status">Loading Writia Flashcards…</section>}>
        <WritiaFlashcardsPage
          username={username}
          entries={writingFlashcardEntries}
          savedIds={[]}
          apiKey={apiKey}
          onOpenSettings={onOpenSettings}
          onOpenLexis={() => { setWritingBankTab('vocabulary'); onModuleChange('writing-bank') }}
          product="writia"
          showSavedFilter={false}
        />
      </Suspense>}

      {module === 'writing-bank' && <section className="writa-module-view writa-writing-bank">
        <div className="writa-section-title"><div><p className="writa-kicker">WRITING TOPICS &amp; VOCABULARY STUDIO</p><h2>Build your writing toolkit.</h2><p>Explore IELTS tasks, develop useful language, create your own study materials, and apply everything directly to your draft.</p></div><span className="writa-module-number">{writingTasks.length} TASKS · {availableWritingVocabulary.length} TERMS</span></div>
        <div className="learning-library-tabs writa-writing-bank-tabs" role="tablist" aria-label="Writing topics and vocabulary">
          {([
            { id: 'topics', label: 'Topics & Tasks', detail: 'Find a prompt for your next response', icon: ListFilter, count: writingTasks.length, iconClass: 'topic-bank-tab-icon' },
            { id: 'vocabulary', label: 'Vocabulary Bank', detail: 'Explore words in writing context', icon: BookOpen, count: availableWritingVocabulary.length, iconClass: 'lexical-vault-tab-icon' },
            { id: 'builder', label: 'Build Your Own', detail: 'Add a task or save useful language', icon: Sparkles, iconClass: 'vocab-builder-tab-icon' },
            { id: 'upgrades', label: 'Vocabulary Upgrade', detail: 'Practise more precise academic wording', icon: Target, iconClass: 'topic-bank-tab-icon' },
          ] as const).map((tab) => <button id={`writa-bank-tab-${tab.id}`} type="button" role="tab" aria-selected={writingBankTab === tab.id} aria-controls={`writa-bank-panel-${tab.id}`} tabIndex={writingBankTab === tab.id ? 0 : -1} className={writingBankTab === tab.id ? 'learning-library-tab learning-library-tab-active' : 'learning-library-tab'} key={tab.id} onClick={() => { setWritingBankTab(tab.id); setWritingBankSearch('') }} onKeyDown={(event) => moveWritingBankTab(event, tab.id)}>
            <span className={`learning-library-tab-icon ${tab.iconClass}`}><tab.icon size={18} /></span>
            <span className="learning-library-tab-copy"><strong>{tab.label}</strong><small>{tab.detail}</small></span>
            {tab.count !== undefined ? <span className="learning-library-tab-count">{tab.count}</span> : <span className="learning-library-tab-arrow"><ArrowRight size={15} /></span>}
          </button>)}
        </div>
        <div id="writa-bank-panel-topics" role="tabpanel" aria-labelledby="writa-bank-tab-topics" hidden={writingBankTab !== 'topics'}>
          <label className="writa-bank-search"><Search size={16} /><input value={writingBankSearch} onChange={(event) => setWritingBankSearch(event.target.value)} placeholder="Search task types, topics, or prompts…" aria-label="Search writing tasks" /></label>
          <div className="writa-bank-section-heading"><div><span className="writa-kicker">CENTRAL IELTS TASK BANK</span><strong>Use any prompt in the studio</strong></div><span>{filteredWritingTasks.length} tasks</span></div>
          <div className="writa-task-bank-grid">{filteredWritingTasks.map((task) => <article className="writa-task-bank-card" key={task.id}>
            <div><span className="writa-kicker">{task.type}</span>{task.id.startsWith('custom-') && <span className="writa-custom-tag">YOUR PROMPT</span>}{taskVisuals[task.id] && <span className="writa-custom-tag">VISUAL SAVED</span>}</div>
            <h3>{task.label}</h3><p>{task.prompt}</p>
            <footer><span>{task.minimumWords} words · {task.minimumWords === 250 ? '40 min' : '20 min'}</span><Button className="writa-primary-button" onClick={() => selectWritingTask(task)}>Use this prompt <ArrowRight size={14} /></Button></footer>
          </article>)}</div>
          {!filteredWritingTasks.length && <div className="writa-bank-empty">No tasks match this search.</div>}
        </div>
        <div id="writa-bank-panel-vocabulary" role="tabpanel" aria-labelledby="writa-bank-tab-vocabulary" hidden={writingBankTab !== 'vocabulary'}>
          <label className="writa-bank-search"><Search size={16} /><input value={writingBankSearch} onChange={(event) => setWritingBankSearch(event.target.value)} placeholder="Search words, meanings, examples, or topics…" aria-label="Search writing vocabulary" /></label>
          <div className="writa-bank-section-heading"><div><span className="writa-kicker">WRITING LEXIS</span><strong>Precise, useful language for IELTS Writing</strong></div><span>{filteredWritingVocabulary.length} terms</span></div>
          <div className="writa-vocabulary-grid">{filteredWritingVocabulary.map((entry) => <article className="writa-vocab-card" key={entry.id}>
            <div><span>{entry.category}</span><small>{entry.topic}</small></div><h3>{entry.term}</h3><p>{entry.meaning}</p><blockquote>{entry.example}</blockquote>
            <button type="button" onClick={() => addVocabularyToDraft(entry.term)}>Add to current draft <ArrowRight size={13} /></button>
          </article>)}</div>
          {!filteredWritingVocabulary.length && <div className="writa-bank-empty">No vocabulary matches this search.</div>}
        </div>
        <div id="writa-bank-panel-builder" role="tabpanel" aria-labelledby="writa-bank-tab-builder" hidden={writingBankTab !== 'builder'}>
          <div className="writa-bank-form-layout">
          <article className="writa-bank-form-card"><span className="writa-kicker">ADD A TASK TO THE SHARED BANK</span><h3>Build your own IELTS prompt</h3><p>Your prompt will be available in the bank, Studio picker, and Guided Practice.</p>
            <form onSubmit={addCustomWritingTask}>
              <label>Task type<select value={customTaskType} onChange={(event) => setCustomTaskType(event.target.value as typeof customTaskType)}><option value="task2">Task 2 · Essay</option><option value="academic1">Academic Task 1 · Report</option><option value="general1">General Training Task 1 · Letter</option></select></label>
              <label>Topic title<input value={customTaskTitle} onChange={(event) => setCustomTaskTitle(event.target.value)} maxLength={90} required placeholder="e.g. Community libraries" /></label>
              <label>Full task prompt<textarea value={customTaskPrompt} onChange={(event) => setCustomTaskPrompt(event.target.value)} maxLength={1800} minLength={30} required placeholder="Write the complete task instructions…" /></label>
              <Button className="writa-primary-button" type="submit"><Plus size={14} /> Add to shared task bank</Button>
            </form>
            <WritaTask1ImageBuilder
              apiKey={apiKey}
              model={writingAssessmentModel}
              username={username}
              onTaskCreated={addGeneratedImageTask}
            />
          </article>
          <article className="writa-bank-form-card"><span className="writa-kicker">BUILD A PERSONAL WORD BANK</span><h3>Save vocabulary in context</h3><p>Record useful language with a meaning and your own example so it is ready for future writing.</p>
            <form onSubmit={addWritingVocabulary}>
              <label>Word or phrase<input value={newVocabTerm} onChange={(event) => setNewVocabTerm(event.target.value)} maxLength={90} required placeholder="e.g. a substantial proportion" /></label>
              <label>Meaning<input value={newVocabMeaning} onChange={(event) => setNewVocabMeaning(event.target.value)} maxLength={220} required placeholder="Explain it in your own words" /></label>
              <label>Example sentence<textarea value={newVocabExample} onChange={(event) => setNewVocabExample(event.target.value)} maxLength={400} required placeholder="Use the phrase naturally in an IELTS-style sentence" /></label>
              <label>Topic (optional)<input value={newVocabTopic} onChange={(event) => setNewVocabTopic(event.target.value)} maxLength={70} placeholder="e.g. Education" /></label>
              <Button className="writa-primary-button" type="submit"><Plus size={14} /> Save vocabulary</Button>
            </form>
          </article>
          </div>
        </div>
        <div id="writa-bank-panel-upgrades" role="tabpanel" aria-labelledby="writa-bank-tab-upgrades" hidden={writingBankTab !== 'upgrades'}>
          <div className="writa-bank-section-heading"><div><span className="writa-kicker">UPGRADE WITH PRECISION</span><strong>Replace vague wording with natural academic language</strong></div></div>
          <p className="writa-upgrade-guidance">Compare everyday wording with a more precise option. Vocabulary alone does not determine an IELTS band: accuracy, context, and natural use matter more than complexity.</p>
          <div className="writa-upgrade-grid">{starterWritingVocabulary.filter((entry) => ['Academic collocation', 'Trend language', 'Comparison', 'Data description', 'Overview language', 'Problem and solution', 'Discourse marker', 'Argument structure', 'Cohesion', 'Formal letter'].includes(entry.category)).map((entry) => {
            const comparison = writingVocabularyComparisons[entry.id]
            return <article className="writa-upgrade-card" key={entry.id}>
            <span>{entry.category} · {entry.topic}</span>
            <div className="writa-upgrade-comparison">
              <div><small>LESS PRECISE</small><strong>{comparison?.everyday ?? 'a general expression'}</strong></div>
              <ArrowRight size={15} />
              <div><small>MORE PRECISE</small><strong>{entry.term}</strong></div>
            </div>
            <p>{entry.meaning}</p><p className="writa-upgrade-note"><strong>Usage:</strong> {comparison?.note ?? 'Choose this wording only when it accurately expresses your meaning.'}</p><blockquote>{entry.example}</blockquote>
            <Button className="writa-primary-button" onClick={() => { setVocabPracticeSentence(entry.example); addVocabularyToDraft(entry.term) }}>Practise in my draft <PenLine size={14} /></Button>
          </article>})}</div>
          <article className="writa-upgrade-practice"><span className="writa-kicker">YOUR SENTENCE</span><textarea value={vocabPracticeSentence} onChange={(event) => setVocabPracticeSentence(event.target.value)} placeholder="Write a sentence using one upgraded phrase, or choose a model above." aria-label="Vocabulary upgrade practice sentence" /><Button className="writa-primary-button" onClick={() => addVocabularyToDraft(vocabPracticeSentence.trim())} disabled={!vocabPracticeSentence.trim()}>Add sentence to current draft <ArrowRight size={14} /></Button></article>
        </div>
      </section>}

      {module === 'assessment' && <section className="writa-module-view">
        <div className="writa-section-title"><div><p className="writa-kicker">EVIDENCE-BASED REVIEW</p><h2>See what to work on next.</h2><p>Writia evaluates the four IELTS criteria in a separate assessment step, using evidence from your response.</p></div>{assessment && <span className="writa-band-estimate">Practice estimate · Band {assessment.overallBand.toFixed(1)}</span>}</div>
        {assessmentProgress !== 'idle' && <section className={`writa-assessment-progress writa-assessment-progress-${assessmentProgress}`} aria-live="polite">
          <div className="writa-assessment-progress-heading">{assessmentProgress === 'complete' ? <Check size={18} /> : assessmentProgress === 'assessment-failed' || assessmentProgress === 'lesson-failed' ? <X size={18} /> : <LoaderCircle className="writa-spin" size={18} />}<div><strong>{assessmentProgress === 'complete' ? 'Your assessment and learning lesson are ready' : assessmentProgress === 'assessment-failed' ? 'The assessment could not be completed' : assessmentProgress === 'lesson-failed' ? 'Your assessment is ready; the lesson needs another attempt' : assessmentProgress === 'assessing' ? 'Assessing your response' : 'Creating your adaptive learning lesson'}</strong><span>{assessmentProgress === 'complete' ? 'Review your band estimate, criterion feedback, and interactive lesson below.' : assessmentProgress === 'assessment-failed' ? 'Your writing is still saved in the studio. Review the error above, then return to retry.' : assessmentProgress === 'lesson-failed' ? 'Your band estimate is saved. Use the retry option in the lesson section below.' : assessmentProgress === 'assessing' ? 'Writia is checking your response against the four writing criteria.' : 'Your criterion feedback is complete. Writia is building an interactive lesson from your strengths and next steps.'}</span></div></div>
          <ol><li className={assessment ? 'writa-assessment-step-done' : assessmentProgress === 'assessment-failed' ? 'writa-assessment-step-failed' : 'writa-assessment-step-active'}>{assessment ? <Check size={14} /> : assessmentProgress === 'assessment-failed' ? <X size={14} /> : <LoaderCircle className="writa-spin" size={14} />} Assess response</li><li className={assessmentProgress === 'complete' ? 'writa-assessment-step-done' : assessmentProgress === 'lesson-failed' ? 'writa-assessment-step-failed' : assessmentProgress === 'lesson' ? 'writa-assessment-step-active' : ''}>{assessmentProgress === 'complete' ? <Check size={14} /> : assessmentProgress === 'lesson-failed' ? <X size={14} /> : assessmentProgress === 'lesson' ? <LoaderCircle className="writa-spin" size={14} /> : <BookOpen size={14} />} Create adaptive lesson</li></ol>
          {assessmentProgress === 'assessment-failed' && <Button className="writa-primary-button" onClick={() => onModuleChange('studio')}>Return to writing studio <ArrowRight size={14} /></Button>}
        </section>}
        {assessment ? <>
          <div className="writa-assessment-summary"><span className="writa-score-round">{assessment.overallBand.toFixed(1)}</span><div><span className="writa-kicker">OVERALL PRACTICE ESTIMATE · {assessment.mode === 'exam' ? 'EXAM SIMULATION' : assessment.mode === 'guided' ? 'GUIDED PRACTICE' : 'PRACTICE'}</span><p>{assessment.summary}</p></div></div>
          <div className="writa-criteria-grid">{assessment.criteria.map((item) => <article className="writa-criterion" key={item.id}><div><span>{item.label}</span><strong>{item.band.toFixed(1)}</strong></div><p>{item.evidence}</p><small><Lightbulb size={13} />{item.nextStep}</small><button type="button" className="writa-band-link" onClick={() => { setBandDescriptorFocus({ criterion: item.id, band: Math.max(4, Math.min(9, Math.round(item.band))) }); onModuleChange('band-descriptors') }}>Understand this band <ArrowRight size={13} /></button></article>)}</div>
          <div className="writa-priority"><Target size={17} /><div><span className="writa-kicker">TRANSFER PRIORITY</span><p>{assessment.priority}</p></div></div>
        </> : assessmentProgress !== 'assessing' && <div className="writa-assessment-empty"><FileCheck2 size={24} /><h3>No assessment for this draft yet</h3><p>Choose an IELTS task, write a response in the studio, then request a diagnostic review. The estimate is for practice and is not an official IELTS score.</p><Button className="writa-primary-button" onClick={() => onModuleChange('studio')}>Return to writing studio <ArrowRight size={15} /></Button></div>}
        {assessments.length > 0 && <div className="writa-history-block"><h3>Recent writing reviews</h3>{assessments.slice(0, 5).map((item) => <div className="writa-history-row" key={item.id}><div><strong>{item.taskLabel}</strong><span>{item.mode === 'exam' ? 'Exam simulation' : item.mode === 'guided' ? 'Guided practice' : 'Practice'} · {new Date(item.createdAt).toLocaleDateString()} · {item.wordCount} words</span></div><b>{item.overallBand.toFixed(1)}</b><button type="button" aria-label={`View review for ${item.taskLabel}`} onClick={() => { setAssessment(item); setAssessmentProgress(item.assessmentLessonStatus === 'ready' ? 'complete' : item.assessmentLessonStatus === 'failed' ? 'lesson-failed' : item.assessmentLessonStatus === 'generating' ? 'lesson' : 'idle') }}><ArrowRight size={15} /></button></div>)}</div>}
      </section>}
      {module === 'assessment' && assessment && <WritaAdaptiveAssessmentLesson
        assessmentId={assessment.id}
        assessment={assessment}
        taskPrompt={assessment.taskPrompt ?? writingTasks.find((task) => task.id === assessment.taskId)?.prompt ?? ''}
        response={assessment.response ?? ''}
        apiKey={apiKey}
        model={writingAssessmentModel}
        status={assessment.assessmentLessonStatus}
        onStatusChange={updateAssessmentLessonStatus}
      />}
      {module === 'assessment' && chartAssessment && <WritingAssessmentCharts assessment={chartAssessment} assessments={assessments} />}
      {module === 'band-descriptors' && <BandDescriptorsPage product="writing" initialCriterion={bandDescriptorFocus?.criterion} initialBand={bandDescriptorFocus?.band} />}
      {module === 'placement-assessment' && <PlacementAssessmentPage skill="writing" apiKey={apiKey} writingModel={writingAssessmentModel} testType={profile.testType} result={profile.writingPlacementAssessment} onComplete={onSavePlacementAssessment} />}
      {module === 'coach-assets' && <Suspense fallback={<div className="writa-module-view" role="status">Loading Writia Coach Assets…</div>}>
        <CoachAssetsPage
          platform="writing"
          onOpenCoach={() => window.dispatchEvent(new Event('speakia:open-coach'))}
          onAdapt={(asset) => window.dispatchEvent(new CustomEvent('speakia:coach-adapt-asset', { detail: asset }))}
        />
      </Suspense>}
      {module === 'progress' && <section className="placement-profile-card" aria-label="Writing placement baseline">
        <div><p className="writa-kicker">WRITING PLACEMENT BASELINE</p><strong>{profile.writingPlacementAssessment ? `Starting point: Band ${profile.writingPlacementAssessment.overallBand.toFixed(1)}` : 'Set your writing starting point'}</strong>
          <p>{profile.writingPlacementAssessment ? profile.writingPlacementAssessment.summary : 'Take an optional short writing baseline so Writia can adapt your first practice focus.'}</p>
          {profile.writingPlacementAssessment && <div className="placement-profile-criteria">{profile.writingPlacementAssessment.criteria.map((criterion) => <span key={criterion.id}>{criterion.label}<strong>{criterion.band.toFixed(1)}</strong></span>)}</div>}
          {profile.writingPlacementAssessment && <small>Baseline from {new Date(profile.writingPlacementAssessment.createdAt).toLocaleDateString()} · AI practice estimate, not an official IELTS score.</small>}
        </div><Button className="writa-primary-button" onClick={() => onModuleChange('placement-assessment')}>{profile.writingPlacementAssessment ? 'Update baseline' : 'Take optional placement'} <ArrowRight size={14} /></Button>
      </section>}

      {module === 'resources' && <section className="writa-module-view"><div className="writa-section-title"><div><p className="writa-kicker">LEARN THEN APPLY</p><h2>A small library for the next step.</h2><p>Short lessons connected to real writing practice, not a passive pile of theory.</p></div><BookOpen size={23} /></div><div className="writa-resource-grid">{resources.map((resource, index) => <button type="button" key={resource.title} className={resourceIndex === index ? 'writa-resource-active' : ''} onClick={() => setResourceIndex(index)}><span>{resource.category}</span><strong>{resource.title}</strong><p>{resource.detail}</p><small>Explore lesson <ArrowRight size={13} /></small></button>)}</div><div className="writa-resource-apply"><Lightbulb size={17} /><p>Apply “{resources[resourceIndex].title}” to your current response.</p><Button className="writa-primary-button" onClick={() => { setStudioHint(resources[resourceIndex].detail); onModuleChange('studio') }}>Open writing studio <ArrowRight size={14} /></Button></div></section>}

      {module === 'progress' && <section className="writa-module-view">
        <div className="writa-section-title"><div><p className="writa-kicker">YOUR WRITIA LEARNER PROFILE</p><h2>Your writing progress, ready to put to work.</h2><p>This profile combines your writing preparation plan with evidence from Writia assessments. Use repeated evidence to decide what to practise next.</p></div><Sparkles size={23} /></div>
        <div className="writa-learner-details">
          <div className="writa-learner-details-heading"><div><span className="writa-kicker">YOUR WRITING PLAN</span><strong>{profile.displayName || profile.username} · IELTS {profile.testType}</strong></div><button type="button" className="writa-profile-action" onClick={onOpenProfile}>Edit writing plan <ArrowRight size={13} /></button></div>
          <div className="writa-learner-details-grid">
            <article><span>Writing target band</span><strong>{profile.writingTargetBand ? `Band ${Number(profile.writingTargetBand).toFixed(1)}` : 'Not set'}</strong></article>
            <article><span>Writing test date</span><strong>{formatLearnerDate(profile.writingTestDate)}</strong></article>
            <article className="writa-learner-goal"><span>Writing study goal</span><strong>{profile.writingStudyGoal || 'Add a goal to personalise your Writia coaching.'}</strong></article>
            <article><span>Test type</span><strong>IELTS {profile.testType}</strong></article>
            <article><span>First language</span><strong>{profile.firstLanguage || 'Not set'}</strong></article>
          </div>
        </div>
        <div className="learning-profile-overview writa-progress-stats">
          <button type="button" onClick={() => openWritingReview()}><span><FileCheck2 size={15} /> WRITING ASSESSMENTS</span><strong>{assessments.length}</strong><small>Saved practice reviews <ArrowRight size={12} /></small></button>
          <button type="button" onClick={() => openWritingReview()}><span><Sparkles size={15} /> AVERAGE PRACTICE ESTIMATE</span><strong>{averageBand === null ? '--' : averageBand.toFixed(1)}</strong><small>Across {assessments.length} reviews · / 9 <ArrowRight size={12} /></small></button>
          <button type="button" onClick={() => openWritingReview()}><span><Target size={15} /> LATEST RESULT</span><strong>{latestAssessment ? latestAssessment.overallBand.toFixed(1) : '--'}</strong><small>{latestAssessment ? latestAssessment.taskLabel : 'No writing assessment yet'} <ArrowRight size={12} /></small></button>
          <button type="button" onClick={() => openWritingReview()}><span><CalendarCheck size={15} /> MOST RECENT PRACTICE</span><strong>{latestAssessment ? new Date(latestAssessment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '--'}</strong><small>{latestAssessment ? 'Writing assessment' : 'Start your first practice'} <ArrowRight size={12} /></small></button>
        </div>
        <div className="writa-profile-charts">
          <article className="writa-report-chart-card">
            <div><span className="writa-kicker">WRITING CRITERIA</span><strong>Recent skill balance</strong></div>
            {writingCriterionAverages.length ? <div className="writa-criterion-chart" role="img" aria-label="Vertical bar chart showing recent IELTS writing criterion band averages">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={writingCriterionAverages} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="var(--writa-chart-grid)" vertical={false} />
                  <XAxis dataKey="criterion" interval={0} tick={{ fill: 'var(--writa-chart-text)', fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis type="number" domain={[0, 9]} ticks={[0, 3, 6, 9]} width={28} tick={{ fill: 'var(--writa-chart-text)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 9`, 'Recent average']} />
                  <Bar dataKey="band" fill="#4d8a6b" radius={[5, 5, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <p className="writa-chart-empty">Criterion scores will appear after your first saved writing assessment.</p>}
          </article>
          <article className="writa-report-chart-card">
            <div><span className="writa-kicker">WRITING JOURNEY</span><strong>Practice estimate trend</strong></div>
            {writingBandTrend.length > 0 ? <div className="writa-history-chart" role="img" aria-label="Area chart showing recent writing practice estimates">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={writingBandTrend} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
                  <defs><linearGradient id="writiaLearnerBandTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4d8a6b" stopOpacity={0.25} /><stop offset="100%" stopColor="#4d8a6b" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid stroke="var(--writa-chart-grid)" vertical={false} />
                  <XAxis dataKey="attempt" tickFormatter={(value) => `#${value}`} tick={{ fill: 'var(--writa-chart-text)', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} tick={{ fill: 'var(--writa-chart-text)', fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip labelFormatter={(value) => `Attempt ${value}`} formatter={(value) => [`${Number(value).toFixed(1)} / 9`, 'Practice estimate']} />
                  <Area type="monotone" dataKey="band" stroke="#36785f" strokeWidth={2.5} fill="url(#writiaLearnerBandTrend)" activeDot={{ r: 5, fill: '#36785f' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div> : <p className="writa-chart-empty">Complete another writing assessment to reveal your progress trend.</p>}
          </article>
        </div>
        <div className="writa-profile-focus"><span className="writa-focus-icon"><Target size={18} /></span><div><span className="writa-kicker">NEXT PRACTICE PRIORITY</span><strong>{focusCriterion?.label ?? 'Write your first response'}</strong><p>{focusCriterion?.nextStep ?? 'Start with one IELTS prompt. Writia will use evidence from your writing to recommend a useful next step.'}</p></div><Button className="writa-primary-button" onClick={() => onModuleChange(focusCriterion ? 'drills' : 'studio')}>{focusCriterion ? 'Practise this skill' : 'Start writing'} <ArrowRight size={14} /></Button></div>
        {assessments.length > 0 && <div className="writa-progress-history"><h3>Assessment trail</h3>{assessments.slice(0, 6).map((item) => <button type="button" key={item.id} onClick={() => { setAssessment(item); setAssessmentProgress(item.assessmentLessonStatus === 'ready' ? 'complete' : item.assessmentLessonStatus === 'failed' ? 'lesson-failed' : item.assessmentLessonStatus === 'generating' ? 'lesson' : 'idle'); onModuleChange('assessment') }}><span>{new Date(item.createdAt).toLocaleDateString()}</span><strong>{item.taskLabel}</strong><b>{item.overallBand.toFixed(1)}</b><ArrowRight size={14} /></button>)}</div>}
      </section>}
      {module === 'progress' && chartAssessment && <WritingAssessmentCharts assessment={chartAssessment} assessments={assessments} />}
    </div>
  )
}