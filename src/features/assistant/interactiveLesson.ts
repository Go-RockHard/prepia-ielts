import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai'

export interface InteractiveLesson {
  id: string
  title: string
  topic: string
  summary: string
  html: string
  interactions: string[]
}

export const interactiveLessonTool: FunctionDeclaration = {
  name: 'build_interactive_ielts_lesson',
  description: 'Build and display a personalized, self-contained interactive HTML5 IELTS Speaking lesson inside this Speakia conversation. Call this when the learner asks for a lesson, tutorial, guided walkthrough, quiz, practice activity, interactive exercise, or asks to adapt an existing lesson. Use their request, goals, recent performance, and current lesson interactions to personalize it.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: { type: Type.STRING, description: 'The lesson request or desired adaptation, based on what the learner asked.' },
      topic: { type: Type.STRING, description: 'IELTS Speaking topic, such as hometown, technology, work, or describing an experience.' },
      focus: { type: Type.STRING, description: 'Target skill, such as fluency, idea development, vocabulary, grammar, or pronunciation.' },
      part: { type: Type.STRING, enum: ['part1', 'part2', 'part3'], description: 'Relevant IELTS Speaking part.' },
      level: { type: Type.STRING, description: 'Learner level or target band, if known.' },
    },
    required: ['request'],
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedText(value: unknown, fallback: string, maximum: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) || fallback : fallback
}

function createSandboxedDocument(rawHtml: string, lessonId: string): string {
  const html = rawHtml
    .replace(/^```(?:html)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  if (html.length > 85_000) throw new Error('The generated lesson is too large to embed. Please try a shorter lesson request.')
  if (!/<html[\s>]/i.test(html) || !/<\/html\s*>/i.test(html)) {
    throw new Error('The generated lesson was not a complete HTML document. Please try again.')
  }

  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; navigate-to \'none\'">'
  const bridge = `<script>
(()=>{const lessonId=${JSON.stringify(lessonId)};const send=(kind,detail)=>parent.postMessage({type:"speakia:interactive-lesson",lessonId,kind,detail},"*");document.addEventListener("click",event=>{const target=event.target instanceof Element?event.target:null;if(!target)return;const link=target.closest("a[href]");if(link){const href=link.getAttribute("href")||"";if(!href.startsWith("#")){event.preventDefault();return}}const button=target.closest("button,[data-speakia-action]");if(!button)return;const action=button.getAttribute("data-speakia-action")||"interaction";const label=(button.getAttribute("aria-label")||button.textContent||"Activity interaction").trim().slice(0,100);send(action==="complete"?"complete":action==="hint"?"hint":"interaction",label)},true);document.addEventListener("submit",event=>{const form=event.target;if(!(form instanceof HTMLFormElement))return;const answers=Array.from(new FormData(form).entries()).slice(0,8).map(([name,value])=>({name:String(name).slice(0,40),value:String(value).slice(0,500)}));send("exercise",JSON.stringify(answers).slice(0,2400))},true)})();
</script>`
  let document = html.replace(/<meta\s+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '')
  if (/<head[\s>]/i.test(document)) {
    document = document.replace(/<head([^>]*)>/i, `<head$1><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${policy}`)
  } else {
    document = document.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${policy}</head>`)
  }
  if (/<\/body\s*>/i.test(document)) return document.replace(/<\/body\s*>/i, `${bridge}</body>`)
  return document.replace(/<\/html\s*>/i, `${bridge}</html>`)
}

export async function createInteractiveLesson(
  apiKey: string,
  rawArgs: Record<string, unknown>,
  learnerContext: unknown,
  model = 'gemini-2.5-flash',
): Promise<InteractiveLesson> {
  if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings to create an interactive lesson.')
  if (!isRecord(rawArgs)) throw new Error('The lesson request was incomplete. Please try again.')
  const request = boundedText(rawArgs.request, '', 800)
  if (request.length < 3) throw new Error('Tell Speakia what topic or skill you want the lesson to cover.')
  const topic = boundedText(rawArgs.topic, 'IELTS Speaking', 120)
  const focus = boundedText(rawArgs.focus, 'speaking fluency and clear ideas', 160)
  const part = rawArgs.part === 'part1' || rawArgs.part === 'part2' || rawArgs.part === 'part3' ? rawArgs.part : 'choose the most relevant part'
  const level = boundedText(rawArgs.level, 'infer an appropriate level from the learner context', 120)
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const response = await client.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify({
          learnerContext,
          lessonRequest: request,
          topic,
          targetFocus: focus,
          speakingPart: part,
          level,
        }),
      }],
    }],
    config: {
      responseMimeType: 'text/plain',
      systemInstruction: `Create a complete, polished, adaptive and immediately usable HTML5 lesson for IELTS Speaking. Return ONLY the complete HTML document (doctype, html, head, body). The host will render this document in a sandboxed iframe with scripts enabled but no network access, same-origin access, forms, popups, or top navigation. Therefore use only inline CSS and inline JavaScript: no external scripts, stylesheets, libraries, fonts, fetch, or network calls.

Build an engaging but readable responsive mini-learning experience with a clear lesson goal, concise teaching, realistic IELTS examples, definitions where useful, scaffolded practice, and at least two meaningful interactions (such as a quiz with feedback, revealable examples, a vocabulary exercise, answer builder, or timed speaking prompt). Provide instant feedback and a visible completion action. Include semantic HTML, keyboard-friendly controls, accessible labels, adequate contrast and mobile-friendly typography. Adapt the difficulty and examples to the supplied learner context and focus on useful IELTS Speaking practice, not generic filler. Do not include markdown fences. When possible mark completion buttons with data-speakia-action="complete" and hint buttons with data-speakia-action="hint". Keep the complete HTML under 70 KB. The page must work offline within the iframe.`,
    },
  })
  const rawHtml = response.text?.trim()
  if (!rawHtml) throw new Error('Gemini returned an empty lesson. Please try again.')
  const id = crypto.randomUUID()
  const html = createSandboxedDocument(rawHtml, id)
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, '').trim().slice(0, 100)
  return {
    id,
    title: title || topic,
    topic,
    summary: `Interactive IELTS Speaking lesson about ${topic}, personalized for ${focus}.`,
    html,
    interactions: [],
  }
}
