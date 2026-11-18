import { SpeakiaAssistant } from '@/features/assistant/SpeakiaAssistant'
import type { AssistantModel } from '@/features/assistant/models'
import { EMPTY_WRITIA_LEARNER_CONTEXT } from '@/features/writing/learnerContext'
import type { UserProfile } from '@/features/profile/localAccount'
import type { PracticeSet } from '@/features/skills/questionTypes'

export function LiteracyAssistant({
  product,
  apiKey,
  username,
  profile,
  testType,
  targetBand,
  studyGoal,
  currentSet,
  currentView,
  practiceMode,
  chatModel,
  toolModel,
  onChatModelChange,
}: {
  product: 'readia' | 'listenia'
  apiKey: string
  username: string
  profile: UserProfile
  testType: 'Academic' | 'General Training'
  targetBand?: string
  studyGoal?: string
  currentSet?: PracticeSet
  currentView: string
  practiceMode: 'exam' | 'guided'
  chatModel: AssistantModel
  toolModel: AssistantModel
  onChatModelChange: (model: AssistantModel) => void
}) {
  const platform = product === 'readia' ? 'reading' : 'listening'
  const practiceSet = currentView === 'practice' && practiceMode === 'guided' ? currentSet : undefined
  return <SpeakiaAssistant
    key={`${product}:${username}`}
    platform={platform}
    activeSection="Dashboard"
    results={[]}
    lexicalEntries={[]}
    profile={{ ...profile, testType }}
    writingContext={EMPTY_WRITIA_LEARNER_CONTEXT}
    literacyContext={{ product, currentView, testType, targetBand, studyGoal, practiceSet }}
    apiKey={apiKey}
    chatModel={chatModel}
    toolModel={toolModel}
    onChatModelChange={onChatModelChange}
    onStartPractice={() => undefined}
    onStartGuidedPractice={() => undefined}
    onNavigate={() => undefined}
    onReviewPerformanceTest={() => false}
    onActivateControl={async () => undefined}
    assignments={[]}
    onChooseTomorrowAssignment={async () => { throw new Error('Assignments are unavailable in this assistant context.') }}
    assignmentBusy={false}
    coachLaunch={null}
    onAddLexicalEntry={() => { throw new Error('Vocabulary saving is unavailable in this assistant context.') }}
    onAddTopicPrompt={() => { throw new Error('Topic saving is unavailable in this assistant context.') }}
  />
}
