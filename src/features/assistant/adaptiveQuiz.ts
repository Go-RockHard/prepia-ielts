import { Type, type FunctionDeclaration } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'

export type QuizQuestionType = 'mcq' | 'true_false' | 'fill_blank' | 'dropdown'

export interface AdaptiveQuizQuestion {
  id: string
  type: QuizQuestionType
  question: string
  options: string[]
  correctAnswer: string
  explanation: string
}

export interface AdaptiveQuiz {
  id: string
  title: string
  topic: string
  questions: AdaptiveQuizQuestion[]
}

export const adaptiveQuizTool: FunctionDeclaration = {
  name: 'build_adaptive_speaking_quiz',
  description: 'Create and render an interactive IELTS Speaking knowledge or skills quiz when the learner asks for a quiz, test, self-check, or quick assessment. Support mixed or single-type quizzes: multiple choice, true/false, fill-in-the-blank, and dropdown selection. Honor requested per-type question counts exactly when specified.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: { type: Type.STRING, description: 'The learner’s quiz request, subject, skill, level, and any requested question counts.' },
      topic: { type: Type.STRING, description: 'IELTS Speaking topic or skill to assess.' },
      focus: { type: Type.STRING, description: 'Knowledge or speaking skill focus.' },
      questionCount: { type: Type.INTEGER, description: 'Total questions if requested; otherwise choose an appropriate short quiz of 5–8 questions.' },
      mcqCount: { type: Type.INTEGER, description: 'Exact number of multiple-choice questions requested.' },
      trueFalseCount: { type: Type.INTEGER, description: 'Exact number of true/false questions requested.' },
      fillBlankCount: { type: Type.INTEGER, description: 'Exact number of fill-in-the-blank questions requested.' },
      dropdownCount: { type: Type.INTEGER, description: 'Exact number of dropdown-selection questions requested.' },
    },
    required: ['request'],
  },
}

const liveQuizQuestionSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['mcq', 'true_false', 'fill_blank', 'dropdown'] },
    question: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctAnswer: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ['type', 'question', 'options', 'correctAnswer', 'explanation'],
}

export const liveAdaptiveQuizTool: FunctionDeclaration = {
  ...adaptiveQuizTool,
  description: `${adaptiveQuizTool.description} Generate and return the complete quiz now, with a title, topic, request, exact total and per-type question counts, and all questions including answer options, correct answers, and explanations.`,
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: { type: Type.STRING, description: 'The learner’s quiz request including any exact question counts.' },
      topic: { type: Type.STRING, description: 'The quiz topic.' },
      title: { type: Type.STRING, description: 'A concise quiz title.' },
      questionCount: { type: Type.INTEGER, description: 'The requested total number of questions, if specified.' },
      mcqCount: { type: Type.INTEGER, description: 'The exact requested number of multiple-choice questions, if specified.' },
      trueFalseCount: { type: Type.INTEGER, description: 'The exact requested number of true/false questions, if specified.' },
      fillBlankCount: { type: Type.INTEGER, description: 'The exact requested number of fill-in-the-blank questions, if specified.' },
      dropdownCount: { type: Type.INTEGER, description: 'The exact requested number of dropdown questions, if specified.' },
      questions: { type: Type.ARRAY, items: liveQuizQuestionSchema },
    },
    required: ['request', 'topic', 'title', 'questionCount', 'mcqCount', 'trueFalseCount', 'fillBlankCount', 'dropdownCount', 'questions'],
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readCount(args: Record<string, unknown>, name: string): number | undefined {
  const count = args[name]
  if (count === undefined) return undefined
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0 || count > 20) {
    throw new Error('The requested quiz question counts must be whole numbers from 0 to 20.')
  }
  return count
}

function countsInRequest(request: string): Record<QuizQuestionType, number> {
  const counts: Record<QuizQuestionType, number> = { mcq: 0, true_false: 0, fill_blank: 0, dropdown: 0 }
  const patterns: [QuizQuestionType, RegExp][] = [
    ['mcq', /(\d+)\s*(?:mcqs?|multiple[\s-]?choice(?:\s+questions?)?)/gi],
    ['true_false', /(\d+)\s*(?:true\s*\/\s*false|true[\s-]+false|t\/f)(?:\s+questions?)?/gi],
    ['fill_blank', /(\d+)\s*(?:fill(?:[\s-]+in)?(?:[\s-]+the)?[\s-]+blanks?|gap[\s-]+fill)(?:\s+questions?)?/gi],
    ['dropdown', /(\d+)\s*(?:drop[\s-]?down(?:\s+selection)?|dropdowns?)(?:\s+questions?)?/gi],
  ]
  for (const [type, pattern] of patterns) {
    for (const match of request.matchAll(pattern)) counts[type] += Number(match[1])
  }
  return counts
}

function parseQuestions(value: unknown, expectedCounts?: Record<QuizQuestionType, number>): AdaptiveQuizQuestion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new Error('Speakia returned an invalid quiz. Please ask for a quiz with 1–20 questions.')
  }

  const questions = value.map((entry, index): AdaptiveQuizQuestion => {
    if (!isRecord(entry)
      || (entry.type !== 'mcq' && entry.type !== 'true_false' && entry.type !== 'fill_blank' && entry.type !== 'dropdown')
      || typeof entry.question !== 'string' || !entry.question.trim()
      || typeof entry.correctAnswer !== 'string' || !entry.correctAnswer.trim()
      || typeof entry.explanation !== 'string' || !entry.explanation.trim()
      || (entry.options !== undefined && (!Array.isArray(entry.options) || !entry.options.every((option) => typeof option === 'string' && option.trim())))) {
      throw new Error('Speakia returned an invalid quiz question. Please try generating the quiz again.')
    }
    const type = entry.type
    const options = Array.isArray(entry.options) ? entry.options.map((option) => option.trim()) : []
    const correctAnswer = entry.correctAnswer.trim()
    if ((type === 'mcq' || type === 'dropdown')
      && (options.length < 2 || options.length > 6 || !options.includes(correctAnswer))) {
      throw new Error('A quiz choice question has invalid options or a missing correct answer.')
    }
    if (type === 'true_false'
      && (!options.every((option) => option === 'True' || option === 'False')
        || !options.includes('True') || !options.includes('False')
        || (correctAnswer !== 'True' && correctAnswer !== 'False'))) {
      throw new Error('A true/false question must use True and False as its answers.')
    }
    if (type === 'fill_blank' && options.length) {
      throw new Error('A fill-in-the-blank question must not include answer choices.')
    }
    if (entry.question.trim().length > 500 || correctAnswer.length > 180 || entry.explanation.trim().length > 700
      || options.some((option) => option.length > 180)) {
      throw new Error('Speakia returned a quiz question that is too long. Try a more focused quiz.')
    }
    return {
      id: `quiz-question-${index + 1}`,
      type,
      question: entry.question.trim(),
      options,
      correctAnswer,
      explanation: entry.explanation.trim(),
    }
  })

  if (expectedCounts) {
    const actual: Record<QuizQuestionType, number> = { mcq: 0, true_false: 0, fill_blank: 0, dropdown: 0 }
    for (const question of questions) actual[question.type] += 1
    if (Object.keys(expectedCounts).some((type) => actual[type as QuizQuestionType] !== expectedCounts[type as QuizQuestionType])) {
      throw new Error('Speakia did not match the requested number of questions for each quiz type. Please try again.')
    }
  }
  return questions
}

interface QuizRequirements {
  request: string
  topic: string
  focus: string
  count?: number
  expectedCounts?: Record<QuizQuestionType, number>
}

function getQuizRequirements(rawArgs: Record<string, unknown>, lessonType: 'speaking' | 'writing' = 'speaking'): QuizRequirements {
  if (!isRecord(rawArgs)) throw new Error('The quiz request was incomplete. Please try again.')
  const request = typeof rawArgs.request === 'string' ? rawArgs.request.trim().slice(0, 1000) : ''
  if (request.length < 3) throw new Error('Tell Speakia what you want to check in your quiz.')
  const inferredCounts = countsInRequest(request)
  const counts: Record<QuizQuestionType, number> = {
    mcq: readCount(rawArgs, 'mcqCount') ?? inferredCounts.mcq,
    true_false: readCount(rawArgs, 'trueFalseCount') ?? inferredCounts.true_false,
    fill_blank: readCount(rawArgs, 'fillBlankCount') ?? inferredCounts.fill_blank,
    dropdown: readCount(rawArgs, 'dropdownCount') ?? inferredCounts.dropdown,
  }
  const hasTypeCounts = Object.values(counts).some((item) => item > 0)
  const requestedTotal = readCount(rawArgs, 'questionCount')
    ?? (Number(request.match(/\b(\d+)[\s-]+questions?\b/i)?.[1]) || undefined)
  const typeCountTotal = Object.values(counts).reduce((total, item) => total + item, 0)
  if (hasTypeCounts && requestedTotal !== undefined && requestedTotal !== typeCountTotal) {
    throw new Error(`The requested total (${requestedTotal}) does not match the per-type counts (${typeCountTotal}). Update the quiz request so the counts add up.`)
  }
  const count = hasTypeCounts ? typeCountTotal : requestedTotal
  if (count !== undefined && (count < 1 || count > 20)) {
    throw new Error('A quiz must contain between 1 and 20 questions.')
  }
  return {
    request,
    topic: typeof rawArgs.topic === 'string' && rawArgs.topic.trim() ? rawArgs.topic.trim().slice(0, 120) : `IELTS ${lessonType === 'writing' ? 'Writing' : 'Speaking'}`,
    focus: typeof rawArgs.focus === 'string' && rawArgs.focus.trim() ? rawArgs.focus.trim().slice(0, 180) : request,
    count,
    ...(hasTypeCounts ? { expectedCounts: counts } : {}),
  }
}

function buildAdaptiveQuiz(rawArgs: Record<string, unknown>, requirements: QuizRequirements): AdaptiveQuiz {
  if (!isRecord(rawArgs) || typeof rawArgs.title !== 'string' || !rawArgs.title.trim()) {
    throw new Error('Speakia returned an incomplete quiz. Please try again.')
  }
  const questions = parseQuestions(rawArgs.questions, requirements.expectedCounts)
  if (requirements.count !== undefined && questions.length !== requirements.count) {
    throw new Error('Speakia did not match the requested number of quiz questions. Please try again.')
  }
  return {
    id: crypto.randomUUID(),
    title: rawArgs.title.trim().slice(0, 120),
    topic: requirements.topic,
    questions,
  }
}

export function createAdaptiveQuizFromContent(rawArgs: Record<string, unknown>, lessonType: 'speaking' | 'writing' = 'speaking'): AdaptiveQuiz {
  const requirements = getQuizRequirements(rawArgs, lessonType)
  return buildAdaptiveQuiz(rawArgs, requirements)
}

export async function createAdaptiveQuiz(
  apiKey: string,
  rawArgs: Record<string, unknown>,
  learnerContext: unknown,
  model: string,
  abortSignal?: AbortSignal,
  lessonType: 'speaking' | 'writing' = 'speaking',
): Promise<AdaptiveQuiz> {
  if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings to create a quiz.')
  const skillName = lessonType === 'writing' ? 'Writing' : 'Speaking'
  const requirements = getQuizRequirements(rawArgs, lessonType)
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [{ text: JSON.stringify({
        learnerContext,
        request: requirements.request,
        topic: requirements.topic,
        focus: requirements.focus,
        requestedTotal: requirements.count ?? 'Choose 5–8 concise questions',
        exactQuestionCountsByType: requirements.expectedCounts ?? null,
      }) }],
    }],
    config: {
      responseMimeType: 'application/json',
      abortSignal,
      responseJsonSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
              minItems: requirements.count ?? 5,
              maxItems: requirements.count ?? 8,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['mcq', 'true_false', 'fill_blank', 'dropdown'] },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['type', 'question', 'correctAnswer', 'explanation'],
              propertyOrdering: ['type', 'question', 'options', 'correctAnswer', 'explanation'],
            },
          },
        },
        required: ['title', 'questions'],
        propertyOrdering: ['title', 'questions'],
      },
      systemInstruction: `Create an accurate, adaptive interactive quiz that checks IELTS ${skillName} knowledge and practical skills, such as ${lessonType === 'writing' ? 'task response, task achievement, coherence and cohesion, lexical resource, grammar, planning, and editing' : 'test format, fluency, coherence, vocabulary, grammar, pronunciation, and natural language use'}. Return only JSON with a concise title and questions. Each question type must be exactly one of mcq, true_false, fill_blank, dropdown. MCQ and dropdown questions need 3–5 plausible options with exactly one correct option; true_false options must be exactly ["True","False"]; fill_blank must omit options and have a concise accepted answer. Include a short explanation teaching why the answer is correct. Adapt difficulty and focus to the supplied learner context and request. If exactQuestionCountsByType is supplied, match each count exactly, including zero-count types; return precisely requestedTotal questions when it is numeric.`,
    },
  })
  const text = response.text?.trim()
  if (!text) throw new Error('Speakia AI returned an empty quiz. Please try again.')
  let decoded: unknown
  try {
    decoded = JSON.parse(text)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON for an adaptive quiz.', error)
    throw new Error('Speakia could not read the generated quiz. Please try again.')
  }
  if (!isRecord(decoded)) throw new Error('Speakia returned an incomplete quiz. Please try again.')
  return buildAdaptiveQuiz(decoded, requirements)
}
