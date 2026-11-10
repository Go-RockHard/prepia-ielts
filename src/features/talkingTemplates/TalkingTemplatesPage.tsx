import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AudioLines, BarChart3, BookOpen, Bookmark, Check, ChevronRight, Clock3, Headphones,
  History, Lightbulb, ListFilter, LoaderCircle, Mic, Mic2, MicOff, Pause, Play, Radio, Search,
  Sparkles, Square, Volume2, VolumeX, Waves, X,
} from 'lucide-react'
import { Behavior, FunctionCallingConfigMode, FunctionResponseScheduling, Type, type FunctionCall, type FunctionResponse, type Tool } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaLiveModel, getProdiaTextModel } from '@/lib/geminiModels'
import { generateModelAnswerAudio, loadModelAnswerAudio, saveModelAnswerAudio } from '@/features/topics/modelAnswerAudio'
import { SpeechHighlight } from '@/features/simulator/SpeechHighlight'
import { wordIndexAtElapsed } from '@/features/simulator/speechTiming'
import { useGeminiLive } from '@/features/simulator/useGeminiLive'
import { useAiToAiSimulation } from '@/features/aiSimulation/useAiToAiSimulation'
import { ASSISTANT_MODELS, DEFAULT_TEMPLATE_GENERATION_MODEL, type AssistantModel } from '@/features/assistant/models'
import { useLexicalSessionCapture } from '@/features/vault/useLexicalSessionCapture'
import { loadAiSimulationAudio } from '@/features/aiSimulation/storage'
import type { AiSimulationPart, AiSimulationRecord, AiSimulationTurn, AnswerMasteryAssessment, AnswerMasteryResponse } from '@/features/aiSimulation/types'
import { loadTranscriptAudio, saveTranscriptAudio } from '@/features/simulator/recordingStorage'
import { bankPrompts, modelAnswerFor } from '@/features/topics/topicPrompts'
import type { TopicBankPrompt } from '@/features/topics/types'
import type { LexicalEntry } from '@/features/vault/lexicalEntries'
import type { TranscriptEntry } from '@/features/simulator/types'
import { drillRecommendationToolName, drillRecommendationTools, processDrillRecommendationToolCalls, type DrillRecommendation } from '@/features/drills/recommendations'
import { DrillRecommendations } from '@/features/drills/DrillRecommendations'

type TemplatePart = Exclude<AiSimulationPart, 'full'>
type TemplateFilter = 'all' | TemplatePart | 'full'

interface SpeakingTemplate {
  id: string
  part: TemplatePart
  topic: string
  category: string
  question: string
  answer: string
  structure: string[]
  vocabulary: string[]
  duration: string
}

interface TranscriptExchange {
  question: string
  answer: string
}

interface AnswerPair {
  question: string
  answer: string
  candidateTurnId: string
  supportUsed: boolean
}

function answerPairsFromTurns(turns: AiSimulationTurn[], scaffoldedTurnIds: string[] = []): AnswerPair[] {
  const pairs: AnswerPair[] = []
  const scaffoldedIds = new Set(scaffoldedTurnIds)
  let pendingQuestion = ''
  for (const turn of turns) {
    if (turn.role === 'examiner') {
      pendingQuestion = [pendingQuestion, turn.text].filter(Boolean).join('\n')
    } else if (pendingQuestion) {
      pairs.push({ question: pendingQuestion, answer: turn.text, candidateTurnId: turn.id, supportUsed: scaffoldedIds.has(turn.id) })
      pendingQuestion = ''
    }
  }
  return pairs
}

async function assessAnswerMastery(apiKey: string, turns: AiSimulationTurn[], referenceAnswer = '', scaffoldedTurnIds: string[] = []): Promise<AnswerMasteryAssessment> {
  const pairs = answerPairsFromTurns(turns, scaffoldedTurnIds).filter((pair) => pair.answer.trim())
  if (!pairs.length) throw new Error('No candidate answers were captured to assess.')
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model: getProdiaTextModel(),
    contents: `Assess the candidate's answer-building skill for each response in this IELTS speaking practice. This is formative learning feedback, not an official IELTS band score. Score each dimension from 0 to 100: relevance (answers the exact prompt), structure (clear organization and progression), development (supporting detail, examples, or explanation), and language (clear, natural, appropriately varied language based on the transcript). Also score independence from 0 to 100: estimate how well the candidate could produce an IELTS-ready response independently, considering supportUsed. Support is not failure: credit ideas and language that go beyond the aid, but do not treat a heavily scaffolded response as fully independent evidence. Do not penalize a learner for content absent from speech transcription. Keep feedback and nextStep specific, concise, and encouraging. Return one assessment in the same order for every candidate response; never invent missing answers. ${referenceAnswer.trim() ? `Optional model answer for comparison:\n${referenceAnswer.trim()}\n` : ''}Candidate responses:\n${JSON.stringify(pairs)}`,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          responses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                relevance: { type: Type.NUMBER },
                structure: { type: Type.NUMBER },
                development: { type: Type.NUMBER },
                language: { type: Type.NUMBER },
                independence: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
                nextStep: { type: Type.STRING },
              },
              required: ['relevance', 'structure', 'development', 'language', 'independence', 'feedback', 'nextStep'],
            },
          },
        },
        required: ['responses'],
      },
    },
  })
  if (!response.text?.trim()) throw new Error('Speakia returned no answer-building assessment.')
  let parsed: unknown
  try {
    parsed = JSON.parse(response.text)
  } catch (error) {
    console.error('Speakia returned invalid JSON for answer-building mastery.', error)
    throw new Error('Speakia returned an unreadable answer-building assessment.')
  }
  if (typeof parsed !== 'object' || parsed === null || !('responses' in parsed) || !Array.isArray(parsed.responses)) {
    throw new Error('Speakia returned an incomplete answer-building assessment.')
  }
  if (parsed.responses.length !== pairs.length) throw new Error('Speakia did not assess every candidate answer. Try the assessment again.')
  const responses: AnswerMasteryResponse[] = parsed.responses.map((item, index) => {
    if (typeof item !== 'object' || item === null) throw new Error(`Speakia returned an invalid score for answer ${index + 1}.`)
    const candidate = item as Record<string, unknown>
    const relevance = candidate.relevance
    const structure = candidate.structure
    const development = candidate.development
    const language = candidate.language
    const independence = candidate.independence
    const validScore = (score: unknown): score is number => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100
    if (!validScore(relevance)) throw new Error(`Speakia returned an invalid relevance score for answer ${index + 1}.`)
    if (!validScore(structure)) throw new Error(`Speakia returned an invalid structure score for answer ${index + 1}.`)
    if (!validScore(development)) throw new Error(`Speakia returned an invalid development score for answer ${index + 1}.`)
    if (!validScore(language)) throw new Error(`Speakia returned an invalid language score for answer ${index + 1}.`)
    if (!validScore(independence)) throw new Error(`Speakia returned an invalid independence score for answer ${index + 1}.`)
    if (typeof candidate.feedback !== 'string' || typeof candidate.nextStep !== 'string') {
      throw new Error(`Speakia returned incomplete feedback for answer ${index + 1}.`)
    }
    return {
      question: pairs[index].question,
      answer: pairs[index].answer,
      relevance,
      structure,
      development,
      language,
      supportUsed: pairs[index].supportUsed,
      independence,
      feedback: candidate.feedback,
      nextStep: candidate.nextStep,
    }
  })
  return { assessedAt: new Date().toISOString(), responses }
}

const adaptiveScaffoldToolName = 'prepare_answer_builder_scaffold'
type AdaptiveSupportType = 'idea-cue' | 'vocabulary' | 'answer-structure' | 'sentence-frames' | 'worked-example'
interface AdaptiveAid {
  supportType: AdaptiveSupportType
  question: string
  reason: string
  hints?: string[]
  vocabulary?: { phrase: string; meaning: string; example: string }[]
  framework?: string[]
  sentenceFrames?: string[]
  workedExample?: string
}

function isAdaptiveSupportType(value: unknown): value is AdaptiveSupportType {
  return value === 'idea-cue' || value === 'vocabulary' || value === 'answer-structure'
    || value === 'sentence-frames' || value === 'worked-example'
}

const adaptiveScaffoldTools: Tool[] = [{ functionDeclarations: [{
  name: adaptiveScaffoldToolName,
  behavior: Behavior.NON_BLOCKING,
  description: 'Choose the smallest useful support when the learner is stuck or asks for help. Prepare one aid for the current IELTS question. Do not interrupt a clear, independent answer; use Socratic follow-up questions when the learner is ready to develop an idea.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      supportType: { type: 'string', enum: ['idea-cue', 'vocabulary', 'answer-structure', 'sentence-frames', 'worked-example'] },
      question: { type: 'string', description: 'The exact current IELTS question this aid supports.' },
      reason: { type: 'string', description: 'A short, encouraging explanation of why this aid may help.' },
      hints: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
      vocabulary: {
        type: 'array',
        items: {
          type: 'object',
          properties: { phrase: { type: 'string' }, meaning: { type: 'string' }, example: { type: 'string' } },
          required: ['phrase', 'meaning', 'example'],
          additionalProperties: false,
        },
        minItems: 2,
        maxItems: 4,
      },
      framework: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
      sentenceFrames: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
      workedExample: { type: 'string', description: 'A short example only after the learner has attempted the question and still needs substantial support.' },
    },
    required: ['supportType', 'question', 'reason'],
    additionalProperties: false,
  },
}] }]

function completeAdaptiveToolCall(call: FunctionCall, response: Record<string, unknown>): FunctionResponse {
  return {
    id: call.id,
    name: call.name,
    response,
    willContinue: false,
    scheduling: FunctionResponseScheduling.WHEN_IDLE,
  }
}

interface FullSpeakingTemplate {
  id: string
  title: string
  topic: string
  category: string
  part1: TranscriptExchange[]
  part2CueCard: string
  part2Answer: string
  part2FollowUp: TranscriptExchange
  part3: TranscriptExchange[]
}

const templates: SpeakingTemplate[] = [
  {
    id: 'p1-hometown', part: 'part1', topic: 'Your hometown', category: 'Places',
    question: 'What do you like most about the place where you grew up?',
    answer: 'What I like most about my hometown is its relaxed atmosphere. It is a fairly busy city, but there are leafy parks and quiet cafés where people can slow down. I especially enjoy the local food market because it brings neighbours together. Overall, it feels lively without being overwhelming, which is why I still feel very connected to it.',
    structure: ['Give a direct personal answer', 'Add a specific reason or detail', 'Finish with a short reflection'],
    vocabulary: ['a relaxed atmosphere', 'bring people together', 'feel connected to'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-free-time', part: 'part1', topic: 'Free time', category: 'Lifestyle',
    question: 'What do you usually enjoy doing when you have some free time?',
    answer: 'In my free time, I usually go for a walk or listen to a podcast. It gives me a chance to clear my head, especially after a busy day at work. At weekends, I sometimes meet a friend for coffee, so I get a good balance between having time to myself and socialising.',
    structure: ['Say what you do', 'Explain when or why', 'Add a contrasting example'],
    vocabulary: ['clear my head', 'a good balance', 'catch up with a friend'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-technology', part: 'part1', topic: 'Technology', category: 'Technology',
    question: 'Which piece of technology do you use most often?',
    answer: 'I probably use my smartphone more than anything else. I rely on it to organise my day, keep in touch with family, and look up information when I am out. I try not to spend too much time scrolling, though, because I would rather use it for things that are genuinely useful.',
    structure: ['Name the technology', 'Give two practical uses', 'Add a personal qualification'],
    vocabulary: ['rely on', 'keep in touch', 'genuinely useful'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-reading', part: 'part1', topic: 'Reading', category: 'Lifestyle',
    question: 'Do you enjoy reading?',
    answer: 'Yes, especially when I want to unwind. I mostly read non-fiction because I like learning about real people and ideas, although I occasionally pick up a novel when I am travelling. I tend to read in short bursts rather than for hours, but it has become a relaxing part of my routine.',
    structure: ['Answer yes or no', 'Give a preference and reason', 'Add a habit or example'],
    vocabulary: ['unwind', 'in short bursts', 'part of my routine'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-food', part: 'part1', topic: 'Food and cooking', category: 'Lifestyle',
    question: 'Do you enjoy cooking?',
    answer: 'I do, although I would not call myself an expert. I like making simple meals with fresh ingredients because it is healthier and usually less expensive than ordering food. I often cook at the weekend, when I have more time to try a new recipe.',
    structure: ['State your view', 'Explain one benefit', 'Give a typical example'],
    vocabulary: ['fresh ingredients', 'less expensive than', 'try a new recipe'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-music', part: 'part1', topic: 'Music', category: 'Arts and culture',
    question: 'What kind of music do you enjoy listening to?',
    answer: 'I listen to a fairly wide range of music, but I usually choose acoustic or instrumental tracks when I need to concentrate. In the evenings, I prefer something more upbeat because it helps me switch off from work. I also enjoy discovering local musicians, so my playlists are always changing.',
    structure: ['Name a preference', 'Explain when or why you listen', 'Add a personal detail'],
    vocabulary: ['a wide range of', 'switch off from work', 'discover local musicians'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-transport', part: 'part1', topic: 'Public transport', category: 'Places',
    question: 'How do you usually travel around your town or city?',
    answer: 'I usually take the bus because the main routes are convenient and reasonably reliable. If I am only going a short distance, I prefer to walk, especially when the weather is pleasant. Having both options makes it easier to avoid driving everywhere.',
    structure: ['Give your usual choice', 'Explain its practical benefit', 'Mention when you choose another option'],
    vocabulary: ['main routes', 'reasonably reliable', 'avoid driving everywhere'],
    duration: '20–30 sec',
  },
  {
    id: 'p2-memorable-place', part: 'part2', topic: 'A memorable place', category: 'Places',
    question: 'Describe a place you enjoy visiting. You should say where it is, how you found out about it, what you do there, and explain why you enjoy going there.',
    answer: 'I would like to talk about a small botanical garden on the edge of my city. I first heard about it from a friend, who suggested it as a peaceful place to visit on a weekend. It is not particularly famous, but it has winding paths, a little pond, and a greenhouse filled with tropical plants. When I go there, I usually take a slow walk and sometimes bring a book. What makes it special is the contrast with the busy streets nearby. After an hour there, I feel much calmer and more focused. I have visited several times, and I would happily recommend it to anyone who needs a quiet break.',
    structure: ['Set the scene and identify the place', 'Describe how you discovered it', 'Add sensory details and what you do', 'Explain why it matters to you'],
    vocabulary: ['on the edge of the city', 'a quiet break', 'a welcome contrast'],
    duration: '1–2 min',
  },
  {
    id: 'p2-skill', part: 'part2', topic: 'A useful skill', category: 'Learning',
    question: 'Describe a skill you learned that was useful to you. You should say what it is, when you learned it, how you learned it, and explain why it is useful.',
    answer: 'A useful skill I learned is basic graphic design. I started learning it a couple of years ago because I needed to create clear presentations for a project. At first, I followed short online tutorials and practised by redesigning some old slides. I gradually learned how to choose colours, arrange information, and make a page easier to understand. I am still improving, but now I can put together materials much more confidently. The skill has been useful at work, and it has also made me more aware of good design in everyday life. I like it because it combines creativity with practical problem-solving.',
    structure: ['Name the skill and give the context', 'Explain how you learned it', 'Describe progress and a specific use', 'Reflect on why it is valuable'],
    vocabulary: ['short online tutorials', 'put together materials', 'practical problem-solving'],
    duration: '1–2 min',
  },
  {
    id: 'p2-person', part: 'part2', topic: 'A person who inspires you', category: 'People',
    question: 'Describe a person who has inspired you. You should say who this person is, how you know them, what they have achieved, and explain why they inspire you.',
    answer: 'The person I would like to describe is my former science teacher. I met her at secondary school, and she made a difficult subject feel approachable. She was known for helping students who lacked confidence, and she always found a different way to explain an idea if we did not understand it. One thing I remember clearly is how she stayed after class to help me prepare for a project. She did not simply give me the answers; she showed me how to work things out for myself. I admire her patience and the way she encouraged people to believe in their own abilities. That example still influences how I approach challenges.',
    structure: ['Introduce the person and relationship', 'Describe a memorable example', 'Explain the qualities you admire', 'Connect their influence to your life'],
    vocabulary: ['feel approachable', 'work things out', 'believe in your abilities'],
    duration: '1–2 min',
  },
  {
    id: 'p2-celebration', part: 'part2', topic: 'A memorable celebration', category: 'Experiences',
    question: 'Describe a celebration you remember. You should say what was celebrated, where it took place, who was there, and explain why you remember it.',
    answer: 'One celebration I remember especially well was my cousin’s graduation. It took place at a restaurant near the university, and several relatives travelled from different cities to be there. The atmosphere was cheerful, but the best part was hearing my cousin talk about the challenges she had overcome during her course. We shared a meal, looked through old photographs, and took plenty of pictures together. I remember it because it felt like more than a formal event; it brought our family together and gave everyone a chance to recognise her hard work. It was a simple evening, but it left me feeling proud and grateful.',
    structure: ['Set the occasion and place', 'Describe who was there and what happened', 'Add a memorable moment', 'Explain your feelings and why it stayed with you'],
    vocabulary: ['overcome a challenge', 'recognise someone’s hard work', 'bring the family together'],
    duration: '1–2 min',
  },
  {
    id: 'p2-object', part: 'part2', topic: 'An object you use every day', category: 'Lifestyle',
    question: 'Describe an object you use every day. You should say what it is, when you started using it, how it helps you, and explain why it is important to you.',
    answer: 'An object I use every day is a small notebook that I keep in my bag. I started carrying it a few years ago, when I realised I was forgetting small tasks and ideas during busy days. I use it to write reminders, plan my week, and make quick notes when I am reading. It is simple, but it helps me organise my thoughts without opening my phone and getting distracted. I have filled several notebooks over the years, and I sometimes look back at them to see what I was working on. It is important to me because it gives me a practical way to stay organised and focused.',
    structure: ['Identify the object and when you got it', 'Describe how you use it', 'Give a specific example', 'Explain why it matters'],
    vocabulary: ['keep it in my bag', 'organise my thoughts', 'stay focused'],
    duration: '1–2 min',
  },
  {
    id: 'p2-helpful-advice', part: 'part2', topic: 'Helpful advice', category: 'People',
    question: 'Describe a piece of advice that you found helpful. You should say what the advice was, who gave it to you, when you received it, and explain why it was helpful.',
    answer: 'A piece of advice I found helpful was to focus on making steady progress rather than waiting until I could do something perfectly. A former teacher gave it to me when I was preparing a presentation and felt nervous about speaking in front of a group. She suggested that I practise one section at a time and ask someone for feedback. That made the task feel manageable, and I gradually became more confident. I still use that advice when I face a new challenge because it reminds me that small improvements can add up. It is useful in both my studies and daily life.',
    structure: ['State the advice clearly', 'Explain who gave it and the situation', 'Describe the result', 'Reflect on why it remains useful'],
    vocabulary: ['steady progress', 'one section at a time', 'small improvements add up'],
    duration: '1–2 min',
  },
  {
    id: 'p3-technology', part: 'part3', topic: 'Technology and communication', category: 'Technology',
    question: 'How has technology changed the way people communicate with one another?',
    answer: 'Technology has made communication much faster and more convenient. People can exchange messages or make video calls regardless of distance, which is particularly valuable for families living in different countries. However, there is a trade-off: some people may rely on quick messages instead of having more meaningful conversations in person. I think technology works best as a way to stay connected, rather than a complete replacement for face-to-face contact.',
    structure: ['Make a clear general claim', 'Explain a benefit with an example', 'Introduce a contrasting drawback', 'End with a balanced view'],
    vocabulary: ['regardless of distance', 'there is a trade-off', 'face-to-face contact'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-education', part: 'part3', topic: 'Education and opportunity', category: 'Learning',
    question: 'Should schools focus more on practical skills or academic subjects?',
    answer: 'I do not think schools should choose one at the expense of the other. Academic subjects help students develop knowledge and critical thinking, while practical skills prepare them to manage real situations, such as communicating at work or handling money. The right balance may depend on students’ ages and needs. For instance, younger learners might benefit from a broad foundation, whereas older students could have more opportunities to apply what they have learned.',
    structure: ['Give a balanced position', 'Explain the value of each side', 'Add a relevant example', 'Conclude with a condition or recommendation'],
    vocabulary: ['at the expense of', 'critical thinking', 'a broad foundation'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-environment', part: 'part3', topic: 'The environment', category: 'Society',
    question: 'What can individuals do to protect the environment?',
    answer: 'Individuals can make a difference through small, consistent choices, such as reducing food waste, using public transport, and buying fewer disposable products. These actions alone cannot solve large environmental problems, so governments and businesses also need to make changes. Still, individual habits can influence demand and encourage people around us to think more carefully about consumption. I would describe personal action as one important part of a wider solution.',
    structure: ['Suggest several practical actions', 'Recognise the limits of individual action', 'Explain how personal choices can have wider effects', 'Finish with a balanced conclusion'],
    vocabulary: ['small, consistent choices', 'reduce food waste', 'a wider solution'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-tourism', part: 'part3', topic: 'Tourism and local communities', category: 'Places',
    question: 'What are the advantages and disadvantages of tourism for local communities?',
    answer: 'Tourism can support local businesses and create jobs, particularly in places with few other industries. It can also introduce visitors to local traditions. On the other hand, a sudden increase in visitors may put pressure on housing, public transport, and natural sites. In my view, tourism is most beneficial when it is managed responsibly and local residents have a say in how it develops.',
    structure: ['Explain economic or cultural benefits', 'Contrast with a potential cost', 'Give a considered recommendation'],
    vocabulary: ['support local businesses', 'put pressure on', 'managed responsibly'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-remote-work', part: 'part3', topic: 'Remote work', category: 'Work and study',
    question: 'What are the main advantages and disadvantages of working from home?',
    answer: 'Working from home can save commuting time and give people more flexibility over their daily routine. It may also help employers recruit people who live far from an office. On the other hand, some workers can feel isolated, and it may be harder to separate work from personal life. I think a hybrid arrangement can work well, provided that teams communicate clearly and employees have suitable working conditions.',
    structure: ['State a general position', 'Develop one or two benefits', 'Balance them with drawbacks', 'Conclude with a condition or recommendation'],
    vocabulary: ['save commuting time', 'separate work from personal life', 'a hybrid arrangement'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-public-libraries', part: 'part3', topic: 'Public libraries', category: 'Learning',
    question: 'Do public libraries still have an important role in modern communities?',
    answer: 'Yes, although their role has broadened beyond lending books. Libraries provide quiet study areas, internet access, and events for people who may not have these resources at home. They can also help residents develop digital skills. Some services are now available online, but a welcoming public space remains valuable, particularly for children, older people, and those on a limited income.',
    structure: ['Give a direct view', 'Explain how the role has changed', 'Support the argument with examples', 'Add a balanced final point'],
    vocabulary: ['broaden beyond', 'develop digital skills', 'on a limited income'],
    duration: '30–45 sec',
  },
  {
    id: 'p1-morning-routine', part: 'part1', topic: 'Daily routines', category: 'Lifestyle',
    question: 'Is your daily routine the same every day?',
    answer: 'Not exactly. I have a fairly regular start to the day because I need to get ready for work, but my evenings vary. Some days I cook at home, while on others I meet a friend or spend time reading. I like having a routine, but a little flexibility keeps it from feeling repetitive.',
    structure: ['Give a direct answer', 'Compare two parts of the day', 'Add a personal view'],
    vocabulary: ['a fairly regular routine', 'vary from day to day', 'feel repetitive'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-weather', part: 'part1', topic: 'Weather', category: 'Lifestyle',
    question: 'What kind of weather do you enjoy most?',
    answer: 'I enjoy mild, sunny weather with a light breeze. It is comfortable enough to spend time outdoors without feeling too hot, so I can walk or meet friends in a park. Very hot days can be tiring, and heavy rain tends to disrupt my plans.',
    structure: ['Name the weather you prefer', 'Explain what it lets you do', 'Briefly contrast another condition'],
    vocabulary: ['a light breeze', 'spend time outdoors', 'disrupt my plans'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-photographs', part: 'part1', topic: 'Photographs', category: 'Arts and culture',
    question: 'Do you like taking photographs?',
    answer: 'Yes, especially when I travel or spend time with family. I do not take professional photographs, but I like capturing small details that I might otherwise forget. I usually keep the pictures on my phone and look through them when I want to remember a particular day.',
    structure: ['State your preference', 'Say when you take photos', 'Explain why you keep them'],
    vocabulary: ['capture small details', 'look through photographs', 'remember a particular day'],
    duration: '20–30 sec',
  },
  {
    id: 'p1-neighbours', part: 'part1', topic: 'Neighbours', category: 'People',
    question: 'Do you know the people who live near you?',
    answer: 'I know a few of them, mostly because we see each other in the building or at nearby shops. We are not extremely close, but we greet one another and sometimes help with small things, such as collecting a parcel. It makes the area feel friendlier.',
    structure: ['Describe how well you know them', 'Give a typical interaction', 'Explain the effect on the neighbourhood'],
    vocabulary: ['see each other regularly', 'help with small things', 'feel friendlier'],
    duration: '20–30 sec',
  },
  {
    id: 'p2-family-tradition', part: 'part2', topic: 'A tradition in your family', category: 'People',
    question: 'Describe a tradition that is important in your family. You should say what the tradition is, when your family follows it, who takes part, and explain why it is important to you.',
    answer: 'A tradition I value is having a meal together during a major family celebration. Relatives make time to visit, even if they live in different parts of the country. Everyone contributes something, so the meal is a mixture of familiar dishes and new ideas. While we eat, people share stories about what has happened over the past year. I enjoy the food, of course, but the best part is having an unhurried chance to talk. Busy schedules can make it difficult for everyone to meet, so this tradition gives us a reason to stay connected. It is important because it reminds me that family relationships need regular attention, not just good intentions.',
    structure: ['Introduce the tradition and occasion', 'Describe who participates and what happens', 'Share a memorable detail', 'Explain its personal value'],
    vocabulary: ['make time to visit', 'stay connected', 'an unhurried chance to talk'],
    duration: '1–2 min',
  },
  {
    id: 'p2-local-business', part: 'part2', topic: 'A local business you like', category: 'Work and study',
    question: 'Describe a local business that you often visit. You should say what it sells or does, where it is, how you learned about it, and explain why you like it.',
    answer: 'A local business I often visit is a small bakery near the bus stop on my route home. I discovered it when I was looking for somewhere to buy fresh bread after work. It sells simple things such as rolls, pastries, and a few savoury snacks. The staff are friendly and remember what regular customers usually order, which makes the place feel welcoming. I particularly like that the products are prepared in small batches, so they are fresh in the evening. It is not a large or fashionable shop, but it has become part of my routine. I prefer supporting a neighbourhood business when I can, especially when the service is personal and the quality is consistent.',
    structure: ['Identify the business and location', 'Explain how you found it', 'Describe its products or service', 'Give reasons you return'],
    vocabulary: ['part of my routine', 'prepared in small batches', 'quality is consistent'],
    duration: '1–2 min',
  },
  {
    id: 'p2-challenging-journey', part: 'part2', topic: 'A journey that did not go as planned', category: 'Travel',
    question: 'Describe a journey that did not go as you expected. You should say where you were going, who you travelled with, what went wrong, and explain how you felt about the experience.',
    answer: 'I remember a train journey I took with a friend to visit a coastal town. We had planned to arrive before lunch, but a signal problem delayed the train for several hours. At first we were frustrated because we had booked a walking tour and thought we would miss it. We checked the station updates, contacted the guide, and found that we could join a later group. While we waited, we bought some food and talked about other places we wanted to see. The day did not follow our plan, but it was still enjoyable once we stopped worrying about the timetable. The experience taught me to leave some flexibility in travel plans and to focus on what can be done rather than what has already gone wrong.',
    structure: ['Set the destination and travel context', 'Explain the unexpected problem', 'Describe your response and feelings', 'Reflect on what you learned'],
    vocabulary: ['did not go as planned', 'leave some flexibility', 'focus on what can be done'],
    duration: '1–2 min',
  },
  {
    id: 'p2-useful-app', part: 'part2', topic: 'An app that is useful to you', category: 'Technology',
    question: 'Describe an application on your phone that you find useful. You should say what it is, how often you use it, what you use it for, and explain why it is useful.',
    answer: 'One application I find useful is a map app that I use whenever I travel somewhere unfamiliar. I open it several times a week, not only to find directions but also to check public transport and estimate how long a journey will take. A feature I appreciate is that it shows alternative routes if there is heavy traffic. It has helped me avoid getting lost in a new area and makes it easier to plan when to leave. I still check important details before setting off because digital information is not always perfect. Overall, it saves time and gives me more confidence when I need to get around a city I do not know well.',
    structure: ['Name the app and its purpose', 'Describe how often and when you use it', 'Give a specific benefit', 'Add a balanced personal reflection'],
    vocabulary: ['somewhere unfamiliar', 'alternative routes', 'get around a city'],
    duration: '1–2 min',
  },
  {
    id: 'p3-urban-green-space', part: 'part3', topic: 'Green spaces in cities', category: 'Places',
    question: 'Why should cities protect parks and other green spaces?',
    answer: 'Green spaces improve urban life in several ways. They give residents somewhere to exercise and relax, and trees can make streets more pleasant during hot weather. Parks may also provide habitats for birds and insects. However, maintaining them requires planning and investment, especially as cities grow. I think green areas should be treated as essential infrastructure rather than optional decoration because their benefits are shared by the wider community.',
    structure: ['State the main reasons', 'Develop practical and environmental benefits', 'Acknowledge a challenge', 'End with a clear recommendation'],
    vocabulary: ['urban life', 'essential infrastructure', 'benefits are shared'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-children-reading', part: 'part3', topic: 'Children and reading', category: 'Learning',
    question: 'How can parents and schools encourage children to read more?',
    answer: 'The most effective approach is probably to make reading enjoyable and accessible. Parents can read with younger children and let them choose books that match their interests, while schools can provide a varied library and time for independent reading. It is also useful to discuss stories rather than treating every book as a test. Digital books can attract some children, although they should be one option among several. When reading feels relevant rather than compulsory, children are more likely to continue.',
    structure: ['Give an overall approach', 'Compare what families and schools can do', 'Add a balanced view of digital reading', 'Conclude with the likely effect'],
    vocabulary: ['match their interests', 'independent reading', 'feel relevant rather than compulsory'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-public-transport-investment', part: 'part3', topic: 'Investment in public transport', category: 'Travel',
    question: 'What can governments do to persuade more people to use public transport?',
    answer: 'Governments need to make public transport reliable, affordable, and convenient. More frequent services and well-connected routes would make it a realistic choice for people who currently depend on cars. Clear information and safe stations also matter, particularly for people travelling at night. Discounts may encourage use, but they are unlikely to be enough if services are unreliable. Investment should therefore improve the whole journey, from access to the station to the final connection.',
    structure: ['Identify the main conditions', 'Give examples of service improvements', 'Explain why price alone is insufficient', 'Finish with a practical summary'],
    vocabulary: ['a realistic choice', 'well-connected routes', 'the whole journey'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-online-shopping', part: 'part3', topic: 'Online shopping and local shops', category: 'Work and study',
    question: 'How has online shopping affected small local shops?',
    answer: 'Online shopping has created strong competition because customers can compare prices and order products without travelling. Small shops may find that difficult, particularly when they cannot match large retailers on cost. At the same time, local businesses can offer personal service, specialist knowledge, and products that are not widely available. Some have adapted by using online ordering themselves. Their future may depend on combining the convenience of digital tools with the qualities that make a local shop distinctive.',
    structure: ['Explain the competitive pressure', 'Recognise advantages of local businesses', 'Describe an adaptation', 'Offer a balanced conclusion'],
    vocabulary: ['compare prices', 'personal service', 'make a shop distinctive'],
    duration: '30–45 sec',
  },
  {
    id: 'p3-cultural-events', part: 'part3', topic: 'Cultural events and communities', category: 'Arts and culture',
    question: 'What benefits can cultural events bring to a community?',
    answer: 'Cultural events can help people learn about local traditions and meet others who live nearby. They may also support artists and small businesses by attracting visitors. A well-organised event can create a sense of shared identity, although organisers should make sure it is accessible to different age groups and income levels. In my view, the most successful events are not only entertaining but also give local people a chance to participate.',
    structure: ['Describe social and economic benefits', 'Explain community impact', 'Mention inclusion as a consideration', 'Conclude with what makes events successful'],
    vocabulary: ['a sense of shared identity', 'attracting visitors', 'a chance to participate'],
    duration: '30–45 sec',
  },
]

const partLabels: Record<TemplateFilter, string> = {
  all: 'All questions',
  part1: 'Part 1',
  part2: 'Part 2',
  part3: 'Part 3',
  full: 'Full test',
}

function favoritesKey(username: string): string {
  return `speakia-talking-template-favorites-v1:${username}`
}

function answerEditsKey(username: string): string {
  return `speakia-talking-template-answer-edits-v1:${username}`
}

function generatedTemplatesKey(username: string): string {
  return `speakia-interactive-templates-generated-v1:${username}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringList(value: unknown, minLength: number, maxLength: number, maxItemLength: number): value is string[] {
  return Array.isArray(value) && value.length >= minLength && value.length <= maxLength
    && value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= maxItemLength)
}

function isSpeakingTemplate(value: unknown): value is SpeakingTemplate {
  if (!isRecord(value)) return false
  return typeof value.id === 'string' && /^ai-template-[\w-]{8,80}$/.test(value.id)
    && (value.part === 'part1' || value.part === 'part2' || value.part === 'part3')
    && typeof value.topic === 'string' && value.topic.trim().length > 0 && value.topic.length <= 100
    && typeof value.category === 'string' && value.category.trim().length > 0 && value.category.length <= 60
    && typeof value.question === 'string' && value.question.trim().length > 0 && value.question.length <= 700
    && typeof value.answer === 'string' && value.answer.trim().length > 0 && value.answer.length <= 1500
    && isStringList(value.structure, 3, 5, 120)
    && isStringList(value.vocabulary, 3, 6, 80)
    && typeof value.duration === 'string' && value.duration.trim().length > 0 && value.duration.length <= 20
}

function loadGeneratedTemplates(username: string): SpeakingTemplate[] {
  try {
    const raw = localStorage.getItem(generatedTemplatesKey(username))
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || !value.every(isSpeakingTemplate)) {
      throw new Error('Saved generated Answer Builder examples are invalid.')
    }
    return value
  } catch (error) {
    console.error('Unable to load generated Answer Builder examples.', error)
    return []
  }
}

function loadFavorites(username: string): string[] {
  try {
    const raw = localStorage.getItem(favoritesKey(username))
    if (!raw) return []
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
      throw new Error('Saved Answer Builder favorites are invalid.')
    }
    return value
  } catch (error) {
    console.error('Unable to load Answer Builder favorites.', error)
    return []
  }
}

function loadAnswerEdits(username: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(answerEditsKey(username))
    if (!raw) return {}
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('Saved Answer Builder answer edits are invalid.')
    }
    const edits: Record<string, string> = {}
    for (const [id, answer] of Object.entries(value)) {
      if (typeof answer !== 'string') throw new Error('Saved Answer Builder answer edits are invalid.')
      edits[id] = answer
    }
    return edits
  } catch (error) {
    console.error('Unable to load Answer Builder answer edits.', error)
    return {}
  }
}

function partTitle(part: TemplatePart): string {
  return part === 'part1' ? 'Part 1' : part === 'part2' ? 'Part 2' : 'Part 3'
}

function promptQuestionText(prompt: TopicBankPrompt): string {
  if (prompt.part !== 'part2' || !prompt.cuePoints?.length) return prompt.question
  return `${prompt.question}\n\nYou should say:\n${prompt.cuePoints.map((point) => `• ${point}`).join('\n')}`
}

function promptAsTemplate(prompt: TopicBankPrompt): SpeakingTemplate {
  const normalize = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const example = templates.find((template) => template.part === prompt.part
    && normalize(template.question) === normalize(prompt.question))
  const structure = prompt.cuePoints?.length
    ? prompt.cuePoints
    : example?.structure ?? (prompt.part === 'part1'
      ? ['Give a direct answer', 'Add a reason or personal detail', 'Finish with a brief reflection']
      : prompt.part === 'part2'
        ? ['Introduce the person, place, or experience', 'Develop the main details', 'Add a specific example', 'Explain why it matters to you']
        : ['Give a clear opinion', 'Explain your reasoning', 'Support it with an example', 'Acknowledge another perspective'])
  return {
    id: prompt.id,
    part: prompt.part,
    topic: prompt.topic,
    category: prompt.category,
    question: promptQuestionText(prompt),
    answer: example?.answer ?? modelAnswerFor(prompt),
    structure,
    vocabulary: prompt.vocabulary.length >= 3 ? prompt.vocabulary : example?.vocabulary ?? prompt.vocabulary,
    duration: prompt.part === 'part1' ? '20–30 sec' : prompt.part === 'part2' ? '1–2 min' : '30–45 sec',
  }
}

function fullTestsFromTopicBank(prompts: TopicBankPrompt[]): FullSpeakingTemplate[] {
  const part1 = prompts.filter((prompt) => prompt.part === 'part1')
  const part2 = prompts.filter((prompt) => prompt.part === 'part2')
  const part3 = prompts.filter((prompt) => prompt.part === 'part3')
  if (!part1.length || !part2.length || !part3.length) return []

  return part2.map((cueCard) => {
    const relatedPart1 = part1.filter((prompt) => prompt.category === cueCard.category)
    const relatedPart3 = part3.filter((prompt) => prompt.category === cueCard.category)
    const selectedPart1 = (relatedPart1.length >= 3 ? relatedPart1 : part1).slice(0, 5)
    const selectedPart3 = (relatedPart3.length >= 3 ? relatedPart3 : part3).slice(0, 5)
    const followUpPrompt = selectedPart3[0]
    return {
      id: `topic-bank-full-${cueCard.id}`,
      title: `${cueCard.topic} · Full mock test`,
      topic: cueCard.topic,
      category: cueCard.category,
      part1: selectedPart1.map((prompt) => ({ question: prompt.question, answer: modelAnswerFor(prompt) })),
      part2CueCard: promptQuestionText(cueCard),
      part2Answer: modelAnswerFor(cueCard),
      part2FollowUp: { question: followUpPrompt.question, answer: modelAnswerFor(followUpPrompt) },
      part3: selectedPart3.slice(1).map((prompt) => ({ question: prompt.question, answer: modelAnswerFor(prompt) })),
    }
  })
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function TranscriptExchangeView({ exchange, number }: { exchange: TranscriptExchange; number: number }) {
  return <div className="tt-transcript-exchange">
    <div className="tt-transcript-turn"><strong>Examiner · question {number}</strong><p>{exchange.question}</p></div>
    <div className="tt-transcript-turn tt-transcript-turn-candidate"><strong>Candidate · model response</strong><p>{exchange.answer}</p></div>
  </div>
}

function TemplateAudio({ template, answer, apiKey }: { template: SpeakingTemplate; answer: string; apiKey: string }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [speed, setSpeed] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioUrlRef = useRef('')
  const autoPlayRef = useRef(false)

  useEffect(() => () => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
  }, [])

  async function loadAudio() {
    setError('')
    setNotice('')
    if (audioUrl && audioRef.current) {
      try {
        await audioRef.current.play()
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to play the model answer.')
      }
      return
    }
    setLoading(true)
    try {
      let audio = await loadModelAnswerAudio(template.id, answer)
      if (!audio) {
        if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings to generate AI audio.')
        audio = await generateModelAnswerAudio(apiKey, answer)
        await saveModelAnswerAudio(template.id, answer, audio)
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      const url = URL.createObjectURL(audio)
      audioUrlRef.current = url
      autoPlayRef.current = true
      setAudioUrl(url)
    } catch (caughtError) {
      console.error('Unable to generate Answer Builder answer audio.', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to prepare AI audio.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.playbackRate = speed
    if (audioUrl && autoPlayRef.current) {
      autoPlayRef.current = false
      void audioRef.current.play().catch((caughtError: unknown) => {
        console.info('Automatic Answer Builder playback was blocked.', caughtError)
        setNotice('AI audio is ready. Press play in the player if it did not start.')
      })
    }
  }, [audioUrl, speed])

  return <div className="tt-audio">
    <div className="tt-audio-actions">
      <button type="button" className="tt-primary-button" onClick={() => void loadAudio()} disabled={loading}>
        {loading ? <LoaderCircle size={16} className="spin-icon" /> : audioUrl ? <Play size={15} fill="currentColor" /> : <Volume2 size={16} />}
        {loading ? 'Preparing AI voice…' : audioUrl ? 'Play answer' : 'Listen to AI answer'}
      </button>
      <label className="tt-speed"><span>Speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="AI answer playback speed">
        <option value={0.75}>0.75×</option><option value={0.9}>0.9×</option><option value={1}>1×</option><option value={1.1}>1.1×</option>
      </select></label>
    </div>
    {audioUrl && <audio ref={audioRef} controls preload="metadata" src={audioUrl} aria-label={`AI model answer for ${template.topic}`} />}
    {error && <p className="tt-inline-error" role="alert">{error}</p>}
    {notice && <p className="tt-inline-notice" role="status">{notice}</p>}
  </div>
}

function TemplateSimulationArchiveItem({ username, record, search, transcriptMatch, focusSearchMatch, referenceAnswer, apiKey, onSave, onOpenSettings, jumpRequest }: {
  username: string
  record: AiSimulationRecord
  search: string
  transcriptMatch: boolean
  focusSearchMatch: boolean
  referenceAnswer: string
  apiKey: string
  onSave: (record: AiSimulationRecord) => boolean
  onOpenSettings: () => void
  jumpRequest: { id: string; key: string } | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioError, setAudioError] = useState('')
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null)
  const [assessing, setAssessing] = useState(false)
  const [assessmentError, setAssessmentError] = useState('')
  const recordRef = useRef<HTMLElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const segmentEndRef = useRef<number | null>(null)
  const turnAudioRef = useRef<HTMLAudioElement | null>(null)
  const turnAudioUrlRef = useRef('')
  const turnAudioRequestRef = useRef(0)
  const isOpen = expanded || transcriptMatch || jumpRequest?.id === record.id
  const audioLoading = isOpen && Boolean(record.audioAvailable) && record.mode !== 'human-practice' && !audioUrl && !audioError

  useEffect(() => {
    if (!jumpRequest || jumpRequest.id !== record.id) return
    const frame = window.requestAnimationFrame(() => recordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => window.cancelAnimationFrame(frame)
  }, [jumpRequest, record.id])

  useEffect(() => {
    if (!transcriptMatch || !focusSearchMatch) return
    const frame = window.requestAnimationFrame(() => {
      const match = recordRef.current?.querySelector<HTMLElement>('.speech-word-search-match[tabindex="-1"]')
      if (!match) return
      match.scrollIntoView({ behavior: 'smooth', block: 'center' })
      match.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusSearchMatch, search, transcriptMatch])

  useEffect(() => {
    if (!isOpen || !record.audioAvailable || record.mode === 'human-practice') return
    let current = true
    let objectUrl = ''
    void loadAiSimulationAudio(username, record.id).then((audio) => {
      if (!current) return
      if (!audio) {
        setAudioError('The recording is unavailable on this device.')
        return
      }
      objectUrl = URL.createObjectURL(audio)
      setAudioUrl(objectUrl)
      setAudioError('')
    }).catch((error: unknown) => {
      if (current) setAudioError(error instanceof Error ? error.message : 'Unable to load the recording.')
    })
    return () => {
      current = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isOpen, record.audioAvailable, record.id, record.mode, username])

  useEffect(() => () => {
    turnAudioRequestRef.current += 1
    turnAudioRef.current?.pause()
    if (turnAudioUrlRef.current) URL.revokeObjectURL(turnAudioUrlRef.current)
  }, [])

  function stopTurnAudio() {
    turnAudioRequestRef.current += 1
    turnAudioRef.current?.pause()
    turnAudioRef.current = null
    if (turnAudioUrlRef.current) URL.revokeObjectURL(turnAudioUrlRef.current)
    turnAudioUrlRef.current = ''
    setPlayingTurnId(null)
  }

  async function playTurn(turn: AiSimulationTurn) {
    if (record.mode === 'human-practice') {
      if (playingTurnId === turn.id) {
        stopTurnAudio()
        return
      }
      stopTurnAudio()
      const requestId = ++turnAudioRequestRef.current
      setAudioError('')
      try {
        const audio = await loadTranscriptAudio(record.id, turn.id)
        if (requestId !== turnAudioRequestRef.current) return
        if (!audio) throw new Error('Original audio is unavailable for this transcript turn.')
        const url = URL.createObjectURL(audio)
        const playback = new Audio(url)
        turnAudioUrlRef.current = url
        turnAudioRef.current = playback
        setPlayingTurnId(turn.id)
        const finishPlayback = () => {
          if (turnAudioRef.current === playback) stopTurnAudio()
        }
        playback.onended = finishPlayback
        playback.onerror = () => {
          if (turnAudioRef.current === playback) {
            setAudioError('Unable to play the original audio for this transcript turn.')
            stopTurnAudio()
          }
        }
        await playback.play()
      } catch (error) {
        console.error('Unable to play a saved Answer Builder transcript turn.', error)
        if (requestId === turnAudioRequestRef.current) {
          setAudioError(error instanceof Error ? error.message : 'Unable to play this transcript turn.')
          stopTurnAudio()
        }
      }
      return
    }

    const audio = audioRef.current
    if (!audio || !audioUrl || typeof turn.audioStartSeconds !== 'number') return
    try {
      if (!audio.paused && audio.currentTime >= turn.audioStartSeconds
        && audio.currentTime <= turn.audioStartSeconds + (turn.audioDurationSeconds ?? 0)) {
        audio.pause()
        segmentEndRef.current = null
        return
      }
      audio.currentTime = Math.max(0, turn.audioStartSeconds)
      segmentEndRef.current = turn.audioDurationSeconds
        ? turn.audioStartSeconds + turn.audioDurationSeconds
        : null
      await audio.play()
    } catch (error) {
      console.error('Unable to play an Answer Builder transcript turn.', error)
      setAudioError(error instanceof Error ? error.message : 'Unable to play this transcript turn.')
    }
  }

  function stopAtTurnEnd(audio: HTMLAudioElement) {
    if (segmentEndRef.current !== null && audio.currentTime >= segmentEndRef.current) {
      audio.pause()
      segmentEndRef.current = null
    }
  }

  const title = record.templateTitle ?? record.topic
  const searchTerms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const firstMatchingTurnIndex = record.turns.findIndex((turn) => searchTerms.some((term) => turn.text.toLocaleLowerCase().includes(term)))
  const canAssess = record.mode === 'human-practice' && record.turns.some((turn) => turn.role === 'candidate' && turn.text.trim())

  async function assessRecord() {
    if (!canAssess || assessing) return
    if (!apiKey.trim()) {
      setAssessmentError('Add your Speakia AI key in Settings to assess this session.')
      return
    }
    setAssessing(true)
    setAssessmentError('')
    try {
      const updatedRecord = {
        ...record,
        answerMastery: await assessAnswerMastery(apiKey, record.turns, referenceAnswer, record.scaffoldedTurnIds),
      }
      if (!onSave(updatedRecord)) throw new Error('The assessment could not be saved to your archive.')
    } catch (error) {
      console.error('Unable to assess an archived Answer Builder session.', error)
      setAssessmentError(error instanceof Error ? error.message : 'The session could not be assessed.')
    } finally {
      setAssessing(false)
    }
  }

  return <article ref={recordRef} className={`tt-archive-record ${isOpen ? 'is-expanded' : ''} ${transcriptMatch ? 'has-search-match' : ''}`}>
    <header className="tt-archive-record-header">
      <div><span className={`tt-part-badge tt-${record.part}`}>{record.part === 'full' ? 'FULL TEST' : partTitle(record.part)}</span><span className={`tt-archive-assessment-status ${record.mode === 'human-practice' ? record.answerMastery ? 'is-graded' : 'is-ungraded' : 'is-sample'}`}>{record.mode === 'human-practice' ? record.answerMastery ? 'Feedback ready' : 'Needs feedback' : 'Model sample'}</span><h3>{title}</h3><p>{record.topic}</p><small>{record.mode === 'human-practice' ? 'Your coached practice · ' : 'AI-to-AI sample · '}{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.startedAt))} · {formatDuration(record.durationSeconds)} · {record.turns.length} turns</small></div>
      <button type="button" className="tt-archive-expand" aria-expanded={isOpen} onClick={() => setExpanded((current) => !current)}>{isOpen ? 'Hide session' : 'View session'}<ChevronRight size={16} /></button>
    </header>
    {isOpen && <div className="tt-archive-record-detail">
      <div className="tt-archive-audio"><strong><Headphones size={15} />{record.mode === 'human-practice' ? 'Original turn audio' : 'Full conversation'}</strong>{record.mode === 'human-practice' ? <span>{record.audioAvailable ? 'Use the speaker buttons beside each coach and candidate turn.' : 'This older session has no saved audio; its transcript is still available.'}</span> : audioLoading ? <span><LoaderCircle size={14} className="spin-icon" /> Loading recording…</span> : audioUrl ? <audio ref={audioRef} controls preload="metadata" src={audioUrl} aria-label={`Full ${title} AI conversation`} onTimeUpdate={(event) => stopAtTurnEnd(event.currentTarget)} onPause={() => { segmentEndRef.current = null }} /> : <span>{audioError || 'No saved recording is available for this session.'}</span>}</div>
      {record.answerMastery && <TemplateMasteryCard assessment={record.answerMastery} />}
      {canAssess && <div className="tt-archive-assess"><span>{record.answerMastery ? 'You can reassess this practice at any time.' : 'This practice is saved and ready for feedback whenever you are.'}</span><div><button type="button" onClick={() => void assessRecord()} disabled={assessing}>{assessing ? <LoaderCircle size={14} className="spin-icon" /> : <Sparkles size={14} />}{record.answerMastery ? 'Reassess' : 'Assess now'}</button>{!apiKey.trim() && <button type="button" className="tt-archive-settings" onClick={onOpenSettings}>Open Settings</button>}</div></div>}
      {assessmentError && <p className="tt-archive-error" role="alert">{assessmentError}</p>}
      {audioError && <p className="tt-archive-error" role="status">{audioError}</p>}
      <div className="tt-archive-transcript">{record.turns.map((turn, index) => <article className={`tt-archive-turn tt-archive-turn-${turn.role}`} key={`${record.id}:${turn.id}`}>
        <div><span>{turn.role === 'examiner' ? record.mode === 'human-practice' ? 'Speakia Coach' : 'AI Examiner' : record.mode === 'human-practice' ? 'You · Candidate' : 'AI Candidate'}</span><p><SpeechHighlight text={turn.text} search={search} focusSearchMatch={focusSearchMatch && index === firstMatchingTurnIndex} /></p></div>
        <button type="button" className={playingTurnId === turn.id ? 'is-playing' : ''} title={playingTurnId === turn.id ? 'Stop transcript turn' : `Listen to ${turn.role === 'examiner' ? 'coach' : 'candidate'} turn ${index + 1}`} aria-label={`${playingTurnId === turn.id ? 'Stop' : 'Listen to'} ${turn.role === 'examiner' && record.mode === 'human-practice' ? 'coach' : turn.role === 'examiner' ? 'examiner' : 'candidate'} turn ${index + 1}`} disabled={record.mode === 'human-practice' ? !turn.audioAvailable : !audioUrl || typeof turn.audioStartSeconds !== 'number'} onClick={() => void playTurn(turn)}>{playingTurnId === turn.id ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>
      </article>)}</div>
    </div>}
  </article>
}

function independentReadiness(assessment?: AnswerMasteryAssessment): number | null {
  const scores = assessment?.responses
    .map((response) => response.independence)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
  return scores?.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null
}

function readinessLevel(assessment?: AnswerMasteryAssessment): string {
  const score = independentReadiness(assessment)
  if (score === null) return 'none'
  if (score < 25) return '1'
  if (score < 50) return '2'
  if (score < 75) return '3'
  return '4'
}

function TemplateMasteryCard({ assessment }: { assessment?: AnswerMasteryAssessment }) {
  const criteria = [
    { key: 'relevance', label: 'On topic' },
    { key: 'structure', label: 'Structure' },
    { key: 'development', label: 'Development' },
    { key: 'language', label: 'Language' },
  ] as const
  const responses = assessment?.responses ?? []
  const scores = criteria.map(({ key }) => responses.length
    ? Math.round(responses.reduce((total, response) => total + response[key], 0) / responses.length)
    : 0)
  const overall = responses.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null
  const independence = independentReadiness(assessment)
  const latestResponse = responses[responses.length - 1]
  return <section className="tt-mastery-card" aria-label="Answer-building mastery">
    <div className="tt-mastery-heading"><span><Activity size={14} /> ANSWER-BUILDING MASTERY</span><strong>{overall === null ? '—' : `${overall}%`}</strong></div>
    <div className="tt-mastery-meter" role={overall === null ? undefined : 'meter'} aria-label={overall === null ? 'Answer-building mastery not assessed' : `Answer-building mastery ${overall} percent`} aria-valuemin={overall === null ? undefined : 0} aria-valuemax={overall === null ? undefined : 100} aria-valuenow={overall ?? undefined}><span style={{ width: `${overall ?? 0}%` }} /></div>
    {overall === null
      ? <small>No practice score yet · complete a coached practice to assess this answer.</small>
      : <><div className="tt-mastery-criteria">{criteria.map(({ key, label }, index) => <span key={key}>{label}<strong>{scores[index]}%</strong></span>)}</div>
        {independence !== null && <div className="tt-independent-progress">
          <div className="tt-mastery-heading"><span><Lightbulb size={13} /> INDEPENDENT READINESS</span><strong>{independence}%</strong></div>
          <div className="tt-independent-meter" role="meter" aria-label={`Independent answer readiness ${independence} percent`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={independence}><span style={{ width: `${independence}%` }} /></div>
        </div>}
        {latestResponse && <><p className="tt-mastery-feedback"><strong>Latest feedback:</strong> {latestResponse.feedback}</p><p className="tt-mastery-feedback"><strong>Next step:</strong> {latestResponse.nextStep}</p></>}
        <small>Formative estimate from {responses.length} {responses.length === 1 ? 'answer' : 'answers'} · not an IELTS band score. Card tint reflects assessed independence.</small></>}
  </section>
}

interface TemplatePerformance {
  attempts: number
  assessed: number
  pending: number
  criteria: { label: string; score: number | null }[]
  independence: number | null
}

function templatePerformance(records: AiSimulationRecord[]): TemplatePerformance {
  const attempts = records.filter((record) => record.mode === 'human-practice')
  const responses = attempts.flatMap((record) => record.answerMastery?.responses ?? [])
  const criteria = [
    { key: 'relevance', label: 'On topic' },
    { key: 'structure', label: 'Structure' },
    { key: 'development', label: 'Development' },
    { key: 'language', label: 'Language' },
  ] as const
  return {
    attempts: attempts.length,
    assessed: attempts.filter((record) => Boolean(record.answerMastery)).length,
    pending: attempts.filter((record) => !record.answerMastery).length,
    criteria: criteria.map(({ key, label }) => ({
      label,
      score: responses.length
        ? Math.round(responses.reduce((total, response) => total + response[key], 0) / responses.length)
        : null,
    })),
    independence: independentReadiness(responses.length ? { assessedAt: '', responses } : undefined),
  }
}

function TemplatePerformanceMini({ performance, onOpenTranscript }: {
  performance: TemplatePerformance
  onOpenTranscript?: () => void
}) {
  return <section className="tt-card-performance" aria-label="Question card performance">
    <header><span><Activity size={13} /> YOUR PERFORMANCE</span><strong>{performance.attempts ? `${performance.attempts} ${performance.attempts === 1 ? 'attempt' : 'attempts'}` : 'Not practised'}</strong></header>
    {performance.attempts
      ? <>
        <div className="tt-card-performance-metrics">{performance.criteria.map(({ label, score }) => <span key={label}><small>{label}</small><strong>{score === null ? '—' : `${score}%`}</strong><i><b style={{ width: `${score ?? 0}%` }} /></i></span>)}</div>
        <div className="tt-card-performance-summary">
          <span>{performance.assessed} with feedback · {performance.pending} to assess</span>
          {performance.independence !== null && <strong>Independent readiness {performance.independence}%</strong>}
        </div>
        {onOpenTranscript && <button type="button" className="tt-card-history-link" onClick={onOpenTranscript}><History size={13} /> Open latest transcript</button>}
      </>
      : <p>Complete a coached practice to start tracking this question.</p>}
  </section>
}

interface JoinInPracticeProps {
  apiKey: string
  part: TemplatePart | 'full'
  topic: string
  templateId: string
  title: string
  openingPrompt: string
  questionGuide: string
  referenceAnswer?: string
  onSave: (record: AiSimulationRecord) => boolean
  onClose: () => void
  onOpenDrill: (drillId: string, context?: string) => void
}

function JoinInPractice({ apiKey, part, topic, templateId, title, openingPrompt, questionGuide, referenceAnswer = '', onSave, onClose, onOpenDrill }: JoinInPracticeProps) {
  const [sessionPhase, setSessionPhase] = useState<'ready' | 'connecting' | 'live' | 'saving' | 'finished'>('ready')
  const [saveError, setSaveError] = useState('')
  const [scaffoldError, setScaffoldError] = useState('')
  const [adaptiveAid, setAdaptiveAid] = useState<AdaptiveAid | null>(null)
  const [drillRecommendation, setDrillRecommendation] = useState<DrillRecommendation | null>(null)
  const [masteryError, setMasteryError] = useState('')
  const [assessingMastery, setAssessingMastery] = useState(false)
  const [masteryAssessmentAttempted, setMasteryAssessmentAttempted] = useState(false)
  const [recordSaved, setRecordSaved] = useState(false)
  const [savedRecord, setSavedRecord] = useState<AiSimulationRecord | null>(null)
  const startedAtRef = useRef('')
  const sessionElementRef = useRef<HTMLElement | null>(null)
  const transcriptElementRef = useRef<HTMLDivElement>(null)
  const startPracticeRef = useRef<() => Promise<void>>(async () => {})
  const aidUsedForNextCandidateRef = useRef(false)
  const candidateSupportFlagsRef = useRef<boolean[]>([])
  const handleCandidateTranscript = useCallback(() => {
    candidateSupportFlagsRef.current.push(aidUsedForNextCandidateRef.current)
    aidUsedForNextCandidateRef.current = false
  }, [])
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
    const validType = isAdaptiveSupportType(supportType)
    const hasSupport = supportType === 'idea-cue' ? hints.length > 0
      : supportType === 'vocabulary' ? vocabulary.length >= 2
        : supportType === 'answer-structure' ? framework.length >= 3
          : supportType === 'sentence-frames' ? sentenceFrames.length >= 2
            : supportType === 'worked-example' && Boolean(workedExample)
    if (call.name !== adaptiveScaffoldToolName || !validType || !question || !reason || !hasSupport) {
      setScaffoldError('The adaptive coach could not prepare a complete support aid. Ask it to try again.')
      return completeAdaptiveToolCall(call, { error: 'Provide a valid support type, exact question, short reason, and complete matching support content.' })
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
    aidUsedForNextCandidateRef.current = true
    return completeAdaptiveToolCall(call, {
      accepted: true,
      instruction: 'The app displayed this one scaffold. Do not read it aloud. Invite the learner to use only what helps and answer in their own words. Fade support as they gain independence.',
    })
  }), [])
  const handleDrillRecommendationToolCall = useCallback(async (functionCalls: FunctionCall[]) => processDrillRecommendationToolCalls(
    functionCalls,
    setDrillRecommendation,
    setScaffoldError,
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
    voiceName: 'Aoede',
    openingPrompt,
    systemInstruction: `You are Speakia's adaptive IELTS Speaking answer coach for the selected Answer Builder prompt "${title}" about "${topic}". Help the candidate develop their own answer using the supplied question sequence only; never reveal, quote, paraphrase, or refer to sample/model candidate answers. Adapt support in real time: when the candidate is stuck, uncertain, or asks for help, call ${adaptiveScaffoldToolName} to display the smallest useful aid (idea cue, vocabulary, answer structure, sentence frames, or—only after an attempt and continued difficulty—a brief worked example). Do not provide a complete answer or over-scaffold. When the candidate expresses a clear idea, use one thoughtful Socratic follow-up to deepen their reasoning, then step back. Gradually fade support as their answers become more independent. Keep the candidate's ideas central, speak conversationally, and do not claim to be an official examiner. For a Part 2 cue card, allow preparation and invite a long turn. Finish naturally when the listed questions are complete. After at least two meaningful candidate attempts, if you observe a specific recurring speaking-skill gap, call ${drillRecommendationToolName} with concise evidence from this session and one to three matching drill IDs. Do not infer a weakness from one minor slip or make a stable diagnosis. The app will show the learner a choice of targeted drills; explain it briefly and let them decide.\n\nExact question sequence:\n${questionGuide}`,
    tools: [...adaptiveScaffoldTools, ...drillRecommendationTools],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO, allowedFunctionNames: [adaptiveScaffoldToolName, drillRecommendationToolName] } },
    onToolCall: handleLiveToolCall,
    onCandidateTranscript: handleCandidateTranscript,
  })
  const startLive = live.start

  const startPractice = useCallback(async () => {
    if (sessionPhase === 'connecting' || sessionPhase === 'live' || sessionPhase === 'saving') return
    setSaveError('')
    setScaffoldError('')
    setMasteryError('')
    setMasteryAssessmentAttempted(false)
    setRecordSaved(false)
    setAdaptiveAid(null)
    setDrillRecommendation(null)
    aidUsedForNextCandidateRef.current = false
    candidateSupportFlagsRef.current = []
    setSessionPhase('connecting')
    startedAtRef.current = new Date().toISOString()
    try {
      const connected = await startLive()
      setSessionPhase(connected ? 'live' : 'ready')
    } catch (error) {
      console.error('Unable to start the Answer Builder live practice.', error)
      setSaveError(error instanceof Error ? error.message : 'Unable to connect to the live examiner.')
      setSessionPhase('ready')
    }
  }, [sessionPhase, startLive])

  useEffect(() => {
    startPracticeRef.current = startPractice
  }, [startPractice])

  useEffect(() => {
    let cancelled = false
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return
      sessionElementRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      void startPracticeRef.current()
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
    }
  }, [])

  async function endPractice() {
    if (sessionPhase !== 'live') return
    setSessionPhase('saving')
    try {
      const result = await live.stop()
      const recordId = crypto.randomUUID()
      let candidateIndex = 0
      const scaffoldedTurnIds: string[] = []
      const audioTurns = result.transcript.filter((turn) => (turn.role === 'examiner' || turn.role === 'candidate') && Boolean(turn.audio))
      const turns = result.transcript
        .filter((turn): turn is TranscriptEntry & { role: 'examiner' | 'candidate' } => (
          (turn.role === 'examiner' || turn.role === 'candidate') && Boolean(turn.text.trim())
        ))
        .map((turn, index) => {
          const id = turn.id ?? `${Date.now()}-${index}`
          if (turn.role === 'candidate') {
            if (candidateSupportFlagsRef.current[candidateIndex]) scaffoldedTurnIds.push(id)
            candidateIndex += 1
          }
          return {
            id,
            role: turn.role,
            text: turn.text.trim(),
            completedAt: new Date().toISOString(),
            audioAvailable: audioAvailable && Boolean(turn.audio),
          }
        })
      if (!turns.some((turn) => turn.role === 'candidate')) {
        setSaveError('No candidate response was captured, so this practice was not added to your archive.')
        setSessionPhase('finished')
        return
      }
      let audioAvailable = false
      if (audioTurns.length) {
        try {
          await saveTranscriptAudio(recordId, result.transcript)
          audioAvailable = true
        } catch (error) {
          console.error('Unable to save Answer Builder transcript audio.', error)
          setSaveError('Your transcript was saved, but some speaker audio could not be saved on this device.')
        }
      }
      const savedAudioTurnIds = new Set(audioTurns.map((turn) => turn.id))
      for (const turn of turns) turn.audioAvailable = audioAvailable && savedAudioTurnIds.has(turn.id)
      const completedAt = new Date().toISOString()
      const record: AiSimulationRecord = {
        id: recordId,
        templateId,
        templateTitle: title,
        mode: 'human-practice',
        part,
        topic,
        startedAt: startedAtRef.current || completedAt,
        completedAt,
        durationSeconds: Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(startedAtRef.current || completedAt)) / 1000)),
        status: 'completed',
        turns,
        audioAvailable,
        model: getProdiaLiveModel(),
        ...(scaffoldedTurnIds.length ? { scaffoldedTurnIds } : {}),
      }
      setSavedRecord(record)
      const saved = onSave(record)
      setRecordSaved(saved)
      if (!saved) {
        setSaveError('This practice could not be saved to your archive. Please try again.')
      }
      setSessionPhase('finished')
    } catch (error) {
      console.error('Unable to finish the Answer Builder live practice.', error)
      setSaveError(error instanceof Error ? error.message : 'Unable to save this practice.')
      setSessionPhase('finished')
    }
  }

  async function retryMasteryAssessment() {
    const record = savedRecord
    if (!record || assessingMastery) return
    setAssessingMastery(true)
    setMasteryAssessmentAttempted(true)
    setMasteryError('')
    try {
      const updatedRecord = { ...record, answerMastery: await assessAnswerMastery(apiKey, record.turns, referenceAnswer, record.scaffoldedTurnIds) }
      if (!onSave(updatedRecord)) throw new Error('The answer-building assessment could not be saved to the archive.')
      setSavedRecord(updatedRecord)
      setRecordSaved(true)
    } catch (error) {
      console.error('Unable to retry the Answer Builder mastery assessment.', error)
      setMasteryError(error instanceof Error ? error.message : 'Answer-building mastery could not be assessed.')
    } finally {
      setAssessingMastery(false)
    }
  }

  function resetPractice() {
    setSaveError('')
    setScaffoldError('')
    setMasteryError('')
    setMasteryAssessmentAttempted(false)
    setRecordSaved(false)
    setSavedRecord(null)
    setAdaptiveAid(null)
    void startPractice()
  }

  const turns = live.transcript.filter((turn) => turn.role === 'examiner' || turn.role === 'candidate')
  const displayedTurns = savedRecord?.turns ?? turns
  const latestDisplayedTurnText = displayedTurns[displayedTurns.length - 1]?.text ?? ''
  const latestCoachQuestion = [...live.transcript].reverse().find((turn) => turn.role === 'examiner' && turn.text.trim())?.text.trim()
  const drillContext = latestCoachQuestion || `${title}: ${topic}`

  useEffect(() => {
    const transcript = transcriptElementRef.current
    if (!transcript) return
    if (transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 100) {
      transcript.scrollTop = transcript.scrollHeight
    }
  }, [displayedTurns.length, latestDisplayedTurnText, live.candidateDraft])

  return <section ref={sessionElementRef} className="tt-join-session" aria-label="Live answer coaching session">
    <header><div><span className="tt-kicker">SCAFFOLDED LIVE COACHING</span><h2>Build your answer: {title}</h2><p>Speakia adapts its hints and follow-up questions to each attempt, then fades support as you gain confidence. Your model answer stays hidden.</p></div>
      {sessionPhase === 'live' ? <div className="tt-join-controls"><span className="tt-join-status" role="status"><i />{live.status || 'Live coaching'}</span><button type="button" className="tt-join-hint" onClick={() => live.sendInstruction(`The candidate has explicitly asked for help with the current IELTS question. Choose the smallest useful scaffold based on the conversation so far, call ${adaptiveScaffoldToolName} to display one aid, then invite the candidate to answer in their own words. Do not give a complete answer unless they have already tried and still need substantial support.`)}><Lightbulb size={14} /> Need a hint</button><button type="button" onClick={live.toggleMicMuted} aria-pressed={live.micMuted}>{live.micMuted ? <MicOff size={15} /> : <Mic size={15} />}{live.micMuted ? 'Unmute' : 'Mute'}</button><button type="button" className="tt-join-end" onClick={() => void endPractice()}><Square size={13} fill="currentColor" /> End session &amp; save</button></div> : (sessionPhase === 'ready' || sessionPhase === 'finished') && <button type="button" className="tt-join-close" onClick={onClose} disabled={assessingMastery} aria-label="Close live coaching session"><X size={17} /></button>}
    </header>
    {sessionPhase === 'ready' && <button type="button" className="tt-live-button" onClick={() => void startPractice()} disabled={!apiKey.trim()}><Mic size={15} /> Start live coaching</button>}
    {sessionPhase === 'connecting' && <p className="tt-connecting"><LoaderCircle size={15} className="spin-icon" /> Connecting to the AI examiner and microphone…</p>}
    {sessionPhase === 'saving' && <p className="tt-connecting"><LoaderCircle size={15} className="spin-icon" /> Saving your transcript…</p>}
    {live.error && <p className="tt-inline-error" role="alert">{live.error}</p>}
    {scaffoldError && <p className="tt-inline-error" role="alert">{scaffoldError}</p>}
    {sessionPhase === 'live' && adaptiveAid && <section className="tt-adaptive-aid" aria-live="polite" aria-label="Adaptive answer support">
      <header><span className="tt-adaptive-aid-icon"><Lightbulb size={17} /></span><div><strong>{adaptiveAid.supportType === 'idea-cue' ? 'A few ideas to get started' : adaptiveAid.supportType === 'vocabulary' ? 'Useful words for this answer' : adaptiveAid.supportType === 'answer-structure' ? 'A simple way to shape your answer' : adaptiveAid.supportType === 'sentence-frames' ? 'Sentence starters you can adapt' : 'A short worked example'}</strong><small>{adaptiveAid.reason}</small></div><button type="button" onClick={() => setAdaptiveAid(null)} aria-label="Dismiss answer support"><X size={15} /></button></header>
      {adaptiveAid.hints && <ul>{adaptiveAid.hints.map((hint, index) => <li key={`${index}-${hint}`}>{hint}</li>)}</ul>}
      {adaptiveAid.vocabulary && <div className="tt-adaptive-vocabulary">{adaptiveAid.vocabulary.map((item) => <article key={item.phrase}><strong>{item.phrase}</strong><span>{item.meaning}</span><small>{item.example}</small></article>)}</div>}
      {adaptiveAid.framework && <ol>{adaptiveAid.framework.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span>{step}</li>)}</ol>}
      {adaptiveAid.sentenceFrames && <div className="tt-adaptive-frames">{adaptiveAid.sentenceFrames.map((frame, index) => <p key={`${index}-${frame}`}>{frame}</p>)}</div>}
      {adaptiveAid.workedExample && <p className="tt-adaptive-example">{adaptiveAid.workedExample}<small>Learn from the example; make the answer your own.</small></p>}
    </section>}
    {(sessionPhase === 'live' || sessionPhase === 'finished') && drillRecommendation && <DrillRecommendations recommendation={drillRecommendation} context={drillContext} onOpenDrill={onOpenDrill} />}
    {sessionPhase !== 'ready' && <div ref={transcriptElementRef} className="tt-join-transcript" role="log" aria-live="polite" aria-relevant="additions" aria-label="Live practice transcript">
      {displayedTurns.map((turn, index) => <article className={`tt-turn tt-turn-${turn.role}`} key={turn.id ?? `${turn.role}-${index}`}><span>{turn.role === 'examiner' ? 'SPEAKIA COACH' : 'YOU · CANDIDATE'}</span><p>{turn.text}</p></article>)}
      {sessionPhase === 'live' && live.candidateDraft && <article className="tt-turn tt-turn-candidate"><span>YOU · CANDIDATE · SPEAKING</span><p>{live.candidateDraft}</p></article>}
      {!displayedTurns.length && !(sessionPhase === 'live' && live.candidateDraft) && <div className="tt-session-empty"><Headphones size={22} /><span>{sessionPhase === 'finished' ? 'No transcript was captured for this session.' : 'The two-way transcript will appear here as you speak.'}</span></div>}
    </div>}
    {sessionPhase === 'finished' && <div className="tt-join-finished"><span><Check size={15} />{recordSaved ? <>Your coached practice is saved. {savedRecord?.answerMastery ? 'Feedback is ready below and in the archive.' : 'You can assess it now or return to it from the archive later.'}</> : saveError || 'No candidate response was captured, so this practice was not saved.'}</span><button type="button" className="tt-live-button" onClick={resetPractice}><Mic size={14} /> Practise again</button></div>}
    {sessionPhase === 'finished' && savedRecord && recordSaved && !savedRecord.answerMastery && <div className="tt-mastery-prompt" role="group" aria-label="Optional answer-building assessment">
      <span role={masteryError ? 'alert' : 'status'}>{assessingMastery ? 'Assessing your answers…' : masteryError || 'Want personalized feedback on your answers? You can request it now or skip it.'}</span>
      <div className="tt-mastery-actions">
        <button type="button" onClick={() => void retryMasteryAssessment()} disabled={assessingMastery || !apiKey.trim()}>{assessingMastery ? <LoaderCircle size={14} className="spin-icon" /> : <Sparkles size={14} />}{masteryAssessmentAttempted ? 'Retry assessment' : 'Assess my answers'}</button>
        <button type="button" className="tt-mastery-skip" onClick={onClose} disabled={assessingMastery}>Not now</button>
      </div>
    </div>}
    {sessionPhase === 'finished' && recordSaved && savedRecord?.answerMastery && <TemplateMasteryCard assessment={savedRecord.answerMastery} />}
    {saveError && <p className="tt-inline-error" role="alert">{saveError}</p>}
  </section>
}

export function TalkingTemplatesPage({ username, apiKey, lexicalTerms, customPrompts = [], onAddLexicalEntry, onOpenSettings, onOpenDrill }: {
  username: string
  apiKey: string
  lexicalTerms: string[]
  customPrompts?: TopicBankPrompt[]
  onAddLexicalEntry: (entry: Omit<LexicalEntry, 'id' | 'custom'>) => LexicalEntry
  onOpenSettings: () => void
  onOpenDrill: (drillId: string, context?: string) => void
}) {
  const [filter, setFilter] = useState<TemplateFilter>('all')
  const [generationPart, setGenerationPart] = useState<TemplatePart>('part1')
  const [generationModel, setGenerationModel] = useState<AssistantModel>(DEFAULT_TEMPLATE_GENERATION_MODEL)
  const [allTemplates, setAllTemplates] = useState<SpeakingTemplate[]>(() => loadGeneratedTemplates(username))
  const [generatingTemplate, setGeneratingTemplate] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState(() => loadFavorites(username))
  const [selectedId, setSelectedId] = useState(() => bankPrompts[0]?.id ?? templates[0].id)
  const [expandedFullTranscriptId, setExpandedFullTranscriptId] = useState<string | null>(null)
  const [answerEdits, setAnswerEdits] = useState<Record<string, string>>(() => loadAnswerEdits(username))
  const [transcriptHidden, setTranscriptHidden] = useState(false)
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archivePartFilter, setArchivePartFilter] = useState<TemplateFilter>('all')
  const [archiveModeFilter, setArchiveModeFilter] = useState<'all' | 'ai-to-ai' | 'human-practice'>('all')
  const [archiveAssessmentFilter, setArchiveAssessmentFilter] = useState<'all' | 'graded' | 'ungraded'>('all')
  const [archiveJumpRequest, setArchiveJumpRequest] = useState<{ id: string; key: string } | null>(null)
  const [activeView, setActiveView] = useState<'overview' | 'library' | 'history'>('overview')
  const [joinInTemplateId, setJoinInTemplateId] = useState<string | null>(null)
  const [recorderState, setRecorderState] = useState<'idle' | 'recording'>('idle')
  const [recording, setRecording] = useState<{ id: string; url: string } | null>(null)
  const [recordingError, setRecordingError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const simulationTranscriptRef = useRef<HTMLDivElement>(null)
  const archiveSectionRef = useRef<HTMLElement>(null)
  const selectedTemplateDetailRef = useRef<HTMLElement>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTemplateIdRef = useRef('')
  const recordingUrlRef = useRef('')
  const simulation = useAiToAiSimulation(username, apiKey)
  const lexicalCapture = useLexicalSessionCapture(simulation.records, apiKey, lexicalTerms, onAddLexicalEntry)
  const topicBankQuestions = useMemo(() => [...customPrompts, ...bankPrompts], [customPrompts])
  const topicBankTemplates = useMemo(() => topicBankQuestions.map(promptAsTemplate), [topicBankQuestions])
  const displayTemplates = useMemo(() => [...topicBankTemplates, ...allTemplates], [allTemplates, topicBankTemplates])
  const fullTestTemplates = useMemo(() => fullTestsFromTopicBank(topicBankQuestions), [topicBankQuestions])
  const answerByTemplateId = useMemo(() => {
    const answers = new Map<string, string>(displayTemplates.map((template) => [template.id, template.answer]))
    for (const template of fullTestTemplates) {
      answers.set(template.id, [
        ...template.part1.map((exchange) => exchange.answer),
        template.part2Answer,
        template.part2FollowUp.answer,
        ...template.part3.map((exchange) => exchange.answer),
      ].join('\n\n'))
    }
    return answers
  }, [displayTemplates, fullTestTemplates])
  const talkingTemplateIds = useMemo(() => new Set([
    ...displayTemplates.map((template) => template.id),
    ...templates.map((template) => template.id),
    ...fullTestTemplates.map((template) => template.id),
    'full-community',
    'full-learning',
  ]), [displayTemplates, fullTestTemplates])
  const talkingTemplateRecords = useMemo(
    () => simulation.records.filter((record) => record.templateId && talkingTemplateIds.has(record.templateId)),
    [simulation.records, talkingTemplateIds],
  )
  const practiceRecordsByTemplateId = useMemo(() => {
    const recordsByTemplateId = new Map<string, AiSimulationRecord[]>()
    for (const record of talkingTemplateRecords) {
      if (record.mode !== 'human-practice' || !record.templateId) continue
      const current = recordsByTemplateId.get(record.templateId) ?? []
      current.push(record)
      recordsByTemplateId.set(record.templateId, current)
    }
    return recordsByTemplateId
  }, [talkingTemplateRecords])
  const filteredArchiveRecords = useMemo(() => {
    const query = archiveSearch.trim().toLocaleLowerCase()
    return talkingTemplateRecords.filter((record) => (archivePartFilter === 'all' || record.part === archivePartFilter)
      && (archiveModeFilter === 'all' || (record.mode ?? 'ai-to-ai') === archiveModeFilter)
      && (archiveAssessmentFilter === 'all' || (record.mode === 'human-practice' && Boolean(record.answerMastery) === (archiveAssessmentFilter === 'graded')))
      && (!query || `${record.templateTitle ?? ''} ${record.topic} ${record.turns.map((turn) => turn.text).join(' ')}`.toLocaleLowerCase().includes(query)))
  }, [archiveAssessmentFilter, archiveModeFilter, archivePartFilter, archiveSearch, talkingTemplateRecords])
  const archiveSearchTerms = useMemo(() => archiveSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), [archiveSearch])
  const transcriptMatchIds = useMemo(() => new Set(talkingTemplateRecords
    .filter((record) => archiveSearchTerms.some((term) => record.turns.some((turn) => turn.text.toLocaleLowerCase().includes(term))))
    .map((record) => record.id)), [archiveSearchTerms, talkingTemplateRecords])
  const firstTranscriptMatchId = filteredArchiveRecords.find((record) => transcriptMatchIds.has(record.id))?.id
  const masteryByTemplateId = useMemo(() => {
    const assessments = new Map<string, AnswerMasteryAssessment>()
    for (const record of talkingTemplateRecords) {
      if (record.templateId && record.answerMastery?.responses.length && !assessments.has(record.templateId)) {
        assessments.set(record.templateId, record.answerMastery)
      }
    }
    return assessments
  }, [talkingTemplateRecords])
  const performanceByTemplateId = useMemo(() => new Map(
    [...practiceRecordsByTemplateId].map(([templateId, records]) => [templateId, templatePerformance(records)]),
  ), [practiceRecordsByTemplateId])
  const latestSimulationTurnText = simulation.turns[simulation.turns.length - 1]?.text ?? ''
  const candidatePracticeRecords = talkingTemplateRecords.filter((record) => record.mode === 'human-practice')
  const pendingAssessmentCount = candidatePracticeRecords.filter((record) => !record.answerMastery).length
  const assessedPracticeCount = candidatePracticeRecords.filter((record) => Boolean(record.answerMastery)).length
  const averagePerformance = (() => {
    const scores = candidatePracticeRecords.flatMap((record) => record.answerMastery?.responses.flatMap((response) => [
      response.relevance, response.structure, response.development, response.language,
    ]) ?? [])
    return scores.length ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null
  })()

  useEffect(() => {
    const transcript = simulationTranscriptRef.current
    if (!transcript) return
    if (transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 100) {
      transcript.scrollTop = transcript.scrollHeight
    }
  }, [latestSimulationTurnText, simulation.turns.length])

  const categories = useMemo(() => [...new Set(displayTemplates.map((template) => template.category))].sort(), [displayTemplates])
  const selected = displayTemplates.find((template) => template.id === selectedId) ?? displayTemplates[0] ?? templates[0]
  const selectedAnswer = answerEdits[selected.id] ?? selected.answer
  const selectedPracticeRecords = practiceRecordsByTemplateId.get(selected.id) ?? []
  const latestSelectedPractice = selectedPracticeRecords[0]
  const visibleTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return displayTemplates.filter((template) => (filter === 'all' || filter === 'full' || template.part === filter)
      && (category === 'all' || template.category === category)
      && (!favoritesOnly || favorites.includes(template.id))
      && (!query || `${template.topic} ${template.question} ${template.answer} ${template.category} ${template.vocabulary.join(' ')}`.toLocaleLowerCase().includes(query)))
  }, [displayTemplates, category, favorites, favoritesOnly, filter, search])
  const fullTest = fullTestTemplates[0]
  const visibleFullTests = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return fullTestTemplates.filter((template) => (category === 'all' || template.category === category)
      && (!favoritesOnly || favorites.includes(template.id))
      && (!query || `${template.title} ${template.topic} ${template.category} ${template.part1.map((exchange) => `${exchange.question} ${exchange.answer}`).join(' ')} ${template.part2CueCard} ${template.part2Answer} ${template.part3.map((exchange) => `${exchange.question} ${exchange.answer}`).join(' ')}`.toLocaleLowerCase().includes(query)))
  }, [category, favorites, favoritesOnly, fullTestTemplates, search])

  useEffect(() => {
    try {
      localStorage.setItem(favoritesKey(username), JSON.stringify(favorites))
    } catch (error) {
      console.error('Unable to save Answer Builder favorites.', error)
    }
  }, [favorites, username])

  useEffect(() => {
    try {
      localStorage.setItem(answerEditsKey(username), JSON.stringify(answerEdits))
    } catch (error) {
      console.error('Unable to save Answer Builder answer edits.', error)
    }
  }, [answerEdits, username])

  useEffect(() => () => {
    recorderRef.current?.stop()
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current)
  }, [])

  function toggleFavorite(id: string) {
    setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function selectTemplate(template: SpeakingTemplate) {
    setSelectedId(template.id)
    setTranscriptHidden(false)
    setRecordingError('')
    window.requestAnimationFrame(() => selectedTemplateDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function openArchiveRecord(record: AiSimulationRecord) {
    setActiveView('history')
    setArchiveSearch('')
    setArchivePartFilter('all')
    setArchiveModeFilter('all')
    setArchiveAssessmentFilter('all')
    setArchiveJumpRequest({ id: record.id, key: crypto.randomUUID() })
    window.requestAnimationFrame(() => archiveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function openAssessmentQueue() {
    setActiveView('history')
    setArchiveSearch('')
    setArchivePartFilter('all')
    setArchiveModeFilter('human-practice')
    setArchiveAssessmentFilter('ungraded')
    window.requestAnimationFrame(() => archiveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function generateTemplate() {
    if (!apiKey.trim()) {
      setGenerationError('Add your Speakia AI key in Settings to generate a template.')
      return
    }
    setGeneratingTemplate(true)
    setGenerationError('')
    try {
      const existingTopics = displayTemplates.filter((template) => template.part === generationPart).map((template) => template.topic)
      const existingQuestions = displayTemplates.filter((template) => template.part === generationPart).map((template) => template.question)
      const client = new GoogleGenAI({ apiKey: apiKey.trim() })
      const response = await client.models.generateContent({
        model: generationModel,
        contents: `Create one original IELTS Speaking ${partTitle(generationPart)} template for a learner. Avoid duplicating these existing topics: ${JSON.stringify(existingTopics)}. Avoid repeating these questions or cue cards: ${JSON.stringify(existingQuestions)}. Make the topic and prompt meaningfully different from the existing set. For Part 1, use one natural personal question and a concise 3–4 sentence sample answer. For Part 2, the question must be a cue card with an introductory instruction, four "You should say" bullet points, and a final "and explain" instruction; provide a coherent 1–2 minute sample answer. For Part 3, use one analytical discussion question and a balanced 4–5 sentence sample answer. In every case provide 3–5 short answer-structure steps, 3–6 useful natural expressions appearing in or relevant to the answer, and a broad topic category. Avoid fabricated personal details that assume the learner's identity; write the sample as an adaptable example. Return only the requested JSON object.`,
        config: {
          temperature: 0.9,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              category: { type: Type.STRING },
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              structure: { type: Type.ARRAY, items: { type: Type.STRING } },
              vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
              duration: { type: Type.STRING },
            },
            required: ['topic', 'category', 'question', 'answer', 'structure', 'vocabulary', 'duration'],
          },
        },
      })
      if (!response.text?.trim()) throw new Error('Speakia returned an empty template. Try again.')
      let generated: unknown
      try {
        generated = JSON.parse(response.text)
      } catch (error) {
        console.error('Speakia returned invalid JSON for a generated template.', error)
        throw new Error('Speakia returned an unreadable template. Try again.')
      }
      if (!isRecord(generated)) throw new Error('Speakia returned an incomplete template. Try again.')
      const candidate: SpeakingTemplate = {
        id: `ai-template-${crypto.randomUUID()}`,
        part: generationPart,
        topic: typeof generated.topic === 'string' ? generated.topic.trim() : '',
        category: typeof generated.category === 'string' ? generated.category.trim() : '',
        question: typeof generated.question === 'string' ? generated.question.trim() : '',
        answer: typeof generated.answer === 'string' ? generated.answer.trim() : '',
        structure: Array.isArray(generated.structure) ? generated.structure.filter((item): item is string => typeof item === 'string').map((item) => item.trim()) : [],
        vocabulary: Array.isArray(generated.vocabulary) ? generated.vocabulary.filter((item): item is string => typeof item === 'string').map((item) => item.trim()) : [],
        duration: typeof generated.duration === 'string' ? generated.duration.trim() : generationPart === 'part1' ? '20–30 sec' : generationPart === 'part2' ? '1–2 min' : '30–45 sec',
      }
      if (!isSpeakingTemplate(candidate)) throw new Error('Speakia returned an incomplete template. Try again.')
      const normalize = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
      if (displayTemplates.some((template) => template.part === candidate.part
        && (normalize(template.topic) === normalize(candidate.topic) || normalize(template.question) === normalize(candidate.question)))) {
        throw new Error('That template is too similar to one already in your library. Generate another.')
      }
      const updatedTemplates = [...allTemplates, candidate]
      try {
        localStorage.setItem(generatedTemplatesKey(username), JSON.stringify(updatedTemplates))
      } catch (error) {
        console.error('Unable to save the generated Interactive Template.', error)
        throw new Error('The new template was created, but could not be saved in this browser. Check available storage and try again.')
      }
      setAllTemplates(updatedTemplates)
      setSelectedId(candidate.id)
      setFilter(candidate.part)
      setCategory('all')
      setFavoritesOnly(false)
      setSearch('')
      setTranscriptHidden(false)
    } catch (error) {
      console.error('Unable to generate an Interactive Template.', error)
      setGenerationError(error instanceof Error ? error.message : 'Unable to generate a template. Try again.')
    } finally {
      setGeneratingTemplate(false)
    }
  }

  async function startRecording() {
    setRecordingError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Audio recording is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recordingStreamRef.current = stream
      chunksRef.current = []
      recordingTemplateIdRef.current = selected.id
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        recordingStreamRef.current = null
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) {
          if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current)
          const url = URL.createObjectURL(blob)
          recordingUrlRef.current = url
          setRecording({ id: recordingTemplateIdRef.current, url })
        } else {
          setRecordingError('No audio was captured. Please try recording again.')
        }
      }
      recorder.start()
      setRecorderState('recording')
    } catch (error) {
      console.error('Unable to start an Answer Builder recording.', error)
      setRecordingError(error instanceof Error ? error.message : 'Microphone access was denied or unavailable.')
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
      setRecorderState('idle')
    }
  }

  function runSimulation(template: SpeakingTemplate) {
    const question = template.part === 'part2'
      ? `Read this Part 2 cue card to the candidate: "${template.question}" Give them one minute to prepare, then invite them to speak for up to two minutes.`
      : `Ask the candidate this exact IELTS Speaking ${partTitle(template.part)} question: "${template.question}" Ask only this question, then wait for their answer.`
    const guide = `Sample examiner prompt: ${template.question}\nSample candidate response: ${answerEdits[template.id] ?? template.answer}\nUse the response as the model for this topic.`
    void simulation.startSimulation(template.part, template.topic, question, guide, undefined, template.id, `${partTitle(template.part)} · ${template.topic}`)
  }

  function startFullTest(template: FullSpeakingTemplate) {
    const opening = `Begin a full IELTS Speaking practice test. Start Part 1 with this question: "${template.part1[0].question}" Ask it naturally and wait for the candidate's answer.`
    const guide = [
      'PART 1',
      ...template.part1.flatMap((exchange, index) => [`Examiner question ${index + 1}: ${exchange.question}`, `Candidate model response ${index + 1}: ${exchange.answer}`]),
      `PART 2 cue card: ${template.part2CueCard}`,
      `PART 2 candidate model response: ${template.part2Answer}`,
      `PART 2 follow-up question: ${template.part2FollowUp.question}`,
      `PART 2 follow-up response: ${template.part2FollowUp.answer}`,
      'PART 3',
      ...template.part3.flatMap((exchange, index) => [`Discussion question ${index + 1}: ${exchange.question}`, `Candidate model response ${index + 1}: ${exchange.answer}`]),
    ].join('\n')
    void simulation.startSimulation('full', template.topic, opening, guide, undefined, template.id, template.title)
  }

  function joinTemplate(template: SpeakingTemplate) {
    setJoinInTemplateId(template.id)
  }

  function joinFullTest(template: FullSpeakingTemplate) {
    setJoinInTemplateId(template.id)
  }

  const joinTemplateTarget = displayTemplates.find((template) => template.id === joinInTemplateId)
  const joinFullTestTarget = fullTestTemplates.find((template) => template.id === joinInTemplateId)
  const joinInOpeningPrompt = joinTemplateTarget
    ? joinTemplateTarget.part === 'part2'
      ? `Present this exact Part 2 cue card to the candidate: "${joinTemplateTarget.question}" Give them one minute to prepare, then invite them to begin their long turn.`
      : `Ask the candidate this exact IELTS Speaking ${partTitle(joinTemplateTarget.part)} question: "${joinTemplateTarget.question}" Ask only this question and wait for their answer.`
    : joinFullTestTarget
      ? `Begin the full IELTS Speaking test with Part 1. Ask this first question exactly: "${joinFullTestTarget.part1[0].question}" Then wait for the candidate's answer.`
      : ''
  const joinInQuestionGuide = joinTemplateTarget
    ? `${partTitle(joinTemplateTarget.part)} prompt: ${joinTemplateTarget.question}`
    : joinFullTestTarget
      ? [
        'PART 1 QUESTIONS',
        ...joinFullTestTarget.part1.map((exchange, index) => `${index + 1}. ${exchange.question}`),
        'PART 2 CUE CARD',
        joinFullTestTarget.part2CueCard,
        'PART 2 FOLLOW-UP QUESTION',
        joinFullTestTarget.part2FollowUp.question,
        'PART 3 QUESTIONS',
        ...joinFullTestTarget.part3.map((exchange, index) => `${index + 1}. ${exchange.question}`),
      ].join('\n')
      : ''

  const categoriesForTemplates = filter === 'full' ? [] : visibleTemplates

  return <div className="page-content inner-page tt-page">
    <header className="tt-heading">
      <div><p className="eyebrow">CHOOSE A PROMPT · BUILD YOUR ANSWER</p><h1>Answer Builder</h1><p className="page-subtitle">Choose a question, explore a model, then shape your own answer with responsive live coaching and feedback you can revisit later.</p></div>
      <span className="tt-heading-badge"><AudioLines size={17} /> Topic Bank synced</span>
    </header>
    {lexicalCapture.message && <div className={lexicalCapture.state === 'error' ? 'tt-simulation-error' : 'tt-inline-notice'} role={lexicalCapture.state === 'error' ? 'alert' : 'status'}><span>{lexicalCapture.message}</span>{lexicalCapture.state === 'error' && <button type="button" onClick={lexicalCapture.retry}>Retry</button>}</div>}
    <nav className="drill-page-tabs tt-page-tabs" aria-label="Answer Builder sections">
      <button type="button" className={activeView === 'overview' ? 'drill-page-tab-active' : ''} aria-current={activeView === 'overview' ? 'page' : undefined} onClick={() => setActiveView('overview')}><BarChart3 size={15} /> Performance dashboard</button>
      <button type="button" className={activeView === 'library' ? 'drill-page-tab-active' : ''} aria-current={activeView === 'library' ? 'page' : undefined} onClick={() => setActiveView('library')}><BookOpen size={15} /> Prompt library <span>{displayTemplates.length + fullTestTemplates.length}</span></button>
      <button type="button" className={activeView === 'history' ? 'drill-page-tab-active' : ''} aria-current={activeView === 'history' ? 'page' : undefined} onClick={() => setActiveView('history')}><History size={15} /> Session archive <span>{talkingTemplateRecords.length}{pendingAssessmentCount ? ` · ${pendingAssessmentCount} to assess` : ''}</span></button>
    </nav>
    {activeView === 'overview' && <section className="tt-overview" aria-label="Answer Builder performance dashboard">
      <div className="tt-overview-welcome"><div><span className="tt-kicker">YOUR ANSWER-BUILDING SNAPSHOT</span><h2>Turn each attempt into progress</h2><p>See your practice at a glance, return to a question you’ve worked on, or jump straight into the prompt library.</p></div><button type="button" className="tt-overview-cta" onClick={() => setActiveView('library')}><Mic size={15} /> Choose a prompt <ChevronRight size={15} /></button></div>
      <div className="tt-overview-metrics">
        <article><span><Activity size={17} /></span><small>COACHED ATTEMPTS</small><strong>{candidatePracticeRecords.length}</strong><p>{practiceRecordsByTemplateId.size} question cards practised</p></article>
        <article><span><Check size={17} /></span><small>FEEDBACK READY</small><strong>{assessedPracticeCount}</strong><p>Assessed sessions in your archive</p></article>
        <article><span><Sparkles size={17} /></span><small>NEEDS ASSESSMENT</small><strong>{pendingAssessmentCount}</strong><p>{pendingAssessmentCount ? 'Saved whenever you are ready' : 'All saved sessions reviewed'}</p></article>
        <article><span><BarChart3 size={17} /></span><small>AVERAGE PERFORMANCE</small><strong>{averagePerformance === null ? '—' : `${averagePerformance}%`}</strong><p>Formative answer-building indicator</p></article>
      </div>
      {pendingAssessmentCount > 0 && <div className="tt-overview-pending"><div><strong>{pendingAssessmentCount} saved {pendingAssessmentCount === 1 ? 'session is' : 'sessions are'} waiting for feedback</strong><span>Assess now or come back later—the transcript is safely in your archive.</span></div><button type="button" onClick={openAssessmentQueue}><Sparkles size={14} /> Review unassessed sessions <ChevronRight size={14} /></button></div>}
      <section className="tt-overview-prompts" aria-labelledby="tt-overview-prompts-title">
        <header><div><span className="tt-kicker">QUESTION-BY-QUESTION PROGRESS</span><h3 id="tt-overview-prompts-title">Your recent prompt cards</h3></div><button type="button" onClick={() => setActiveView('library')}>Browse all prompts <ChevronRight size={14} /></button></header>
        {practiceRecordsByTemplateId.size
          ? <div className="tt-overview-prompt-grid">{[...practiceRecordsByTemplateId.entries()]
            .map(([templateId, records]) => ({ templateId, records, latest: records[0] }))
            .sort((first, second) => Date.parse(second.latest.startedAt) - Date.parse(first.latest.startedAt))
            .slice(0, 6)
            .map(({ templateId, records, latest }) => {
              const template = displayTemplates.find((item) => item.id === templateId)
                ?? fullTestTemplates.find((item) => item.id === templateId)
              const performance = performanceByTemplateId.get(templateId) ?? templatePerformance(records)
              return <button type="button" className="tt-overview-prompt" key={templateId} onClick={() => {
                if (displayTemplates.some((item) => item.id === templateId)) {
                  const selectedTemplate = displayTemplates.find((item) => item.id === templateId)
                  if (selectedTemplate) selectTemplate(selectedTemplate)
                } else {
                  setFilter('full')
                  setSearch(template?.topic ?? '')
                }
                setActiveView('library')
              }}>
                <span className={`tt-part-badge tt-${latest.part}`}>{latest.part === 'full' ? 'FULL TEST' : partTitle(latest.part)}</span>
                <strong>{latest.templateTitle ?? template?.topic ?? latest.topic}</strong>
                <small>{records.length} {records.length === 1 ? 'attempt' : 'attempts'} · {performance.assessed} assessed · {performance.pending} to assess</small>
                <span className="tt-overview-prompt-score">{performance.independence === null ? '—' : `${performance.independence}%`}<small> independent readiness</small></span>
                <i><b style={{ width: `${performance.independence ?? 0}%` }} /></i>
              </button>
            })}
          </div>
          : <div className="tt-overview-empty"><BookOpen size={20} /><strong>Your question-level progress will build here</strong><span>Choose a prompt and work through a live coaching session to get started.</span><button type="button" onClick={() => setActiveView('library')}>Explore the prompt library <ChevronRight size={14} /></button></div>}
      </section>
      {candidatePracticeRecords.length > 0 && <section className="tt-overview-recent"><header><div><span className="tt-kicker">PICK UP WHERE YOU LEFT OFF</span><h3>Recent coached sessions</h3></div><button type="button" onClick={() => setActiveView('history')}>Open archive <ChevronRight size={14} /></button></header>
        {candidatePracticeRecords.slice(0, 3).map((record) => <button type="button" className="tt-overview-session" key={record.id} onClick={() => openArchiveRecord(record)}><span className={`tt-archive-assessment-status ${record.answerMastery ? 'is-graded' : 'is-ungraded'}`}>{record.answerMastery ? 'Feedback ready' : 'Needs feedback'}</span><strong>{record.templateTitle ?? record.topic}</strong><small>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.startedAt))} · {formatDuration(record.durationSeconds)}</small><ChevronRight size={15} /></button>)}
      </section>}
    </section>}

    {simulation.error && <div className="tt-simulation-error" role="alert"><span>{simulation.error}</span>{!apiKey.trim() && <button type="button" onClick={onOpenSettings}>Open Settings</button>}</div>}
    {!apiKey.trim() && <div className="tt-key-note"><Sparkles size={16} /><span>Add your Speakia AI key to listen to examples and start live practice.</span><button type="button" onClick={onOpenSettings}>Open Settings</button></div>}

    {simulation.state !== 'idle' && <section className="tt-live-session" aria-label="Live AI conversation">
      <header><div><span className="tt-kicker">{simulation.state === 'saving' ? 'SAVING YOUR PRACTICE' : simulation.state === 'connecting' ? 'CONNECTING TWO AI VOICES' : 'LIVE AI-TO-AI PRACTICE'}</span><h2>{simulation.topic}</h2></div><div className="tt-live-session-actions"><span><Clock3 size={14} />{formatDuration(simulation.elapsedSeconds)}</span><button type="button" onClick={simulation.stopSimulation} disabled={simulation.state === 'saving'}><Square size={13} fill="currentColor" />{simulation.state === 'saving' ? 'Saving…' : 'Stop & save'}</button></div></header>
      <div className="tt-live-speakers"><div className={simulation.activeSpeaker === 'examiner' ? 'is-speaking' : ''}><span><Mic2 size={16} /></span><div><strong>AI Examiner</strong><small>{simulation.activeSpeaker === 'examiner' ? 'Speaking now' : 'Your test host'}</small></div><i /></div><div className={simulation.activeSpeaker === 'candidate' ? 'is-speaking' : ''}><span><Activity size={16} /></span><div><strong>AI Candidate</strong><small>{simulation.activeSpeaker === 'candidate' ? 'Speaking now' : 'Model response'}</small></div><i /></div></div>
      {simulation.state === 'connecting' && <p className="tt-connecting"><LoaderCircle size={15} className="spin-icon" /> Connecting to Speakia Live…</p>}
      <div ref={simulationTranscriptRef} className="tt-live-transcript" aria-label="AI conversation transcript">{simulation.turns.length ? simulation.turns.map((turn) => <article className={`tt-turn tt-turn-${turn.role}`} key={turn.id}><span>{turn.role === 'examiner' ? 'AI EXAMINER' : 'AI CANDIDATE'}{!turn.completedAt && ' · speaking'}</span><p>{turn.text ? <SpeechHighlight text={turn.text} wordIndex={!turn.completedAt && simulation.activeSpeaker === turn.role ? wordIndexAtElapsed(turn.text, simulation.speechElapsedSeconds, turn.audioDurationSeconds || undefined) : -1} /> : 'Listening…'}</p></article>) : <div className="tt-session-empty"><Headphones size={22} /><span>The AI examiner will start shortly.</span></div>}</div>
      <footer><span><Waves size={14} /> Audio plays automatically; the transcript follows live.</span><span>{simulation.turns.length} turns</span></footer>
    </section>}

    {(joinTemplateTarget || joinFullTestTarget) && joinInOpeningPrompt && <JoinInPractice
      key={joinInTemplateId}
      apiKey={apiKey}
      part={joinTemplateTarget?.part ?? 'full'}
      topic={joinTemplateTarget?.topic ?? joinFullTestTarget?.topic ?? ''}
      templateId={joinInTemplateId ?? ''}
      title={joinTemplateTarget ? `${partTitle(joinTemplateTarget.part)} · ${joinTemplateTarget.topic}` : joinFullTestTarget?.title ?? ''}
      openingPrompt={joinInOpeningPrompt}
      questionGuide={joinInQuestionGuide}
      referenceAnswer={joinTemplateTarget ? answerEdits[joinTemplateTarget.id] ?? joinTemplateTarget.answer : ''}
      onSave={simulation.savePracticeRecord}
      onClose={() => setJoinInTemplateId(null)}
      onOpenDrill={onOpenDrill}
    />}

    {activeView === 'library' && <>
    <div className="tt-library-heading"><div><span className="tt-kicker">START WITH A PROMPT</span><h2>Choose a question or cue card</h2></div><div className="tt-library-actions"><span className="tt-result-count">{filter === 'full' ? `${visibleFullTests.length} full test ${visibleFullTests.length === 1 ? 'set' : 'sets'}` : `${visibleTemplates.length} ${visibleTemplates.length === 1 ? 'question' : 'questions'}`}</span><label className="tt-generate-part"><span>Generate for</span><select aria-label="IELTS part for the generated template" value={generationPart} disabled={generatingTemplate} onChange={(event) => setGenerationPart(event.target.value as TemplatePart)}><option value="part1">Part 1</option><option value="part2">Part 2</option><option value="part3">Part 3</option></select></label><label className="tt-generate-part tt-generate-model"><span>AI model</span><select aria-label="Text model for prompt generation" value={generationModel} disabled={generatingTemplate} onChange={(event) => setGenerationModel(event.target.value as AssistantModel)}>{ASSISTANT_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.description}{model.id === DEFAULT_TEMPLATE_GENERATION_MODEL ? ' · lightweight default' : ''}</option>)}</select></label><button type="button" className="tt-generate-button" onClick={() => void generateTemplate()} disabled={generatingTemplate}><Sparkles size={15} />{generatingTemplate ? 'Generating…' : 'Create a prompt'}</button></div></div>
    {generationError && <div className="tt-simulation-error tt-generation-error" role="alert"><span>{generationError}</span>{!apiKey.trim() && <button type="button" onClick={onOpenSettings}>Open Settings</button>}</div>}
    <div className="tt-filters">
      <label className="tt-search"><Search size={17} /><input aria-label="Search templates by topic or keyword" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics, questions, vocabulary…" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}</label>
      <label className="tt-category-filter"><ListFilter size={16} /><span>Topic</span><select aria-label="Filter templates by topic category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All topics</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button type="button" className={`tt-favorites-filter ${favoritesOnly ? 'is-active' : ''}`} onClick={() => setFavoritesOnly((current) => !current)} aria-pressed={favoritesOnly}><Bookmark size={15} fill={favoritesOnly ? 'currentColor' : 'none'} /> Saved</button>
    </div>
    <div className="tt-part-tabs" role="tablist" aria-label="Filter Topic Bank questions by IELTS test part">
      {(['all', 'part1', 'part2', 'part3', 'full'] as TemplateFilter[]).map((part) => <button type="button" role="tab" aria-selected={filter === part} className={filter === part ? 'is-active' : ''} key={part} onClick={() => { setFilter(part); if (part === 'part1' || part === 'part2' || part === 'part3') setGenerationPart(part) }}>{partLabels[part]}{part === 'full' && <span className="tt-live-dot" />}</button>)}
    </div>

    {filter === 'full' ? <section className="tt-full-library" aria-label="Topic Bank full mock tests">
      <div><span className="tt-full-stamp"><Radio size={18} /> FULL SPEAKING TESTS · TOPIC BANK SYNCED</span><h3>Follow the complete test, part by part</h3><p>Each full test is assembled from the current Topic Bank questions, cue cards, and discussion prompts. Updates to your Topic Bank appear here automatically.</p></div>
      {visibleFullTests.map((test) => <article className="tt-full-transcript-card" key={test.id}>
        <header><div><span className="tt-part-badge tt-full-badge">FULL TEST · 3 PARTS</span><span className="tt-topic-label">{test.category}</span><h3>{test.title}</h3><p>{test.topic} · {test.part1.length} Part 1 questions · cue card · {test.part3.length} Part 3 questions</p></div><button type="button" className={`tt-detail-save ${favorites.includes(test.id) ? 'is-saved' : ''}`} aria-label={`${favorites.includes(test.id) ? 'Remove' : 'Save'} ${test.title}`} aria-pressed={favorites.includes(test.id)} onClick={() => toggleFavorite(test.id)}><Bookmark size={17} fill={favorites.includes(test.id) ? 'currentColor' : 'none'} /></button></header>
        <div className="tt-full-transcript-actions"><button type="button" className="tt-transcript-toggle" aria-expanded={expandedFullTranscriptId === test.id} onClick={() => setExpandedFullTranscriptId((current) => current === test.id ? null : test.id)}><BookOpen size={15} />{expandedFullTranscriptId === test.id ? 'Hide transcript' : 'Read full transcript'}</button><button type="button" className="tt-live-button" onClick={() => startFullTest(test)} disabled={simulation.state !== 'idle' || joinInTemplateId !== null}><Play size={14} fill="currentColor" />{simulation.state === 'idle' ? 'Listen with two AI voices' : 'Simulation in progress'}</button><button type="button" className="tt-join-button" onClick={() => joinFullTest(test)} disabled={!apiKey.trim() || simulation.state !== 'idle' || joinInTemplateId !== null}><Mic size={15} /> Build answers with live coach</button></div>
        <TemplatePerformanceMini performance={performanceByTemplateId.get(test.id) ?? templatePerformance([])} onOpenTranscript={practiceRecordsByTemplateId.get(test.id)?.[0] ? () => openArchiveRecord(practiceRecordsByTemplateId.get(test.id)![0]) : undefined} />
        {expandedFullTranscriptId === test.id && <div className="tt-full-transcript">
          <section><h4><span>PART 1</span> Introduction and familiar topics</h4>{test.part1.map((exchange, index) => <TranscriptExchangeView key={exchange.question} exchange={exchange} number={index + 1} />)}</section>
          <section><h4><span>PART 2</span> Individual long turn</h4><div className="tt-transcript-turn"><strong>Examiner · cue card</strong><p>{test.part2CueCard}</p></div><div className="tt-transcript-turn tt-transcript-turn-candidate"><strong>Candidate · model response</strong><p>{test.part2Answer}</p></div><TranscriptExchangeView exchange={test.part2FollowUp} number={1} /></section>
          <section><h4><span>PART 3</span> Two-way discussion</h4>{test.part3.map((exchange, index) => <TranscriptExchangeView key={exchange.question} exchange={exchange} number={index + 1} />)}</section>
        </div>}
      </article>)}
      {!visibleFullTests.length && <div className="tt-empty"><Search size={22} /><strong>No full tests match these filters</strong><span>Try another search or topic, or turn off Saved only.</span><button type="button" onClick={() => { setSearch(''); setCategory('all'); setFavoritesOnly(false) }}>Clear filters</button></div>}
    </section> : <div className="tt-library-layout">
      <section className="tt-template-list" aria-label="Speaking templates">
        <div className="tt-template-grid">{categoriesForTemplates.map((template) => {
          const templateRecords = practiceRecordsByTemplateId.get(template.id) ?? []
          const latestPractice = templateRecords[0]
          return <article className={`tt-template-card ${template.id === selected.id ? 'is-selected' : ''}`} data-readiness={readinessLevel(masteryByTemplateId.get(template.id))} key={template.id}>
          <button type="button" className="tt-template-select" onClick={() => selectTemplate(template)} aria-pressed={template.id === selected.id}>
            <span className={`tt-part-badge tt-${template.part}`}>{partTitle(template.part)}</span>{template.id === selected.id && <span className="tt-selected-badge"><Check size={11} /> Selected</span>}<span className="tt-card-duration"><Clock3 size={12} />{template.duration}</span>
            <h3>{template.topic}</h3><p>{template.question}</p>
          </button>
          <footer><span>{template.category}</span><button type="button" aria-label={`${favorites.includes(template.id) ? 'Remove' : 'Save'} ${template.topic} favorite`} aria-pressed={favorites.includes(template.id)} onClick={() => toggleFavorite(template.id)}><Bookmark size={15} fill={favorites.includes(template.id) ? 'currentColor' : 'none'} /></button></footer>
          <TemplatePerformanceMini performance={performanceByTemplateId.get(template.id) ?? templatePerformance([])} onOpenTranscript={latestPractice ? () => openArchiveRecord(latestPractice) : undefined} />
        </article>})}</div>
        {!categoriesForTemplates.length && <div className="tt-empty"><Search size={22} /><strong>No matching templates</strong><span>Try another search or clear your filters.</span><button type="button" onClick={() => { setSearch(''); setCategory('all'); setFavoritesOnly(false) }}>Clear filters</button></div>}
      </section>

      <aside className="tt-detail" aria-label="Selected speaking template" ref={selectedTemplateDetailRef}>
        <header className="tt-detail-heading"><div><span className={`tt-part-badge tt-${selected.part}`}>{partTitle(selected.part)}</span><span className="tt-topic-label">{selected.category}</span></div><button type="button" className={`tt-detail-save ${favorites.includes(selected.id) ? 'is-saved' : ''}`} aria-label={`${favorites.includes(selected.id) ? 'Remove' : 'Save'} favorite`} onClick={() => toggleFavorite(selected.id)}><Bookmark size={17} fill={favorites.includes(selected.id) ? 'currentColor' : 'none'} /></button></header>
        <h2>{selected.topic}</h2>
        <p className="tt-question">{selected.question}</p>
        <div className="tt-detail-next-steps"><button type="button" className="tt-detail-start-coaching" onClick={() => joinTemplate(selected)} disabled={!apiKey.trim() || simulation.state !== 'idle' || joinInTemplateId !== null}><Mic size={15} /> Start live coaching</button><button type="button" className="tt-detail-model-link" onClick={() => runSimulation(selected)} disabled={!apiKey.trim() || simulation.state !== 'idle' || joinInTemplateId !== null}><Waves size={14} /> Listen to a model conversation</button>{latestSelectedPractice && <button type="button" className="tt-detail-history-link" onClick={() => openArchiveRecord(latestSelectedPractice)}><History size={14} /> {selectedPracticeRecords.length} previous {selectedPracticeRecords.length === 1 ? 'attempt' : 'attempts'} · open latest transcript</button>}</div>
        <div className="tt-answer-label"><span><Sparkles size={14} /> SAMPLE TRANSCRIPT</span><button type="button" onClick={() => setTranscriptHidden((hidden) => !hidden)}>{transcriptHidden ? <Play size={13} /> : <Pause size={13} />}{transcriptHidden ? 'Show transcript' : 'Hide transcript'}</button></div>
        {transcriptHidden ? <div className="tt-hidden-answer"><Headphones size={19} /><strong>Listen first. Speak from memory.</strong><span>Your transcript is hidden—reveal it when you are ready.</span></div> : <div className="tt-sample-transcript"><div className="tt-transcript-turn"><strong>Examiner · {partTitle(selected.part)} prompt</strong><p>{selected.question}</p></div><div className="tt-transcript-turn tt-transcript-turn-candidate"><strong>Candidate · model response</strong><textarea className="tt-answer-editor" aria-label="Editable model answer—adapt it to your own experience" value={selectedAnswer} maxLength={1500} onChange={(event) => setAnswerEdits((current) => ({ ...current, [selected.id]: event.target.value }))} /></div></div>}
        <TemplateAudio key={`${selected.id}-${selectedAnswer}`} template={selected} answer={selectedAnswer} apiKey={apiKey} />
        <div className="tt-detail-section"><h3><span>01</span>Answer blueprint</h3><ol>{selected.structure.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol></div>
        <div className="tt-detail-section"><h3><span>02</span>Useful expressions</h3><div className="tt-vocabulary">{selected.vocabulary.map((word) => <span key={word}>{word}</span>)}</div></div>
        <div className="tt-record-box"><div><span className="tt-record-icon"><Mic2 size={17} /></span><div><strong>Your turn</strong><small>Record your version and compare it with the model.</small></div></div>
          {recorderState === 'recording' ? <button type="button" className="tt-record-button tt-recording" onClick={stopRecording}><Square size={13} fill="currentColor" /> Stop recording</button> : <button type="button" className="tt-record-button" onClick={() => void startRecording()}><Mic2 size={14} /> Record answer</button>}
          {recording?.id === selected.id && <audio className="tt-recorded-audio" controls src={recording.url} aria-label="Your recorded answer" />}
          {recordingError && <p className="tt-inline-error" role="alert">{recordingError}</p>}
        </div>
      </aside>
    </div>}

    {fullTest && filter === 'all' && <section className="tt-full-test" aria-labelledby="tt-full-test-title">
      <div className="tt-full-test-intro"><div className="tt-full-test-icon"><Radio size={20} /></div><div><span className="tt-kicker">AI SIMULATION</span><h2 id="tt-full-test-title">Listen to a complete speaking test</h2><p>Hear an AI examiner and candidate demonstrate all three parts of an IELTS Speaking practice.</p></div></div>
      <div className="tt-full-test-route"><div className="tt-route-step"><span>01</span><div><strong>Part 1 · Familiar questions</strong><small>{fullTest.part1.length} short questions about {fullTest.topic}</small></div><ChevronRight size={15} /></div><div className="tt-route-step"><span>02</span><div><strong>Part 2 · Long turn</strong><small>Cue card, preparation time, extended response, and follow-up</small></div><ChevronRight size={15} /></div><div className="tt-route-step"><span>03</span><div><strong>Part 3 · Discussion</strong><small>{fullTest.part3.length} broader questions connected to the topic</small></div></div></div>
      <div className="tt-full-test-actions"><button type="button" className="tt-live-button" onClick={() => startFullTest(fullTest)} disabled={simulation.state !== 'idle' || joinInTemplateId !== null}><Play size={15} fill="currentColor" />{simulation.state === 'idle' ? 'Listen to sample test' : 'Simulation in progress'}</button><button type="button" className="tt-join-button" onClick={() => joinFullTest(fullTest)} disabled={!apiKey.trim() || simulation.state !== 'idle' || joinInTemplateId !== null}><Mic size={15} /> Build answers with live coach</button></div>
      <TemplatePerformanceMini performance={performanceByTemplateId.get(fullTest.id) ?? templatePerformance([])} onOpenTranscript={practiceRecordsByTemplateId.get(fullTest.id)?.[0] ? () => openArchiveRecord(practiceRecordsByTemplateId.get(fullTest.id)![0]) : undefined} />
    </section>}
    </>}

    {activeView === 'history' && <section ref={archiveSectionRef} className="tt-archive" aria-labelledby="tt-archive-title">
      <div className="tt-library-heading"><div><span className="tt-kicker">TEMPLATE PRACTICE</span><h2 id="tt-archive-title">Session archive</h2></div><span className="tt-result-count">{filteredArchiveRecords.length} {filteredArchiveRecords.length === 1 ? 'session' : 'sessions'}</span></div>
      <div className="tt-archive-controls">
        <label className="tt-search"><Search size={16} /><input aria-label="Search Answer Builder session archive" value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Search template, topic, or transcript..." />{archiveSearch && <button type="button" aria-label="Clear archive search" onClick={() => setArchiveSearch('')}><X size={14} /></button>}</label>
        <label className="tt-category-filter"><ListFilter size={15} /><span>Part</span><select aria-label="Filter Answer Builder archive by IELTS part" value={archivePartFilter} onChange={(event) => setArchivePartFilter(event.target.value as TemplateFilter)}><option value="all">All parts</option><option value="part1">Part 1</option><option value="part2">Part 2</option><option value="part3">Part 3</option><option value="full">Full test</option></select></label>
        <label className="tt-category-filter"><ListFilter size={15} /><span>Session</span><select aria-label="Filter Answer Builder archive by session type" value={archiveModeFilter} onChange={(event) => setArchiveModeFilter(event.target.value as typeof archiveModeFilter)}><option value="all">All sessions</option><option value="ai-to-ai">AI-to-AI samples</option><option value="human-practice">Candidate practice</option></select></label>
        <label className="tt-category-filter"><ListFilter size={15} /><span>Feedback</span><select aria-label="Filter Answer Builder archive by assessment status" value={archiveAssessmentFilter} onChange={(event) => setArchiveAssessmentFilter(event.target.value as typeof archiveAssessmentFilter)}><option value="all">All feedback states</option><option value="graded">Feedback ready</option><option value="ungraded">Needs assessment</option></select></label>
      </div>
      {filteredArchiveRecords.length
        ? <div className="tt-archive-list">{filteredArchiveRecords.map((record) => {
          const transcriptMatch = transcriptMatchIds.has(record.id)
          return <TemplateSimulationArchiveItem
            key={record.id}
            username={username}
            record={record}
            search={archiveSearch}
            transcriptMatch={transcriptMatch}
            focusSearchMatch={record.id === firstTranscriptMatchId}
            referenceAnswer={answerByTemplateId.get(record.templateId ?? '') ?? ''}
            apiKey={apiKey}
            onSave={simulation.savePracticeRecord}
            onOpenSettings={onOpenSettings}
            jumpRequest={archiveJumpRequest}
          />
        })}</div>
        : <div className="tt-archive-empty"><Headphones size={20} /><strong>{talkingTemplateRecords.length ? 'No sessions match these filters' : 'Your template sessions will appear here'}</strong><span>{talkingTemplateRecords.length ? 'Try another search, part, session type, or feedback state.' : 'Listen to a model sample or build an answer live with Speakia to save a session here.'}</span>{talkingTemplateRecords.length > 0 && <button type="button" onClick={() => { setArchiveSearch(''); setArchivePartFilter('all'); setArchiveModeFilter('all'); setArchiveAssessmentFilter('all') }}>Clear filters</button>}</div>}
    </section>}
    <p className="tt-disclaimer"><Check size={14} /> Practice examples are learning aids, not scripts to memorise or official IELTS band-score assessments.</p>
  </div>
}
