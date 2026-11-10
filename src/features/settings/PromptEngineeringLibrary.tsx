import { BookOpen, PenLine, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SpeakiaPromptLibrary } from './SpeakiaPromptLibrary'
import { WritiaPromptLibrary } from './WritiaPromptLibrary'

type PromptLibraryPlatform = 'speakia' | 'writia' | null

export function PromptEngineeringLibrary({ onBack }: { onBack: () => void }) {
  const [selectedPlatform, setSelectedPlatform] = useState<PromptLibraryPlatform>(null)

  if (selectedPlatform === 'speakia') return <SpeakiaPromptLibrary onBack={() => setSelectedPlatform(null)} />
  if (selectedPlatform === 'writia') return <WritiaPromptLibrary onBack={() => setSelectedPlatform(null)} />

  return <div className="page-content inner-page prompt-library-page">
    <div className="inner-page-heading">
      <div><p className="eyebrow">SHARED PLATFORM RESOURCES</p><h1>Prompt Engineering / Library</h1><p className="page-subtitle">Choose the platform-specific prompt library. Speakia and Writia have separate coaching and assessment instructions.</p></div>
      <Button variant="outline" onClick={onBack}><BookOpen size={15} /> Back to Settings</Button>
    </div>
    <div className="prompt-library-platform-grid">
      <Card className="prompt-library-platform-card prompt-library-speaking-card">
        <span className="prompt-library-platform-icon"><Sparkles size={20} /></span>
        <div className="prompt-library-platform-copy"><h2>Speakia IELTS</h2><p>Explore the live instructions behind speaking coaching, examiner simulations, assessments, drills, and learning tools.</p></div>
        <Button onClick={() => setSelectedPlatform('speakia')}>Open Speakia library <PenLine size={14} /></Button>
      </Card>
      <Card className="prompt-library-platform-card prompt-library-writing-card">
        <span className="prompt-library-platform-icon"><PenLine size={20} /></span>
        <div className="prompt-library-platform-copy"><h2>Writia IELTS</h2><p>Explore writing-coach guidance, real-time scaffolding, assessment, task-bank, and exam-simulation boundaries.</p></div>
        <Button onClick={() => setSelectedPlatform('writia')}>Open Writia library <PenLine size={14} /></Button>
      </Card>
    </div>
  </div>
}
