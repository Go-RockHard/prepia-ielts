import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Behavior, FunctionCallingConfigMode, FunctionResponseScheduling, ThinkingLevel, type FunctionCall, type FunctionResponse, type Tool } from '@google/genai'
import { Activity, AlertCircle, ArrowLeft, ArrowRight, Award, BarChart3, BookOpen, Check, ChevronDown, Clock3, Gauge, History, Lightbulb, ListFilter, LoaderCircle, Mic, MicOff, RotateCcw, Search, Sparkles, Target, TrendingUp, Waves, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TranscriptAudioList } from '@/features/simulator/TranscriptAudioList'
import { useGeminiLive } from '@/features/simulator/useGeminiLive'
import { evaluateSpeakingDrill } from './evaluation'
import { loadSpeakingDrillAttempts, saveSpeakingDrillAttempts, updateSpeakingDrillAttempt, type SpeakingDrillAttempt, type DrillEvaluation } from './storage'
import { loadPracticeModeAudio, savePracticeModeAudio } from '@/features/practiceModes/archive'
import { AdaptiveAidWidget } from '@/features/practiceModes/AdaptiveAid'
import { isAdaptiveSupportType, type AdaptiveAid } from '@/features/practiceModes/adaptiveAidTypes'
import { drillRecommendationToolName, drillRecommendationTools, processDrillRecommendationToolCalls, type DrillRecommendation } from './recommendations'
import { DrillRecommendations } from './DrillRecommendations'
import { loadTranscriptAudio, saveTranscriptAudio } from '@/features/simulator/recordingStorage'
import { createTranscriptAudioCopy } from '@/features/simulator/gemini'

interface Drill {
  id: string
  title: string
  category: string
  skill: string
  durationSeconds: number
  task: string
  prompts: string[]
  instructions: string
  openingPrompt: string
}

function randomPromptForDrill(drill: Drill): string {
  return drill.prompts[Math.floor(Math.random() * drill.prompts.length)]
}

type DrillTranscriptTurn = { id?: string; role: 'examiner' | 'candidate'; text: string; audio?: Blob; audioOrder?: number }

const adaptiveScaffoldToolName = 'prepare_drill_adaptive_scaffold'
const adaptiveScaffoldTools: Tool[] = [{ functionDeclarations: [{
  name: adaptiveScaffoldToolName,
  behavior: Behavior.NON_BLOCKING,
  description: 'Choose and display the smallest useful support when a learner is stuck, struggling with a drill attempt, or explicitly asks for help. Do not call this when the learner is already expressing a clear idea; ask a helpful follow-up instead.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      supportType: {
        type: 'string',
        enum: ['idea-cue', 'vocabulary', 'answer-structure', 'sentence-frames', 'worked-example'],
        description: 'Select the single most useful aid for this learner and drill. Reserve worked-example for after they have tried and still need substantial support.',
      },
      question: { type: 'string', description: 'The exact current drill prompt or sentence.' },
      reason: { type: 'string', description: 'A short, encouraging explanation of why this aid fits the learner’s attempt.' },
      hints: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3, description: 'Brief idea cues for idea-cue support.' },
      vocabulary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            phrase: { type: 'string' },
            meaning: { type: 'string' },
            example: { type: 'string' },
          },
          required: ['phrase', 'meaning', 'example'],
          additionalProperties: false,
        },
        minItems: 2,
        maxItems: 4,
        description: 'Useful vocabulary and short examples for vocabulary support.',
      },
      framework: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5, description: 'Ordered answer steps for answer-structure support.' },
      sentenceFrames: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4, description: 'Adaptable partial sentence frames with blanks.' },
      workedExample: { type: 'string', description: 'A short illustrative sample, only when this is the least support that will help after the learner has already tried.' },
    },
    required: ['supportType', 'question', 'reason'],
    additionalProperties: false,
  },
}] }]

function completeNonBlockingToolCall(call: FunctionCall, response: Record<string, unknown>): FunctionResponse {
  return {
    id: call.id,
    name: call.name,
    response,
    willContinue: false,
    scheduling: FunctionResponseScheduling.WHEN_IDLE,
  }
}

function recommendedDrillFor(evaluation: DrillEvaluation): Drill {
  const recommendation = evaluation.nextDrill.toLocaleLowerCase()
  const namedDrill = drills.find((drill) => recommendation.includes(drill.title.toLocaleLowerCase()))
  if (namedDrill) return namedDrill
  const recommendationRules: [RegExp, string][] = [
    [/error.?triggered|targeted micro.?drill|recurring (?:grammar|language) error/, 'error-triggered-micro-drill'],
    [/transfer|new topic|apply (?:the )?(?:same )?skill/, 'transfer'],
    [/sentence rebuild|rebuild (?:a )?sentence|word order/, 'sentence-rebuilding'],
    [/sentence completion|sentence starter/, 'spoken-completion'],
    [/tense control|tense consistency|past tense|tense/, 'tense-correction'],
    [/grammar pattern|target structure/, 'grammar-pattern-repetition'],
    [/\bpart\s*2\b|\bpart2\b|cue.?card|long.?turn|story structure/, 'part2'],
    [/\bpart\s*3\b|\bpart3\b|discussion question|compare|speculat/, 'part3'],
    [/\bpart\s*1\b|\bpart1\b|quick response|answer promptly/, 'part1'],
    [/pronunciation|shadow|stress|intonation|rhythm|emphasis/, 'pronunciation'],
    [/vocabulary|lexical|collocation|word choice|expressions?|paraphras|repetition/, 'vocabulary'],
    [/grammar|sentence structure|complex sentence|sentence building|sentence variety/, 'grammar'],
    [/fluency|coherence|pace|pauses?|linking ideas?/, 'fluency'],
  ]
  const matchingRule = recommendationRules.find(([pattern]) => pattern.test(recommendation))
  if (matchingRule) return drills.find((drill) => drill.id === matchingRule[1]) ?? drills[0]
  const weakestCriterion = [...evaluation.criteria].sort((left, right) => left.score - right.score)[0]
  const fallbackDrillId = weakestCriterion?.id === 'pronunciation'
    ? 'pronunciation'
    : weakestCriterion?.id === 'vocabulary'
      ? 'vocabulary'
      : weakestCriterion?.id === 'grammar'
        ? 'grammar'
        : 'fluency'
  return drills.find((drill) => drill.id === fallbackDrillId) ?? drills[0]
}

function DrillSessionAudio({ username, attempt }: { username: string; attempt: SpeakingDrillAttempt }) {
  const [audioState, setAudioState] = useState<{ attemptId: string; url?: string; error?: string } | null>(null)

  useEffect(() => {
    let active = true
    let objectUrl = ''
    void loadPracticeModeAudio(username, attempt.id).then(async (audio) => {
      if (!active) return
      if (!audio) {
        setAudioState({ attemptId: attempt.id, error: 'The saved full-session audio is unavailable.' })
        return
      }
      if (audio.type !== 'audio/wav' && audio.type !== 'audio/wave') {
        const transcriptWithAudio = await Promise.all(attempt.transcript.map(async (turn) => ({
          ...turn,
          ...(turn.id ? { audio: await loadTranscriptAudio(attempt.id, turn.id) ?? undefined } : {}),
        })))
        if (transcriptWithAudio.some((turn) => turn.role === 'candidate' && turn.audio instanceof Blob)
          && transcriptWithAudio.some((turn) => turn.role === 'examiner' && turn.audio instanceof Blob)
          && transcriptWithAudio.every((turn) => !turn.text.trim() || turn.audio instanceof Blob)) {
          try {
            const repairedAudio = await createTranscriptAudioCopy(transcriptWithAudio)
            await savePracticeModeAudio(username, attempt.id, repairedAudio)
            if (!active) return
            objectUrl = URL.createObjectURL(repairedAudio)
            setAudioState({ attemptId: attempt.id, url: objectUrl })
            return
          } catch (repairError) {
            console.error('Unable to rebuild legacy Speaking Drill session audio from its transcript turns.', repairError)
          }
        }
      }
      objectUrl = URL.createObjectURL(audio)
      setAudioState({ attemptId: attempt.id, url: objectUrl })
    }).catch((caughtError: unknown) => {
      console.error('Unable to load the saved Speaking Drill session audio.', caughtError)
      if (active) setAudioState({ attemptId: attempt.id, error: caughtError instanceof Error ? caughtError.message : 'Unable to load the saved session audio.' })
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attempt, username])

  const currentAudio = audioState?.attemptId === attempt.id ? audioState : null
  return <div className="drill-session-audio">
    <strong>Full session audio</strong>
    {currentAudio?.url ? <audio aria-label="Play the full speaking drill session" controls preload="none" src={currentAudio.url} onError={() => setAudioState({ attemptId: attempt.id, error: 'This saved session audio could not be decoded. Try a newer session recording.' })}>Your browser does not support audio playback.</audio> : currentAudio?.error ? <p role="status">{currentAudio.error}</p> : <span>Loading saved audio…</span>}
  </div>
}

const drills: Drill[] = [
  {
    id: 'fluency',
    title: '60-second fluency drill',
    category: 'Fluency drills',
    skill: 'Fluency & coherence',
    durationSeconds: 60,
    task: 'Speak for one minute about a place you enjoy visiting. Keep your ideas connected and continue naturally if you lose your place.',
    prompts: ['Describe a place you enjoy visiting and explain what makes it special.', 'Talk about a small success you had recently and how you achieved it.', 'Describe a routine that helps you feel organised.', 'Talk about a person you enjoy spending time with.'],
    instructions: 'Give a short topic and ask the learner to speak continuously for one minute. Do not interrupt. When they ask to finish, give focused feedback on pace, pauses, idea development, linking, and one practical fluency improvement.',
    openingPrompt: 'Start the one-minute fluency drill. Briefly introduce the task and invite the learner to begin speaking about a place they enjoy visiting. Let them speak without interruptions.',
  },
  {
    id: 'pronunciation',
    title: 'Speech shadowing',
    category: 'Pronunciation drills',
    skill: 'Pronunciation',
    durationSeconds: 90,
    task: 'Repeat short, natural IELTS-style sentences and practise clear word stress, sentence rhythm, connected speech, and intonation.',
    prompts: ['Shadow a sentence about a memorable journey, focusing on thought groups and sentence stress.', 'Repeat a sentence about a useful invention, linking words naturally.', 'Practise a sentence with contrastive stress, then say it again with a different emphasis.', 'Repeat a short opinion about city life, using natural intonation at the end.'],
    instructions: 'Lead a progressive speech-shadowing drill. Say one short natural sentence clearly, ask the learner to repeat it, then compare only what is reasonably audible. Focus on intelligibility, stress, rhythm, connected speech, and intonation. Give a model and another attempt when useful; never claim certainty about subtle sounds that are unclear.',
    openingPrompt: 'Begin a pronunciation and shadowing drill with one short, natural IELTS Speaking sentence. Ask the learner to repeat it and wait for their attempt.',
  },
  {
    id: 'vocabulary',
    title: 'Topic vocabulary in speech',
    category: 'Vocabulary drills',
    skill: 'Lexical resource',
    durationSeconds: 90,
    task: 'Use three natural expressions about a familiar topic without forcing them into your answer.',
    prompts: ['Use natural expressions to talk about a skill you would like to learn.', 'Describe a local place using precise sensory vocabulary and natural collocations.', 'Talk about a recent choice using expressions for weighing up options.', 'Discuss a useful change in your town without repeating the same adjectives.'],
    instructions: 'Choose a familiar topic and give three useful, natural collocations or expressions with brief meanings. Ask the learner to answer a speaking question using them naturally. Notice range, precision, collocation, and repetition; give a natural reformulation and invite a retry.',
    openingPrompt: 'Start a vocabulary drill. Choose a familiar topic, give three useful natural expressions with brief meanings, then ask one question that lets the learner use them.',
  },
  {
    id: 'grammar',
    title: 'Simple-to-complex expansion',
    category: 'Grammar drills',
    skill: 'Grammar range & accuracy',
    durationSeconds: 90,
    task: 'Answer aloud using a mix of simple and complex sentences, including a reason, contrast, or conditional idea.',
    prompts: ['Talk about a hobby using a reason clause and a relative clause.', 'Explain how your routine might change if you had more free time.', 'Compare two ways of learning using a contrast clause.', 'Describe an experience using a mix of past and present forms.'],
    instructions: 'Ask one IELTS-style question, then coach the learner to express the answer using varied sentence forms, such as a reason clause, contrast, relative clause, or conditional. Correct errors kindly, explain the pattern briefly, and ask for a spoken retry.',
    openingPrompt: 'Start a grammar range drill with one everyday IELTS Speaking question. Invite the learner to answer aloud with varied sentence structures.',
  },
  {
    id: 'part1',
    title: 'Part 1 quick responses',
    category: 'Response speed drills',
    skill: 'IELTS Speaking Part 1',
    durationSeconds: 90,
    task: 'Respond promptly to familiar questions, then add a reason or specific detail in a natural two- or three-sentence answer.',
    prompts: ['What do you usually do at weekends?', 'Do you prefer studying alone or with other people?', 'What kind of weather do you enjoy?', 'How often do you use public transport?', 'What is a food you particularly enjoy?'],
    instructions: 'Run a rapid IELTS Speaking Part 1 response drill with one familiar question at a time. Encourage the learner to begin within a few seconds without sacrificing clarity, then keep each answer brief and natural. Ask a few varied questions and give concise feedback on relevance, development, fluency, and natural phrasing.',
    openingPrompt: 'Begin an IELTS Speaking Part 1 quick-response drill. Explain that the learner should start within a few seconds, then ask one familiar personal question and wait for their answer before continuing.',
  },
  {
    id: 'part2',
    title: 'Part 2 story structure',
    category: 'Topic drills',
    skill: 'IELTS Speaking Part 2',
    durationSeconds: 120,
    task: 'Build a clear beginning, a few specific details, and a reflection into a short talk about a memorable day.',
    prompts: ['Describe a memorable day you spent with someone.', 'Describe a place you visited that you would like to return to.', 'Describe a useful object you received as a gift.', 'Describe a time you learned something important from an experience.'],
    instructions: 'Give a compact IELTS Speaking Part 2 cue card about a memorable day. Allow a brief moment to plan, then invite a long turn without interruption. On request to finish, comment on organization, detail, development, fluency, and one way to extend the response.',
    openingPrompt: 'Begin an IELTS Speaking Part 2 drill. Give a cue card about a memorable day, allow a short planning pause, and then invite the learner to speak at length without interruption.',
  },
  {
    id: 'part3',
    title: 'Part 3 develop an opinion',
    category: 'Topic drills',
    skill: 'IELTS Speaking Part 3',
    durationSeconds: 120,
    task: 'Develop an opinion with a clear point, explanation, relevant example, and a thoughtful qualification.',
    prompts: ['Why do some people prefer living in large cities?', 'How has technology changed the way people communicate?', 'Should schools give students more practical lessons?', 'Why is it important for communities to have public spaces?'],
    instructions: 'Ask an IELTS Speaking Part 3 discussion question. Coach a structured response using a point, explanation, example, and qualification where appropriate. Ask a follow-up that invites analysis or comparison, then give specific feedback on reasoning, support, coherence, and language.',
    openingPrompt: 'Begin an IELTS Speaking Part 3 opinion drill. Ask one thoughtful discussion question and wait for the learner to develop an answer.',
  },
  {
    id: 'answer-expansion',
    title: 'Expand your answer',
    category: 'Fluency drills',
    skill: 'Answer development',
    durationSeconds: 90,
    task: 'Turn a brief answer into a clear response with a reason, a specific detail, and a natural example.',
    prompts: ['What do you like doing in your free time?', 'Do you enjoy cooking?', 'What kind of place do you like to visit?', 'Is there a subject you would like to learn more about?'],
    instructions: 'Ask one familiar IELTS-style question. If the answer is brief, coach the learner to extend it with a reason and one specific detail or example. Demonstrate a compact expansion, then ask for a spoken retry. Keep the answer natural rather than formulaic.',
    openingPrompt: 'Start an answer expansion drill. Ask one familiar question to extend an answer and invite the learner to respond.',
  },
  {
    id: 'idea-linking',
    title: 'Link ideas naturally',
    category: 'Fluency drills',
    skill: 'Fluency & coherence',
    durationSeconds: 90,
    task: 'Connect a main idea, explanation, and example with clear relationships instead of relying on memorised linking phrases.',
    prompts: ['Describe a change that has improved your daily routine.', 'Explain why a local place is important to people in your community.', 'Talk about a skill that is useful in everyday life.', 'Discuss one way technology has changed how people learn.'],
    instructions: 'Ask the learner to explain a topic using connected ideas. Notice the relationship between the point, reason, and example; coach one natural transition only when needed. Avoid forcing linking phrases or a fixed template, and invite a retry.',
    openingPrompt: 'Start a natural idea-linking drill. Ask the learner to explain a topic and connect their ideas clearly.',
  },
  {
    id: 'paraphrase',
    title: 'Paraphrasing drill',
    category: 'Vocabulary drills',
    skill: 'Lexical resource',
    durationSeconds: 90,
    task: 'Express an idea using precise alternatives and natural paraphrasing rather than repeating the same key words.',
    prompts: ['Describe a film or book you enjoyed without repeating the title’s key words.', 'Explain why a place is popular using varied, precise language.', 'Talk about a useful skill and paraphrase its importance.', 'Describe a memorable event using more than one way to express your main feeling.'],
    instructions: 'Invite the learner to explain an idea, then notice repeated or vague wording. Offer one or two context-appropriate alternatives, distinguish natural paraphrase from awkward synonym substitution, and ask for a spoken retry.',
    openingPrompt: 'Start a paraphrase practice drill. Give the learner a topic and invite them to express its key idea in varied, natural language.',
  },
  {
    id: 'intonation',
    title: 'Intonation & emphasis',
    category: 'Pronunciation drills',
    skill: 'Pronunciation',
    durationSeconds: 90,
    task: 'Practise thought groups, sentence stress, and emphasis so the intended meaning is easy to follow.',
    prompts: ['Say an opinion about working from home, then emphasise its main advantage.', 'Contrast two ways of travelling using clear sentence stress.', 'Practise a sentence that shows surprise and then mild disagreement.', 'Explain why a hobby is valuable, placing emphasis on the key reason.'],
    instructions: 'Give a short natural sentence or prompt and coach the learner to group ideas and emphasise key words. Model a clear version and invite one repeat. Focus on overall intelligibility and meaning; do not claim precise phonetic diagnosis when the audio is unclear.',
    openingPrompt: 'Begin an intonation and emphasis drill. Offer one short speaking prompt and invite the learner to make the main meaning clear through natural stress and phrasing.',
  },
  {
    id: 'compare-speculate',
    title: 'Compare & speculate',
    category: 'Topic drills',
    skill: 'IELTS Speaking Part 3',
    durationSeconds: 120,
    task: 'Compare two situations and discuss how they may change in the future, supporting ideas with relevant reasons.',
    prompts: ['How is learning online different from learning in a classroom, and how might it change?', 'How do transport choices differ between cities and smaller towns?', 'How have people’s leisure activities changed, and what may happen next?', 'What differences are there between shopping locally and online, and how could these choices evolve?'],
    instructions: 'Lead a short Part 3 comparison discussion. Invite a clear comparison, a reason, and a cautious prediction. Ask one follow-up that deepens the idea. Give concise feedback on relevance, development, and language without demanding a memorised response structure.',
    openingPrompt: 'Start a Part 3 compare-and-speculate drill. Ask one discussion question that invites a comparison and a reasoned prediction.',
  },
  {
    id: 'sentence-rebuilding',
    title: 'Sentence rebuilding',
    category: 'Grammar drills',
    skill: 'Grammar range & accuracy',
    durationSeconds: 90,
    task: 'Rebuild an inaccurate or incomplete spoken sentence into clear, natural English, then use the corrected pattern in a new sentence.',
    prompts: ['Correct and rebuild: “Yesterday I go to the market and buy some fruit.”', 'Make this natural and complete: “My friend, she help me when exam.”', 'Repair the sentence, then add a detail: “People in my city is enjoy parks because relax.”', 'Rebuild this sentence without changing its meaning: “I have visited there last year and it was very enjoy.”'],
    instructions: 'Give one short spoken sentence with a clear grammar or word-order issue. Let the learner identify and rebuild it aloud before offering a correction. Explain only the key change, then ask them to produce a new sentence using the same pattern. Keep corrections encouraging and preserve their intended meaning.',
    openingPrompt: 'Begin a sentence-rebuilding drill. Read the selected sentence naturally, invite the learner to repair it aloud, and wait for their attempt before correcting.',
  },
  {
    id: 'spoken-completion',
    title: 'Spoken sentence completion',
    category: 'Grammar drills',
    skill: 'Grammar range & accuracy',
    durationSeconds: 90,
    task: 'Complete spoken sentence starters with accurate, relevant ideas and develop each completion naturally.',
    prompts: ['Complete aloud: “One reason I enjoy living in my city is…”', 'Complete aloud: “Although public transport can be crowded, …”', 'Complete aloud: “If I had more free time, I would…”', 'Complete aloud: “A skill I would like to develop is…, because…”'],
    instructions: 'Speak one sentence starter and let the learner complete it in their own words. Use varied structures such as reason, contrast, relative, and conditional clauses. Respond to what they actually say, correct only important errors, and gradually make the starters less explicit.',
    openingPrompt: 'Start a spoken sentence-completion drill. Say the selected sentence starter and let the learner finish it aloud in their own words.',
  },
  {
    id: 'tense-correction',
    title: 'Tense control & repair',
    category: 'Grammar drills',
    skill: 'Grammar range & accuracy',
    durationSeconds: 90,
    task: 'Choose and maintain appropriate past, present, and future forms while speaking about experiences, routines, and plans.',
    prompts: ['Retell what you did yesterday using consistent past-tense forms.', 'Describe a regular weekend routine, then explain one way it has changed.', 'Talk about a plan for next year and explain what you hope to achieve.', 'Describe a memorable trip: set the scene in the past and explain how you feel about it now.'],
    instructions: 'Ask the learner to tell a short story or describe a routine or plan. Listen for tense consistency and time references. If an error appears, let the learner finish the thought, point to the time cue, and invite a self-correction or short retell. Avoid interrupting every sentence.',
    openingPrompt: 'Begin a tense-control drill. Ask the learner to respond to the selected time-focused prompt and listen for consistent tense use.',
  },
  {
    id: 'grammar-pattern-repetition',
    title: 'Grammar pattern repetition',
    category: 'Grammar drills',
    skill: 'Grammar range & accuracy',
    durationSeconds: 90,
    task: 'Use one useful spoken grammar pattern accurately across several meaningful IELTS topics, then try it without a model.',
    prompts: ['Practise “Although…, I still…” across a hobby, a city, and a learning experience.', 'Use “The reason why… is that…” for three different everyday topics.', 'Practise “If I could…, I would…” with a skill, a place, and a future plan.', 'Use a relative clause beginning with “which…” to add detail to three different ideas.'],
    instructions: 'Introduce the selected target structure with one short example, then invite the learner to use it in several different relevant contexts. Give brief feedback on accuracy and naturalness, vary the topic, and finish with one independent use without repeating the model. Do not reward repetition that sounds forced.',
    openingPrompt: 'Start a grammar-pattern repetition drill. Model the selected structure once, then ask the learner to use it naturally in a new example.',
  },
  {
    id: 'guided-answer-building',
    title: 'Guided answer-building',
    category: 'Fluency drills',
    skill: 'Answer development',
    durationSeconds: 120,
    task: 'Build a complete spoken answer one step at a time: main idea, reason, specific example, and a concluding detail.',
    prompts: ['Build an answer about a useful skill: give your view, explain why, add an example, and say when you use it.', 'Develop an answer about a memorable place one idea at a time.', 'Explain a change in your town: main point, reason, example, and effect on people.', 'Answer a question about a hobby by adding a reason, a specific moment, and a personal reflection.'],
    instructions: 'Guide the learner through a response in small turns: first their main idea, then a reason, then a specific example or detail, and finally a natural complete answer. Ask only one focused prompt at a time. Offer a small cue if they get stuck; never compose the polished answer for them.',
    openingPrompt: 'Begin guided answer-building. Ask for the learner’s main idea in response to the selected prompt, then build the answer one step at a time.',
  },
  {
    id: 'repeat-after-feedback',
    title: 'Repeat after feedback',
    category: 'Fluency drills',
    skill: 'Fluency & coherence',
    durationSeconds: 120,
    task: 'Answer a question, apply one or two specific coaching points, and answer the same question again more clearly.',
    prompts: ['What do you enjoy doing at weekends, and why?', 'Describe a small success you had recently.', 'Do you prefer learning new things alone or with other people?', 'What is one change that would improve your local area?'],
    instructions: 'Ask the selected question and let the learner complete an answer. Give no more than two specific, evidence-based improvement points, then ask the exact same question again. Compare the retry with the first attempt and acknowledge what changed without inventing progress.',
    openingPrompt: 'Start a repeat-after-feedback drill. Ask the selected question, listen to the complete answer, and wait before giving brief feedback and inviting a retry.',
  },
  {
    id: 'discourse-markers',
    title: 'Natural discourse markers',
    category: 'Vocabulary drills',
    skill: 'Fluency & coherence',
    durationSeconds: 90,
    task: 'Connect spoken ideas with a small range of discourse markers only when they express a real relationship between ideas.',
    prompts: ['Explain a benefit and limitation of studying online; connect your contrast naturally.', 'Describe a routine and give an example using a natural marker.', 'Explain why a local place matters and describe its result for the community.', 'Give an opinion, acknowledge another view, and return to your main point.'],
    instructions: 'Invite a short answer with connected ideas. Notice whether the learner signals examples, contrast, sequence, or results naturally. Offer one suitable discourse marker only when it clarifies a real relationship, then ask for a retry. Discourage inserting linkers into every sentence.',
    openingPrompt: 'Begin a natural discourse-marker drill. Ask the selected question and invite the learner to connect their ideas clearly without forcing linking phrases.',
  },
  {
    id: 'model-repeat-pronunciation',
    title: 'Model-and-repeat pronunciation',
    category: 'Pronunciation drills',
    skill: 'Pronunciation',
    durationSeconds: 90,
    task: 'Repeat a short model phrase or sentence and refine intelligibility, word stress, rhythm, and intonation over a few attempts.',
    prompts: ['Repeat a sentence about a memorable journey, focusing on natural thought groups.', 'Practise a useful phrase about technology with clear word stress.', 'Repeat an opinion about public spaces, emphasizing the key contrast.', 'Say a short sentence about a hobby with natural linking and final intonation.'],
    instructions: 'Model one short, natural phrase or sentence, ask the learner to repeat it, and give one targeted, observable note about intelligibility, stress, rhythm, phrasing, or intonation. Model it again only as needed and invite another attempt. Do not claim certainty about subtle sounds that are unclear.',
    openingPrompt: 'Start a model-and-repeat pronunciation drill. Say one short natural sentence based on the selected prompt, then invite the learner to repeat it.',
  },
  {
    id: 'live-coaching',
    title: 'Live coaching',
    category: 'Fluency drills',
    skill: 'Fluency, coherence & language control',
    durationSeconds: 120,
    task: 'Practise spontaneous speaking while the coach adapts its questions, feedback, and scaffold to the learner’s actual response.',
    prompts: ['Talk about a skill you would like to learn and why.', 'Explain a choice you made recently and what influenced it.', 'Describe a place that is important to your community.', 'Discuss one way technology has changed everyday life.'],
    instructions: 'Hold a natural short coaching conversation around the selected prompt. Let the learner finish their thought, then adapt the next question or offer one small scaffold only when it is useful. If the learner is ready, deepen the challenge with a follow-up. Keep the exchange learner-led and invite a final independent response.',
    openingPrompt: 'Begin a live-coaching drill with the selected speaking prompt. Let the learner respond naturally, then adapt your follow-up to what they actually say.',
  },
  {
    id: 'error-triggered-micro-drill',
    title: 'Error-triggered micro-drill',
    category: 'Grammar drills',
    skill: 'Targeted grammar & language repair',
    durationSeconds: 120,
    task: 'Notice a recurring language issue in the learner’s response and pause for a brief targeted repair exercise before they retry.',
    prompts: ['Tell a short story about something you did last week.', 'Describe a person who has influenced you and explain why.', 'Explain what you would change about your daily routine.', 'Talk about a recent experience and what you learned from it.'],
    instructions: 'Listen for a repeated or meaningful language pattern that affects clarity, such as tense consistency or sentence completion. Do not interrupt for a single minor slip. If the same issue recurs, pause supportively, give one brief micro-drill with two examples, and ask the learner to retry the original idea using the target pattern.',
    openingPrompt: 'Start an error-triggered micro-drill by asking the selected speaking prompt. Listen for recurring patterns, not isolated minor slips, before offering a short targeted repair.',
  },
  {
    id: 'reduced-assistance',
    title: 'Gradually reduced assistance',
    category: 'Fluency drills',
    skill: 'Independent speaking & answer development',
    durationSeconds: 120,
    task: 'Move from guided support to independent speaking by gradually removing models, sentence starters, and idea cues.',
    prompts: ['Describe a memorable day: begin with guided questions, then try again using only a keyword.', 'Explain a useful skill: move from a sentence frame to a short independent answer.', 'Talk about a place you enjoy: start with an idea cue and finish without prompts.', 'Give an opinion about a community change, first with a structure and then independently.'],
    instructions: 'Use a gradual sequence suited to the learner: a small model or scaffold only if needed, then a partial sentence starter, then a keyword cue, then an independent retry. Do not force a full worked answer when a lighter cue is enough. Praise independence and adjust the amount of help based on each attempt.',
    openingPrompt: 'Begin a gradually reduced-assistance drill with the selected prompt. Start with only the support the learner needs, then fade it as they become more confident.',
  },
  {
    id: 'transfer',
    title: 'Transfer to a new topic',
    category: 'Topic drills',
    skill: 'Flexible speaking & skill transfer',
    durationSeconds: 120,
    task: 'Apply a recently practised speaking skill to a new IELTS topic without relying on the original example or scaffold.',
    prompts: ['Use a clear reason and specific example to discuss education instead of a familiar hobby topic.', 'Apply a natural comparison to transport after practising a comparison about learning.', 'Use precise paraphrasing to describe a community event without repeating the original practice words.', 'Develop an opinion about technology using a structure you practised on a different topic.'],
    instructions: 'Ask which strategy or speaking skill the learner wants to transfer, or infer it from the conversation. Switch to a genuinely different topic and invite an independent response using the same skill. Offer a cue only if needed, then ask what transferred successfully. Do not assume improvement without evidence.',
    openingPrompt: 'Begin a transfer drill. Invite the learner to apply a useful speaking strategy to the new topic in the selected prompt, without copying a memorized answer.',
  },
]

const drillCategories = [
  { title: 'Fluency drills', description: 'Keep a natural pace, develop complete answers, and connect ideas without losing your thread.' },
  { title: 'Pronunciation drills', description: 'Refine intelligibility, stress, connected speech, thought groups, and intonation.' },
  { title: 'Vocabulary drills', description: 'Retrieve precise topic language, paraphrase flexibly, and connect ideas naturally.' },
  { title: 'Response speed drills', description: 'Answer familiar questions promptly, then add a relevant detail.' },
  { title: 'Topic drills', description: 'Practise Part 2 long turns, Part 3 discussion, comparison, and speculation.' },
  { title: 'Grammar drills', description: 'Rebuild sentences, control tense, and use accurate, flexible spoken structures.' },
]

const drillSearchSynonyms: Record<string, string[]> = {
  fluency: ['flow', 'coherence', 'pace', 'pauses', 'hesitation', 'automaticity', 'smoothness', 'linking'],
  pronunciation: ['stress', 'intonation', 'rhythm', 'sounds', 'clarity', 'connected speech', 'shadowing'],
  vocabulary: ['lexical', 'word choice', 'collocation', 'paraphrase', 'expressions', 'phrases'],
  grammar: ['accuracy', 'tense', 'sentence structure', 'sentence building', 'language repair'],
  speed: ['promptly', 'quick', 'rapid', 'response time', 'automaticity'],
  confidence: ['independent', 'hesitation', 'stuck', 'scaffold', 'assistance'],
  answer: ['response', 'develop', 'expand', 'structure', 'example', 'reason'],
  part1: ['part 1', 'familiar questions', 'quick response'],
  part2: ['part 2', 'cue card', 'long turn', 'story'],
  part3: ['part 3', 'discussion', 'opinion', 'analysis'],
}

const drillSearchStopWords = new Set(['a', 'an', 'and', 'are', 'about', 'based', 'can', 'by', 'for', 'find', 'from', 'help', 'how', 'improve', 'in', 'is', 'me', 'my', 'of', 'or', 'related', 'show', 'speaking', 'the', 'to', 'what', 'with', 'drill', 'drills', 'practice', 'practise'])

const criterionLabels = [
  { id: 'fluency', label: 'Fluency', color: '#7868d2' },
  { id: 'vocabulary', label: 'Vocabulary', color: '#e99572' },
  { id: 'grammar', label: 'Grammar', color: '#5d9e7a' },
  { id: 'pronunciation', label: 'Pronunciation', color: '#5a91c3' },
] as const

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

export function SpeakingDrillsPage({ apiKey, username, onOpenSettings, onOpenDrill, initialDrillId, initialPrompt, onInitialDrillHandled }: {
  apiKey: string
  username: string
  onOpenSettings: () => void
  onOpenDrill: (drillId: string, context?: string) => void
  initialDrillId?: string
  initialPrompt?: string
  onInitialDrillHandled?: () => void
}) {
  return <SpeakingDrillWorkspace apiKey={apiKey} username={username} onOpenSettings={onOpenSettings} onOpenDrill={onOpenDrill} initialDrillId={initialDrillId} initialPrompt={initialPrompt} onInitialDrillHandled={onInitialDrillHandled} />
}

function SpeakingDrillWorkspace({ apiKey, username, onOpenSettings, onOpenDrill, initialDrillId, initialPrompt, onInitialDrillHandled }: {
  apiKey: string
  username: string
  onOpenSettings: () => void
  onOpenDrill: (drillId: string, context?: string) => void
  initialDrillId?: string
  initialPrompt?: string
  onInitialDrillHandled?: () => void
}) {
  const initialDrill = drills.find((item) => item.id === initialDrillId)
  const [selectedDrillId, setSelectedDrillId] = useState(initialDrill?.id ?? drills[0].id)
  const [activePrompt, setActivePrompt] = useState(initialPrompt?.trim() || initialDrill?.prompts[0] || drills[0].prompts[0])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState<DrillTranscriptTurn[]>([])
  const [attempts, setAttempts] = useState<SpeakingDrillAttempt[]>(() => loadSpeakingDrillAttempts(username))
  const [evaluation, setEvaluation] = useState<DrillEvaluation | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [assessmentDeferred, setAssessmentDeferred] = useState(false)
  const [evaluationError, setEvaluationError] = useState('')
  const [adaptiveAid, setAdaptiveAid] = useState<AdaptiveAid | null>(null)
  const [scaffoldError, setScaffoldError] = useState('')
  const [drillRecommendation, setDrillRecommendation] = useState<DrillRecommendation | null>(null)
  const [recommendationError, setRecommendationError] = useState('')
  const [historyWarning, setHistoryWarning] = useState('')
  const [lastAttemptId, setLastAttemptId] = useState('')
  const [recordingForAttempt, setRecordingForAttempt] = useState<{ attemptId: string; recording: Blob } | null>(null)
  const sessionStartedAt = useRef('')
  const [archiveFilter, setArchiveFilter] = useState('all')
  const [drillSearch, setDrillSearch] = useState('')
  const [expandedAttemptId, setExpandedAttemptId] = useState('')
  const [activeView, setActiveView] = useState<'overview' | 'library' | 'history'>(initialDrill ? 'library' : 'overview')
  const drillTaskRef = useRef<HTMLDivElement>(null)
  const focusRecommendedDrillRef = useRef(Boolean(initialDrill))
  const drill = useMemo(() => drills.find((item) => item.id === selectedDrillId) ?? drills[0], [selectedDrillId])
  useEffect(() => {
    if (!initialDrill) return
    onInitialDrillHandled?.()
  }, [initialDrill, initialPrompt, onInitialDrillHandled])
  const handleAdaptiveScaffoldToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => functionCalls.map((call) => {
    const supportType = call.args?.supportType
    const question = typeof call.args?.question === 'string' ? call.args.question.trim() : ''
    const reason = typeof call.args?.reason === 'string' ? call.args.reason.trim() : ''
    const textList = (value: unknown, limit: number) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()).slice(0, limit)
      : []
    const hints = textList(call.args?.hints, 3)
    const framework = textList(call.args?.framework, 5)
    const sentenceFrames = textList(call.args?.sentenceFrames, 4)
    const vocabulary = Array.isArray(call.args?.vocabulary) ? call.args.vocabulary.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return []
      const item = entry as Record<string, unknown>
      if (typeof item.phrase !== 'string' || typeof item.meaning !== 'string' || typeof item.example !== 'string') return []
      const phrase = item.phrase.trim()
      const meaning = item.meaning.trim()
      const example = item.example.trim()
      return phrase && meaning && example ? [{ phrase, meaning, example }] : []
    }).slice(0, 4) : []
    const workedExample = typeof call.args?.workedExample === 'string' ? call.args.workedExample.trim() : ''
    const hasSupport = supportType === 'idea-cue' ? hints.length > 0
      : supportType === 'vocabulary' ? vocabulary.length >= 2
        : supportType === 'answer-structure' ? framework.length >= 3
          : supportType === 'sentence-frames' ? sentenceFrames.length >= 2
            : supportType === 'worked-example' && Boolean(workedExample)
    if (call.name !== adaptiveScaffoldToolName || !isAdaptiveSupportType(supportType) || !question || !reason || !hasSupport) {
      setScaffoldError('The adaptive coach could not prepare a complete support aid. Ask it to try again.')
      return completeNonBlockingToolCall(call, { error: 'Provide a valid supportType, exact drill prompt, short reason, and the matching complete support content.' })
    }
    const aid: AdaptiveAid = {
      supportType,
      question,
      reason,
      ...(hints.length ? { hints } : {}),
      ...(vocabulary.length ? { vocabulary } : {}),
      ...(framework.length ? { framework } : {}),
      ...(sentenceFrames.length ? { sentenceFrames } : {}),
      ...(workedExample ? { workedExample } : {}),
    }
    setAdaptiveAid(aid)
    setScaffoldError('')
    return completeNonBlockingToolCall(call, {
      accepted: true,
      instruction: 'The app has displayed this single scaffold. Do not read the scaffold or any worked example aloud. Invite the learner to use only what helps and try the drill again in their own words. Fade support as they improve.',
    })
  }), [])
  const handleDrillRecommendationToolCall = useCallback(async (functionCalls: FunctionCall[]) => processDrillRecommendationToolCalls(
    functionCalls,
    setDrillRecommendation,
    setRecommendationError,
  ), [])
  const handleLiveToolCall = useCallback(async (functionCalls: FunctionCall[]): Promise<FunctionResponse[]> => {
    const recommendationCalls = functionCalls.filter((call) => call.name === drillRecommendationToolName)
    const scaffoldCalls = functionCalls.filter((call) => call.name !== drillRecommendationToolName)
    const scaffoldResponses = scaffoldCalls.length ? await handleAdaptiveScaffoldToolCall(scaffoldCalls) : []
    const recommendationResponses = recommendationCalls.length ? await handleDrillRecommendationToolCall(recommendationCalls) : []
    return [...scaffoldResponses, ...recommendationResponses]
  }, [handleAdaptiveScaffoldToolCall, handleDrillRecommendationToolCall])
  const live = useGeminiLive({
    apiKey,
    systemInstruction: `You are Speakia, a supportive IELTS Speaking drill coach. This is focused practice, not an official band assessment. Target skill: ${drill.skill}. Exercise: ${drill.task}\nToday's prompt: ${activePrompt}\n${drill.instructions}\nUse additional internal reasoning to compare the learner's performance with the target skill and select the most useful next step. Never disclose private chain-of-thought. Give only actionable feedback and concise conclusions. Let the learner know they can ask for support at any time using the Get tailored help control or by asking you directly.\n\nAdaptive coaching is available in every Speaking Drill, not only in drills about coaching. Follow the selected drill's practice instructions, listen to each attempt, and decide whether the learner would benefit from a just-in-time scaffold. If they are stuck, cannot start, give a very brief or off-task response, repeatedly hesitate, make a recurring or meaningful error they struggle to correct, or explicitly ask for help, call ${adaptiveScaffoldToolName} and show exactly one small aid through the app's shared Guided Practice support widget. Do not interrupt a learner who is actively speaking. Match the aid to both the observed attempt and target skill: use idea cues for generating content, useful vocabulary for lexical gaps, answer structure for developing or connecting ideas, sentence frames for grammar or incomplete sentences, and a short worked example for a demonstrated pattern or pronunciation model only after the learner has tried and still needs substantial support. For pronunciation, keep the model short and focus feedback on intelligibility, stress, rhythm, phrasing, or intonation that is actually audible. Respect drills specifically designed to scaffold from the start, then fade their support progressively. If the learner can proceed independently, use a brief encouraging or appropriately more challenging follow-up instead of adding unnecessary help. After showing a scaffold, invite the learner to retry in their own words, respond to the retry, and reduce support as they improve. Never present a worked example as a script to memorize.\n\nAfter at least two meaningful candidate attempts, if you observe a specific speaking-skill gap in this session, call ${drillRecommendationToolName} with concise evidence from the learner's actual attempts and one to three matching drill IDs. Do not recommend a drill for a single minor slip, guess at a weakness, or describe a short session as a stable diagnosis. The app will show an optional choice of targeted drills; explain the suggestion briefly and let the learner decide whether to open one.`,
    thinkingLevel: ThinkingLevel.HIGH,
    tools: [...adaptiveScaffoldTools, ...drillRecommendationTools],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO, allowedFunctionNames: [adaptiveScaffoldToolName, drillRecommendationToolName] } },
    onToolCall: handleLiveToolCall,
    openingPrompt: initialPrompt?.trim()
      ? `Start the ${drill.title} drill using this exact question or topic from the learner’s previous session: "${activePrompt}". Keep their original topic unchanged while practising ${drill.skill}. ${drill.instructions}`
      : drill.openingPrompt.replace(/about a place they enjoy visiting|one short, natural IELTS Speaking sentence|a familiar topic|one everyday IELTS Speaking question|one familiar personal question|a cue card about a memorable day|one thoughtful discussion question|a question to extend an answer|a question and connect their ideas clearly|a topic and invite them to express its key idea|one short speaking prompt|one discussion question that invites a comparison/i, activePrompt),
  })
  const isActive = live.connected || live.connecting
  const selectedAttempts = useMemo(() => attempts.filter((attempt) => attempt.drillId === selectedDrillId && attempt.evaluation), [attempts, selectedDrillId])
  const evaluatedAttempts = useMemo(() => attempts.filter((attempt) => attempt.evaluation), [attempts])
  const averageMastery = evaluatedAttempts.length ? Math.round(evaluatedAttempts.reduce((sum, attempt) => sum + (attempt.evaluation?.masteryScore ?? 0), 0) / evaluatedAttempts.length) : 0
  const selectedMastery = selectedAttempts.length ? Math.round(selectedAttempts.reduce((sum, attempt) => sum + (attempt.evaluation?.masteryScore ?? 0), 0) / selectedAttempts.length) : 0
  const firstSelectedScore = selectedAttempts[selectedAttempts.length - 1]?.evaluation?.masteryScore
  const latestSelectedScore = selectedAttempts[0]?.evaluation?.masteryScore
  const improvement = firstSelectedScore !== undefined && latestSelectedScore !== undefined ? latestSelectedScore - firstSelectedScore : 0
  const trend = useMemo(() => evaluatedAttempts.slice(0, 12).reverse().map((attempt, index) => ({
    attempt: index + 1,
    score: attempt.evaluation?.masteryScore ?? 0,
    label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(attempt.completedAt)),
  })), [evaluatedAttempts])
  const recentFocus = useMemo(() => criterionLabels.map((criterion) => {
    const scores = evaluatedAttempts.flatMap((attempt) => attempt.evaluation?.criteria.filter((item) => item.id === criterion.id).map((item) => item.score) ?? [])
    return { ...criterion, score: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0, attempts: scores.length }
  }), [evaluatedAttempts])
  const filteredAttempts = useMemo(() => attempts.filter((attempt) => archiveFilter === 'all' || attempt.drillId === archiveFilter), [archiveFilter, attempts])
  const filteredDrills = useMemo(() => {
    const queryTerms = drillSearch.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((term) => !drillSearchStopWords.has(term)) ?? []
    if (!queryTerms.length) return drills
    return drills.map((item) => {
      const historicalText = attempts.filter((attempt) => attempt.drillId === item.id).map((attempt) => [
        attempt.task,
        ...attempt.transcript.map((turn) => turn.text),
        attempt.evaluation?.summary ?? '',
        ...(attempt.evaluation?.improvements ?? []),
        ...(attempt.evaluation?.strengths ?? []),
      ].join(' ')).join(' ')
      const searchableText = `${item.title} ${item.category} ${item.skill} ${item.task} ${item.prompts.join(' ')} ${item.instructions} ${item.openingPrompt} ${historicalText}`.toLocaleLowerCase()
      const matches = queryTerms.filter((term) => [term, ...(drillSearchSynonyms[term] ?? [])]
        .some((candidate) => searchableText.includes(candidate))).length
      return { item, score: matches / queryTerms.length }
    }).filter(({ score }) => score >= 0.5)
      .sort((left, right) => right.score - left.score)
      .map(({ item }) => item)
  }, [attempts, drillSearch])
  const finishedAttempt = attempts.find((attempt) => attempt.id === lastAttemptId)

  useEffect(() => {
    if (activeView !== 'library' || isFinished || !focusRecommendedDrillRef.current) return
    focusRecommendedDrillRef.current = false
    const frame = window.requestAnimationFrame(() => drillTaskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => window.cancelAnimationFrame(frame)
  }, [activeView, isFinished, selectedDrillId])

  useEffect(() => {
    if (!live.connected || isReviewing) return
    const interval = window.setInterval(() => setElapsedSeconds((current) => current + 1), 1000)
    return () => window.clearInterval(interval)
  }, [isReviewing, live.connected])

  async function startDrill() {
    sessionStartedAt.current = new Date().toISOString()
    setElapsedSeconds(0)
    setIsReviewing(false)
    setIsFinished(false)
    setFinalTranscript([])
    setEvaluation(null)
    setEvaluationError('')
    setAssessmentDeferred(false)
    setAdaptiveAid(null)
    setScaffoldError('')
    setDrillRecommendation(null)
    setRecommendationError('')
    setHistoryWarning('')
    await live.start()
  }

  function requestAdaptiveHelp() {
    if (!live.connected || isReviewing) return
    setScaffoldError('')
    live.sendInstruction(`The learner has explicitly asked for help with this speaking drill prompt: "${activePrompt}". Review their attempts and choose the smallest useful aid for the target skill, then call ${adaptiveScaffoldToolName} to show exactly one support aid. Do not give a complete model answer unless they have already tried and still need substantial support. Invite them to retry in their own words.`)
  }

  function requestFeedback() {
    setIsReviewing(true)
    live.sendInstruction(`Please wrap up this ${drill.title} now. Give concise, specific feedback only on ${drill.skill}: mention one observed strength, one concrete improvement grounded in what the learner said, and one short spoken retry or next practice step. Be encouraging and do not give an official IELTS band score.`)
  }

  async function endDrill() {
    const result = await live.stop()
    const speechTranscript = result.transcript.filter((turn) => turn.role === 'examiner' || turn.role === 'candidate')
    const transcript = speechTranscript
      .map((turn) => ({
        ...(turn.id ? { id: turn.id } : {}),
        role: turn.role === 'candidate' ? 'candidate' as const : 'examiner' as const,
        text: turn.text,
        ...(typeof turn.audioOrder === 'number' ? { audioOrder: turn.audioOrder } : {}),
        ...(turn.audio ? { audio: turn.audio } : {}),
      }))
    setFinalTranscript(transcript)
    setEvaluation(null)
    setEvaluationError('')
    const completedAt = new Date().toISOString()
    const attempt: SpeakingDrillAttempt = {
      id: crypto.randomUUID(),
      drillId: drill.id,
      drillTitle: drill.title,
      category: drill.category,
      skill: drill.skill,
      task: activePrompt,
      startedAt: sessionStartedAt.current || completedAt,
      completedAt,
      durationSeconds: elapsedSeconds,
      audioAvailable: false,
      transcript: transcript.map(({ id, role, text, audioOrder }) => ({ ...(id ? { id } : {}), role, text, ...(audioOrder === undefined ? {} : { audioOrder }) })),
    }
    let compiledRecording: Blob | null = null
    try {
      if (!speechTranscript.some((turn) => turn.role === 'candidate' && turn.audio instanceof Blob)
        || !speechTranscript.some((turn) => turn.role === 'examiner' && turn.audio instanceof Blob)) {
        throw new Error('The original audio for both speakers is needed to compile a complete session recording.')
      }
      compiledRecording = await createTranscriptAudioCopy(speechTranscript)
      await savePracticeModeAudio(username, attempt.id, compiledRecording)
      attempt.audioAvailable = true
    } catch (error) {
      console.error('Unable to compile and save Speaking Drill session audio.', error)
      setHistoryWarning(`The complete session audio could not be archived. ${error instanceof Error ? error.message : 'You can still review the transcript.'}`)
    }
    try {
      await saveTranscriptAudio(attempt.id, transcript)
    } catch (error) {
      console.error('Unable to save Speaking Drill transcript audio.', error)
      setHistoryWarning((current) => `${current ? `${current} ` : ''}Some original speaker audio could not be archived with the transcript.`)
    }
    const nextAttempts = [attempt, ...loadSpeakingDrillAttempts(username)]
    if (!saveSpeakingDrillAttempts(username, nextAttempts)) {
      setHistoryWarning('This attempt could not be saved to browser history. You can still assess it in this session.')
    }
    setAttempts(nextAttempts)
    setLastAttemptId(attempt.id)
    setRecordingForAttempt(compiledRecording ? { attemptId: attempt.id, recording: compiledRecording } : null)
    if (!compiledRecording) setEvaluationError('A complete recording of both speakers could not be compiled, so this attempt cannot be assessed.')
    setAssessmentDeferred(false)
    setIsFinished(true)
  }

  async function evaluateAttempt(attempt: SpeakingDrillAttempt, recording: Blob, persistAttempt = true) {
    setEvaluating(true)
    setEvaluationError('')
    let report: DrillEvaluation
    try {
      report = await evaluateSpeakingDrill(apiKey, {
        title: attempt.drillTitle,
        skill: attempt.skill,
        task: drills.find((item) => item.id === attempt.drillId)?.task ?? attempt.task,
        prompt: attempt.task,
        transcript: attempt.transcript,
        recording,
      })
    } catch (error) {
      console.error('Unable to evaluate this Speaking Drill attempt.', error)
      const message = error instanceof Error ? error.message : 'Speakia AI could not evaluate this drill. Try again.'
      setEvaluationError(message)
      try {
        if (persistAttempt) {
          const updatedAttempts = updateSpeakingDrillAttempt(username, attempt.id, (saved) => ({ ...saved, evaluationError: message }))
          setAttempts(updatedAttempts)
        } else {
          setAttempts((current) => current.map((saved) => saved.id === attempt.id ? { ...saved, evaluationError: message } : saved))
        }
      } catch (saveError) {
        console.error('Unable to save the Speaking Drill evaluation error.', saveError)
      }
      return
    } finally {
      setEvaluating(false)
    }

    setEvaluation(report)
    try {
      if (persistAttempt) {
        setAttempts(updateSpeakingDrillAttempt(username, attempt.id, (saved) => ({ ...saved, evaluation: report, evaluationError: undefined })))
      } else {
        setAttempts((current) => current.map((saved) => saved.id === attempt.id ? { ...saved, evaluation: report, evaluationError: undefined } : saved))
      }
    } catch (error) {
      console.error('Speakia AI evaluated the drill, but its report could not be saved.', error)
      setHistoryWarning('Speakia AI completed the evaluation, but the report could not be saved to browser history. It is available for this session.')
      setAttempts((current) => current.map((saved) => saved.id === attempt.id ? { ...saved, evaluation: report, evaluationError: undefined } : saved))
    }
  }

  async function retryEvaluation(attempt: SpeakingDrillAttempt) {
    try {
      const cachedRecording = recordingForAttempt?.attemptId === attempt.id ? recordingForAttempt.recording : null
      const audio = cachedRecording ?? await loadPracticeModeAudio(username, attempt.id)
      if (!audio) throw new Error('This attempt has no saved audio recording to evaluate.')
      await evaluateAttempt(attempt, audio, !cachedRecording || loadSpeakingDrillAttempts(username).some((saved) => saved.id === attempt.id))
    } catch (error) {
      console.error('Unable to reload the Speaking Drill recording for evaluation.', error)
      setEvaluationError(error instanceof Error ? error.message : 'The saved drill recording could not be loaded.')
    }
  }

  function chooseDrill(item: Drill) {
    setSelectedDrillId(item.id)
    setActivePrompt(randomPromptForDrill(item))
    setIsFinished(false)
    setEvaluation(null)
    setEvaluationError('')
    setHistoryWarning('')
    if (window.matchMedia('(max-width: 900px)').matches) {
      window.requestAnimationFrame(() => drillTaskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    }
  }

  function chooseNewPrompt() {
    const choices = drill.prompts.filter((prompt) => prompt !== activePrompt)
    setActivePrompt(choices[Math.floor(Math.random() * choices.length)] ?? drill.prompts[0])
  }

  function openSuggestedDrill(evaluation: DrillEvaluation) {
    focusRecommendedDrillRef.current = true
    chooseDrill(recommendedDrillFor(evaluation))
    setActiveView('library')
  }

  function renderAttemptReport(attempt: SpeakingDrillAttempt) {
    const report = attempt.evaluation
    const attemptHasRecording = attempt.audioAvailable || recordingForAttempt?.attemptId === attempt.id
    return <div className="drill-attempt-report">
      {attempt.audioAvailable && <DrillSessionAudio username={username} attempt={attempt} />}
      {!report ? <div className="drill-attempt-pending">
        <span>{evaluating ? 'Speakia AI is assessing this attempt…' : attempt.evaluationError || 'This attempt has not been assessed yet.'}</span>
        {attemptHasRecording && <Button type="button" variant="outline" size="sm" disabled={evaluating} onClick={() => void retryEvaluation(attempt)}>{attempt.evaluationError ? <RotateCcw size={13} /> : <Sparkles size={13} />} {attempt.evaluationError ? 'Retry assessment' : 'Assess now'}</Button>}
      </div> : <>
      <p>{report.summary}</p>
      <div className="drill-attempt-scoreline"><strong>{report.masteryScore}%</strong><span>practice mastery</span><Badge>{report.evidenceQuality} evidence</Badge></div>
      <div className="drill-attempt-feedback-columns">
        <div><strong><Check size={14} /> Strengths</strong>{report.strengths.map((item) => <p key={item}>{item}</p>)}</div>
        <div><strong><Target size={14} /> Work on next</strong>{report.improvements.map((item) => <p key={item}>{item}</p>)}</div>
      </div>
      <div className="drill-attempt-criteria">{report.criteria.map((criterion) => <article key={criterion.id}><span>{criterionLabels.find((item) => item.id === criterion.id)?.label ?? criterion.id}</span><strong>{criterion.score}%</strong><p>{criterion.evidence}</p><small>{criterion.nextStep}</small></article>)}</div>
      <div className="drill-next-step"><Sparkles size={15} /><p><strong>Suggested next step</strong>{report.nextDrill}</p><Button type="button" variant="outline" size="sm" onClick={() => openSuggestedDrill(report)}>Open {recommendedDrillFor(report).title} <ArrowRight size={13} /></Button></div>
      {attempt.transcript.length > 0 && <details className="drill-attempt-transcript"><summary>Review attempt transcript</summary><div><TranscriptAudioList turns={attempt.transcript} variant="evaluation" testId={attempt.id} /></div></details>}
      </>}
    </div>
  }

  const dashboardPanel = <motion.section className="drill-dashboard" key="drill-dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
    <div className="drill-dashboard-welcome"><div><span className="section-kicker">YOUR SPEAKING SNAPSHOT</span><h2>Your practice, adding up</h2><p>Every attempt builds evidence. Review your trend, find your strongest skill, and choose what to practise next.</p></div><Button type="button" className="start-button" onClick={() => setActiveView('library')}><Mic size={15} /> Choose a drill <ArrowRight size={15} /></Button></div>
    <div className="drill-dashboard-metrics">
      <motion.article whileHover={{ y: -2 }}><span className="drill-metric-icon purple"><Activity size={17} /></span><small>ATTEMPTS</small><strong>{attempts.length}</strong><p>{new Set(attempts.map((attempt) => attempt.drillId)).size} distinct drills explored</p></motion.article>
      <motion.article whileHover={{ y: -2 }}><span className="drill-metric-icon green"><Gauge size={17} /></span><small>AVERAGE MASTERY</small><strong>{evaluatedAttempts.length ? `${averageMastery}%` : '—'}</strong><p>AI-estimated practice indicator</p></motion.article>
      <motion.article whileHover={{ y: -2 }}><span className="drill-metric-icon amber"><Award size={17} /></span><small>BEST DRILL</small><strong>{evaluatedAttempts.length ? `${Math.max(...evaluatedAttempts.map((attempt) => attempt.evaluation?.masteryScore ?? 0))}%` : '—'}</strong><p>{evaluatedAttempts.length ? evaluatedAttempts.reduce((best, attempt) => (attempt.evaluation?.masteryScore ?? 0) > (best.evaluation?.masteryScore ?? 0) ? attempt : best).drillTitle : 'Complete a drill to begin'}</p></motion.article>
      <motion.article whileHover={{ y: -2 }}><span className="drill-metric-icon blue"><TrendingUp size={17} /></span><small>SELECTED DRILL GROWTH</small><strong>{selectedAttempts.length > 1 ? `${improvement > 0 ? '+' : ''}${improvement}%` : '—'}</strong><p>{selectedAttempts.length > 1 ? drill.title : 'Repeat a drill to see change'}</p></motion.article>
    </div>
    <div className="drill-dashboard-grid">
      <Card className="drill-chart-card"><div className="drill-panel-heading"><div><span className="section-kicker">CONSISTENCY OVER TIME</span><h3>Mastery trend</h3></div><Badge><TrendingUp size={12} /> Recent attempts</Badge></div>
        {trend.length > 1 ? <div className="drill-trend-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="drillMasteryFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7868d2" stopOpacity={0.25} /><stop offset="100%" stopColor="#7868d2" stopOpacity={0.015} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#eeedf3" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#898695', fontSize: 10 }} /><YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fill: '#898695', fontSize: 10 }} /><Tooltip formatter={(value) => [`${value}%`, 'Practice mastery']} contentStyle={{ border: '1px solid #e9e6f1', borderRadius: 10, fontSize: 11 }} /><Area type="monotone" dataKey="score" stroke="#7868d2" strokeWidth={2.5} fill="url(#drillMasteryFill)" activeDot={{ r: 5, fill: '#7868d2' }} /></AreaChart></ResponsiveContainer></div>
          : <div className="drill-chart-empty"><BarChart3 size={22} /><strong>{trend.length ? 'One score recorded—keep going' : 'Your progress starts with one drill'}</strong><span>{trend.length ? 'Complete another evaluated attempt to reveal your trend.' : 'After your first drill, Speakia AI will add its evaluation here.'}</span></div>}
        <p className="drill-chart-note">Practice mastery is a drill-specific AI estimate, not an official IELTS band score.</p>
      </Card>
      <Card className="drill-skill-snapshot"><div className="drill-panel-heading"><div><span className="section-kicker">FOUR SPEAKING DIMENSIONS</span><h3>Skill snapshot</h3></div><Sparkles size={16} /></div>
        {recentFocus.map((criterion) => <div className="drill-skill-meter" key={criterion.id}><div><span>{criterion.label}</span><strong>{criterion.attempts ? `${criterion.score}%` : '—'}</strong></div><div className="drill-skill-meter-track"><span style={{ width: `${criterion.score}%`, backgroundColor: criterion.color }} /></div></div>)}
        <div className="drill-recommendation"><span><Target size={15} /></span><div><strong>Try next</strong><p>{evaluatedAttempts.length ? evaluatedAttempts.slice(0, 8).flatMap((attempt) => attempt.evaluation?.improvements.slice(0, 1) ?? [])[0] ?? 'Repeat a drill to get a focused next step.' : 'Complete a drill and Speakia AI will identify the most useful next step.'}</p></div></div>
      </Card>
    </div>
    <div className="drill-heatmap-section"><div className="drill-panel-heading"><div><span className="section-kicker">WHERE YOU’VE BEEN PRACTISING</span><h3>Drill mastery map</h3></div><span>Average of evaluated attempts</span></div><div className="drill-mastery-map">{drills.map((item) => {
      const scores = attempts.filter((attempt) => attempt.drillId === item.id && attempt.evaluation).map((attempt) => attempt.evaluation?.masteryScore ?? 0)
      const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0
      return <button type="button" className={`drill-mastery-tile ${scores.length ? `drill-mastery-level-${Math.min(4, Math.max(1, Math.ceil(score / 25)))}` : 'drill-mastery-level-0'}`} key={item.id} onClick={() => { chooseDrill(item); setActiveView('library') }}><span>{item.category.replace(' drills', '')}</span><strong>{item.title}</strong><small>{scores.length ? `${score}% · ${scores.length} ${scores.length === 1 ? 'attempt' : 'attempts'}` : 'Not practised yet'}</small></button>
    })}</div></div>
    <div className="drill-recent-section"><div className="drill-panel-heading"><div><span className="section-kicker">KEEP THE MOMENTUM</span><h3>Recent attempts</h3></div><Button type="button" variant="outline" size="sm" onClick={() => setActiveView('history')}>View archive <ArrowRight size={13} /></Button></div>
      {attempts.length ? <div className="drill-recent-list">{attempts.slice(0, 3).map((attempt) => <article key={attempt.id}><span className="drill-recent-score">{attempt.evaluation ? `${attempt.evaluation.masteryScore}%` : <Clock3 size={15} />}</span><div><strong>{attempt.drillTitle}</strong><small>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(attempt.completedAt))} · {formatTime(attempt.durationSeconds)}</small><p>{attempt.evaluation?.summary ?? attempt.evaluationError ?? 'Not assessed yet'}</p></div><button type="button" aria-label={`Review ${attempt.drillTitle} attempt`} onClick={() => { setExpandedAttemptId(attempt.id); setActiveView('history') }}><ChevronDown size={16} /></button></article>)}</div> : <Card className="drill-empty-state"><History size={22} /><strong>Your first drill is one step away</strong><p>Choose a short exercise, then see its transcript, strengths, improvement cues, and mastery snapshot here.</p><Button type="button" className="start-button" onClick={() => setActiveView('library')}>Explore exercises <ArrowRight size={14} /></Button></Card>}
    </div>
  </motion.section>

  const renderDrillCard = (item: Drill) => (
    <article className={`drill-choice-wrap ${selectedDrillId === item.id ? 'drill-choice-wrap-selected' : ''}`} key={item.id}>
      <button type="button" className={`drill-choice ${selectedDrillId === item.id ? 'drill-choice-selected' : ''}`} aria-pressed={selectedDrillId === item.id} onClick={() => chooseDrill(item)}>
        <span className="drill-choice-top"><span><Sparkles size={15} /></span><small>{formatTime(item.durationSeconds)}</small></span>
        <strong>{item.title}</strong>
        <span className="drill-skill">{item.skill}</span>
        <p>{item.task}</p>
      </button>
      {selectedDrillId === item.id && <button type="button" className="drill-choice-launch" disabled={!apiKey.trim() || live.connecting} onClick={() => void startDrill()}>{live.connecting ? <><LoaderCircle className="spin-icon" size={14} /> Connecting…</> : <><Mic size={14} /> Start this drill <ArrowRight size={14} /></>}</button>}
    </article>
  )

  return (
    <div className="page-content inner-page speaking-drills-page">
      <div className="speaking-drills-workspace">
        <header className="speaking-drills-heading"><div><p className="eyebrow">SPEAKIA IELTS · REPETITION STUDIO</p><h1>Speaking Drills</h1><p className="page-subtitle">Build automaticity with short, repeatable AI-led exercises. Practise a skill, get focused feedback, and try again.</p></div><Badge className="drills-thinking-badge"><Sparkles size={13} /> Speakia Live · adaptive coaching</Badge></header>

        {!isActive && !isFinished && (
        <>
        <nav className="drill-page-tabs" aria-label="Speaking Drills sections">
          <button type="button" className={activeView === 'overview' ? 'drill-page-tab-active' : ''} onClick={() => setActiveView('overview')}><BarChart3 size={15} /> Performance dashboard</button>
          <button type="button" className={activeView === 'library' ? 'drill-page-tab-active' : ''} onClick={() => setActiveView('library')}><BookOpen size={15} /> Drill library <span>{drills.length}</span></button>
          <button type="button" className={activeView === 'history' ? 'drill-page-tab-active' : ''} onClick={() => setActiveView('history')}><History size={15} /> Attempt archive <span>{attempts.length}</span></button>
        </nav>
        {activeView === 'overview' && dashboardPanel}
        {activeView === 'history' && <motion.section className="drill-history-page" key="drill-history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="drill-dashboard-welcome"><div><span className="section-kicker">YOUR PRACTICE LOG</span><h2>Drill attempt archive</h2><p>Review Speakia evaluations, evidence, transcripts, and next steps for every saved attempt.</p></div><label className="drill-history-filter"><ListFilter size={15} /><select aria-label="Filter drill history" value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value)}><option value="all">All drills</option>{drills.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label></div>
            {filteredAttempts.length ? <div className="drill-history-list">{filteredAttempts.map((attempt) => <article className="drill-history-item" key={attempt.id}>
              <button type="button" className="drill-history-summary" aria-expanded={expandedAttemptId === attempt.id} onClick={() => setExpandedAttemptId((current) => current === attempt.id ? '' : attempt.id)}>
                <span className="drill-history-icon"><Mic size={17} /></span><span className="drill-history-title"><strong>{attempt.drillTitle}</strong><small>{attempt.category} · {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(attempt.completedAt))}</small></span><span className="drill-history-duration">{formatTime(attempt.durationSeconds)}</span><span className="drill-history-mastery">{attempt.evaluation ? `${attempt.evaluation.masteryScore}%` : 'Not assessed'}</span>{expandedAttemptId === attempt.id ? <X size={15} /> : <ChevronDown size={16} />}
              </button>
              <AnimatePresence initial={false}>{expandedAttemptId === attempt.id && <motion.div className="drill-history-details" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>{renderAttemptReport(attempt)}</motion.div>}</AnimatePresence>
            </article>)}</div> : <Card className="drill-empty-state"><History size={22} /><strong>{attempts.length ? 'No attempts match this drill' : 'No saved attempts yet'}</strong><p>Complete an exercise and its assessment will appear here for future review.</p><Button type="button" variant="outline" onClick={() => setActiveView('library')}>Browse drills <ArrowRight size={14} /></Button></Card>}
          </motion.section>}
          {activeView === 'library' && <>
          <Card className="drills-intro-card">
            <span className="drills-intro-icon"><Target size={21} /></span>
            <div><strong>Repeat to make the skill feel natural</strong><p>Every drill includes the same live adaptive coaching and support aids as Guided Practice—matched to your attempt and target skill, then faded as you gain confidence. For longer strategy-led coaching or a full test run, use Guided Practice in the Practice module.</p></div>
          </Card>
          {!apiKey.trim() && <Card className="drills-key-notice"><AlertCircle size={17} /><p>Add your Speakia AI key in Settings before starting a live drill.</p><Button variant="outline" size="sm" onClick={onOpenSettings}>Open Settings</Button></Card>}
          <label className="drill-library-search"><Search size={17} /><input aria-label="Search speaking drills" value={drillSearch} onChange={(event) => setDrillSearch(event.target.value)} placeholder="Search by skill, topic, prompt, or past transcript…" />{drillSearch && <button type="button" aria-label="Clear drill search" onClick={() => setDrillSearch('')}><X size={15} /></button>}<span>{filteredDrills.length} {filteredDrills.length === 1 ? 'drill' : 'drills'}</span></label>
          <div className="speaking-drill-library-layout">
          <div className="speaking-drill-categories">{filteredDrills.length ? drillCategories.map((category) => {
            const categoryDrills = filteredDrills.filter((item) => item.category === category.title)
            if (!categoryDrills.length) return null
            return <section className="speaking-drill-category" key={category.title} aria-labelledby={`drill-category-${category.title.toLocaleLowerCase().replaceAll(' ', '-')}`}><div className="speaking-drill-category-heading"><div><h2 id={`drill-category-${category.title.toLocaleLowerCase().replaceAll(' ', '-')}`}>{category.title}</h2><p>{category.description}</p></div><span>{categoryDrills.length} {categoryDrills.length === 1 ? 'drill' : 'drills'}</span></div><div className="drills-grid" aria-label={category.title}>{categoryDrills.map(renderDrillCard)}</div></section>
          }) : <Card className="drill-empty-state"><Search size={22} /><strong>No matching drills</strong><p>Try a skill, IELTS part, topic, or a phrase from a previous transcript.</p><Button type="button" variant="outline" onClick={() => setDrillSearch('')}>Clear search</Button></Card>}</div>
          <div ref={drillTaskRef} id="drill-task-target"><Card className="drill-task-card">
            <div className="drill-task-heading"><div><span className="section-kicker">YOUR TASK</span><h2>{drill.title}</h2></div><Badge className="assignment-part-badge">{drill.skill}</Badge></div>
            <p>{drill.task}</p><div className="drill-active-prompt"><span>THIS ATTEMPT’S PROMPT</span><strong>{activePrompt}</strong><Button type="button" variant="outline" size="sm" onClick={chooseNewPrompt}><RotateCcw size={13} /> New prompt</Button></div>
            {selectedAttempts.length > 0 && <div className="drill-selected-progress"><span><Gauge size={15} /> {drill.title} mastery</span><strong>{selectedMastery}%</strong><div className="drill-skill-meter-track"><span style={{ width: `${selectedMastery}%` }} /></div><small>{selectedAttempts.length} evaluated {selectedAttempts.length === 1 ? 'attempt' : 'attempts'}{selectedAttempts.length > 1 ? ` · ${improvement > 0 ? '+' : ''}${improvement}% since first evaluated attempt` : ''}</small></div>}
            <div className="drill-task-footer"><span><Clock3 size={15} /> About {formatTime(drill.durationSeconds)} · You can finish whenever you’re ready</span><Button className="start-button" disabled={!apiKey.trim() || live.connecting} onClick={() => void startDrill()}>{live.connecting ? <><LoaderCircle className="spin-icon" size={16} /> Connecting…</> : <><Mic size={15} /> Start this drill <ArrowRight size={15} /></>}</Button></div>
            {live.error && <p className="simulator-error" role="alert"><AlertCircle size={15} /> {live.error}</p>}
          </Card></div>
          </div>
          </>}
        </>
      )}

      {isActive && (
        <section className="drill-session" aria-labelledby="drill-session-heading">
          <div className="drill-session-header">
            <Button variant="outline" onClick={() => void endDrill()} disabled={live.connecting}><ArrowLeft size={15} /> End drill</Button>
            <Badge className="drill-live-thinking"><span /> <Sparkles size={13} /> EXTENDED THINKING ACTIVE</Badge>
            <span className="drill-session-timer"><Clock3 size={15} /> {formatTime(Math.max(0, drill.durationSeconds - elapsedSeconds))}</span>
          </div>
          <Card className="drill-live-card">
            <div className={`drill-live-orb ${live.connected ? 'drill-live-orb-on' : ''}`}><Waves size={32} /></div>
            <div><span className="section-kicker">{drill.skill.toLocaleUpperCase()}</span><h2 id="drill-session-heading">{live.connected ? (isReviewing ? 'Speakia is preparing your feedback' : 'Your coach is listening') : 'Connecting to your coach…'}</h2><p>{activePrompt}</p></div>
            <span className={`drill-connection-status ${live.connected ? 'drill-connected' : ''}`}><i />{live.status || 'Connecting'}</span>
          </Card>
          {adaptiveAid && <AdaptiveAidWidget aid={adaptiveAid} ariaLabel="Adaptive drill support" />}
          {scaffoldError && <p className="simulator-error" role="alert"><AlertCircle size={15} /> {scaffoldError}</p>}
          {drillRecommendation && <DrillRecommendations recommendation={drillRecommendation} context={activePrompt} onOpenDrill={onOpenDrill} />}
          {recommendationError && <p className="simulator-error" role="alert"><AlertCircle size={15} /> {recommendationError}</p>}
          <Card className="drill-transcript-card">
            <div className="live-transcript-heading"><div><span className="section-kicker">LIVE PRACTICE</span><h3>What you and Speakia said</h3></div><span>{live.transcript.length} turns</span></div>
            <div className="live-transcript-scroll" aria-live="polite">
              {live.transcript.length ? <TranscriptAudioList turns={live.transcript.slice(-20)} variant="live" /> : <div className="transcript-waiting"><LoaderCircle size={17} /><span>Speakia will introduce the drill. Your captions will appear here.</span></div>}
              {live.candidateDraft && <div className="live-transcript-line candidate-line live-draft-line"><span>YOU · LIVE</span><p>{live.candidateDraft}</p></div>}
            </div>
          </Card>
          {live.error && <p className="simulator-error" role="alert"><AlertCircle size={15} /> {live.error}</p>}
          <div className="drill-session-actions">
            <span><Mic size={15} /> Speak naturally; your practice is not an official IELTS score.</span>
            {isReviewing
              ? <Button className="finish-live-button" disabled={!live.connected} onClick={() => void endDrill()}><MicOff size={15} /> Save transcript &amp; finish</Button>
              : <div className="drill-session-coach-actions"><Button type="button" variant="outline" disabled={!live.connected} onClick={requestAdaptiveHelp}><Lightbulb size={15} /> Get tailored help</Button><Button className="start-button" disabled={!live.connected} onClick={requestFeedback}><Sparkles size={15} /> Wrap up &amp; get feedback</Button></div>}
          </div>
        </section>
      )}

      {isFinished && (
        <Card className="drill-finished-card">
          <div className="drill-finished-heading"><span><Sparkles size={18} /></span><div><span className="section-kicker">{isReviewing ? 'DRILL COMPLETE' : 'SESSION ENDED'}</span><h2>{drill.title}</h2><p>{drill.skill} · Practice time {formatTime(elapsedSeconds)}</p></div></div>
          <section className="drill-finished-evaluation" aria-live="polite">{evaluating
            ? <div className="drill-evaluation-loading"><LoaderCircle className="spin-icon" size={20} /><div><strong>Speakia is assessing your attempt</strong><p>Checking your audio and transcript for evidence, strengths, and the most useful next step…</p></div></div>
            : evaluation && finishedAttempt
              ? renderAttemptReport(finishedAttempt)
              : assessmentDeferred && !evaluationError
                ? <div className="drill-evaluation-choice"><div><strong>Assessment saved for later</strong><p>Your attempt is in the archive. You can request its AI assessment whenever you’re ready.</p></div><Button type="button" variant="outline" onClick={() => { setExpandedAttemptId(lastAttemptId); setActiveView('history'); setIsFinished(false) }}><History size={14} /> Open attempt archive</Button></div>
                : <div className="drill-evaluation-choice"><div><strong>{evaluationError ? 'Assessment unavailable' : 'Would you like an AI assessment?'}</strong><p>{evaluationError || 'Your attempt is saved. Assess it now, or choose “Not yet” and request an assessment later from your attempt archive.'}</p></div>{(Boolean(lastAttemptId && attempts.find((attempt) => attempt.id === lastAttemptId)?.audioAvailable) || recordingForAttempt?.attemptId === lastAttemptId)
                  ? <div className="drill-assessment-actions"><Button type="button" variant={evaluationError ? 'outline' : 'default'} className={evaluationError ? '' : 'start-button'} disabled={evaluating} onClick={() => { const attempt = attempts.find((item) => item.id === lastAttemptId); if (attempt) void retryEvaluation(attempt) }}>{evaluationError ? <RotateCcw size={14} /> : <Sparkles size={14} />} {evaluationError ? 'Try assessment again' : 'Assess now'}</Button>{!evaluationError && <Button type="button" variant="outline" onClick={() => setAssessmentDeferred(true)}>Not yet</Button>}</div>
                  : <span className="drill-assessment-unavailable">Audio unavailable for assessment</span>}</div>}
          </section>
          {drillRecommendation && <DrillRecommendations recommendation={drillRecommendation} context={activePrompt} onOpenDrill={onOpenDrill} />}
          {recommendationError && <p className="simulator-error" role="alert"><AlertCircle size={15} /> {recommendationError}</p>}
          {historyWarning && <p className="drill-history-warning" role="status"><AlertCircle size={14} /> {historyWarning}</p>}
          <div className="drill-finished-transcript"><h3>{isReviewing ? 'Session transcript & feedback' : 'Practice transcript'}</h3>{finishedAttempt?.audioAvailable && <DrillSessionAudio username={username} attempt={finishedAttempt} />}{finalTranscript.length ? <TranscriptAudioList turns={finalTranscript} variant="evaluation" testId={lastAttemptId} /> : <p>No transcript was captured for this drill.</p>}</div>
          <div className="drill-finished-actions"><Button variant="outline" onClick={() => { setIsFinished(false); setElapsedSeconds(0); setActiveView('library') }}>Choose another drill</Button><Button className="start-button" onClick={() => { chooseNewPrompt(); setIsFinished(false) }}><Mic size={15} /> Repeat this drill <ArrowRight size={15} /></Button></div>
        </Card>
      )}
      </div>
    </div>
  )
}
