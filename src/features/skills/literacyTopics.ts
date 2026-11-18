import type { SkillProduct } from '@/features/skills/literacyStorage'

export type TopicPreset = {
  id: string
  topic: string
  angle: string
  testTypes: Array<'Academic' | 'General Training'>
}

const academic: TopicPreset[] = [
  { id: 'urban-heat', topic: 'Urban heat and public health', angle: 'How street design changes exposure to summer heat', testTypes: ['Academic'] },
  { id: 'pollinator-corridors', topic: 'Urban biodiversity', angle: 'Measuring whether pollinator corridors support insect populations', testTypes: ['Academic'] },
  { id: 'renewable-grids', topic: 'Renewable energy systems', angle: 'Balancing local energy storage with variable supply', testTypes: ['Academic'] },
  { id: 'museum-access', topic: 'Museum access and interpretation', angle: 'Testing how layered exhibit labels affect visitor understanding', testTypes: ['Academic'] },
  { id: 'coastal-monitoring', topic: 'Coastal change research', angle: 'How community observations supplement shoreline surveys', testTypes: ['Academic'] },
  { id: 'food-waste', topic: 'Food waste reduction', angle: 'Comparing household and retail interventions using measured outcomes', testTypes: ['Academic'] },
  { id: 'sleep-learning', topic: 'Sleep and learning', angle: 'What controlled studies can and cannot show about recall', testTypes: ['Academic'] },
  { id: 'public-libraries', topic: 'Public library services', angle: 'Evaluating study spaces and digital help for adult learners', testTypes: ['Academic'] },
  { id: 'water-reuse', topic: 'Water reuse in cities', angle: 'How neighbourhood trials monitor safety and public acceptance', testTypes: ['Academic'] },
  { id: 'wildlife-crossings', topic: 'Wildlife crossings', angle: 'Using camera records to evaluate road-crossing structures', testTypes: ['Academic'] },
  { id: 'language-change', topic: 'Language and communication', angle: 'How researchers track changes in everyday vocabulary', testTypes: ['Academic'] },
  { id: 'sustainable-tourism', topic: 'Sustainable tourism', angle: 'Measuring the effects of visitor limits on small communities', testTypes: ['Academic'] },
]

const general: TopicPreset[] = [
  { id: 'community-centre', topic: 'Community centre services', angle: 'A new resident compares classes, opening hours, and membership options', testTypes: ['General Training'] },
  { id: 'workplace-training', topic: 'Workplace training', angle: 'A staff member asks about a new skills course and its schedule', testTypes: ['General Training'] },
  { id: 'rental-repairs', topic: 'Rental accommodation', angle: 'A tenant reports a repair and clarifies access arrangements', testTypes: ['General Training'] },
  { id: 'local-transport', topic: 'Local transport', angle: 'Passengers compare route changes and accessible travel options', testTypes: ['General Training'] },
  { id: 'volunteer-project', topic: 'Volunteering', angle: 'An organiser briefs new volunteers on a local event', testTypes: ['General Training'] },
  { id: 'library-membership', topic: 'Library membership', angle: 'A visitor asks about borrowing, study rooms, and digital services', testTypes: ['General Training'] },
  { id: 'job-application', topic: 'Job applications', angle: 'An applicant confirms duties, interview arrangements, and required documents', testTypes: ['General Training'] },
  { id: 'health-appointment', topic: 'Health appointments', angle: 'A caller checks appointment times and practical preparation details', testTypes: ['General Training'] },
  { id: 'neighbourhood-event', topic: 'Neighbourhood events', angle: 'Residents plan a street event and allocate responsibilities', testTypes: ['General Training'] },
  { id: 'short-course', topic: 'Adult education', angle: 'A learner compares course levels, fees, and enrolment requirements', testTypes: ['General Training'] },
  { id: 'travel-booking', topic: 'Travel arrangements', angle: 'A customer clarifies a booking change and available alternatives', testTypes: ['General Training'] },
  { id: 'workplace-safety', topic: 'Workplace procedures', angle: 'A supervisor explains a revised safety process to a new colleague', testTypes: ['General Training'] },
]

const readingAcademic: TopicPreset[] = [
  { id: 'reading-academic-scan', topic: 'Scientific field research', angle: 'How a research team distinguishes observations from estimates', testTypes: ['Academic'] },
  { id: 'reading-architecture', topic: 'Architecture and climate', angle: 'How building materials influence indoor temperatures', testTypes: ['Academic'] },
  { id: 'reading-archaeology', topic: 'Archaeological methods', angle: 'What layered evidence reveals about a settlement site', testTypes: ['Academic'] },
  { id: 'reading-food-systems', topic: 'Food systems', angle: 'How seasonal supply affects urban food distribution', testTypes: ['Academic'] },
]

const readingGeneral: TopicPreset[] = [
  { id: 'reading-workplace', topic: 'Workplace information', angle: 'A staff handbook explains leave, equipment, and reporting procedures', testTypes: ['General Training'] },
  { id: 'reading-housing', topic: 'Housing information', angle: 'A tenant guide compares services, responsibilities, and repair contacts', testTypes: ['General Training'] },
  { id: 'reading-training', topic: 'Training opportunities', angle: 'A course guide explains entry levels, schedules, and enrolment', testTypes: ['General Training'] },
  { id: 'reading-services', topic: 'Public services', angle: 'A local information page explains access, opening times, and eligibility', testTypes: ['General Training'] },
]

export function getTopicPresets(product: SkillProduct, testType: 'Academic' | 'General Training'): TopicPreset[] {
  const base = testType === 'Academic' ? academic : general
  if (product !== 'readia') return base
  return [...base, ...(testType === 'Academic' ? readingAcademic : readingGeneral)]
}
