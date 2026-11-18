import type { SkillQuestion } from '@/features/skills/questionTypes'
import { fullLengthReadingTest as readingBase } from '@/features/readia/fullLengthReading'

const classification = (prompt: string, answer: 'TRUE' | 'FALSE' | 'NOT GIVEN', explanation: string): SkillQuestion => ({
  type: 'classification',
  prompt,
  options: ['TRUE', 'FALSE', 'NOT GIVEN'],
  answer,
  explanation,
})

const matching = (
  type: 'matching-headings' | 'matching-features' | 'matching-sentence-endings',
  prompt: string,
  instruction: string,
  options: string[],
  items: { id: string; text: string; answer: string }[],
  explanation: string,
): SkillQuestion => ({ type, prompt, instruction, options, items, explanation })

const completion = (
  type: 'note-completion' | 'sentence-completion',
  prompt: string,
  instruction: string,
  gaps: { id: string; label: string; acceptedAnswers: string[] }[],
  explanation: string,
): SkillQuestion => ({ type, prompt, instruction, gaps, explanation })

const multipleChoice = (prompt: string, options: string[], answer: string, explanation: string): SkillQuestion => ({
  type: 'multiple-choice',
  prompt,
  options,
  answer,
  explanation,
})

const shortAnswer = (prompt: string, acceptedAnswers: string[], explanation: string): SkillQuestion => ({
  type: 'short-answer',
  prompt,
  acceptedAnswers,
  wordLimit: 3,
  explanation,
})

const selectTwo = (prompt: string, options: string[], answer: string[], explanation: string): SkillQuestion => ({
  type: 'multiple-select',
  prompt,
  options,
  answer,
  instruction: 'Choose TWO answers.',
  explanation,
})

export const fullLengthReadingTest = {
  ...readingBase,
  examSections: [
    { title: 'Passage 1', questionStartIndex: 0, questionEndIndex: 6 },
    { title: 'Passage 2', questionStartIndex: 6, questionEndIndex: 10 },
    { title: 'Passage 3', questionStartIndex: 10, questionEndIndex: 21 },
  ],
  questions: [
    matching('matching-headings', 'Choose the best heading for each paragraph.', 'Choose the correct heading for paragraphs A–E. There are more headings than you need.', [
      'A community space expands beyond its original purpose',
      'Why repairs are not always the best outcome',
      'A new partnership eases a practical bottleneck',
      'Funding decisions depend on visitor feedback',
      'Recording evidence without overstating impact',
      'A project turns away from local participation',
      'A schedule becomes easier to access',
    ], [
      { id: 'r1-heading-a', text: 'Paragraph A', answer: 'Why repairs are not always the best outcome' },
      { id: 'r1-heading-b', text: 'Paragraph B', answer: 'Recording evidence without overstating impact' },
      { id: 'r1-heading-c', text: 'Paragraph C', answer: 'A new partnership eases a practical bottleneck' },
      { id: 'r1-heading-d', text: 'Paragraph D', answer: 'Funding decisions depend on visitor feedback' },
      { id: 'r1-heading-e', text: 'Paragraph E', answer: 'A community space expands beyond its original purpose' },
    ], 'Paragraphs A–E cover the event’s purpose, records, college partnership, possible fee, and expansion of library activities.'),
    classification('The repair event was first suggested after the final independent repair shop closed.', 'TRUE', 'The passage says the library employee proposed the event after the shop closed.'),
    classification('The first session attracted more than twenty visitors.', 'FALSE', 'Twelve people attended the first session.'),
    classification('The technical-college students work without supervision.', 'FALSE', 'Students join as supervised placements and work alongside experienced volunteers.'),
    classification('The library has already decided to charge for every repair.', 'FALSE', 'The fee is only being considered for complex repairs and has not been adopted.'),
    completion('note-completion', 'Complete the project notes.', 'Write NO MORE THAN TWO WORDS from the passage for each answer.', [
      { id: 'r1-note-1', label: 'First repair event venue: library ________', acceptedAnswers: ['meeting room'] },
      { id: 'r1-note-2', label: 'College students study ________', acceptedAnswers: ['electronics'] },
      { id: 'r1-note-3', label: 'Grant-funded storage ________', acceptedAnswers: ['cabinets'] },
      { id: 'r1-note-4', label: 'Proposed calendar locations include cafés and ________', acceptedAnswers: ['community centres', 'community centers'] },
    ], 'The passage identifies the meeting room, electronics students, storage cabinets, and community centres.'),

    matching('matching-features', 'Match each observation with the group that made or reported it.', 'Choose the correct group for each statement. You may use a group more than once.', [
      'City planners',
      'Transport engineers',
      'Residents',
    ], [
      { id: 'r2-feature-a', text: 'Tree totals alone do not describe useful shade.', answer: 'City planners' },
      { id: 'r2-feature-b', text: 'A roof material was noisy during heavy rain.', answer: 'Transport engineers' },
      { id: 'r2-feature-c', text: 'A shaded arcade was missing from official records.', answer: 'Residents' },
      { id: 'r2-feature-d', text: 'Route comfort includes safe crossings and places to rest.', answer: 'City planners' },
    ], 'The passage attributes these findings to planners, engineers testing roofs, and residents commenting on the map.'),
    selectTwo('Which TWO features were included in the community-centre courtyard?', [
      'A drinking-water point',
      'Benches with backs',
      'A covered bus stop',
      'A new clinic entrance',
    ], ['A drinking-water point', 'Benches with backs'], 'The courtyard included a water point and benches with backs.'),
    selectTwo('Which TWO factors can limit the usefulness of a cooling centre?', [
      'Unreliable opening hours',
      'Insufficient staffing',
      'Too many mature trees',
      'A nearby bus route',
    ], ['Unreliable opening hours', 'Insufficient staffing'], 'The passage says cooling centres need staff and reliable opening hours.'),
    completion('sentence-completion', 'Complete the sentences about the city’s heat interventions.', 'Write NO MORE THAN TWO WORDS from the passage for each answer.', [
      { id: 'r2-gap-a', label: 'The pale metal shelter roof reflected sunlight but could become ________ in rain.', acceptedAnswers: ['noisy'] },
      { id: 'r2-gap-b', label: 'A timber canopy needed more frequent ________.', acceptedAnswers: ['inspection'] },
      { id: 'r2-gap-c', label: 'The coated fabric roof gave less protection from ________ sun.', acceptedAnswers: ['low-angle'] },
      { id: 'r2-gap-d', label: 'A live map update depends on an ________ with centre operators.', acceptedAnswers: ['agreement'] },
      { id: 'r2-gap-e', label: 'The next phase will compare the cost of ________ interventions.', acceptedAnswers: ['maintaining'] },
    ], 'The passage names the material trade-offs, the update agreement, and future maintenance costs.'),

    matching('matching-sentence-endings', 'Complete each sentence by choosing the correct ending.', 'Choose the correct ending for Questions 24–27. There are more endings than you need.', [
      'helped reveal repair marks absent from the catalogue.',
      'distinguished documented facts from personal memories.',
      'worked with curators before the English text was final.',
      'made every visitor remember more information.',
      'offer visitors different levels of detail.',
      'replaced printed labels with digital screens.',
    ], [
      { id: 'r3-ending-a', text: 'Comments from retired sailors', answer: 'helped reveal repair marks absent from the catalogue.' },
      { id: 'r3-ending-b', text: 'The museum’s source notes', answer: 'distinguished documented facts from personal memories.' },
      { id: 'r3-ending-c', text: 'Translators in the label experiment', answer: 'worked with curators before the English text was final.' },
      { id: 'r3-ending-d', text: 'The museum’s current plan is to', answer: 'offer visitors different levels of detail.' },
    ], 'The endings reflect the contributions, source distinction, early translation, and multiple information formats.'),
    shortAnswer('What kind of instruments were reviewed at the North Coast Museum?', ['navigational instruments', 'navigational instrument'], 'The reviewed collection consisted of navigational instruments.'),
    shortAnswer('How many languages were tested in the label experiment?', ['two', '2'], 'The experiment tested labels in two languages.'),
    shortAnswer('What did the museum add to explain specialist words?', ['a glossary', 'glossary'], 'The team added a small glossary.'),
    shortAnswer('How long after launch does the museum plan to review the labels?', ['a year', 'one year'], 'The museum plans a review after a year.'),
    shortAnswer('Which group was invited to comment alongside local historians?', ['retired sailors', 'sailors'], 'Curators invited retired sailors to comment.'),
    multipleChoice('What does the passage say the label project did NOT measure?', [
      'Whether visitors remembered more information later',
      'Whether visitors found the revised labels easier to follow',
      'Whether some words had no direct translation',
      'Whether specialist knowledge affected readability',
    ], 'Whether visitors remembered more information later', 'The project recorded improved ease of understanding but did not measure later recall.'),
    multipleChoice('Why did the museum add an online story?', [
      'Some visitors wanted more detail than fit on a short label',
      'The printed labels were removed from the gallery',
      'The contributors refused to discuss repair marks',
      'The museum wanted to avoid translating the labels',
    ], 'Some visitors wanted more detail than fit on a short label', 'The online story provided additional detail for visitors who wanted it.'),
    multipleChoice('What does the museum’s approach to disputed memories demonstrate?', [
      'It identifies the source and status of claims',
      'It treats every recollection as proven fact',
      'It removes all accounts that lack written records',
      'It avoids asking community members for input',
    ], 'It identifies the source and status of claims', 'The museum distinguishes documented facts from personal recollections and explains sources.'),
    multipleChoice('Why did the team read draft labels aloud?', [
      'To check their length and clarity',
      'To record a permanent audio guide',
      'To test the musical quality of translations',
      'To replace visitor feedback',
    ], 'To check their length and clarity', 'Staff read drafts aloud and tested them with visitors to identify unclear wording.'),
    multipleChoice('Which principle best summarises the museum’s new approach?', [
      'Provide clear core information with routes to further context',
      'Put every known fact on each object label',
      'Use digital formats instead of printed text',
      'Present one interpretation as final and unquestionable',
    ], 'Provide clear core information with routes to further context', 'The museum aims for concise labels and optional deeper material.'),
  ],
}
