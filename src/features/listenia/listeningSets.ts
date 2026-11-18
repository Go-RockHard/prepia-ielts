import type { PracticeSet } from '@/features/skills/questionTypes'
import { fullLengthListeningTest } from '@/features/listenia/fullLengthListeningMock'

type LegacyQuestion = { prompt: string; options: string[]; answer: number; explanation: string }

const listeningLegacySets: Array<Omit<PracticeSet, 'questions'> & { questions: LegacyQuestion[] }> = [
  {
    id: 'museum-booking',
    title: 'Booking a museum visit',
    level: 'Foundation',
    minutes: 7,
    instructions: 'Listen to the announcement and answer the questions. You can replay the audio before checking your answers.',
    audioScript: 'Hello, this is a message for people booked on the Saturday history tour at Westbrook Museum. The tour will start at ten thirty, not ten o’clock as shown on some older tickets. Please meet beside the main entrance, where your guide will be holding a blue folder. The group will visit the upstairs gallery first, so anyone who needs step-free access should tell the guide before the tour begins. There is a café on the ground floor, but it does not open until eleven. Finally, please bring your booking confirmation, either on your phone or printed on paper.',
    questions: [
      { prompt: 'What time will the tour begin?', options: ['9:30', '10:00', '10:30', '11:00'], answer: 2, explanation: 'The announcement corrects the older ticket time and says the tour starts at ten thirty.' },
      { prompt: 'Where should visitors meet?', options: ['Inside the café.', 'Beside the main entrance.', 'In the upstairs gallery.', 'At the museum ticket office.'], answer: 1, explanation: 'Visitors are asked to meet beside the main entrance.' },
      { prompt: 'What should visitors needing step-free access do?', options: ['Arrive after the tour.', 'Use the staff entrance.', 'Tell the guide before the tour.', 'Wait in the café.'], answer: 2, explanation: 'They should inform the guide before the tour begins.' },
      { prompt: 'What should visitors bring?', options: ['A blue folder.', 'A printed map.', 'Their booking confirmation.', 'A café receipt.'], answer: 2, explanation: 'The announcement asks visitors to bring the booking confirmation, digitally or printed.' },
    ],
  },
  {
    id: 'coastal-research',
    title: 'A coastal research project',
    level: 'Intermediate',
    minutes: 9,
    instructions: 'Listen for specific details and paraphrases. Replay the recording as needed, then select one answer for each question.',
    audioScript: 'Good afternoon. I’m going to explain the shoreline survey that begins next month. We originally planned to work on the northern beach, but recent repairs there make it unsuitable, so our team will meet at the small harbour instead. The first session is on the twelfth of May. Please arrive by quarter past eight; the safety briefing starts at half past. The work is mostly observation, not collecting samples. You’ll record the width of the beach and note where seaweed gathers after high tide. Bring a pencil and a notebook, as wet weather can damage phone screens. Boots are recommended, but the project can lend you a pair if you request them by Friday. Travel costs are not covered, although tea and lunch will be provided at the harbour office.',
    questions: [
      { prompt: 'Why was the original meeting location changed?', options: ['The northern beach is being repaired.', 'The harbour office is closed.', 'The group is collecting more samples.', 'The weather forecast is poor.'], answer: 0, explanation: 'Recent repairs made the northern beach unsuitable for the survey.' },
      { prompt: 'When should participants arrive?', options: ['At 8:00.', 'At 8:15.', 'At 8:30.', 'At 9:15.'], answer: 1, explanation: 'Participants should arrive at quarter past eight, before the 8:30 briefing.' },
      { prompt: 'What will participants mainly do?', options: ['Collect water samples.', 'Repair the shoreline.', 'Observe and record beach conditions.', 'Prepare meals for visitors.'], answer: 2, explanation: 'The speaker says the work is mostly observation, including recording beach width and seaweed.' },
      { prompt: 'What can the project lend participants?', options: ['A notebook.', 'A phone.', 'A pair of boots.', 'A travel pass.'], answer: 2, explanation: 'Boots are recommended and can be borrowed if requested by Friday.' },
    ],
  },
]

function convertLegacyQuestions(sets: Array<Omit<PracticeSet, 'questions'> & { questions: LegacyQuestion[] }>): PracticeSet[] {
  return sets.map((set) => ({
    ...set,
    questions: set.questions.map((question) => ({
      type: 'multiple-choice' as const,
      prompt: question.prompt,
      options: question.options,
      answer: question.options[question.answer],
      explanation: question.explanation,
    })),
  }))
}

export const listeningSets: PracticeSet[] = [
  ...convertLegacyQuestions(listeningLegacySets),
  {
    id: 'campus-orientation',
    title: 'Campus orientation and room booking',
    level: 'Intermediate',
    minutes: 12,
    instructions: 'This mixed-format Listening practice includes multiple selection, note completion, matching people and details, sentence endings, classification, short answers, and plan labeling. Play the recording before answering.',
    audioScript: 'Welcome to the North Hall orientation. The information desk is just inside the east entrance. From there, walk past the café and turn left at the glass doors; the language centre is the second room on your right. The computer room is opposite it, but it is closed this morning for an equipment check.\\n\\nStudent: I’d like to reserve a study room for a project group.\\n\\nStaff: Certainly. Room 4B is free on Thursday, but it only holds four people. If there are five of you, the larger room is 2A. It is available from half past two until four.\\n\\nStudent: We have five. Is there a deposit?\\n\\nStaff: No deposit is needed, but please bring your student cards. The booking will be under the name Patel.\\n\\nStudent: Could we use the projector?\\n\\nStaff: Room 2A has one, though you’ll need to borrow an adapter from the desk. We ask groups to return it before leaving. The room must be left by four because a language class begins then.',
    questions: [
      { type: 'multiple-choice', prompt: 'Why is the computer room unavailable this morning?', options: ['A class is using it.', 'It is being checked for equipment.', 'It has been moved.', 'The staff are cleaning it.'], answer: 'It is being checked for equipment.', explanation: 'The announcement says it is closed for an equipment check.' },
      { type: 'completion', prompt: 'Complete the booking notes. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.', instruction: 'Use the exact details you hear.', gaps: [{ id: 'note-1', label: 'Room: ________', acceptedAnswers: ['2A'] }, { id: 'note-2', label: 'Available until: ________', acceptedAnswers: ['4', '4:00', 'four'] }, { id: 'note-3', label: 'Booking name: ________', acceptedAnswers: ['Patel'] }], explanation: 'The booking is for room 2A, until four, under Patel.' },
      { type: 'multiple-select', prompt: 'Which TWO things does the staff member ask the group to do?', instruction: 'Choose TWO answers.', options: ['Bring their student cards.', 'Pay a deposit in advance.', 'Borrow an adapter from the desk.', 'Leave the room before half past two.'], answer: ['Bring their student cards.', 'Borrow an adapter from the desk.'], explanation: 'The group should bring student cards and borrow an adapter; no deposit is required.' },
      { type: 'matching', prompt: 'Match each room with its detail.', instruction: 'Choose the correct description for each place. Options may be used once.', options: ['Closed this morning', 'Available Thursday but seats four', 'Booked from 2:30 to 4:00 for five people'], items: [{ id: 'room-1', text: 'Computer room', answer: 'Closed this morning' }, { id: 'room-2', text: 'Room 4B', answer: 'Available Thursday but seats four' }, { id: 'room-3', text: 'Room 2A', answer: 'Booked from 2:30 to 4:00 for five people' }], explanation: 'The speaker distinguishes the computer room, the smaller 4B, and the larger 2A by these details.' },
      { type: 'matching-features', prompt: 'Match each speaker with the statement that reflects what they say.', instruction: 'Choose one statement for each speaker. Options may be used once.', options: ['Needs a room for five people.', 'Explains which larger room is available.', 'Will collect a deposit.'], items: [{ id: 'speaker-student', text: 'Student', answer: 'Needs a room for five people.' }, { id: 'speaker-staff', text: 'Staff member', answer: 'Explains which larger room is available.' }], explanation: 'The student says there are five in the group; the staff member recommends room 2A.' },
      { type: 'matching-sentence-endings', prompt: 'Choose the correct ending for each sentence.', instruction: 'Choose one ending for each sentence. Options may be used once.', options: ['a language class starts then.', 'it has no projector.', 'the information desk closes.'], items: [{ id: 'ending-room', text: 'The group must leave room 2A by four because', answer: 'a language class starts then.' }], explanation: 'The staff member says a language class begins at four.' },
      { type: 'classification', prompt: 'The group needs to pay a deposit to reserve room 2A.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], answer: 'FALSE', explanation: 'The staff member says no deposit is needed.' },
      { type: 'short-answer', prompt: 'What must the students borrow to connect their equipment? Use NO MORE THAN TWO WORDS.', acceptedAnswers: ['an adapter', 'adapter'], wordLimit: 2, explanation: 'They need to borrow an adapter from the desk.' },
      { type: 'labeling', prompt: 'Label the route from the east entrance to the language centre.', diagramDescription: 'EAST ENTRANCE → INFORMATION DESK → CAFÉ → GLASS DOORS → [ A ]', options: ['language centre', 'computer room', 'study room 2A'], items: [{ id: 'plan-a', label: 'A · Second room on the right', answer: 'language centre' }], explanation: 'The language centre is the second room on the right after the glass doors.' },
    ],
  },
  fullLengthListeningTest,
]
