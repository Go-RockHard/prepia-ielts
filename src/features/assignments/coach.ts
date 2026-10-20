import { GoogleGenAI } from '@google/genai'
import type { TestResult } from '@/features/simulator/types'
import type { UserProfile } from '@/features/profile/localAccount'
import type { AssistantModel } from '@/features/assistant/models'
import type { AssignmentPart, CoachAssignment } from './types'

interface AssignmentRecommendation {
  title: string
  activity: string
  topic: string
  focus: string
  rationale: string
  instructions: string[]
  durationMinutes: number
  part: AssignmentPart
  mode: 'speaking' | 'handwritten'
  detailedStatement: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRecommendation(text: string): AssignmentRecommendation {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    console.error('Speakia coach returned invalid assignment JSON.', error)
    throw new Error('Speakia could not create a usable assignment. Please try again.')
  }
  if (!isRecord(value)
    || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.activity !== 'string' || !value.activity.trim()
    || typeof value.topic !== 'string' || !value.topic.trim()
    || typeof value.focus !== 'string' || !value.focus.trim()
    || typeof value.rationale !== 'string' || !value.rationale.trim()
    || !Array.isArray(value.instructions)
    || value.instructions.length < 2
    || value.instructions.length > 5
    || !value.instructions.every((instruction): instruction is string => typeof instruction === 'string' && !!instruction.trim())
    || typeof value.durationMinutes !== 'number'
    || !Number.isInteger(value.durationMinutes)
    || value.durationMinutes < 5
    || value.durationMinutes > 45
    || (value.part !== 'part1' && value.part !== 'part2' && value.part !== 'part3')
    || (value.mode !== 'speaking' && value.mode !== 'handwritten')
    || typeof value.detailedStatement !== 'string' || !value.detailedStatement.trim()) {
    throw new Error('Speakia returned an incomplete assignment. Please try again.')
  }
  if (value.title.length > 100
    || value.activity.length > 500
    || value.topic.length > 100
    || value.focus.length > 200
    || value.rationale.length > 500
    || value.instructions.some((instruction) => instruction.length > 300)
    || value.detailedStatement.length > 1400) {
    throw new Error('Speakia returned an assignment that is too long. Please try again.')
  }
  return {
    title: value.title.trim(),
    activity: value.activity.trim(),
    topic: value.topic.trim(),
    focus: value.focus.trim(),
    rationale: value.rationale.trim(),
    instructions: value.instructions.map((instruction) => instruction.trim()),
    durationMinutes: value.durationMinutes,
    part: value.part,
    mode: value.mode,
    detailedStatement: value.detailedStatement.trim(),
  }
}

export async function chooseTomorrowAssignment(
  apiKey: string,
  profile: UserProfile,
  recentResults: TestResult[],
  model: AssistantModel,
  recentAssignments: CoachAssignment[],
): Promise<CoachAssignment> {
  if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings before asking Speakia to choose an assignment.')
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify({
          learner: {
            targetBand: profile.targetBand || null,
            testType: profile.testType,
            studyGoal: profile.studyGoal || null,
          },
          recentPractice: recentResults.slice(0, 5).map((result) => ({
            completedAt: result.completedAt,
            part: result.part,
            band: result.overallBand,
            feedback: result.criteria.map(({ name, note }) => ({ criterion: name, note })),
            nextSteps: result.nextSteps,
            recentQuestions: result.answers.slice(0, 3).map(({ prompt, answer }) => ({
              prompt,
              answer: answer.slice(0, 400),
            })),
          })),
          recentAssignments: recentAssignments.slice(0, 5).map(({ title, mode, topic }) => ({ title, mode: mode ?? 'speaking', topic })),
          request: 'Choose one suitable IELTS Speaking assignment for tomorrow. Favor a focused, varied activity based on the learner goal and recent feedback. Use an achievable 5–45 minute practice task.',
        }),
      }],
    }],
    config: {
      responseMimeType: 'application/json',
      systemInstruction: 'You are Speakia Coach and you create personalized IELTS Speaking assignments that build durable learning. Choose one concrete, encouraging, self-contained assignment for tomorrow, grounded in the supplied learner goals and feedback. Vary the format: favor a handwritten assignment roughly once every three recommendations, especially if recentAssignments show only speaking tasks; otherwise use a speaking practice task. A speaking task must be doable in Speakia and focus on one IELTS speaking part (part1, part2 or part3). A handwritten task must ask the learner to physically write in a notebook, such as a Part 2 idea map, vocabulary retrieval sheet, answer outline, reflection, or Part 3 argument plan; provide a detailed statement, specific writing steps, a clear length/output target, and a short retrieval or self-check step. Never imply that handwriting alone assesses spoken fluency or pronunciation. Do not invent learner results. Return only JSON with exactly: title (string), activity (string), topic (string), focus (string), rationale (string), instructions (array of 2–5 strings), durationMinutes (integer 5–45), part (part1|part2|part3), mode (speaking|handwritten), detailedStatement (string). For speaking tasks, detailedStatement should clearly explain the task and intended spoken output. For handwritten tasks, detailedStatement must be a complete student-facing task brief with the written deliverable and criteria for self-checking.',
    },
  })
  const text = response.text?.trim()
  if (!text) throw new Error('Speakia returned no assignment. Please try again.')
  const recommendation = parseRecommendation(text)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const assignedFor = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-')
  return {
    ...recommendation,
    id: crypto.randomUUID(),
    assignedFor,
    createdAt: new Date().toISOString(),
    status: 'assigned',
  }
}
