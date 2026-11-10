import { Type, type FunctionDeclaration } from '@google/genai'

export type InfographicLayout = 'metric-grid' | 'bar-chart' | 'process' | 'comparison' | 'timeline' | 'mind-map' | 'funnel' | 'pyramid' | 'checklist'

export interface InfographicPalette {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  muted: string
}

export interface Infographic {
  id: string
  title: string
  topic: string
  summary: string
  layout: InfographicLayout
  palette?: InfographicPalette
  accent?: 'violet' | 'blue' | 'teal' | 'amber' | 'rose'
  metrics: { label: string; value: string; detail: string }[]
  data: { label: string; value: number }[]
  steps: { title: string; body: string; meta: string }[]
  columns: { title: string; summary: string; points: string[] }[]
  knowledgeCheck?: { question: string; options: { label: string; feedback: string; isCorrect: boolean }[] }
}

export function isInfographic(value: unknown): value is Infographic {
  if (!isRecord(value)) return false
  const validLayouts: InfographicLayout[] = ['metric-grid', 'bar-chart', 'process', 'comparison', 'timeline', 'mind-map', 'funnel', 'pyramid', 'checklist']
  const legacyAccents = ['violet', 'blue', 'teal', 'amber', 'rose']
  if (typeof value.layout !== 'string' || !validLayouts.includes(value.layout as InfographicLayout)
    || (!isInfographicPalette(value.palette) && (typeof value.accent !== 'string' || !legacyAccents.includes(value.accent)))
    || !Array.isArray(value.metrics) || value.metrics.length > 6
    || !Array.isArray(value.data) || value.data.length > 7
    || !Array.isArray(value.steps) || value.steps.length > 7
    || !Array.isArray(value.columns) || value.columns.length > 3) return false
  const layout = value.layout as InfographicLayout
  if ((layout === 'metric-grid' && value.metrics.length < 2)
    || (layout === 'bar-chart' && value.data.length < 3)
    || ((layout === 'process' || layout === 'timeline' || layout === 'mind-map' || layout === 'checklist') && value.steps.length < 3)
    || ((layout === 'funnel' || layout === 'pyramid') && value.data.length < 3)
    || (layout === 'comparison' && value.columns.length < 2)
    || (value.knowledgeCheck !== undefined && !isKnowledgeCheck(value.knowledgeCheck))) return false
  return typeof value.id === 'string' && value.id.length <= 100
    && typeof value.title === 'string'
    && value.title.length <= 100
    && typeof value.topic === 'string'
    && value.topic.length <= 120
    && typeof value.summary === 'string'
    && value.summary.length <= 240
    && value.metrics.every((item) => isRecord(item)
      && typeof item.label === 'string' && item.label.length <= 60
      && typeof item.value === 'string' && item.value.length <= 32
      && typeof item.detail === 'string' && item.detail.length <= 120)
    && value.data.every((item) => isRecord(item)
      && typeof item.label === 'string' && item.label.length <= 60
      && typeof item.value === 'number' && Number.isFinite(item.value) && item.value >= 0 && item.value <= 1_000_000)
    && value.steps.every((item) => isRecord(item)
      && typeof item.title === 'string' && item.title.length <= 90
      && typeof item.body === 'string' && item.body.length <= 240
      && typeof item.meta === 'string' && item.meta.length <= 40)
    && value.columns.every((item) => isRecord(item)
      && typeof item.title === 'string' && item.title.length <= 80
      && typeof item.summary === 'string' && item.summary.length <= 160
      && Array.isArray(item.points) && item.points.length >= 2 && item.points.length <= 4
      && item.points.every((point) => typeof point === 'string' && point.length <= 120))
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

function isInfographicPalette(value: unknown): value is InfographicPalette {
  return isRecord(value)
    && isHexColor(value.primary)
    && isHexColor(value.secondary)
    && isHexColor(value.background)
    && isHexColor(value.surface)
    && isHexColor(value.text)
    && isHexColor(value.muted)
}

function isKnowledgeCheck(value: unknown): value is NonNullable<Infographic['knowledgeCheck']> {
  return isRecord(value)
    && typeof value.question === 'string' && value.question.length <= 180
    && Array.isArray(value.options) && value.options.length >= 2 && value.options.length <= 4
    && value.options.every((option) => isRecord(option)
      && typeof option.label === 'string' && option.label.length <= 120
      && typeof option.feedback === 'string' && option.feedback.length <= 200
      && typeof option.isCorrect === 'boolean')
    && value.options.filter((option) => isRecord(option) && option.isCorrect).length === 1
}

const infographicItem = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    value: { type: Type.STRING },
    detail: { type: Type.STRING },
  },
  required: ['label', 'value', 'detail'],
}

const dataItem = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    value: { type: Type.NUMBER },
  },
  required: ['label', 'value'],
}

const stepItem = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    body: { type: Type.STRING },
    meta: { type: Type.STRING },
  },
  required: ['title', 'body', 'meta'],
}

const comparisonItem = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary: { type: Type.STRING },
    points: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['title', 'summary', 'points'],
}

const knowledgeCheckOption = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    feedback: { type: Type.STRING },
    isCorrect: { type: Type.BOOLEAN },
  },
  required: ['label', 'feedback', 'isCorrect'],
}

export const infographicTool: FunctionDeclaration = {
  name: 'build_speaking_infographic',
  description: 'Create a visually rich, editorial-quality IELTS Speaking infographic tailored to the request. Cover any relevant practice material including vocabulary and lexical resource, grammar, fluency and coherence, pronunciation, answer structure, question types, speaking strategies, and examples. Choose a useful composition: metric-grid, bar-chart, process, comparison, timeline, mind-map (summary hub with branches), funnel (broad-to-focused stages), pyramid (layered skill/answer structure), or checklist (actionable practice checklist). Choose a coordinated, high-contrast six-color palette for a light infographic canvas, independently of the app theme. Use strong visual hierarchy, short concrete copy, vivid but harmonious colors, and specific IELTS examples. Add an optional 2–4-option knowledgeCheck only when a quick interaction helps the learner apply the material; exactly one option must be correct, with useful feedback for each choice. Supply all arrays and use empty arrays for unused sections. Keep chart values non-negative; never present invented scores or statistics as facts.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: { type: Type.STRING, description: 'The learner’s requested visual and what it should help them understand.' },
      title: { type: Type.STRING, description: 'A clear, concise infographic headline.' },
      topic: { type: Type.STRING, description: 'The focused IELTS Speaking topic or skill.' },
      summary: { type: Type.STRING, description: 'One sentence describing the visual takeaway.' },
      layout: { type: Type.STRING, enum: ['metric-grid', 'bar-chart', 'process', 'comparison', 'timeline', 'mind-map', 'funnel', 'pyramid', 'checklist'] },
      palette: {
        type: Type.OBJECT,
        properties: {
          primary: { type: Type.STRING, description: 'Vivid primary accent as #RRGGBB.' },
          secondary: { type: Type.STRING, description: 'Complementary accent as #RRGGBB.' },
          background: { type: Type.STRING, description: 'Light canvas color as #RRGGBB.' },
          surface: { type: Type.STRING, description: 'Card surface color as #RRGGBB.' },
          text: { type: Type.STRING, description: 'High-contrast dark text as #RRGGBB.' },
          muted: { type: Type.STRING, description: 'Readable secondary text as #RRGGBB.' },
        },
        required: ['primary', 'secondary', 'background', 'surface', 'text', 'muted'],
      },
      metrics: { type: Type.ARRAY, items: infographicItem, description: 'For metric-grid: 2–6 labeled values with brief context.' },
      data: { type: Type.ARRAY, items: dataItem, description: 'For bar-chart, funnel, or pyramid: 3–7 comparable values; funnel/pyramid order from broad/foundation to narrow/apex.' },
      steps: { type: Type.ARRAY, items: stepItem, description: 'For process, timeline, mind-map, or checklist: 3–7 concise items; for mind-map these are branches; meta is a short stage/category label.' },
      columns: { type: Type.ARRAY, items: comparisonItem, description: 'For comparison: 2–3 alternatives, each with a concise summary and 2–4 short points.' },
      knowledgeCheck: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: knowledgeCheckOption },
        },
        required: ['question', 'options'],
        description: 'Optional applied knowledge check with 2–4 options and exactly one correct answer.',
      },
    },
    required: ['request', 'title', 'topic', 'summary', 'layout', 'palette', 'metrics', 'data', 'steps', 'columns'],
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, name: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new Error(`The infographic ${name} is missing or too long. Please try a more focused request.`)
  }
  return value.trim()
}

function entries<T>(value: unknown, name: string, maximum: number, parse: (entry: unknown, index: number) => T): T[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`The infographic ${name} are invalid. Please try again.`)
  return value.map(parse)
}

export function createInfographic(raw: unknown): Infographic {
  if (!isRecord(raw)) throw new Error('Speakia returned an invalid infographic. Please try again.')
  const layout = raw.layout
  if (layout !== 'metric-grid' && layout !== 'bar-chart' && layout !== 'process' && layout !== 'comparison' && layout !== 'timeline'
    && layout !== 'mind-map' && layout !== 'funnel' && layout !== 'pyramid' && layout !== 'checklist') {
    throw new Error('Speakia returned an unsupported infographic layout. Please try again.')
  }
  if (!isInfographicPalette(raw.palette)) {
    throw new Error('Speakia returned an invalid infographic color palette. Please try again.')
  }
  const palette = raw.palette
  const metrics = entries(raw.metrics, 'metrics', 6, (item) => {
    if (!isRecord(item)) throw new Error('Speakia returned an invalid infographic metric.')
    return { label: text(item.label, 'metric label', 60), value: text(item.value, 'metric value', 32), detail: text(item.detail, 'metric detail', 120) }
  })
  const data = entries(raw.data, 'chart data', 7, (item) => {
    if (!isRecord(item) || typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0 || item.value > 1_000_000) {
      throw new Error('Speakia returned invalid infographic chart data.')
    }
    return { label: text(item.label, 'chart label', 60), value: item.value }
  })
  const steps = entries(raw.steps, 'steps', 7, (item) => {
    if (!isRecord(item)) throw new Error('Speakia returned an invalid infographic step.')
    return { title: text(item.title, 'step title', 90), body: text(item.body, 'step description', 240), meta: text(item.meta, 'step label', 40) }
  })
  const columns = entries(raw.columns, 'comparison columns', 3, (item) => {
    if (!isRecord(item) || !Array.isArray(item.points) || item.points.length < 2 || item.points.length > 4) {
      throw new Error('Speakia returned invalid infographic comparison details.')
    }
    return {
      title: text(item.title, 'comparison title', 80),
      summary: text(item.summary, 'comparison summary', 160),
      points: item.points.map((point) => text(point, 'comparison point', 120)),
    }
  })
  if (layout === 'metric-grid' && (metrics.length < 2 || metrics.length > 6)
    || layout === 'bar-chart' && (data.length < 3 || data.length > 7)
    || (layout === 'process' || layout === 'timeline' || layout === 'mind-map' || layout === 'checklist') && (steps.length < 3 || steps.length > 7)
    || (layout === 'funnel' || layout === 'pyramid') && (data.length < 3 || data.length > 7)
    || layout === 'comparison' && (columns.length < 2 || columns.length > 3)) {
    throw new Error(`Speakia returned incomplete content for the ${layout} infographic. Please try again.`)
  }
  let knowledgeCheck: Infographic['knowledgeCheck']
  if (raw.knowledgeCheck !== undefined) {
    if (!isKnowledgeCheck(raw.knowledgeCheck)) throw new Error('Speakia returned an invalid infographic knowledge check.')
    knowledgeCheck = {
      question: text(raw.knowledgeCheck.question, 'knowledge-check question', 180),
      options: raw.knowledgeCheck.options.map((option) => ({
        label: text(option.label, 'knowledge-check answer', 120),
        feedback: text(option.feedback, 'knowledge-check feedback', 200),
        isCorrect: option.isCorrect,
      })),
    }
  }
  return {
    id: crypto.randomUUID(),
    title: text(raw.title, 'title', 100),
    topic: text(raw.topic, 'topic', 120),
    summary: text(raw.summary, 'summary', 240),
    layout,
    palette,
    metrics,
    data,
    steps,
    columns,
    ...(knowledgeCheck ? { knowledgeCheck } : {}),
  }
}
