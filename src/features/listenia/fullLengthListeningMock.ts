import type { SkillQuestion } from '@/features/skills/questionTypes'
import { fullLengthListeningTest as listeningBase } from '@/features/listenia/fullLengthListening'

const classification = (prompt: string, answer: 'TRUE' | 'FALSE' | 'NOT GIVEN', explanation: string): SkillQuestion => ({
  type: 'classification',
  prompt,
  options: ['TRUE', 'FALSE', 'NOT GIVEN'],
  answer,
  explanation,
})

const matching = (
  type: 'matching' | 'matching-features',
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

const selectTwo = (prompt: string, options: string[], answer: string[], explanation: string): SkillQuestion => ({
  type: 'multiple-select',
  prompt,
  options,
  answer,
  instruction: 'Choose TWO answers.',
  explanation,
})

const shortAnswer = (prompt: string, acceptedAnswers: string[], explanation: string): SkillQuestion => ({
  type: 'short-answer',
  prompt,
  acceptedAnswers,
  wordLimit: 3,
  explanation,
})

const labeling = (prompt: string, diagramDescription: string, items: { id: string; label: string; answer: string }[], explanation: string): SkillQuestion => ({
  type: 'labeling',
  prompt,
  diagramDescription,
  options: ['Reception', 'Changing room', 'Lane three', 'Café', 'Bird hide', 'Eastern trail', 'Old clock'],
  items,
  explanation,
})

export const fullLengthListeningTest = {
  ...listeningBase,
  examSections: [
    { title: 'Section 1', questionStartIndex: 0, questionEndIndex: 4 },
    { title: 'Section 2', questionStartIndex: 4, questionEndIndex: 12 },
    { title: 'Section 3', questionStartIndex: 12, questionEndIndex: 16 },
    { title: 'Section 4', questionStartIndex: 16, questionEndIndex: 21 },
  ],
  questions: [
    completion('note-completion', 'Complete the course registration notes.', 'Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
      { id: 'l1-note-1', label: 'Course begins: 14 ________', acceptedAnswers: ['June'] },
      { id: 'l1-note-2', label: 'Course length: ________ weeks', acceptedAnswers: ['six', '6'] },
      { id: 'l1-note-3', label: 'Class begins at ________ p.m.', acceptedAnswers: ['6:15', 'quarter past six'] },
      { id: 'l1-note-4', label: 'Bring a ________', acceptedAnswers: ['towel'] },
      { id: 'l1-note-5', label: 'Instructor: ________', acceptedAnswers: ['Daniel'] },
      { id: 'l1-note-6', label: 'Arrive ten minutes early to complete a health ________', acceptedAnswers: ['form'] },
    ], 'The caller is given the course dates, time, item to bring, instructor, and arrival requirement.'),
    matching('matching', 'Match each item or place with the correct detail.', 'Choose the correct detail for each item.', [
      'Next to reception',
      'Available to borrow for the first session',
      'Used for the first lesson',
    ], [
      { id: 'l1-match-a', text: 'Accessible changing room', answer: 'Next to reception' },
      { id: 'l1-match-b', text: 'Goggles', answer: 'Available to borrow for the first session' },
    ], 'The staff member locates the changing room by reception and offers goggles to borrow.'),
    multipleChoice('What is included in the course fee?', [
      'Pool entry',
      'A towel',
      'Private transport',
      'A swimming costume',
    ], 'Pool entry', 'The sixty-eight-pound fee includes pool entry.'),
    multipleChoice('How can the caller pay?', [
      'By card at reception',
      'By cash to the instructor',
      'By bank transfer after the course',
      'Through the online activity pack',
    ], 'By card at reception', 'The staff member says payment can be made at reception by card.'),

    labeling('Label the route and facilities at the wildlife reserve.', 'NORTH FOOTPATH (CLOSED) → BLUE SIGNS → [A] · BIRD OBSERVATION AT [B] · GUIDED WALK STARTS AT [C]', [
      { id: 'l2-map-a', label: 'A · Alternative walking route', answer: 'Eastern trail' },
      { id: 'l2-map-b', label: 'B · Location where birds can be observed', answer: 'Bird hide' },
      { id: 'l2-map-c', label: 'C · Landmark beside the walk start', answer: 'Old clock' },
    ], 'The announcement directs visitors to the eastern trail, identifies the bird hide, and locates the walk beside the old clock.'),
    classification('The visitor centre closes at half past four.', 'FALSE', 'The visitor centre stays open until five; the café closes at half past four.'),
    classification('The activity pack is free for families to borrow.', 'TRUE', 'Families can borrow a free activity pack from the desk.'),
    classification('Visitors can pay for binocular rental by card.', 'FALSE', 'The rental desk accepts cash only.'),
    multipleChoice('Why is the north footpath closed?', [
      'A bridge is being repaired',
      'The trail is being widened',
      'A bird survey is taking place',
      'The visitor centre is closed',
    ], 'A bridge is being repaired', 'The footpath is closed while a bridge is repaired.'),
    multipleChoice('Where does the guided walk begin?', [
      'Beside the old clock',
      'At the car park',
      'Inside the café',
      'At the bird hide',
    ], 'Beside the old clock', 'The announcement says the walk starts beside the old clock.'),
    multipleChoice('What should visitors avoid doing at the bird hide?', [
      'Using flash photography',
      'Borrowing an activity pack',
      'Walking on the eastern trail',
      'Renting binoculars',
    ], 'Using flash photography', 'Visitors are asked not to use flash photography.'),
    multipleChoice('What should visitors not feed to the ducks?', [
      'Bread',
      'Seeds',
      'Leaves',
      'Fruit',
    ], 'Bread', 'The speaker says bread can harm the ducks.'),

    matching('matching-features', 'Match each project decision with the person who proposed or explained it.', 'Choose the correct speaker for each statement.', [
      'Student A',
      'Student B',
      'Tutor',
    ], [
      { id: 'l3-speaker-a', text: 'The first observation method would miss cyclists on quieter streets.', answer: 'Student A' },
      { id: 'l3-speaker-b', text: 'Combine site observations with an online survey.', answer: 'Student B' },
      { id: 'l3-speaker-c', text: 'Compare journeys before and after the route opened.', answer: 'Tutor' },
      { id: 'l3-speaker-d', text: 'Interview two shop owners.', answer: 'Tutor' },
    ], 'The students and tutor propose and refine the project methods during the discussion.'),
    selectTwo('Which TWO methods will the students use to gather information?', [
      'Short observations at three locations',
      'An online survey',
      'A laboratory experiment',
      'A review of private travel records',
    ], ['Short observations at three locations', 'An online survey'], 'The students decide to combine observations at three locations with an online survey.'),
    selectTwo('Which TWO pieces of information should be included in the analysis?', [
      'Journey purpose',
      'Approximate travel time',
      'Each cyclist’s identity',
      'The price of each bicycle',
    ], ['Journey purpose', 'Approximate travel time'], 'The tutor advises comparing journey purpose and approximate travel time, not identifying individuals.'),
    completion('sentence-completion', 'Complete the project-planning notes.', 'Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
      { id: 'l3-gap-a', label: 'Observations will take place on Monday, Wednesday, and ________', acceptedAnswers: ['Saturday'] },
      { id: 'l3-gap-b', label: 'The council has offered the students a ________', acceptedAnswers: ['map'] },
    ], 'The students select Saturday and receive a map from the council.'),

    completion('note-completion', 'Complete the wetland restoration notes.', 'Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', [
      { id: 'l4-note-a', label: 'Two drainage channels will be ________', acceptedAnswers: ['blocked'] },
      { id: 'l4-note-b', label: 'Water depth checked at ________ marked points', acceptedAnswers: ['six', '6'] },
      { id: 'l4-note-c', label: 'First plant expected to expand: ________', acceptedAnswers: ['reeds'] },
      { id: 'l4-note-d', label: 'Initial funding period: ________ years', acceptedAnswers: ['three', '3'] },
    ], 'The lecture describes the channel work, measurement plan, expected reeds, and funding period.'),
    shortAnswer('Who will decide whether the project continues after its initial funding?', ['regional trust', 'the regional trust'], 'The regional trust will make the decision.'),
    shortAnswer('Who will install the water gates?', ['specialist contractors', 'contractors'], 'Specialist contractors will install the gates.'),
    shortAnswer('In which month is the first review scheduled?', ['March'], 'The first review is scheduled for March.'),
    completion('note-completion', 'Complete the wetland monitoring notes.', 'Write NO MORE THAN TWO WORDS for each answer.', [
      { id: 'l4-note-e', label: 'Plant cover recorded in spring and ________', acceptedAnswers: ['late summer'] },
      { id: 'l4-note-f', label: 'Visitor structure: ________', acceptedAnswers: ['boardwalk'] },
      { id: 'l4-note-g', label: 'Stream reopened on the ________ edge', acceptedAnswers: ['western'] },
    ], 'The lecture says plant cover is recorded in late summer, a boardwalk protects sensitive ground, and the stream is reopened on the western edge.'),
  ],
}
