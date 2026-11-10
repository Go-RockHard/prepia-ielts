import { Type, type FunctionDeclaration } from '@google/genai'
import { GoogleGenAI } from '@/lib/geminiClient'
import { getProdiaTextModel } from '@/lib/geminiModels'

export interface LearningModuleItem {
  title: string
  body: string
  example?: string
  prompt?: string
  answer?: string
}

export interface EmbeddedLearningModule {
  id: string
  kind: 'flashcards' | 'slides'
  title: string
  topic: string
  summary: string
  items: LearningModuleItem[]
  html: string
  interactions: string[]
}

export const flashcardsTool: FunctionDeclaration = {
  name: 'build_speaking_flashcards',
  description: 'Create a personalized interactive flashcard set for IELTS Speaking. Use for requests for flashcards, vocabulary cards, revision cards, memory practice, or quick review of speaking topics, grammar, pronunciation, or strategies.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: { type: Type.STRING, description: 'Learner’s requested flashcard topic or adaptation.' },
      topic: { type: Type.STRING, description: 'Topic for the cards.' },
      focus: { type: Type.STRING, description: 'Skill or content focus, such as vocabulary, grammar, pronunciation, or speaking tips.' },
      level: { type: Type.STRING, description: 'Learner level or target band if known.' },
    },
    required: ['request'],
  },
}

export const slidesTool: FunctionDeclaration = {
  name: 'build_speaking_slides',
  description: 'Create a personalized interactive slide deck for IELTS Speaking preparation. Use for requests for slides, a presentation, visual lesson, walkthrough, or concise step-by-step guide on speaking topics, grammar, vocabulary, pronunciation, or test strategies.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      request: { type: Type.STRING, description: 'Learner’s requested slide topic or adaptation.' },
      topic: { type: Type.STRING, description: 'Topic for the deck.' },
      focus: { type: Type.STRING, description: 'Skill or content focus, such as vocabulary, grammar, pronunciation, or speaking tips.' },
      level: { type: Type.STRING, description: 'Learner level or target band if known.' },
    },
    required: ['request'],
  },
}

const liveLearningItemSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'The flashcard term or slide heading.' },
    body: { type: Type.STRING, description: 'The answer, explanation, or teaching point.' },
    example: { type: Type.STRING, description: 'An optional accurate example.' },
    prompt: { type: Type.STRING, description: 'An optional active-recall or practice prompt.' },
    answer: { type: Type.STRING, description: 'An optional answer or coach note.' },
  },
  required: ['title', 'body'],
}

function liveLearningTool(tool: FunctionDeclaration, kind: EmbeddedLearningModule['kind']): FunctionDeclaration {
  return {
    ...tool,
    description: `${tool.description} Generate and return the complete content now: a title, summary, topic, request, and ${kind === 'flashcards' ? '4–16 flashcards' : '4–12 progressive slides'} in items. Each item needs a title and body; include useful examples and prompts where appropriate.`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        request: { type: Type.STRING, description: 'The learner’s request being fulfilled.' },
        topic: { type: Type.STRING, description: 'The focused IELTS Speaking topic.' },
        title: { type: Type.STRING, description: 'A concise title for the generated content.' },
        summary: { type: Type.STRING, description: 'A concise description of the generated content.' },
        items: { type: Type.ARRAY, items: liveLearningItemSchema },
      },
      required: ['request', 'topic', 'title', 'summary', 'items'],
    },
  }
}

export const liveFlashcardsTool = liveLearningTool(flashcardsTool, 'flashcards')
export const liveSlidesTool = liveLearningTool(slidesTool, 'slides')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateItems(value: unknown, kind: EmbeddedLearningModule['kind']): LearningModuleItem[] {
  if (!Array.isArray(value) || value.length < (kind === 'flashcards' ? 4 : 4) || value.length > (kind === 'flashcards' ? 16 : 12)) {
    throw new Error(`Speakia returned an incomplete ${kind === 'flashcards' ? 'flashcard set' : 'slide deck'}. Please try again.`)
  }
  return value.map((item) => {
    if (!isRecord(item)
      || typeof item.title !== 'string' || !item.title.trim()
      || typeof item.body !== 'string' || !item.body.trim()
      || (item.example !== undefined && typeof item.example !== 'string')
      || (item.prompt !== undefined && typeof item.prompt !== 'string')
      || (item.answer !== undefined && typeof item.answer !== 'string')) {
      throw new Error(`Speakia returned invalid ${kind === 'flashcards' ? 'flashcard' : 'slide'} content. Please try again.`)
    }
    const entry = {
      title: item.title.trim(),
      body: item.body.trim(),
      ...(typeof item.example === 'string' ? { example: item.example.trim() } : {}),
      ...(typeof item.prompt === 'string' ? { prompt: item.prompt.trim() } : {}),
      ...(typeof item.answer === 'string' ? { answer: item.answer.trim() } : {}),
    }
    if (entry.title.length > 140 || entry.body.length > 650
      || (entry.example?.length ?? 0) > 400
      || (entry.prompt?.length ?? 0) > 300
      || (entry.answer?.length ?? 0) > 400) {
      throw new Error('Speakia returned an item that is too long. Please try a more focused request.')
    }
    return entry
  })
}

function makeDocument(kind: EmbeddedLearningModule['kind'], id: string, topic: string, items: LearningModuleItem[], lessonType: 'speaking' | 'writing'): string {
  const itemJson = JSON.stringify(items).replace(/</g, '\\u003c')
  const safeId = JSON.stringify(id)
  const safeTopic = JSON.stringify(topic)
  const skillName = lessonType === 'writing' ? 'Writing' : 'Speaking'
  const skillNameJson = JSON.stringify(skillName)
  const policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; navigate-to \'none\'">'
  const bridge = `<script>
(()=> {
  const id=${safeId}, topic=${safeTopic}, kind=${JSON.stringify(kind)}, items=${itemJson};
  const send=(eventKind,detail)=>parent.postMessage({type:"speakia:interactive-lesson",lessonId:id,kind:eventKind,detail:String(detail).slice(0,1200)},"*");
  const esc=value=>String(value).replace(/[&<>"']/g,char=>char==="&"?"&amp;":char==="<"?"&lt;":char===">"?"&gt;":char===String.fromCharCode(34)?"&quot;":"&#39;");
  const root=document.getElementById("app");let index=0,flipped=false,notes=false;
  function render(){
    const item=items[index], previousDisabled=index===0?" disabled":"", nextDisabled=index===items.length-1?" disabled":"";
    let content="";
    if(kind==="flashcards"){
      const answer=esc(item.body)+(item.example?"<br><br><em>Example: "+esc(item.example)+"</em>":"");
      content="<button class='card "+(flipped?"flip":"")+"' aria-label='Flip flashcard'><span class='label'>"+(flipped?"REVEAL":"RECALL")+"</span><strong>"+esc(item.title)+"</strong><p>"+(flipped?answer:"Think of the meaning or a natural IELTS answer before revealing.")+"</p><small>Tap to "+(flipped?"return":"reveal")+" · Space to flip</small></button><div class='controls'><button id='prev'"+previousDisabled+">← Previous</button><button id='flip'>"+(flipped?"Hide answer":"Reveal answer")+"</button><button id='next'"+nextDisabled+">Next →</button></div><div class='recall'><strong>"+${skillNameJson}+" prompt</strong><p>"+esc(item.prompt||"Use this idea in a natural IELTS "+${skillNameJson}+" response.")+"</p></div><button class='done' data-speakia-action='complete'>Finish flashcards</button>";
    } else {
      content="<article class='slide'><span class='eyebrow'>IELTS "+${skillNameJson.toLocaleUpperCase()}+" · "+String(index+1).padStart(2,"0")+"</span><h1>"+esc(item.title)+"</h1><p>"+esc(item.body)+"</p>"+(item.example?"<blockquote>"+esc(item.example)+"</blockquote>":"")+(item.prompt?"<div class='prompt'><strong>Try it</strong><p>"+esc(item.prompt)+"</p></div>":"")+(notes&&item.answer?"<aside class='notes'><strong>Coach notes</strong><p>"+esc(item.answer)+"</p></aside>":"")+"</article><div class='controls'><button id='prev'"+previousDisabled+">← Previous</button><button id='notes'>"+(notes?"Hide":"Show")+" coach notes</button><button id='next'"+nextDisabled+">Next →</button></div><div class='progress'><span style='width:"+(((index+1)/items.length)*100)+"%'></span></div><button class='done' data-speakia-action='complete'>Finish slide deck</button>";
    }
    root.innerHTML="<main class='deck'><div class='top'><span>"+esc(topic)+" · "+${skillNameJson.toLocaleUpperCase()}+" "+(kind==="slides"?"SLIDES":"FLASHCARDS")+"</span><span>"+(index+1)+" / "+items.length+"</span></div>"+content+"</main>";
    root.querySelector("#prev").onclick=()=>{index=Math.max(0,index-1);flipped=false;notes=false;render();send("interaction","Viewed item "+(index+1)+": "+items[index].title)};
    root.querySelector("#next").onclick=()=>{index=Math.min(items.length-1,index+1);flipped=false;notes=false;render();send("interaction","Viewed item "+(index+1)+": "+items[index].title)};
    if(kind==="flashcards"){
      const flip=()=>{flipped=!flipped;render();send("interaction",(flipped?"Revealed":"Reviewed")+" flashcard: "+items[index].title)};
      root.querySelector("#flip").onclick=flip;root.querySelector(".card").onclick=flip;
    } else root.querySelector("#notes").onclick=()=>{notes=!notes;render();send("interaction",(notes?"Opened":"Closed")+" coach notes for: "+items[index].title)};
    root.querySelector(".done").onclick=()=>send("complete","Completed "+kind+" about "+topic);
  }
  document.addEventListener("keydown",event=>{if(event.key==="ArrowRight"&&index<items.length-1){index++;flipped=false;notes=false;render()}if(event.key==="ArrowLeft"&&index>0){index--;flipped=false;notes=false;render()}if(event.key===" "&&kind==="flashcards"){event.preventDefault();flipped=!flipped;render()}});
  addEventListener("message",event=>{const data=event.data;if(!data||data.type!=="speakia:module-navigation"||data.lessonId!==id)return;if(data.direction==="next")root.querySelector("#next")?.click();if(data.direction==="previous")root.querySelector("#prev")?.click()});
  render();
})();
</script>`
  const style = `<style>
:root{font-family:Inter,"Segoe UI",Arial,sans-serif;color:#28283c;background:#f7f7fc;font-synthesis:none;text-rendering:optimizeLegibility}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 90% 0,#efebff,transparent 38%),#f8f8fc}button{font:inherit;cursor:pointer}.deck{max-width:720px;margin:0 auto;padding:18px 20px 22px}.top{display:flex;justify-content:space-between;gap:8px;color:#77728d;font-size:10px;font-weight:800;letter-spacing:.7px}.card{display:flex;width:100%;min-height:205px;flex-direction:column;align-items:center;justify-content:center;padding:25px;margin:15px 0 12px;text-align:center;color:#36334e;background:linear-gradient(140deg,#fff,#f8f6ff);border:1px solid #e5e0f4;border-radius:18px;box-shadow:0 12px 28px #47377912}.card.flip{background:linear-gradient(140deg,#f5f1ff,#fff)}.card .label,.eyebrow{color:#7765cb;font-size:9px;font-weight:800;letter-spacing:1px}.card strong{margin:8px 0;color:#36334e;font-size:22px}.card p{max-width:500px;margin:4px 0;color:#666273;font-size:14px;line-height:1.7}.card small{margin-top:12px;color:#9895a5;font-size:10px}.controls{display:flex;justify-content:space-between;gap:7px}.controls button,.done{min-height:35px;padding:0 12px;color:#6154a1;background:#fff;border:1px solid #e7e3f1;border-radius:9px;font-size:11px;font-weight:700}.controls button:disabled{opacity:.4;cursor:default}.controls button:nth-child(2){color:#fff;background:#6d5bc3;border-color:#6d5bc3}.recall,.prompt,.notes{padding:12px 14px;margin-top:11px;background:#fff;border:1px solid #eeebf4;border-radius:10px}.recall strong,.prompt strong,.notes strong{color:#6255ad;font-size:11px}.recall p,.prompt p,.notes p{margin:5px 0 0;color:#666273;font-size:12px;line-height:1.6}.done{width:100%;margin-top:12px;color:#4f845f;background:#eff8f1;border-color:#dfefdf}.slide{display:flex;min-height:228px;flex-direction:column;justify-content:center;padding:25px 28px;margin:15px 0 12px;background:#fff;border:1px solid #e6e2f0;border-radius:17px;box-shadow:0 12px 28px #47377912}.slide h1{margin:8px 0;color:#343148;font-size:25px;line-height:1.22}.slide>p{margin:0;color:#666273;font-size:14px;line-height:1.75}.slide blockquote{padding:10px 13px;margin:13px 0 0;color:#584b95;background:#f5f2ff;border-left:3px solid #7a68ce;border-radius:0 8px 8px 0;font-size:12px;line-height:1.6}.progress{height:5px;overflow:hidden;margin:12px 0 0;background:#e8e4f1;border-radius:8px}.progress span{display:block;height:100%;background:linear-gradient(90deg,#ac91f5,#6553c2);transition:width .2s}@media(max-width:520px){.deck{padding:14px}.card{min-height:180px;padding:18px}.slide{min-height:200px;padding:19px}.slide h1{font-size:21px}.controls button{padding:0 8px}}
</style>`
  const document = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${policy}<title>${safeTopic} ${kind}</title>${style}</head><body><div id="app"></div>${bridge}</body></html>`
  return document
}

export function createLearningModuleFromContent(
  kind: EmbeddedLearningModule['kind'],
  rawArgs: Record<string, unknown>,
  lessonType: 'speaking' | 'writing' = 'speaking',
): EmbeddedLearningModule {
  if (!isRecord(rawArgs)) throw new Error('The learning module content was incomplete. Please try again.')
  const title = typeof rawArgs.title === 'string' ? rawArgs.title.trim() : ''
  const summary = typeof rawArgs.summary === 'string' ? rawArgs.summary.trim() : ''
  const topic = typeof rawArgs.topic === 'string' ? rawArgs.topic.trim().slice(0, 120) : ''
  if (!title || !summary || !topic) {
    throw new Error('Speakia returned an incomplete learning module. Please try again.')
  }
  const items = validateItems(rawArgs.items, kind)
  const id = crypto.randomUUID()
  return {
    id,
    kind,
    title: title.slice(0, 100),
    topic,
    summary: summary.slice(0, 500),
    items,
    html: makeDocument(kind, id, topic, items, lessonType),
    interactions: [],
  }
}

export async function createLearningModule(
  apiKey: string,
  kind: EmbeddedLearningModule['kind'],
  rawArgs: Record<string, unknown>,
  learnerContext: unknown,
  model: string = getProdiaTextModel(),
  abortSignal?: AbortSignal,
  lessonType: 'speaking' | 'writing' = 'speaking',
): Promise<EmbeddedLearningModule> {
  if (!apiKey.trim()) throw new Error('Add your Speakia AI API key in Settings to create this learning module.')
  if (!isRecord(rawArgs)) throw new Error('The learning module request was incomplete. Please try again.')
  const request = typeof rawArgs.request === 'string' ? rawArgs.request.trim().slice(0, 800) : ''
  if (request.length < 3) throw new Error('Tell Speakia what you want to study.')
  const skillName = lessonType === 'writing' ? 'Writing' : 'Speaking'
  const topic = typeof rawArgs.topic === 'string' && rawArgs.topic.trim() ? rawArgs.topic.trim().slice(0, 120) : `IELTS ${skillName}`
  const focus = typeof rawArgs.focus === 'string' && rawArgs.focus.trim() ? rawArgs.focus.trim().slice(0, 160) : `${skillName.toLocaleLowerCase()} test preparation`
  const level = typeof rawArgs.level === 'string' && rawArgs.level.trim() ? rawArgs.level.trim().slice(0, 100) : 'adapt to the supplied learner profile'
  const client = new GoogleGenAI({ apiKey: apiKey.trim() })
  const isFlashcards = kind === 'flashcards'
  const response = await client.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [{ text: JSON.stringify({ learnerContext, request, topic, focus, level, kind }) }],
    }],
    config: {
      responseMimeType: 'application/json',
      abortSignal,
      systemInstruction: isFlashcards
        ? `Design a personalized IELTS ${skillName} flashcard set. Include accurate, useful content with active recall, realistic examples and ${skillName.toLocaleLowerCase()} prompts. Adapt to the supplied learner and request. Return only JSON with title (string), summary (string), items (4–16 objects). Each item has title (term/question), body (meaning/model answer/key explanation), and optional example (string), prompt (string), answer (string).`
        : `Design a personalized visual mini slide deck for IELTS ${skillName}. Teach progressively with concise, accurate content, worked examples, and learner practice. Adapt to the supplied learner and request. Return only JSON with title (string), summary (string), items (4–12 objects). Each item has title (string), body (string), and optional example (string), prompt (string), answer (string, a useful coach note).`,
    },
  })
  const text = response.text?.trim()
  if (!text) throw new Error('Speakia AI returned an empty learning module. Please try again.')
  let decoded: unknown
  try {
    decoded = JSON.parse(text)
  } catch (error) {
    console.error('Speakia AI returned invalid JSON for an interactive learning module.', error)
    throw new Error('Speakia could not read the generated learning module. Please try again.')
  }
  if (!isRecord(decoded)) throw new Error('Speakia returned an incomplete learning module. Please try again.')
  return createLearningModuleFromContent(kind, { ...decoded, topic }, lessonType)
}
