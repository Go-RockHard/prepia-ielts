import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, Clock3, History, Lightbulb, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SkillPracticeRunner, type LiteracyView } from '@/features/skills/SkillPracticeRunner'
import { LiteracyContentStudio } from '@/features/skills/LiteracyContentStudio'
import { loadLocalContentPackages, loadSkillAttempts, type LocalContentPackage, type SkillAttempt } from '@/features/skills/literacyStorage'
import { getAccuracyTrend } from '@/features/skills/literacyAnalytics'
import { LiteracyAssistant } from '@/features/skills/LiteracyAssistant'
import { LiteracyAssignmentsPage, LiteracyDrillsPage, LiteracyLearnerProfile, LiteracyPlacementPage } from '@/features/skills/LiteracyWorkspacePages'
import { CoachAssetsPage } from '@/features/assistant/CoachAssetsPage'
import type { EmbeddedLearningModule } from '@/features/assistant/learningModules'
import type { InteractiveLesson } from '@/features/assistant/interactiveLesson'
import { PodcastsPage } from '@/features/podcasts/PodcastsPage'
import { readingSets } from '@/features/readia/readingSets'
import type { AssistantModel } from '@/features/assistant/models'
import type { UserProfile } from '@/features/profile/localAccount'

type PracticeMode = 'exam' | 'guided'

export function ReadiaPage({ username, profile, testType, view, onViewChange, apiKey, onOpenSettings, onSaveProfile, targetBand, studyGoal, chatModel, toolModel, onChatModelChange }: {
  username: string
  profile: UserProfile
  testType: 'Academic' | 'General Training'
  view: LiteracyView
  onViewChange: (view: LiteracyView) => void
  apiKey: string
  onOpenSettings: () => void
  onSaveProfile: (profile: UserProfile) => Promise<void>
  targetBand?: string
  studyGoal?: string
  chatModel: AssistantModel
  toolModel: AssistantModel
  onChatModelChange: (model: AssistantModel) => void
}) {
  const [mode, setMode] = useState<PracticeMode>('exam')
  const [selectedSetId, setSelectedSetId] = useState(readingSets[0]?.id ?? '')
  const [packages, setPackages] = useState<LocalContentPackage[]>([])
  const [attempts, setAttempts] = useState<SkillAttempt[]>([])
  const [storageError, setStorageError] = useState('')
  const placementRunActive = useRef(false)
  const sets = useMemo(() => [...readingSets, ...packages.filter((content) => content.status !== 'archived').map((content) => content.set)], [packages])
  const selectedSet = sets.find((set) => set.id === selectedSetId) ?? sets[0]
  const selectedPackage = packages.find((content) => content.set.id === selectedSet?.id)
  const totalMarks = attempts.reduce((total, attempt) => total + attempt.total, 0)
  const earnedMarks = attempts.reduce((total, attempt) => total + attempt.score, 0)
  const averageMinutes = attempts.length ? Math.round(attempts.reduce((total, attempt) => total + attempt.elapsedSeconds, 0) / attempts.length / 60) : 0
  const questionTypeScores = attempts.reduce<Record<string, { score: number; total: number }>>((summary, attempt) => {
    Object.entries(attempt.questionTypeScores ?? {}).forEach(([type, value]) => {
      const current = summary[type] ?? { score: 0, total: 0 }
      summary[type] = { score: current.score + value.score, total: current.total + value.total }
    })
    return summary
  }, {})
  const accuracyTrend = getAccuracyTrend(attempts)
  const changeView = useCallback((nextView: LiteracyView) => {
    if (nextView !== 'practice') placementRunActive.current = false
    onViewChange(nextView)
  }, [onViewChange])
  const handlePlacementCompletion = useCallback((attempt: SkillAttempt) => {
    if (!placementRunActive.current) return
    placementRunActive.current = false
    const updatedProfile: UserProfile = {
      ...profile,
      readingPlacementBaseline: { score: attempt.score, total: attempt.total, completedAt: attempt.completedAt },
    }
    void onSaveProfile(updatedProfile).then(() => {
      changeView('placement')
    }).catch((error: unknown) => {
      console.error('Unable to save the Readia placement baseline.', error)
      setStorageError(error instanceof Error ? error.message : 'The Reading placement baseline could not be saved.')
    })
  }, [changeView, onSaveProfile, profile])

  useEffect(() => {
    if (view !== 'practice') placementRunActive.current = false
  }, [view])

  useEffect(() => {
    let active = true
    void Promise.all([loadLocalContentPackages('readia'), loadSkillAttempts(username, 'readia')]).then(([savedPackages, savedAttempts]) => {
      if (!active) return
      setPackages(savedPackages)
      setAttempts(savedAttempts)
      setStorageError('')
    }).catch((error: unknown) => {
      console.error('Unable to load Readia content or practice history.', error)
      if (active) setStorageError(error instanceof Error ? error.message : 'Readia local data could not be loaded.')
    })
    return () => { active = false }
  }, [username, view])

  if (view === 'content') return <>
    <LiteracyContentStudio
      product="readia"
      username={username}
      apiKey={apiKey}
      testType={testType}
      onBack={() => changeView('home')}
      onOpenPractice={(content) => {
        placementRunActive.current = false
        setPackages((current) => [content, ...current.filter((item) => item.id !== content.id)])
        setSelectedSetId(content.set.id)
        changeView('practice')
      }}
    />
    <LiteracyAssistant key={username} product="readia" apiKey={apiKey} username={username} profile={profile} testType={testType} targetBand={targetBand} studyGoal={studyGoal} currentSet={selectedSet} currentView={view} practiceMode={mode} chatModel={chatModel} toolModel={toolModel} onChatModelChange={onChatModelChange} />
  </>

  if (view === 'learner-profile') return <LiteracyLearnerProfile product="readia" profile={profile} attempts={attempts} onSave={onSaveProfile} />

  if (view === 'drills') return <LiteracyDrillsPage product="readia" username={username} testType={testType} apiKey={apiKey} packages={packages} onPractice={(content) => {
    setPackages((current) => [content, ...current.filter((item) => item.id !== content.id)])
    setSelectedSetId(content.set.id)
    setMode('guided')
    placementRunActive.current = false
    changeView('practice')
  }} />

  if (view === 'assignments') return <LiteracyAssignmentsPage username={username} product="readia" sets={sets} attempts={attempts} onPractice={(setId) => {
    setSelectedSetId(setId)
    setMode('guided')
    placementRunActive.current = false
    changeView('practice')
  }} />

  if (view === 'placement') return <LiteracyPlacementPage product="readia" sets={sets} baseline={profile.readingPlacementBaseline} onStart={(setId) => {
    setSelectedSetId(setId)
    setMode('exam')
    placementRunActive.current = true
    changeView('practice')
  }} />

  if (view === 'coach-assets') return <CoachAssetsPage platform="reading" onOpenCoach={() => {
    setMode('guided')
    changeView('practice')
  }} onAdapt={(asset: InteractiveLesson | EmbeddedLearningModule) => {
    window.dispatchEvent(new CustomEvent('speakia:coach-adapt-asset', { detail: asset }))
  }} />

  if (view === 'podcasts') return <PodcastsPage username={username} profile={profile} apiKey={apiKey} results={[]} lexicalEntries={[]} assignments={[]} product="readia" literacyAttempts={attempts} />

  if (view === 'practice' && selectedSet) {
    return <div className="page-content inner-page literacy-page literacy-readia">
      <header className="literacy-heading"><div><p className="eyebrow">PREPIA IELTS · READING PRACTICE</p><h1>Readia</h1><p className="page-subtitle">Read closely, locate evidence, and check each answer against the passage.</p></div><span className="literacy-heading-icon"><BookOpen size={24} /></span></header>
      {storageError && <p className="literacy-error" role="alert">{storageError}</p>}
      <SkillPracticeRunner
        key={`${selectedSet.id}-${mode}`}
        product="readia"
        sets={sets}
        username={username}
        onExit={() => changeView('home')}
        onOpenProgress={() => changeView('progress')}
        apiKey={apiKey}
        onOpenSettings={onOpenSettings}
        learnerGoal={studyGoal}
        initialSetId={selectedSet.id}
        initialMode={mode}
        topicExposureId={selectedPackage?.exposureId}
        topicId={selectedPackage?.topicId}
        onSelectedSetChange={setSelectedSetId}
        onCompleted={handlePlacementCompletion}
      />
      <LiteracyAssistant key={username} product="readia" apiKey={apiKey} username={username} profile={profile} testType={testType} targetBand={targetBand} studyGoal={studyGoal} currentSet={selectedSet} currentView={view} practiceMode={mode} chatModel={chatModel} toolModel={toolModel} onChatModelChange={onChatModelChange} />
    </div>
  }
  if (view === 'progress' || view === 'performance-history') {
    return <div className="page-content inner-page literacy-page literacy-readia">
      <header className="literacy-heading"><div><p className="eyebrow">PREPIA IELTS · READING WORKSPACE</p><h1>Readia progress</h1><p className="page-subtitle">Review your reading practice history and accuracy over time.</p></div><span className="literacy-heading-icon"><History size={24} /></span></header>
      <Card className="literacy-progress readia-progress"><div className="literacy-section-heading"><div><span className="section-kicker">READING HISTORY</span><h2>Completed reading sets</h2></div><span>{attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}</span></div>
        {storageError && <p className="literacy-error" role="alert">{storageError}</p>}
        {attempts.length > 0 && <div className="literacy-analytics-grid"><Card><span className="section-kicker">OVERALL ACCURACY</span><strong>{Math.round(earnedMarks / Math.max(1, totalMarks) * 100)}%</strong><small>{earnedMarks} of {totalMarks} marks</small></Card><Card><span className="section-kicker">PRACTICE SETS</span><strong>{attempts.length}</strong><small>completed locally</small></Card><Card><span className="section-kicker">AVERAGE TIME</span><strong>{averageMinutes} min</strong><small>per completed attempt</small></Card><Card><span className="section-kicker">RECENT TREND</span><strong>{accuracyTrend ? `${accuracyTrend.differencePoints > 0 ? '+' : ''}${accuracyTrend.differencePoints} pts` : '—'}</strong><small>{accuracyTrend ? `${accuracyTrend.recentAccuracy}% recent vs ${accuracyTrend.previousAccuracy}% prior` : 'Complete 6 attempts to compare'}</small></Card></div>}
        {accuracyTrend && <p className="literacy-analytics-provenance">Observed Reading accuracy, weighted by marks: most recent {accuracyTrend.recentAttempts} attempt(s) compared with the prior {accuracyTrend.previousAttempts}. This is practice evidence, not an IELTS band estimate.</p>}
        {Object.keys(questionTypeScores).length > 0 && <div className="literacy-type-analytics"><div className="literacy-section-heading"><div><span className="section-kicker">OBSERVED PERFORMANCE</span><h2>Accuracy by question type</h2></div><span>From completed attempts</span></div>{Object.entries(questionTypeScores).sort(([first], [second]) => first.localeCompare(second)).map(([type, value]) => <div className="literacy-type-row" key={type}><span>{type.replaceAll('-', ' ')}</span><div role="img" aria-label={`${type.replaceAll('-', ' ')} accuracy: ${Math.round(value.score / Math.max(1, value.total) * 100)} percent`}><span style={{ width: `${Math.round(value.score / Math.max(1, value.total) * 100)}%` }} /></div><strong>{Math.round(value.score / Math.max(1, value.total) * 100)}%</strong></div>)}</div>}
        {attempts.length ? attempts.map((attempt) => <article className="literacy-attempt-row" key={attempt.id}><span>{attempt.title}</span><strong>{attempt.score}/{attempt.total} marks · {Math.round(attempt.score / Math.max(1, attempt.total) * 100)}%</strong><small>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(attempt.completedAt))}</small></article>) : <div className="literacy-progress-empty"><History size={22} /><strong>No reading attempts saved yet</strong><p>Complete a passage task to start tracking reading accuracy.</p><Button type="button" onClick={() => changeView('home')}>Browse reading passages <ArrowRight size={14} /></Button></div>}
      </Card>
      <LiteracyAssistant key={username} product="readia" apiKey={apiKey} username={username} profile={profile} testType={testType} targetBand={targetBand} studyGoal={studyGoal} currentSet={selectedSet} currentView={view} practiceMode={mode} chatModel={chatModel} toolModel={toolModel} onChatModelChange={onChatModelChange} />
    </div>
  }

  const publishedPackages = packages.filter((content) => content.status === 'published')
  return <div className="page-content inner-page literacy-page literacy-readia readia-module-page">
    <header className="literacy-heading">
      <div><p className="eyebrow">PREPIA IELTS · READING WORKSPACE</p><h1>Readia</h1><p className="page-subtitle">A dedicated reading studio for understanding passages, locating evidence, and building confidence across IELTS question types.</p></div>
      <Button type="button" variant="outline" onClick={() => changeView('content')}>Open Content Studio <ArrowRight size={14} /></Button>
    </header>
    {storageError && <p className="literacy-error" role="alert">{storageError}</p>}
    <Card className="literacy-welcome">
      <div><span className="section-kicker">READIA READING STUDIO</span><h2>Read with purpose. Prove every answer.</h2><p>Work through original passages, learn to skim and scan effectively, then review the evidence behind every response. Choose an independent timed task or practise with live AI guidance.</p>
        <div className="readia-focus-list"><span><Search size={14} /> Find evidence and paraphrases</span><span><CheckCircle2 size={14} /> Distinguish facts from claims</span><span><Lightbulb size={14} /> Build transferable reading strategies</span></div>
        {studyGoal && <p className="literacy-learner-goal"><strong>Your Reading focus:</strong> {studyGoal}</p>}
      </div>
      <div className="literacy-summary"><strong>{readingSets.length + publishedPackages.length}</strong><span>reading sets</span><strong>{targetBand ? `Band ${targetBand}` : '—'}</strong><span>target Reading band</span></div>
    </Card>
    <div className="literacy-mode-picker" role="group" aria-label="Choose a Readia mode">
      <button type="button" className={mode === 'exam' ? 'literacy-mode-selected' : ''} onClick={() => setMode('exam')}><Clock3 size={17} /><strong>Exam simulation</strong><small>Work independently under a timer and review your result.</small></button>
      <button type="button" className={mode === 'guided' ? 'literacy-mode-selected' : ''} onClick={() => setMode('guided')}><Lightbulb size={17} /><strong>AI guided practice</strong><small>Ask your live reading tutor for strategy and evidence guidance.</small></button>
    </div>
    {mode === 'guided' && !apiKey.trim() && <Card className="literacy-key-notice"><p>Connect Prepia AI in Settings to use Readia’s live guided tutor.</p><Button type="button" variant="outline" onClick={onOpenSettings}>Open Settings <ArrowRight size={13} /></Button></Card>}
    <div className="literacy-section-heading readia-library-heading"><div><span className="section-kicker">READING LIBRARY</span><h2>Choose a passage</h2></div><span>{readingSets.length} starter sets · {publishedPackages.length} authored</span></div>
    <div className="literacy-set-grid">{readingSets.map((set) => <Card className="literacy-set-card" key={set.id}>
      <div className="literacy-set-meta"><span>{set.fullLength ? 'Full-length mock' : set.level}</span><span><Clock3 size={13} /> {set.minutes} min</span></div>
      <h2>{set.title}</h2><p>{set.instructions}</p>
      <div className="literacy-set-footer"><span>{set.fullLength ? `${set.questions.length} questions` : `${set.questions.length} question groups`}</span><Button type="button" onClick={() => { setSelectedSetId(set.id); changeView('practice') }}>{mode === 'exam' ? set.fullLength ? 'Start full mock test' : 'Start reading task' : 'Practise with tutor'} <ArrowRight size={14} /></Button></div>
    </Card>)}
      {publishedPackages.map((content) => <Card className="literacy-set-card literacy-authored-card" key={content.id}>
        <div className="literacy-set-meta"><span>AUTHORED · {content.set.level}</span><span><Clock3 size={13} /> {content.set.minutes} min</span></div><h2>{content.title}</h2><p>{content.set.instructions}</p>
        <div className="literacy-set-footer"><span>{content.set.questions.length} question groups</span><Button type="button" onClick={() => { setSelectedSetId(content.set.id); changeView('practice') }}>{mode === 'exam' ? 'Start reading task' : 'Practise with tutor'} <ArrowRight size={14} /></Button></div>
      </Card>)}
    </div>
    <LiteracyAssistant key={username} product="readia" apiKey={apiKey} username={username} profile={profile} testType={testType} targetBand={targetBand} studyGoal={studyGoal} currentSet={selectedSet} currentView={view} practiceMode={mode} chatModel={chatModel} toolModel={toolModel} onChatModelChange={onChatModelChange} />
  </div>
}
