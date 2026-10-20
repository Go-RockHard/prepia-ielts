import type { TestPart } from '@/features/simulator/types'

export type LexicalCategory = 'Word' | 'Phrase' | 'Expression' | 'Collocation' | 'Discourse marker'

export interface LexicalEntry {
  id: string
  term: string
  category: LexicalCategory
  meaning: string
  example: string
  topic: string
  partOfSpeech?: string
  custom?: boolean
  meanings?: string[]
  examples?: string[]
  parts?: TestPart[]
  sampleQuestions?: string[]
}

export const lexicalCategories: LexicalCategory[] = [
  'Word',
  'Phrase',
  'Expression',
  'Collocation',
  'Discourse marker',
]

const lexicalPartsByTopic: Record<string, TestPart[]> = {
  'City life': ['part1', 'part2'],
  Travel: ['part1', 'part2'],
  Lifestyle: ['part1', 'part2'],
  Technology: ['part1', 'part3'],
  Experiences: ['part1', 'part2'],
  Home: ['part1', 'part2'],
  Society: ['part3'],
  'Work and study': ['part1', 'part2', 'part3'],
  Education: ['part1', 'part2', 'part3'],
  Relationships: ['part1', 'part2'],
  Food: ['part1', 'part2'],
  Preferences: ['part1'],
  Opinions: ['part1', 'part3'],
  Community: ['part2', 'part3'],
  People: ['part2', 'part3'],
  Environment: ['part3'],
  'Organising ideas': ['part2', 'part3'],
  'Giving examples': ['part2', 'part3'],
  'Contrasting ideas': ['part3'],
  'Cause and effect': ['part3'],
  'Developing an argument': ['part3'],
  'Giving opinions': ['part3'],
}

export const starterLexicalEntries: LexicalEntry[] = ([
  { id: 'bustling', term: 'bustling', category: 'Word', partOfSpeech: 'adjective', meaning: 'Full of lively activity and movement.', example: 'The city centre is bustling at lunchtime, especially near the market.', topic: 'City life' },
  { id: 'picturesque', term: 'picturesque', category: 'Word', partOfSpeech: 'adjective', meaning: 'Visually attractive in a charming or distinctive way.', example: 'We stayed in a picturesque village overlooking the coast.', topic: 'Travel' },
  { id: 'unwind', term: 'unwind', category: 'Word', partOfSpeech: 'verb', meaning: 'To relax after a period of work or stress.', example: 'I usually unwind by taking a long walk after work.', topic: 'Lifestyle' },
  { id: 'rewarding', term: 'rewarding', category: 'Word', partOfSpeech: 'adjective', meaning: 'Providing satisfaction or a sense of achievement.', example: 'Teaching children can be challenging but incredibly rewarding.', topic: 'Work and study' },
  { id: 'convenient', term: 'convenient', category: 'Word', partOfSpeech: 'adjective', meaning: 'Useful because it suits a person’s needs or saves time.', example: 'Online banking is convenient because I can use it at any time.', topic: 'Technology' },
  { id: 'sustainable', term: 'sustainable', category: 'Word', partOfSpeech: 'adjective', meaning: 'Able to continue over time without causing lasting harm.', example: 'Cycling is a more sustainable way to travel short distances.', topic: 'Environment' },
  { id: 'memorable', term: 'memorable', category: 'Word', partOfSpeech: 'adjective', meaning: 'Worth remembering because it was unusual or enjoyable.', example: 'The most memorable part of the trip was watching the sunrise.', topic: 'Experiences' },
  { id: 'spacious', term: 'spacious', category: 'Word', partOfSpeech: 'adjective', meaning: 'Large and having plenty of room.', example: 'Our new flat is much more spacious than the old one.', topic: 'Home' },
  { id: 'affordable', term: 'affordable', category: 'Word', partOfSpeech: 'adjective', meaning: 'Inexpensive enough for most people to buy or use.', example: 'Public transport needs to be reliable and affordable.', topic: 'Society' },
  { id: 'adaptable', term: 'adaptable', category: 'Word', partOfSpeech: 'adjective', meaning: 'Able to adjust easily to new conditions.', example: 'I became more adaptable after moving to a different city.', topic: 'Work and study' },
  { id: 'broaden-horizons', term: 'broaden your horizons', category: 'Phrase', meaning: 'To gain new experiences and learn about different perspectives.', example: 'Studying abroad can broaden your horizons and build independence.', topic: 'Education' },
  { id: 'quality-time', term: 'spend quality time', category: 'Phrase', meaning: 'To give someone your full attention while spending time together.', example: 'At weekends, I try to spend quality time with my family.', topic: 'Relationships' },
  { id: 'keep-in-touch', term: 'keep in touch', category: 'Phrase', meaning: 'To continue communicating with someone.', example: 'Although my friends live overseas, we keep in touch online.', topic: 'Relationships' },
  { id: 'make-the-most', term: 'make the most of', category: 'Phrase', meaning: 'To use an opportunity or resource as effectively as possible.', example: 'I made the most of the short holiday by exploring on foot.', topic: 'Travel' },
  { id: 'from-scratch', term: 'from scratch', category: 'Phrase', meaning: 'Starting from the beginning, without using anything already prepared.', example: 'My grandmother taught me how to make bread from scratch.', topic: 'Food' },
  { id: 'a-change-of-pace', term: 'a welcome change of pace', category: 'Expression', meaning: 'A pleasant difference from a usual routine or situation.', example: 'Spending a day in the countryside is a welcome change of pace.', topic: 'Lifestyle' },
  { id: 'if-i-had-to-choose', term: 'If I had to choose, I’d say…', category: 'Expression', meaning: 'A natural way to introduce a preference when there are several options.', example: 'If I had to choose, I’d say reading is my favourite way to relax.', topic: 'Preferences' },
  { id: 'it-depends', term: 'It depends on…', category: 'Expression', meaning: 'A way to show that an answer changes according to the circumstances.', example: 'It depends on the weather, but I usually walk to work.', topic: 'Opinions' },
  { id: 'what-i-appreciate', term: 'What I appreciate most is…', category: 'Expression', meaning: 'A phrase for emphasizing the most valued aspect of something.', example: 'What I appreciate most is how supportive my colleagues are.', topic: 'Opinions' },
  { id: 'take-pride', term: 'take pride in', category: 'Collocation', meaning: 'To feel pleased about the quality of something you do or own.', example: 'Local residents take pride in keeping the neighbourhood clean.', topic: 'Community' },
  { id: 'strong-influence', term: 'have a strong influence on', category: 'Collocation', meaning: 'To affect a person, decision, or situation considerably.', example: 'My first teacher had a strong influence on my confidence.', topic: 'People' },
  { id: 'raise-awareness', term: 'raise awareness of', category: 'Collocation', meaning: 'To help more people understand an issue or situation.', example: 'Documentaries can raise awareness of environmental problems.', topic: 'Environment' },
  { id: 'strike-balance', term: 'strike a balance between', category: 'Collocation', meaning: 'To find a reasonable middle point between competing needs.', example: 'It can be difficult to strike a balance between work and family life.', topic: 'Lifestyle' },
  { id: 'sense-of-belonging', term: 'a sense of belonging', category: 'Collocation', meaning: 'The feeling of being accepted as part of a group or place.', example: 'Community events can give newcomers a sense of belonging.', topic: 'Community' },
  { id: 'wide-range', term: 'a wide range of', category: 'Collocation', meaning: 'Many different types or examples of something.', example: 'The library has a wide range of books for young readers.', topic: 'Education' },
  { id: 'first-and-foremost', term: 'First and foremost,', category: 'Discourse marker', meaning: 'Introduces the most important point in a response.', example: 'First and foremost, public parks give people space to exercise.', topic: 'Organising ideas' },
  { id: 'for-instance', term: 'For instance,', category: 'Discourse marker', meaning: 'Introduces a specific example to support an idea.', example: 'For instance, my local market sells produce from nearby farms.', topic: 'Giving examples' },
  { id: 'that-being-said', term: 'That being said,', category: 'Discourse marker', meaning: 'Introduces a contrast or qualification to the previous point.', example: 'That being said, commuting by car is still necessary in some areas.', topic: 'Contrasting ideas' },
  { id: 'as-a-result', term: 'As a result,', category: 'Discourse marker', meaning: 'Shows the consequence of an action or situation.', example: 'The bus service became more frequent; as a result, fewer people drove.', topic: 'Cause and effect' },
  { id: 'in-the-long-run', term: 'In the long run,', category: 'Discourse marker', meaning: 'Refers to an outcome over an extended period of time.', example: 'In the long run, investing in public transport could reduce congestion.', topic: 'Developing an argument' },
  { id: 'to-some-extent', term: 'To some extent,', category: 'Discourse marker', meaning: 'Signals a partly agreeing or qualified opinion.', example: 'To some extent, social media helps people maintain friendships.', topic: 'Giving opinions' },
] satisfies LexicalEntry[]).map((entry) => ({
  ...entry,
  parts: lexicalPartsByTopic[entry.topic] ?? ['part1', 'part2', 'part3'],
}))
