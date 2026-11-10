import { useMemo } from 'react'
import { ArrowRight, AudioLines, Clock3, Sparkles, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import type { UserProfile } from '@/features/profile/localAccount'
import type { TestResult } from '@/features/simulator/types'

type LearningCriterion = { id: string; label: string; band: number; nextStep: string }
type LearningReview = {
  id: string
  title: string
  completedAt: number
  overallBand: number
  focus: string
  criteria: LearningCriterion[]
  result: TestResult
}
type LearningProfilePageProps = {
  speakingResults: TestResult[]
  profile: UserProfile
  onNavigate: (section: 'Practice') => void
  onOpenPlacement: () => void
  onOpenAssessment: (result: TestResult) => void
}
type SkillDefinition = { id: string; label: string }

const speakingSkills: SkillDefinition[] = [
  { id: 'fluency', label: 'Fluency & coherence' },
  { id: 'lexical', label: 'Lexical resource' },
  { id: 'grammar', label: 'Grammar range & accuracy' },
  { id: 'pronunciation', label: 'Pronunciation' },
]

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function speakingReviews(results: TestResult[]): LearningReview[] {
  return results.map((result) => ({
    id: result.id,
    title: result.title,
    completedAt: Date.parse(result.completedAt),
    overallBand: result.overallBand,
    focus: result.nextSteps[0] ?? '',
    result,
    criteria: result.criteria.map((criterion) => ({
      id: criterion.id,
      label: criterion.name,
      band: criterion.band,
      nextStep: criterion.note,
    })),
  })).filter((review) => Number.isFinite(review.completedAt))
    .sort((left, right) => right.completedAt - left.completedAt)
}

function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(timestamp)
}

function profileDate(value: string): string {
  if (!value) return 'Not set'
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? 'Not set' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function SkillPanel({ reviews, skills }: {
  reviews: LearningReview[]
  skills: SkillDefinition[]
}) {
  return <section className="learning-profile-panel" aria-label="Speaking skill profile">
    <div className="learning-profile-panel-heading">
      <span className="learning-profile-mode-icon"><AudioLines size={17} /></span>
      <div><p className="section-kicker">SPEAKING SKILLS</p><h2>{reviews.length ? 'Evidence from your reviews' : 'Your first review will appear here'}</h2></div>
      <span className="learning-profile-review-count">{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
    </div>
    {reviews.length ? <div className="learning-profile-skills">
      {skills.map((skill) => {
        const samples = reviews.flatMap((review) => review.criteria.filter((criterion) => criterion.id === skill.id).map((criterion) => criterion.band))
        const score = average(samples.slice(0, 5))
        const change = samples.length > 1 ? samples[0] - samples[1] : null
        return <div className="learning-profile-skill" key={skill.id}>
          <div className="learning-profile-skill-heading"><strong>{skill.label}</strong><span>{score === null ? '—' : `${score.toFixed(1)} / 9`}</span></div>
          <small>{samples.length
            ? change === null
              ? `Based on ${samples.length} ${samples.length === 1 ? 'review' : 'reviews'}`
              : <>{change > 0 ? <TrendingUp size={12} /> : change < 0 ? <TrendingDown size={12} /> : null}{change === 0 ? 'Unchanged' : `${change > 0 ? '+' : ''}${change.toFixed(1)} since previous review`}</>
            : 'No score for this skill yet'}</small>
        </div>
      })}
    </div> : <p className="learning-profile-empty">Complete a speaking assessment to see skill-by-skill evidence here.</p>}
  </section>
}

export function SpeakiaLearnerProfilePage({ speakingResults, profile, onNavigate, onOpenPlacement, onOpenAssessment }: LearningProfilePageProps) {
  const speaking = useMemo(() => speakingReviews(speakingResults), [speakingResults])
  const speakingAverage = average(speaking.map((review) => review.overallBand))
  const latestActivity = speaking[0]
  const skillAverages = speakingSkills.map((skill) => ({
    skill: skill.id === 'fluency' ? 'Fluency'
      : skill.id === 'lexical' ? 'Lexical'
        : skill.id === 'grammar' ? 'Grammar'
          : 'Pronunciation',
    band: average(speaking.slice(0, 5).flatMap((review) => review.criteria.filter((criterion) => criterion.id === skill.id).map((criterion) => criterion.band))),
  })).filter((item): item is { skill: string; band: number } => item.band !== null)
  const progressTrend = speaking.slice(0, 8).reverse().map((review, index) => ({
    attempt: index + 1,
    band: review.overallBand,
    date: shortDate(review.completedAt),
    title: review.title,
  }))
  const nextFocus = useMemo(() => speakingSkills.map((skill) => ({
    label: skill.label,
    score: average(speaking.flatMap((review) => review.criteria.filter((criterion) => criterion.id === skill.id).map((criterion) => criterion.band)).slice(0, 5)),
    nextStep: speaking.flatMap((review) => review.criteria.filter((criterion) => criterion.id === skill.id).map((criterion) => criterion.nextStep))[0] ?? '',
  })).filter((item): item is typeof item & { score: number } => item.score !== null)
    .sort((left, right) => left.score - right.score)[0] ?? null, [speaking])

  return <div className="page-content inner-page learning-profile-page">
    <div className="inner-page-heading learning-profile-heading">
      <div><p className="eyebrow">YOUR SPEAKIA JOURNEY</p><h1>Your Learner Profile</h1><p className="page-subtitle">A focused view of your speaking progress, grounded in your saved practice assessments.</p></div>
      <div className="learning-profile-actions">
        <Button className="start-button" onClick={() => onNavigate('Practice')}><AudioLines size={15} /> Practise speaking</Button>
      </div>
    </div>

    <section className="learning-profile-overview" aria-label="Speakia learner profile summary">
      <article><span><Sparkles size={14} /> SPEAKING ASSESSMENTS</span><strong>{speaking.length}</strong><small>Saved practice reviews</small></article>
      <article><span><AudioLines size={14} /> AVERAGE PRACTICE ESTIMATE</span><strong>{speakingAverage === null ? '—' : speakingAverage.toFixed(1)}</strong><small>Across {speaking.length} reviews · / 9</small></article>
      <article><span><Target size={14} /> LATEST RESULT</span><strong>{latestActivity ? latestActivity.overallBand.toFixed(1) : '—'}</strong><small>{latestActivity ? latestActivity.title : 'Complete a practice assessment'}</small></article>
      <article><span><Clock3 size={14} /> MOST RECENT PRACTICE</span><strong>{latestActivity ? shortDate(latestActivity.completedAt) : '—'}</strong><small>{latestActivity ? 'Speaking assessment' : 'Your practice will appear here'}</small></article>
    </section>

    <section className="learner-profile-details" aria-label="Speaking preparation details">
      <div className="learner-profile-details-heading"><div><p className="section-kicker">YOUR PREPARATION PLAN</p><h2>Your goals &amp; test details</h2></div><span>{profile.testType} IELTS</span></div>
      <div className="learner-profile-details-grid">
        <article><span>Target Speaking band</span><strong>{profile.speakingTargetBand || profile.targetBand ? `Band ${Number(profile.speakingTargetBand || profile.targetBand).toFixed(1)}` : 'Not set'}</strong></article>
        <article><span>Speaking test date</span><strong>{profileDate(profile.speakingTestDate || profile.testDate)}</strong></article>
        <article><span>First language</span><strong>{profile.firstLanguage || 'Not set'}</strong></article>
        <article className="learner-profile-goal"><span>Speaking study goal</span><strong>{profile.speakingStudyGoal || profile.studyGoal || 'Add a goal to personalise your coaching.'}</strong></article>
      </div>
    </section>

    <section className="placement-profile-card" aria-label="Speaking placement baseline">
      <div><p className="section-kicker">SPEAKING PLACEMENT BASELINE</p><h2>{profile.speakingPlacementAssessment ? `Starting point: Band ${profile.speakingPlacementAssessment.overallBand.toFixed(1)}` : 'Set your speaking starting point'}</h2><p>{profile.speakingPlacementAssessment ? profile.speakingPlacementAssessment.summary : 'Take an optional short audio assessment so Speakia can adapt early practice to your current ability.'}</p>
        {profile.speakingPlacementAssessment && <div className="placement-profile-criteria">{profile.speakingPlacementAssessment.criteria.map((criterion) => <span key={criterion.id}>{criterion.label}<strong>{criterion.band.toFixed(1)}</strong></span>)}</div>}
        {profile.speakingPlacementAssessment && <small>Baseline from {shortDate(profile.speakingPlacementAssessment.createdAt)} · AI practice estimate, not an official IELTS score.</small>}
      </div>
      <Button className="start-button" onClick={onOpenPlacement}>{profile.speakingPlacementAssessment ? 'Update baseline' : 'Take optional placement'} <ArrowRight size={14} /></Button>
    </section>

    <section className="learner-profile-visuals" aria-label="Visual speaking progress insights">
      <article className="learner-profile-chart-card">
        <div><p className="section-kicker">RECENT SKILL BALANCE</p><h2>Where your speaking stands</h2><small>Average of up to five most recent available reviews · practice estimates / 9</small></div>
        {skillAverages.length ? <div className="learner-profile-bar-chart" role="img" aria-label="Bar chart showing recent average scores for speaking skills">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skillAverages} margin={{ top: 5, right: 8, bottom: 2, left: -18 }}>
              <CartesianGrid stroke="var(--learner-chart-grid)" vertical={false} />
              <XAxis dataKey="skill" interval={0} tick={{ fill: 'var(--learner-chart-text)', fontSize: 8 }} axisLine={false} tickLine={false} />
              <YAxis type="number" domain={[0, 9]} ticks={[0, 3, 6, 9]} width={28} tick={{ fill: 'var(--learner-chart-text)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 9`, 'Recent average']} cursor={{ fill: 'var(--learner-chart-hover)' }} />
              <Bar dataKey="band" fill="#7668c8" radius={[5, 5, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div> : <p className="learning-profile-empty">Skill comparisons will appear after your first saved assessment.</p>}
      </article>
      <article className="learner-profile-chart-card">
        <div><p className="section-kicker">ASSESSMENT JOURNEY</p><h2>Your practice trend</h2><small>Saved speaking assessment estimates over time · not an official IELTS score</small></div>
        {progressTrend.length ? <div className="learner-profile-trend-chart" role="img" aria-label="Area chart showing speaking assessment estimates over recent attempts">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={progressTrend} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
              <defs><linearGradient id="speakingProgressFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7668c8" stopOpacity={0.28} /><stop offset="100%" stopColor="#7668c8" stopOpacity={0.03} /></linearGradient></defs>
              <CartesianGrid stroke="var(--learner-chart-grid)" vertical={false} />
              <XAxis dataKey="attempt" tickFormatter={(value) => `#${value}`} tick={{ fill: 'var(--learner-chart-text)', fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} tick={{ fill: 'var(--learner-chart-text)', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(value) => `Attempt ${value}`} formatter={(value) => [`${Number(value).toFixed(1)} / 9`, 'Practice estimate']} />
              <Area type="monotone" dataKey="band" stroke="#7668c8" strokeWidth={2.5} fill="url(#speakingProgressFill)" dot={{ r: 3, fill: '#7668c8' }} activeDot={{ r: 5, fill: '#7668c8' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div> : <p className="learning-profile-empty">Your assessment trend will appear when you complete a practice review.</p>}
      </article>
    </section>

    <div className="learning-profile-skill-grid">
      <SkillPanel reviews={speaking} skills={speakingSkills} />
    </div>

    <div className="learning-profile-detail-grid">
      <section className="learning-profile-focus">
        <span className="learning-profile-focus-icon"><Target size={18} /></span>
        <div><p className="section-kicker">A USEFUL NEXT STEP</p><h2>{nextFocus ? `Build ${nextFocus.label.toLocaleLowerCase()}` : 'Start your learner profile'}</h2>
          <p>{nextFocus?.nextStep || 'Complete a speaking assessment. Your skill profile will use that evidence to suggest what to practise next.'}</p>
          {nextFocus && <small>Based on your recent speaking assessment evidence. Practice estimates are not official IELTS scores.</small>}
        </div>
        <Button className="start-button" onClick={() => onNavigate('Practice')}>Start speaking practice <ArrowRight size={14} /></Button>
      </section>
      <section className="learning-profile-activity">
        <div className="learning-profile-activity-heading"><div><p className="section-kicker">YOUR PRACTICE TRAIL</p><h2>Recent speaking assessments</h2></div><span>{speaking.length} total</span></div>
        {speaking.length ? <div className="learning-profile-activity-list">{speaking.slice(0, 8).map((review) => <button type="button" className="learning-profile-activity-row" key={review.id} onClick={() => onOpenAssessment(review.result)} aria-label={`Open speaking assessment ${review.title}`}>
          <span className="learning-profile-activity-icon"><AudioLines size={14} /></span>
          <div><strong>{review.title}</strong><small>Speaking · {shortDate(review.completedAt)}{review.focus ? ` · ${review.focus}` : ''}</small></div>
          <b>{review.overallBand.toFixed(1)}</b>
        </button>)}</div> : <p className="learning-profile-empty">Your saved speaking assessments will appear here.</p>}
      </section>
    </div>
  </div>
}
