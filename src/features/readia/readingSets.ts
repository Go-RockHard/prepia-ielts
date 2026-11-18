import type { PracticeSet } from '@/features/skills/questionTypes'
import { fullLengthReadingTest } from '@/features/readia/fullLengthReadingMock'

type LegacyQuestion = { prompt: string; options: string[]; answer: number; explanation: string }

const readingLegacySets: Array<Omit<PracticeSet, 'questions'> & { questions: LegacyQuestion[] }> = [
  {
    id: 'community-gardens',
    title: 'A new life for unused city space',
    level: 'Foundation',
    minutes: 8,
    instructions: 'Read the passage and choose the best answer for each question. Look for evidence in the text rather than relying on general knowledge.',
    passage: 'When a row of small workshops closed beside the railway in Northbridge, residents expected the buildings to remain empty. Instead, a local group proposed turning the narrow strip of land behind them into a community garden. The council agreed to a one-year trial, provided that volunteers maintained the paths and stored tools safely.\\n\\nAt first, the project attracted mostly families who already enjoyed gardening. To involve more neighbours, the group added a sheltered table and held a monthly repair café, where people could fix household objects with help from volunteers. Attendance grew, although the garden itself remained modest: its shaded position meant that only a few crops flourished.\\n\\nThe organisers now describe the project as a meeting place rather than a source of food. A short survey found that visitors valued the chance to talk to people they had not previously met. The council has extended the trial for another year, but has not promised permanent funding. The group is therefore planning a small membership scheme to pay for seeds and basic repairs.',
    questions: [
      { prompt: 'Why did the council initially agree to the garden project?', options: ['The railway company paid for it.', 'Volunteers accepted responsibility for upkeep and tool storage.', 'The project promised to provide food for the whole neighbourhood.', 'The council had already secured permanent funding.'], answer: 1, explanation: 'The first paragraph says the trial depended on volunteers maintaining paths and storing tools safely.' },
      { prompt: 'What helped attract neighbours who were not already interested in gardening?', options: ['A larger crop of vegetables.', 'A new railway station.', 'A sheltered table and a repair café.', 'Free gardening lessons at the council office.'], answer: 2, explanation: 'The second paragraph describes the table and monthly repair café as ways to involve more neighbours.' },
      { prompt: 'What does the survey suggest visitors valued most?', options: ['Buying inexpensive vegetables.', 'Meeting and talking with other people.', 'Learning how to maintain the railway.', 'Getting permanent employment.'], answer: 1, explanation: 'Visitors valued the opportunity to talk to people they had not previously met.' },
      { prompt: 'What is the group planning because permanent funding is uncertain?', options: ['A membership scheme to cover basic costs.', 'A larger garden on a different site.', 'A paid staff team.', 'An end to all community events.'], answer: 0, explanation: 'The final sentence says a small membership scheme may pay for seeds and repairs.' },
    ],
  },
  {
    id: 'library-hours',
    title: 'Making the most of a local library',
    level: 'Intermediate',
    minutes: 9,
    instructions: 'Read for the writer’s main point and supporting details. Each question has one best answer.',
    passage: 'Riverside Library stayed open later on two evenings each week after a six-month pilot. The change followed requests from people who worked standard daytime hours, but the pilot was not designed simply to increase visitor numbers. Staff also wanted to discover whether later opening would change how people used the building.\\n\\nThe results were mixed. Evening visitors borrowed fewer printed books on average than afternoon visitors, yet they made more use of the study desks and the small advice centre. A nearby college arranged for a tutor to answer questions about digital services during the first hour. This proved popular, particularly with adults who were returning to education.\\n\\nThe library will keep the later hours for now, but its manager cautions against treating the pilot as a complete solution. Staffing costs are higher in the evening, and some visitors said they would prefer a weekend service. The next review will compare the cost of each option with evidence about who benefits, rather than relying on a single measure such as total visits.',
    questions: [
      { prompt: 'What was one purpose of the evening-hours pilot besides attracting more visitors?', options: ['To test how people would use the building at a later time.', 'To replace the library’s printed books.', 'To reduce the number of staff.', 'To move the advice centre to the college.'], answer: 0, explanation: 'Staff wanted to learn whether later opening changed how people used the building.' },
      { prompt: 'How did evening visitors differ from afternoon visitors?', options: ['They borrowed more printed books.', 'They used study desks and the advice centre more.', 'They visited only to meet the tutor.', 'They were all enrolled at the nearby college.'], answer: 1, explanation: 'The results showed fewer book loans but greater use of study desks and the advice centre.' },
      { prompt: 'Who particularly valued the digital-services tutor?', options: ['Children visiting after school.', 'Adults returning to education.', 'Library managers.', 'Weekend visitors.'], answer: 1, explanation: 'The passage notes that the tutor was especially popular with adults returning to education.' },
      { prompt: 'What will the next review consider?', options: ['Only the total number of visits.', 'Whether all evening events should stop.', 'The costs and evidence of who benefits from each option.', 'Whether the college can buy the library.'], answer: 2, explanation: 'The review will compare costs with evidence about beneficiaries, not just visit totals.' },
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

export const readingSets: PracticeSet[] = [
  ...convertLegacyQuestions(readingLegacySets),
  {
    id: 'urban-rooftop-farms',
    title: 'Rooftop farms and the city food chain',
    level: 'Intermediate',
    minutes: 12,
    instructions: 'This mixed-format Reading practice covers matching headings and information, matching features and sentence endings, multiple selection, classification, completion, short answers, and diagram labeling. Follow the word limit for each task.',
    passage: 'A. Rooftop agriculture is often presented as a way to shorten the distance between food and consumers. Yet the practical value of a roof depends on its structure, access to water, and exposure to wind. A building survey must therefore come before decisions about crops.\\n\\nB. In a three-year trial, researchers compared a roof garden with a ground-level plot in the same district. The roof produced fewer kilograms of vegetables overall, but its crops were ready earlier in spring. The researchers linked this difference to warmer growing conditions, not to longer daylight. They also found that the roof retained some rainwater, reducing the amount that entered street drains during heavy showers.\\n\\nC. The project’s coordinator, Leila Morgan, argues that its strongest result was social. Residents who had never spoken began sharing weekly maintenance tasks. She does not claim that rooftop plots can replace conventional farms; instead, she sees them as a small part of a broader urban food network. Some produce was sold locally, while the rest went to a nearby community kitchen.\\n\\nD. The trial also revealed a limitation: transporting compost and tools to the roof required a service lift, which was unavailable in one of the buildings. The team recommends including maintenance costs in any feasibility study, rather than comparing only construction expenses and expected harvests. A second project is planned, but the council has not yet decided whether to fund it.',
    questions: [
      { type: 'multiple-choice', prompt: 'What did researchers say should happen before choosing crops for a roof?', options: ['A survey of the building.', 'A trial sale of produce.', 'A new drainage system.', 'A comparison with distant farms.'], answer: 'A survey of the building.', explanation: 'Paragraph A says the roof should be surveyed before crop decisions.' },
      { type: 'classification', prompt: 'The roof produced more vegetables overall than the ground-level plot.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], answer: 'FALSE', explanation: 'Paragraph B says the roof produced fewer kilograms overall.' },
      { type: 'classification', prompt: 'The roof crops became ready earlier because the growing conditions were warmer.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], answer: 'TRUE', explanation: 'The researchers linked the earlier crops to warmer conditions.' },
      { type: 'classification', prompt: 'The council has already approved funding for the second project.', options: ['TRUE', 'FALSE', 'NOT GIVEN'], answer: 'FALSE', explanation: 'Paragraph D says the council has not yet decided whether to fund it.' },
      { type: 'matching', prompt: 'Which paragraph contains the following information?', instruction: 'Choose a paragraph letter. You may use a letter more than once.', options: ['A', 'B', 'C', 'D'], items: [{ id: 'match-1', text: 'An unexpected benefit for relationships among neighbours', answer: 'C' }, { id: 'match-2', text: 'A factor that made moving materials difficult', answer: 'D' }], explanation: 'Paragraph C describes residents sharing tasks; paragraph D explains the service-lift problem.' },
      { type: 'matching-headings', prompt: 'Choose the best heading for paragraphs A and D.', instruction: 'Choose one heading for each paragraph. Options may be used once.', options: ['Assessing a site before planting', 'A social role beyond food production', 'Practical limits and future costs', 'A comparison of crop yields'], items: [{ id: 'heading-a', text: 'Paragraph A', answer: 'Assessing a site before planting' }, { id: 'heading-d', text: 'Paragraph D', answer: 'Practical limits and future costs' }], explanation: 'Paragraph A focuses on assessing roof suitability; paragraph D discusses access and ongoing costs.' },
      { type: 'matching-features', prompt: 'Match each view with the person or group who expressed it.', instruction: 'Choose the correct person or group for each view. Options may be used once.', options: ['The researchers', 'Leila Morgan'], items: [{ id: 'feature-1', text: 'The warmer conditions explained the earlier harvest.', answer: 'The researchers' }, { id: 'feature-2', text: 'The project’s strongest outcome was social.', answer: 'Leila Morgan' }], explanation: 'The researchers attributed earlier crops to warmer conditions; Morgan highlighted the social result.' },
      { type: 'matching-sentence-endings', prompt: 'Choose the correct ending for each sentence.', instruction: 'Choose one ending for each sentence. Options may be used once.', options: ['was unavailable in one building.', 'should include ongoing maintenance costs.', 'can replace conventional farms.'], items: [{ id: 'ending-1', text: 'The service lift', answer: 'was unavailable in one building.' }, { id: 'ending-2', text: 'A feasibility study', answer: 'should include ongoing maintenance costs.' }], explanation: 'Paragraph D says one building lacked a service lift and recommends accounting for maintenance costs.' },
      { type: 'multiple-select', prompt: 'Which TWO benefits of the rooftop trial are mentioned?', instruction: 'Choose TWO answers.', options: ['It provided a place for neighbours to cooperate.', 'It replaced the need for conventional farms.', 'It retained some rainwater.', 'It made every building suitable for growing crops.'], answer: ['It provided a place for neighbours to cooperate.', 'It retained some rainwater.'], explanation: 'The trial supported social cooperation and retained rainwater; the passage does not claim it replaced farms.' },
      { type: 'completion', prompt: 'Complete the summary using NO MORE THAN TWO WORDS from the passage.', instruction: 'Enter the exact words used in the text.', gaps: [{ id: 'gap-1', label: 'The roof retained some ________, helping to reduce pressure on street drains.', acceptedAnswers: ['rainwater'] }, { id: 'gap-2', label: 'The coordinator describes rooftop plots as part of a wider urban food ________.', acceptedAnswers: ['network'] }], explanation: 'The passage uses “rainwater” and “network” in these summary points.' },
      { type: 'short-answer', prompt: 'What type of building equipment was missing from one site? Use NO MORE THAN TWO WORDS.', acceptedAnswers: ['service lift'], wordLimit: 2, explanation: 'Paragraph D says a service lift was unavailable in one building.' },
      { type: 'labeling', prompt: 'Label the simplified route shown in the passage. Choose the place where produce was shared after some was sold locally.', diagramDescription: 'ROOF GARDEN  →  LOCAL SALES  →  [ LABEL ]', options: ['street drains', 'community kitchen', 'service lift'], items: [{ id: 'label-1', label: 'Destination for unsold produce', answer: 'community kitchen' }], explanation: 'Paragraph C says the remaining produce went to a nearby community kitchen.' },
    ],
  },
  fullLengthReadingTest,
]
