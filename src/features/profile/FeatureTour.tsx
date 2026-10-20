import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileAudio,
  LayoutDashboard,
  Maximize2,
  Mic2,
  Minimize2,
  Podcast,
  Settings,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const features: { title: string; subtitle: string; description: string; example: string; icon: LucideIcon; color: string }[] = [
  {
    title: 'Your IELTS speaking studio',
    subtitle: 'A clearer path from practice to progress.',
    description: 'Your dashboard brings your goals, recent speaking activity, and suggested next steps together. Speakia Coach can guide you through the workspace by voice or text.',
    example: 'Ask the coach to open a page, explain its controls, or help you find what to practise next.',
    icon: Sparkles,
    color: 'violet',
  },
  {
    title: 'See your progress at a glance',
    subtitle: 'Your practice history, all in one place.',
    description: 'Track completed sessions, revisit transcripts and evaluations, and notice how your speaking practice develops over time.',
    example: 'Open a past test to review your answers and return to its detailed feedback.',
    icon: LayoutDashboard,
    color: 'blue',
  },
  {
    title: 'Practice with a live examiner',
    subtitle: 'Build confidence one answer at a time.',
    description: 'Take a timed Part 1, Part 2, Part 3, or full mock speaking test with a voice-based AI examiner.',
    example: 'Choose a part, speak naturally, and review your recorded session afterwards.',
    icon: Mic2,
    color: 'coral',
  },
  {
    title: 'Detailed IELTS evaluations',
    subtitle: 'Understand what to improve—and how.',
    description: 'Review practice band estimates and feedback for fluency, vocabulary, grammar, and pronunciation.',
    example: 'See your transcript, listen back to turns, and explore sentence-level corrections.',
    icon: Target,
    color: 'mint',
  },
  {
    title: 'Explore Lexis & Topics',
    subtitle: 'Ideas and language for richer answers.',
    description: 'Browse IELTS questions and cue cards in Topic Bank, then switch to Lexical Vault to collect useful expressions.',
    example: 'Filter Part 2 cue cards, find topic vocabulary, and save phrases to revisit.',
    icon: BookOpen,
    color: 'blue',
  },
  {
    title: 'Learn with interactive lessons',
    subtitle: 'Turn practice into active learning.',
    description: 'Work through guided IELTS lessons, quizzes, flashcards, and visual slide decks with Speakia Coach.',
    example: 'Ask the coach to create flashcards and navigate them together as you study.',
    icon: Sparkles,
    color: 'gold',
  },
  {
    title: 'Stay on track with assignments',
    subtitle: 'Small steps, tailored to your goals.',
    description: 'Use focused practice activities to build consistency and work on the areas that matter most to you.',
    example: 'Pick a coach-recommended activity and mark it complete when you finish.',
    icon: ClipboardCheck,
    color: 'peach',
  },
  {
    title: 'Learn from your own media',
    subtitle: 'Bring a recording. Get actionable feedback.',
    description: 'Submit a speaking audio recording or supported YouTube video for an IELTS-focused assessment.',
    example: 'Review criterion feedback, a transcript, and sentence-by-sentence suggestions.',
    icon: FileAudio,
    color: 'rose',
  },
  {
    title: 'Listen to your learning podcast',
    subtitle: 'Your goals, turned into a conversation.',
    description: 'Create a two-host episode with IELTS tips and relevant reflections on your saved Speakia practice.',
    example: 'Choose English, Urdu, Punjabi, or code switching for your episode.',
    icon: Podcast,
    color: 'indigo',
  },
  {
    title: 'Make Speakia yours',
    subtitle: 'Set up the tools that fit your learning.',
    description: 'Manage your API connection, evaluation and assistant models, appearance, and learner preferences from Settings and Profile.',
    example: 'Choose your assistant models, then set study goals and a target band.',
    icon: Settings,
    color: 'mint',
  },
]

export function FeatureTour() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const shouldReduceMotion = useReducedMotion()
  const activeFeature = features[activeIndex]
  const Icon = activeFeature.icon

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === document.querySelector('.feature-tour'))
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
      setActiveIndex((index) => (index + direction + features.length) % features.length)
    }
    window.addEventListener('keydown', handlePresentationKeys)
    return () => window.removeEventListener('keydown', handlePresentationKeys)
  }, [isFullscreen])

  function moveSlide(direction: -1 | 1) {
    setActiveIndex((index) => (index + direction + features.length) % features.length)
  }

  async function toggleFullscreen() {
    setFullscreenError('')
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        const tour = document.querySelector<HTMLElement>('.feature-tour')
        if (!tour?.requestFullscreen) throw new Error('Fullscreen presentation is not supported by this browser.')
        await tour.requestFullscreen()
      }
    } catch (error) {
      console.error('Unable to change feature-tour presentation mode.', error)
      setFullscreenError(error instanceof Error ? error.message : 'Unable to open the feature tour in fullscreen.')
    }
  }

  return <section className="feature-tour" aria-label="Discover Speakia IELTS">
    <div className="feature-tour-topline"><span><Sparkles size={14} /> A QUICK TOUR</span><button type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Exit full screen presentation' : 'Open full screen presentation'} title={isFullscreen ? 'Exit presenter view' : 'Open presenter view'}>{isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}<span>{isFullscreen ? 'Exit full screen' : 'Presenter view'}</span></button></div>
    <div className="feature-tour-stage" tabIndex={0} aria-label="Feature tour. Use the left and right arrow keys to move between features.">
      <div className={`feature-tour-art feature-tour-art-${activeFeature.color}`} aria-hidden="true">
        <div className="feature-tour-orbit feature-tour-orbit-one" />
        <div className="feature-tour-orbit feature-tour-orbit-two" />
        <motion.div key={activeFeature.title} className="feature-tour-icon" initial={shouldReduceMotion ? false : { opacity: 0, scale: .75, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 17 }}><Icon size={42} strokeWidth={1.6} /></motion.div>
        <span className="feature-tour-art-label">SPEAKIA IELTS · YOUR NEXT STEP</span>
      </div>
      <div className="feature-tour-copy">
        <span className="feature-tour-counter">FEATURE {String(activeIndex + 1).padStart(2, '0')} <i /> {String(features.length).padStart(2, '0')}</span>
        <AnimatePresence mode="wait">
          <motion.div key={activeFeature.title} initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }} transition={{ duration: .22 }}>
            <p className="feature-tour-subtitle">{activeFeature.subtitle}</p>
            <h2>{activeFeature.title}</h2>
            <p className="feature-tour-description">{activeFeature.description}</p>
            <div className="feature-tour-example"><span>TRY THIS</span><p>{activeFeature.example}</p></div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    <div className="feature-tour-footer">
      <div className="feature-tour-progress"><div className="feature-tour-dots" aria-label={`Feature ${activeIndex + 1} of ${features.length}`}>
        {features.map((feature, index) => <button type="button" key={feature.title} aria-label={`Show feature ${index + 1}: ${feature.title}`} aria-current={activeIndex === index ? 'step' : undefined} className={activeIndex === index ? 'feature-tour-dot-active' : ''} onClick={() => setActiveIndex(index)} />)}
      </div><span className="feature-tour-key-hint">Use ← / → to navigate</span></div>
      <div className="feature-tour-controls">
        <button type="button" className="feature-tour-previous" onClick={() => moveSlide(-1)} aria-label="Previous feature"><ArrowLeft size={17} /></button>
        <button type="button" className="feature-tour-next" onClick={() => moveSlide(1)}>{activeIndex === features.length - 1 ? 'Start again' : 'Next feature'} {activeIndex === features.length - 1 ? <X size={15} /> : <ArrowRight size={15} />}</button>
      </div>
    </div>
    {fullscreenError && <p className="feature-tour-error" role="alert">{fullscreenError}</p>}
  </section>
}
