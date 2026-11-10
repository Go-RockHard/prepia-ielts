import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  FileAudio,
  LayoutDashboard,
  Maximize2,
  Mic2,
  Minimize2,
  PenLine,
  Pencil,
  Plus,
  Podcast,
  Radio,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface FeatureSlide {
  id: string
  title: string
  subtitle: string
  definition: string
  keyPoints: string[]
  icon: string
  color: string
}

const STORAGE_KEY = 'prodia-feature-tour-slides-v2'
const LEGACY_STORAGE_KEY = 'speakia-feature-tour-slides-v1'
const iconOptions: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  microphone: Mic2,
  radio: Radio,
  target: Target,
  coach: Sparkles,
  book: BookOpen,
  flashcards: ClipboardCheck,
  media: FileAudio,
  podcast: Podcast,
  writing: PenLine,
  settings: Settings,
}
const colorOptions = ['violet', 'coral', 'mint', 'blue', 'gold', 'peach', 'rose', 'indigo']

const defaultSlides: FeatureSlide[] = [
  {
    id: 'prodia-introduction',
    title: 'One IELTS journey. Two skills, built to grow.',
    subtitle: 'Meet Prodia: your dedicated home for productive skills.',
    definition: 'Prodia brings together two purpose-built AI coaching platforms: Speakia for IELTS Speaking and Writia for IELTS Writing. Each platform has its own focused tools and learner profile, connected in one learning ecosystem.',
    keyPoints: ['Practise speaking with Speakia', 'Plan, write, and improve with Writia', 'Build both productive skills in one Prodia ecosystem'],
    icon: 'dashboard',
    color: 'violet',
  },
  {
    id: 'live-examiner',
    title: 'Practise with a live examiner',
    subtitle: 'Build real speaking confidence, one answer at a time.',
    definition: 'Exam Simulation provides live examiner-led practice for individual IELTS Speaking parts or a complete test, with Part 2 cue cards drawn from Topic Bank.',
    keyPoints: ['Choose a part or complete mock test and follow the active test stage', 'Use Topic Bank cue cards for Part 2 or let the examiner choose', 'Review your recording and transcript, then select an assessment model'],
    icon: 'microphone',
    color: 'coral',
  },
  {
    id: 'ai-simulation',
    title: 'Watch an IELTS test unfold',
    subtitle: 'Two AI voices. A new way to learn by listening.',
    definition: 'AI-to-AI Simulation lets you listen to a Speakia examiner and candidate complete a practice exchange, without needing to use your microphone.',
    keyPoints: ['Choose Part 1, Part 2, Part 3, or a full test', 'Follow the spoken exchange with a live transcript', 'Replay saved audio and revisit transcripts in the archive'],
    icon: 'radio',
    color: 'blue',
  },
  {
    id: 'assessment-feedback',
    title: 'Turn feedback into progress',
    subtitle: 'Make every insight a practical next step.',
    definition: 'Speaking assessments give criterion-based feedback to help you understand your performance and choose a useful next step. Practice feedback is formative, not an official IELTS score.',
    keyPoints: ['Review fluency and coherence, lexical resource, grammar, and pronunciation', 'Revisit transcripts, recordings, and sentence-level suggestions', 'Choose an assessment model for a new or saved recording'],
    icon: 'target',
    color: 'mint',
  },
  {
    id: 'speakia-coach',
    title: 'Meet Speakia Coach',
    subtitle: 'An always-ready learning partner, built around your goals.',
    definition: 'Speakia Coach connects conversation with the learning workspace, helping you explore IELTS topics, get explanations, and create practice materials.',
    keyPoints: ['Ask questions in chat or use live voice', 'Create lessons, quizzes, audio activities, flashcards, and slide decks', 'Find generated learning materials again in Coach Assets'],
    icon: 'coach',
    color: 'indigo',
  },
  {
    id: 'ai-learning-engine',
    title: 'AI that turns insight into action',
    subtitle: 'A game-changing shift: from asking a question to practising a skill.',
    definition: 'Speakia brings together speaking assessment feedback, guided practice, and generated learning activities so you can put new ideas into practice.',
    keyPoints: ['Turn speaking feedback into a focused practice session', 'Explore explanations and practise with AI-generated activities', 'Continue learning with saved Coach lessons and activities'],
    icon: 'coach',
    color: 'violet',
  },
  {
    id: 'interactive-learning',
    title: 'Learn by doing—not just reading',
    subtitle: 'Turn a question into an interactive learning moment.',
    definition: 'Speakia Coach can create interactive lessons, quizzes, audio activities, flashcards, and slide decks. Your generated materials are collected in Coach Assets.',
    keyPoints: ['Practise a skill in short, interactive activities', 'Return to generated learning materials from your Coach library', 'Build from explanations into active practice'],
    icon: 'book',
    color: 'gold',
  },
  {
    id: 'flashcards',
    title: 'Build vocabulary that lasts',
    subtitle: 'The right review, at the right time.',
    definition: 'Speakia Flashcards uses spaced repetition to revisit vocabulary saved from Lexical Vault and Vocabulary Upgrade, helping you strengthen recall over time.',
    keyPoints: ['Study saved words and phrases in focused sessions', 'Rate how well you remembered each card', 'Use Vocabulary Upgrade categories, including sentence starters'],
    icon: 'flashcards',
    color: 'peach',
  },
  {
    id: 'talking-templates',
    title: 'Practise with Answer Builder',
    subtitle: 'Learn the shape of a strong answer—then make it yours.',
    definition: 'Answer Builder stays in sync with Topic Bank and pairs speaking prompts with model responses, useful structures, and vocabulary. Practise with two AI voices or take the candidate’s turn with Speakia.',
    keyPoints: ['Explore Part 1, Part 2, Part 3, and full-test examples', 'Practise live and review your candidate-to-AI transcript', 'Track answer-building mastery across relevance, structure, development, and language'],
    icon: 'book',
    color: 'rose',
  },
  {
    id: 'lexis-topics',
    title: 'Connect topics with the language to express them',
    subtitle: 'Ideas and vocabulary, ready when you need them.',
    definition: 'Vocabulary Studio brings Topic Bank, Vocabulary Bank, and Vocabulary Upgrade together. Topic Bank questions and cue cards also power practice in Exam Simulation and Answer Builder.',
    keyPoints: ['Browse Part 1, Part 2, Part 3, and full-test question sets', 'Explore and save topic vocabulary, expressions, and collocations', 'Practise upgrading everyday words to precise IELTS vocabulary and use flexible sentence starters in Vocabulary Upgrade'],
    icon: 'book',
    color: 'blue',
  },
  {
    id: 'media-assessment',
    title: 'Bring your own speaking into the picture',
    subtitle: 'Your recording becomes a starting point for growth.',
    definition: 'Media Assessments analyses an audio recording or supported public YouTube video and presents an IELTS-focused review with a visible assessment timer.',
    keyPoints: ['Choose an assessment model before submitting audio or a video URL', 'Review the transcript, four criteria, and sentence-level feedback', 'See how long the assessment took and revisit saved results'],
    icon: 'media',
    color: 'rose',
  },
  {
    id: 'steady-progress',
    title: 'Make progress part of your routine',
    subtitle: 'Small, focused steps can add up to real momentum.',
    definition: 'Assignments support focused study, while Speakia Podcasts offers recorded and live learning episodes that you can return to from the archive.',
    keyPoints: ['Work through assigned practice and track completion', 'Explore podcast episodes and follow their transcripts', 'Replay saved audio, including completed live podcasts'],
    icon: 'podcast',
    color: 'indigo',
  },
  {
    id: 'guided-practice',
    title: 'Choose how you want to practise',
    subtitle: 'One library of focused speaking modes. Four criteria in every session.',
    definition: 'Guided Practice brings its modes together in one library, including live feedback, tips, model answers, Live Template, and Criterion Builder.',
    keyPoints: ['Practise with feedback, answer frameworks, or a focused challenge', 'Use Criterion Builder to target one or more IELTS speaking criteria', 'Keep session transcripts and available audio in your archive'],
    icon: 'target',
    color: 'violet',
  },
  {
    id: 'personalise-speakia',
    title: 'Make Speakia yours',
    subtitle: 'A learning experience that fits the way you work.',
    definition: 'Profile and Settings let you tailor your learning goals, target band, appearance, Speakia AI connection, and the models used by Coach and assessments.',
    keyPoints: ['Set a target band and study preferences', 'Configure your AI connection and model choices', 'Shape a workspace that supports your learning'],
    icon: 'settings',
    color: 'mint',
  },
  {
    id: 'writia',
    title: 'Build confidence in IELTS writing',
    subtitle: 'Plan, draft, and improve with Writia.',
    definition: 'Writia is Prodia’s dedicated IELTS Writing platform for Academic and General Training, with structured tasks, adaptive coaching, and criterion-based feedback.',
    keyPoints: ['Practise IELTS writing tasks and organize your response', 'Review feedback and suggestions as you revise', 'Track writing progress in a dedicated learner profile'],
    icon: 'writing',
    color: 'coral',
  },
  {
    id: 'writia-writing-studio',
    title: 'Turn a writing prompt into a polished response',
    subtitle: 'A focused space to plan, compose, and revise.',
    definition: 'Writing Studio guides you through IELTS Writing Task 1 and Task 2, helping you work on the response while Writia Coach provides task-aware support.',
    keyPoints: ['Work with Academic or General Training tasks', 'Develop your response with planning and revision support', 'Share a task snapshot with Writia Coach for focused feedback'],
    icon: 'writing',
    color: 'violet',
  },
  {
    id: 'writia-guided-practice',
    title: 'Strengthen the writing skill you need next',
    subtitle: 'Focused drills and guided practice, at your pace.',
    definition: 'Writia Guided Practice and Writing Drills offer targeted ways to practise writing, build confidence, and work on improvements between full tasks.',
    keyPoints: ['Choose guided writing activities for structured support', 'Practise specific skills with focused drills', 'Use feedback to decide what to work on next'],
    icon: 'target',
    color: 'mint',
  },
  {
    id: 'writia-coach',
    title: 'Meet Writia Coach',
    subtitle: 'Writing-aware help, right where you need it.',
    definition: 'Writia Coach supports writing tasks with in-context guidance and shares Prodia-wide learning tools, while keeping its coaching grounded in the Writia writing experience.',
    keyPoints: ['Ask about your prompt, ideas, structure, or draft', 'Share a written task snapshot to discuss or assess your work', 'Create learning materials and revisit them in Writia Coach Assets'],
    icon: 'coach',
    color: 'indigo',
  },
  {
    id: 'writia-learning-toolkit',
    title: 'Build the language and knowledge behind your writing',
    subtitle: 'A connected toolkit for ideas, practice, and review.',
    definition: 'Writia brings together writing topics and vocabulary, flashcards, learning resources, podcasts, and assignments to support steady IELTS preparation.',
    keyPoints: ['Explore writing topics and vocabulary for developing ideas', 'Revisit saved language with Writia Flashcards', 'Continue learning with resources, podcasts, and assignments'],
    icon: 'book',
    color: 'blue',
  },
  {
    id: 'writia-progress',
    title: 'See your writing progress take shape',
    subtitle: 'Understand your performance and choose a next step.',
    definition: 'Writia Performance History and its learner profile help you revisit writing work and follow your development, with IELTS band descriptors and placement assessment available as learning guides.',
    keyPoints: ['Review past writing practice and assessment feedback', 'Use band descriptors to understand IELTS writing criteria', 'Start with placement assessment and set a focused learning direction'],
    icon: 'flashcards',
    color: 'gold',
  },
]

function isFeatureSlide(value: unknown): value is FeatureSlide {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const slide = value as Record<string, unknown>
  return typeof slide.id === 'string'
    && typeof slide.title === 'string'
    && typeof slide.subtitle === 'string'
    && typeof slide.definition === 'string'
    && Array.isArray(slide.keyPoints)
    && slide.keyPoints.length <= 8
    && slide.keyPoints.every((point) => typeof point === 'string')
    && typeof slide.icon === 'string' && slide.icon in iconOptions
    && typeof slide.color === 'string' && colorOptions.includes(slide.color)
}

function loadSlides(): { slides: FeatureSlide[]; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isFeatureSlide)
        || new Set(parsed.map((slide: FeatureSlide) => slide.id)).size !== parsed.length) {
        throw new Error('The saved presentation is not in a supported format.')
      }
      return { slides: parsed, error: '' }
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return { slides: defaultSlides, error: '' }
    const parsedLegacy: unknown = JSON.parse(legacy)
    if (!Array.isArray(parsedLegacy) || !parsedLegacy.every(isFeatureSlide)
      || new Set(parsedLegacy.map((slide: FeatureSlide) => slide.id)).size !== parsedLegacy.length) {
      throw new Error('The saved presentation is not in a supported format.')
    }
    const builtInIds = new Set([
      ...defaultSlides.map((slide) => slide.id),
      'speaking-studio',
      'live-examiner',
      'ai-simulation',
      'assessment-feedback',
      'speakia-coach',
      'ai-learning-engine',
      'interactive-learning',
      'flashcards',
      'talking-templates',
      'lexis-topics',
      'media-assessment',
      'steady-progress',
      'guided-practice',
      'writia',
      'personalise-speakia',
    ])
    const customSlides = parsedLegacy.filter((slide: FeatureSlide) => !builtInIds.has(slide.id))
    return { slides: [...defaultSlides, ...customSlides], error: '' }
  } catch (error) {
    console.error('Unable to load the saved feature-tour presentation.', error)
    return {
      slides: defaultSlides,
      error: error instanceof Error ? error.message : 'The saved presentation could not be loaded.',
    }
  }
}

function newSlide(): FeatureSlide {
  return {
    id: crypto.randomUUID(),
    title: 'A new Prodia feature',
    subtitle: 'Add a compelling subcaption',
    definition: 'Describe what this feature makes possible for learners.',
    keyPoints: ['Add a key point', 'Show the learner benefit', 'Connect the feature to progress'],
    icon: 'coach',
    color: 'violet',
  }
}

export function FeatureTour() {
  const [deckState, setDeckState] = useState(loadSlides)
  const [activeId, setActiveId] = useState(deckState.slides[0].id)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const [editing, setEditing] = useState(false)
  const [search, setSearch] = useState('')
  const [storageError, setStorageError] = useState(deckState.error)
  const tourRef = useRef<HTMLElement | null>(null)
  const shouldReduceMotion = useReducedMotion()
  const slides = deckState.slides
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.id === activeId))
  const activeSlide = slides[activeIndex]
  const Icon = iconOptions[activeSlide.icon] ?? Sparkles
  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return []
    return slides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide }) => [slide.title, slide.subtitle, slide.definition, ...slide.keyPoints].join(' ').toLocaleLowerCase().includes(query))
  }, [search, slides])

  function saveSlides(nextSlides: FeatureSlide[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSlides))
      setStorageError('')
    } catch (error) {
      console.error('Unable to save the feature-tour presentation.', error)
      setStorageError(error instanceof Error ? error.message : 'Your presentation changes could not be saved in this browser.')
    }
  }

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === tourRef.current)
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => document.removeEventListener('fullscreenchange', updateFullscreen)
  }, [])

  useEffect(() => {
    function handlePresentationKeys(event: KeyboardEvent) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, select, textarea, [contenteditable="true"]')) return
      const tour = document.querySelector('.feature-tour')
      const inTour = target instanceof Node && tour?.contains(target)
      if (!isFullscreen && !inTour) return
      event.preventDefault()
      const direction = event.key === 'ArrowRight' ? 1 : -1
      setActiveId((currentId) => {
        const currentIndex = Math.max(0, slides.findIndex((slide) => slide.id === currentId))
        return slides[(currentIndex + direction + slides.length) % slides.length].id
      })
    }
    window.addEventListener('keydown', handlePresentationKeys)
    return () => window.removeEventListener('keydown', handlePresentationKeys)
  }, [isFullscreen, slides])

  function updateSlide(id: string, update: Partial<FeatureSlide>) {
    const nextSlides = slides.map((slide) => slide.id === id ? { ...slide, ...update } : slide)
    setDeckState((current) => ({ ...current, slides: nextSlides }))
    saveSlides(nextSlides)
  }

  function moveSlide(direction: -1 | 1) {
    setActiveId(slides[(activeIndex + direction + slides.length) % slides.length].id)
  }

  function addSlide() {
    const slide = newSlide()
    const nextSlides = [...slides, slide]
    setDeckState((current) => ({ ...current, slides: nextSlides }))
    saveSlides(nextSlides)
    setActiveId(slide.id)
    setEditing(true)
    setSearch('')
  }

  function removeSlide() {
    if (slides.length === 1) {
      setStorageError('A presentation must contain at least one slide.')
      return
    }
    const nextSlides = slides.filter((slide) => slide.id !== activeId)
    setDeckState((current) => ({ ...current, slides: nextSlides }))
    saveSlides(nextSlides)
    setActiveId(nextSlides[Math.min(activeIndex, nextSlides.length - 1)].id)
  }

  function updateKeyPoint(index: number, value: string) {
    updateSlide(activeId, { keyPoints: activeSlide.keyPoints.map((point, pointIndex) => pointIndex === index ? value : point) })
  }

  function addKeyPoint() {
    if (activeSlide.keyPoints.length >= 8) {
      setStorageError('A slide can contain up to eight key points.')
      return
    }
    updateSlide(activeId, { keyPoints: [...activeSlide.keyPoints, 'New key point'] })
  }

  async function toggleFullscreen() {
    setFullscreenError('')
    try {
      if (document.fullscreenElement === tourRef.current) {
        await document.exitFullscreen()
      } else {
        const tour = tourRef.current
        if (!tour?.requestFullscreen) throw new Error('Fullscreen presentation is not supported by this browser.')
        await tour.requestFullscreen()
      }
    } catch (error) {
      console.error('Unable to change feature-tour presentation mode.', error)
      setFullscreenError(error instanceof Error ? error.message : 'Unable to open the feature tour in fullscreen.')
    }
  }

  async function toggleEditing() {
    setFullscreenError('')
    if (editing) {
      setEditing(false)
      if (document.fullscreenElement === tourRef.current) {
        try {
          await document.exitFullscreen()
        } catch (error) {
          console.error('Unable to exit the feature-tour editor.', error)
          setFullscreenError(error instanceof Error ? error.message : 'Unable to exit fullscreen editing.')
        }
      }
      return
    }

    setEditing(true)
    try {
      const tour = tourRef.current
      if (!tour?.requestFullscreen) throw new Error('Fullscreen editing is not supported by this browser.')
      if (document.fullscreenElement !== tour) await tour.requestFullscreen()
    } catch (error) {
      console.error('Unable to open the feature-tour editor in fullscreen.', error)
      setFullscreenError(error instanceof Error ? error.message : 'Unable to open fullscreen editing.')
    }
  }

  return <section ref={tourRef} className={`feature-tour ${editing ? 'feature-tour-editing' : ''}`} aria-label="Discover Prodia's Speakia and Writia ecosystem">
    <div className="feature-tour-topline">
      <span><Sparkles size={14} /> PRODIA · FEATURE STORY</span>
      <div className="feature-tour-tools">
        <label className="feature-tour-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a slide…" aria-label="Search slides by text" /><span>{search ? `${searchResults.length} found` : `${slides.length} slides`}</span></label>
        {search.trim() && <div className="feature-tour-search-results" role="listbox" aria-label="Matching slides">
          {searchResults.length ? searchResults.map(({ slide, index }) => <button type="button" role="option" aria-selected={slide.id === activeId} key={slide.id} onClick={() => { setActiveId(slide.id); setSearch('') }}><span>{String(index + 1).padStart(2, '0')}</span><span><strong>{slide.title || 'Untitled slide'}</strong><small>{slide.subtitle || slide.definition}</small></span></button>) : <p>No matching slides.</p>}
        </div>}
        <button type="button" className={`feature-tour-edit-button ${editing ? 'feature-tour-tool-active' : ''}`} onClick={() => void toggleEditing()} aria-pressed={editing}><Pencil size={15} /><span>{editing ? 'Done editing' : 'Edit deck'}</span></button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Exit full screen presentation' : 'Open full screen presentation'} title={isFullscreen ? 'Exit presenter view' : 'Open presenter view'}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{isFullscreen ? 'Exit' : 'Present'}</span></button>
      </div>
    </div>
    <div className="feature-tour-body">
      <div className="feature-tour-stage" tabIndex={0} aria-label="Presentation slide. Use the left and right arrow keys to navigate.">
        <div className={`feature-tour-art feature-tour-art-${activeSlide.color}`} aria-hidden="true">
          <div className="feature-tour-orbit feature-tour-orbit-one" />
          <div className="feature-tour-orbit feature-tour-orbit-two" />
          <motion.div key={activeSlide.id} className="feature-tour-icon" initial={shouldReduceMotion ? false : { opacity: 0, scale: .75, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 17 }}><Icon size={42} strokeWidth={1.6} /></motion.div>
          <span className="feature-tour-art-label">PRACTICE · LEARN · PROGRESS</span>
        </div>
        <div className="feature-tour-copy">
          <span className="feature-tour-counter">SLIDE {String(activeIndex + 1).padStart(2, '0')} <i /> {String(slides.length).padStart(2, '0')}</span>
          <AnimatePresence mode="wait">
            <motion.div key={activeSlide.id} initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }} transition={{ duration: .22 }}>
              <p className="feature-tour-subtitle">{activeSlide.subtitle || 'Add a subcaption in Edit deck'}</p>
              <h2>{activeSlide.title || 'Untitled slide'}</h2>
              <p className="feature-tour-definition">{activeSlide.definition}</p>
              <div className="feature-tour-points"><span>THE LEARNER ADVANTAGE</span><ul>{activeSlide.keyPoints.map((point, index) => <li key={`${activeSlide.id}-point-${index}`}><Check size={15} /><span>{point}</span></li>)}</ul></div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {editing && <div className="feature-tour-editor" aria-label="Edit current slide">
        <div className="feature-tour-editor-heading"><div><span>SLIDE {String(activeIndex + 1).padStart(2, '0')} · EDITOR</span><strong>Shape the story</strong></div><button type="button" className="feature-tour-delete" onClick={removeSlide} aria-label="Remove current slide" title="Remove current slide"><Trash2 size={15} /><span>Remove slide</span></button></div>
        <label>Title<input maxLength={100} value={activeSlide.title} onChange={(event) => updateSlide(activeId, { title: event.target.value })} /></label>
        <label>Subcaption<input maxLength={150} value={activeSlide.subtitle} onChange={(event) => updateSlide(activeId, { subtitle: event.target.value })} /></label>
        <label>Definition<textarea rows={3} maxLength={700} value={activeSlide.definition} onChange={(event) => updateSlide(activeId, { definition: event.target.value })} /></label>
        <div className="feature-tour-editor-points"><span>Key points</span>{activeSlide.keyPoints.map((point, index) => <div key={`${activeSlide.id}-edit-point-${index}`}><input aria-label={`Key point ${index + 1}`} maxLength={180} value={point} onChange={(event) => updateKeyPoint(index, event.target.value)} /><button type="button" aria-label={`Remove key point ${index + 1}`} onClick={() => updateSlide(activeId, { keyPoints: activeSlide.keyPoints.filter((_, pointIndex) => pointIndex !== index) })}><X size={14} /></button></div>)}<button type="button" className="feature-tour-add-point" onClick={addKeyPoint}><Plus size={13} /> Add key point</button></div>
        <div className="feature-tour-editor-options"><label>Icon<select value={activeSlide.icon} onChange={(event) => updateSlide(activeId, { icon: event.target.value })}>{Object.keys(iconOptions).map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label><label>Accent<select value={activeSlide.color} onChange={(event) => updateSlide(activeId, { color: event.target.value })}>{colorOptions.map((color) => <option key={color} value={color}>{color}</option>)}</select></label></div>
        <button type="button" className="feature-tour-add-slide" onClick={addSlide}><Plus size={15} /> Add slide</button>
      </div>}
    </div>
    <div className="feature-tour-footer">
      <div className="feature-tour-progress"><div className="feature-tour-dots" aria-label={`Slide ${activeIndex + 1} of ${slides.length}`}>
        {slides.map((slide, index) => <button type="button" key={slide.id} aria-label={`Show slide ${index + 1}: ${slide.title || 'Untitled'}`} aria-current={activeId === slide.id ? 'step' : undefined} className={activeId === slide.id ? 'feature-tour-dot-active' : ''} onClick={() => setActiveId(slide.id)} />)}
      </div><span className="feature-tour-key-hint">← / → to navigate</span></div>
      <div className="feature-tour-controls">
        <button type="button" className="feature-tour-previous" onClick={() => moveSlide(-1)} aria-label="Previous slide"><ArrowLeft size={17} /></button>
        <button type="button" className="feature-tour-next" onClick={() => moveSlide(1)}>{activeIndex === slides.length - 1 ? 'Start again' : 'Next slide'} {activeIndex === slides.length - 1 ? <X size={15} /> : <ArrowRight size={15} />}</button>
      </div>
    </div>
    {(storageError || fullscreenError) && <p className="feature-tour-error" role="alert">{storageError || fullscreenError}</p>}
  </section>
}
