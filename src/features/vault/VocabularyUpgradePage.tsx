import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Pencil, Plus, Search, Sparkles, X } from 'lucide-react'
import { LexicalPronunciationButton } from './LexicalPronunciationButton'
import type { TestPart } from '@/features/simulator/types'

type UpgradeCategory = 'Everyday verbs' | 'Describing things' | 'Feelings & opinions' | 'Collocations' | 'Linking ideas' | 'Idiomatic phrases'

interface VocabularyUpgrade {
  basic: string
  precise: string
  phrase: string
  examples: string[]
  category: UpgradeCategory
  note?: string
}

interface SpeakingSentenceStarter {
  id: string
  part: Exclude<TestPart, 'full'>
  purpose: string
  starter: string
  example: string
  guidance: string
}

const categories: ('All' | UpgradeCategory | 'Sentence starters')[] = [
  'All', 'Everyday verbs', 'Describing things', 'Feelings & opinions', 'Collocations', 'Linking ideas', 'Idiomatic phrases', 'Sentence starters',
]

const upgrades: VocabularyUpgrade[] = [
  { basic: 'get', precise: 'obtain / receive', phrase: 'gain access to', examples: ['A public library gives residents access to books and reliable information.', 'Reliable online services allow people to obtain documents without travelling to an office.'], category: 'Everyday verbs' },
  { basic: 'make', precise: 'create / produce', phrase: 'make a meaningful contribution to', examples: ['Volunteering can make a meaningful contribution to the local community.', 'The new walking path made a meaningful contribution to the area by connecting several neighbourhoods.'], category: 'Everyday verbs' },
  { basic: 'do exercise', precise: 'exercise / train', phrase: 'take part in regular physical activity', examples: ['People who take part in regular physical activity often feel more energetic.', 'I take part in regular physical activity by cycling to work a few times a week.'], category: 'Everyday verbs' },
  { basic: 'help', precise: 'support / enable', phrase: 'play an important role in', examples: ["Teachers play an important role in building a student's confidence.", 'Local volunteers play an important role in keeping community events welcoming.'], category: 'Everyday verbs' },
  { basic: 'think', precise: 'believe / consider', phrase: 'I tend to think that', examples: ['I tend to think that public transport should be affordable for everyone.', 'I tend to think that practical experience is just as valuable as classroom learning.'], category: 'Feelings & opinions' },
  { basic: 'like', precise: 'enjoy / appreciate', phrase: "I'm particularly fond of", examples: ["I'm particularly fond of small cafes because they feel welcoming.", "I'm particularly fond of walking by the river, especially when I need some quiet time."], category: 'Feelings & opinions' },
  { basic: 'want', precise: 'hope / aim', phrase: 'I would like to see', examples: ['I would like to see more safe cycling routes in residential areas.', 'I would like to see schools offer more opportunities for creative projects.'], category: 'Feelings & opinions' },
  { basic: 'I agree', precise: 'I share that view', phrase: 'I agree to a large extent', examples: ["I agree to a large extent, although it can depend on a person's circumstances.", 'I agree to a large extent that public parks improve the quality of city life.'], category: 'Feelings & opinions' },
  { basic: "I don't agree", precise: 'I see it differently', phrase: "I'm not entirely convinced that", examples: ["I'm not entirely convinced that online lessons can replace every classroom activity.", "I'm not entirely convinced that a longer commute always means a less enjoyable job."], category: 'Feelings & opinions' },
  { basic: 'very good', precise: 'effective / beneficial', phrase: 'particularly beneficial for', examples: ['Flexible working can be particularly beneficial for parents with young children.', "Learning a musical instrument can be particularly beneficial for children's concentration."], category: 'Describing things' },
  { basic: 'very bad', precise: 'harmful / damaging', phrase: 'have a negative impact on', examples: ['Excessive traffic can have a negative impact on air quality.', "A lack of sleep can have a negative impact on a person's ability to focus."], category: 'Describing things' },
  { basic: 'important', precise: 'essential / significant', phrase: 'play a crucial part in', examples: ['Trust plays a crucial part in maintaining close friendships.', 'Affordable childcare can play a crucial part in helping parents return to work.'], category: 'Describing things' },
  { basic: 'interesting', precise: 'engaging / thought-provoking', phrase: 'I find it fascinating that', examples: ['I find it fascinating that the same event can be remembered differently by people.', 'I find it fascinating that local traditions can change while still keeping their original meaning.'], category: 'Describing things' },
  { basic: 'beautiful', precise: 'scenic / visually striking', phrase: 'an impressive natural landscape', examples: ['The region is known for its impressive natural landscape and quiet walking trails.', 'We drove through an impressive natural landscape of mountains, forests, and open fields.'], category: 'Describing things' },
  { basic: 'busy', precise: 'lively / crowded', phrase: 'a lively atmosphere', examples: ['The market has a lively atmosphere, especially in the early morning.', 'There is a lively atmosphere in the town square whenever musicians perform.'], category: 'Describing things' },
  { basic: 'big problem', precise: 'major challenge', phrase: 'a pressing issue', examples: ['Housing affordability has become a pressing issue for many young adults.', 'Reducing food waste is a pressing issue for cities with limited landfill space.'], category: 'Describing things' },
  { basic: 'a lot of', precise: 'numerous / a wide range of', phrase: 'a considerable amount of', examples: ['The project required a considerable amount of time and careful planning.', 'A considerable amount of household waste can be avoided through reuse and recycling.'], category: 'Describing things' },
  { basic: 'small change', precise: 'modest improvement', phrase: 'a gradual but noticeable improvement', examples: ['There has been a gradual but noticeable improvement in local recycling rates.', 'After a few months of practice, I noticed a gradual but noticeable improvement in my pronunciation.'], category: 'Describing things' },
  { basic: 'become better', precise: 'improve / develop', phrase: 'make steady progress', examples: ['With regular practice, I began to make steady progress in speaking English.', 'The team made steady progress once everyone agreed on clear responsibilities.'], category: 'Everyday verbs' },
  { basic: 'change something', precise: 'adapt / transform', phrase: 'bring about lasting change', examples: ["Good public policy can bring about lasting change in people's quality of life.", 'Small daily habits can bring about lasting change when people maintain them over time.'], category: 'Everyday verbs' },
  { basic: 'fix a problem', precise: 'address / resolve', phrase: 'tackle the underlying cause', examples: ['Cities need to tackle the underlying causes of traffic congestion.', 'To reduce absenteeism, employers should tackle the underlying causes rather than punish workers.'], category: 'Everyday verbs' },
  { basic: 'learn a skill', precise: 'develop a skill', phrase: 'acquire practical experience', examples: ['Part-time work helped me acquire practical experience before graduation.', 'Students can acquire practical experience by working on projects with local organisations.'], category: 'Everyday verbs' },
  { basic: 'make a decision', precise: 'reach a decision', phrase: 'make an informed choice', examples: ['It is easier to make an informed choice when people can compare reliable information.', 'Before choosing a course, I spoke to graduates so I could make an informed choice.'], category: 'Collocations' },
  { basic: 'have a chance', precise: 'have an opportunity', phrase: 'be given the opportunity to', examples: ['Every student should be given the opportunity to explore their interests.', 'I was given the opportunity to lead a small project during my internship.'], category: 'Collocations' },
  { basic: 'spend time', precise: 'devote time', phrase: 'set aside time for', examples: ['I try to set aside time for reading, even when I have a busy schedule.', 'Many people set aside time for exercise because it helps them manage stress.'], category: 'Collocations' },
  { basic: 'learn new things', precise: 'expand your knowledge', phrase: 'broaden your perspective', examples: ['Travelling can broaden your perspective by introducing you to different ways of life.', 'Reading biographies can broaden your perspective on how people overcome setbacks.'], category: 'Collocations' },
  { basic: 'feel part of a group', precise: 'feel included', phrase: 'develop a sense of belonging', examples: ['Community events help newcomers develop a sense of belonging.', 'Joining a sports club helped me develop a sense of belonging in my new town.'], category: 'Collocations' },
  { basic: 'cause a problem', precise: 'lead to a difficulty', phrase: 'give rise to concerns about', examples: ['The rapid spread of misinformation gives rise to concerns about public trust.', 'Using personal data without consent can give rise to concerns about privacy.'], category: 'Collocations' },
  { basic: 'solve a problem', precise: 'find a solution', phrase: 'address the issue effectively', examples: ['Local councils need to address the issue effectively rather than rely on short-term fixes.', 'Clear communication can help a team address the issue effectively before it becomes more serious.'], category: 'Collocations' },
  { basic: 'good for the environment', precise: 'environmentally friendly', phrase: 'have a smaller environmental footprint', examples: ['Walking short distances can help people have a smaller environmental footprint.', 'Repairing household items is one way to have a smaller environmental footprint.'], category: 'Collocations' },
  { basic: 'first', precise: 'initially / to begin with', phrase: 'one point worth considering is', examples: ['One point worth considering is how the change would affect older residents.', 'One point worth considering is whether the new service would be accessible to rural families.'], category: 'Linking ideas' },
  { basic: 'also', precise: 'additionally / moreover', phrase: 'another factor to take into account is', examples: ['Another factor to take into account is the cost of maintaining the service.', 'Another factor to take into account is how much time people have available.'], category: 'Linking ideas' },
  { basic: 'for example', precise: 'for instance', phrase: 'a case in point is', examples: ['A case in point is my neighbourhood, where a new bus route reduced commuting time.', 'A case in point is online banking, which lets customers manage routine payments at home.'], category: 'Linking ideas' },
  { basic: 'but', precise: 'however / nevertheless', phrase: 'that said,', examples: ['That said, working from home is not suitable for every occupation.', 'That said, cheaper products are not always the most reliable option.'], category: 'Linking ideas' },
  { basic: 'because of this', precise: 'therefore / consequently', phrase: 'as a consequence,', examples: ['The service became more reliable; as a consequence, more people started using it.', 'The road was closed for repairs; as a consequence, buses had to follow a longer route.'], category: 'Linking ideas' },
  { basic: 'it depends', precise: 'it varies', phrase: 'that largely depends on', examples: ['Whether I prefer to study alone largely depends on the subject.', 'How often I cook at home largely depends on my work schedule.'], category: 'Linking ideas' },
  { basic: 'rarely', precise: 'infrequently', phrase: 'once in a while', examples: ['I eat out once in a while, usually to celebrate a special occasion.', 'Once in a while, I take a day trip to explore a place nearby.'], category: 'Idiomatic phrases', note: 'Informal; use only when it fits your meaning.' },
  { basic: 'start something', precise: 'begin / initiate', phrase: 'get the ball rolling', examples: ['A short team meeting can get the ball rolling on a new project.', 'I volunteered to organise the first event and get the ball rolling.'], category: 'Idiomatic phrases', note: 'Conversational; avoid forcing it into formal explanations.' },
  { basic: 'a refreshing change', precise: 'a welcome alternative', phrase: 'a breath of fresh air', examples: ['The quiet park is a breath of fresh air after a week in the city.', 'Her practical approach was a breath of fresh air during a difficult project.'], category: 'Idiomatic phrases', note: 'Natural in personal examples; keep idioms occasional.' },
  { basic: 'study hard', precise: 'study intensively', phrase: 'hit the books', examples: ['I had to hit the books for a few weeks before my final exams.', 'At weekends, I hit the books in the morning and relax later in the day.'], category: 'Idiomatic phrases', note: 'Informal; best suited to a personal Part 1 or Part 2 answer.' },
  { basic: 'a new experience', precise: 'an unfamiliar experience', phrase: 'a learning curve', examples: ['Moving to a new city involved a steep learning curve, but I adapted quickly.', 'My first job had a steep learning curve, especially when I started using new software.'], category: 'Idiomatic phrases', note: 'Common expression; use it only when you mean a period of learning.' },
]

const sentenceStarters: SpeakingSentenceStarter[] = [
  { id: 'p1-preference', part: 'part1', purpose: 'Expressing a preference', starter: 'If I had to choose, I’d say…', example: 'If I had to choose, I’d say I prefer travelling by train because I can relax along the way.', guidance: 'Answer directly, then add a specific reason or example.' },
  { id: 'p1-routine', part: 'part1', purpose: 'Describing a routine', starter: 'I usually…, particularly when…', example: 'I usually go for a walk, particularly when I need a break from work.', guidance: 'Keep it personal and concise; one detail is often enough for Part 1.' },
  { id: 'p1-frequency', part: 'part1', purpose: 'Talking about frequency', starter: 'I tend to…, although…', example: 'I tend to cook at home, although I sometimes eat out at weekends.', guidance: 'Use the contrast to add a natural second detail.' },
  { id: 'p1-memory', part: 'part1', purpose: 'Giving a personal example', starter: 'One example that comes to mind is…', example: 'One example that comes to mind is a small bookshop near my home that I visit after work.', guidance: 'Choose a real, simple example rather than a memorised story.' },
  { id: 'p1-change', part: 'part1', purpose: 'Describing change over time', starter: 'I used to…, but these days…', example: 'I used to spend most evenings indoors, but these days I try to meet a friend or exercise.', guidance: 'Make the past-versus-present contrast clear.' },
  { id: 'p2-intro', part: 'part2', purpose: 'Introducing a story', starter: 'I’d like to talk about…', example: 'I’d like to talk about a family trip that I still remember clearly.', guidance: 'Name the person, place, event, or object, then establish when or where it happened.' },
  { id: 'p2-setting', part: 'part2', purpose: 'Setting the scene', starter: 'This happened when…', example: 'This happened when I was studying at university, during my summer break.', guidance: 'Give a brief time and place before adding the main events.' },
  { id: 'p2-sequence', part: 'part2', purpose: 'Sequencing events', starter: 'At first…, and then…', example: 'At first, I was unsure what to do, and then a colleague suggested a practical solution.', guidance: 'Use a few clear stages to keep the long turn easy to follow.' },
  { id: 'p2-detail', part: 'part2', purpose: 'Adding a specific detail', starter: 'What made it especially memorable was…', example: 'What made it especially memorable was how everyone worked together without being asked.', guidance: 'Add a concrete action, detail, or reaction instead of repeating the topic.' },
  { id: 'p2-reflection', part: 'part2', purpose: 'Explaining significance', starter: 'Looking back, I realise that…', example: 'Looking back, I realise that the experience taught me to be more patient.', guidance: 'End by explaining why the experience mattered to you.' },
  { id: 'p3-position', part: 'part3', purpose: 'Giving a considered opinion', starter: 'On balance, I’d argue that…', example: 'On balance, I’d argue that public transport should receive more investment in large cities.', guidance: 'State your position clearly before supporting it.' },
  { id: 'p3-reason', part: 'part3', purpose: 'Explaining a reason', starter: 'One of the main reasons is that…', example: 'One of the main reasons is that reliable transport gives people more access to work and education.', guidance: 'Explain the cause behind your opinion, not just the opinion itself.' },
  { id: 'p3-example', part: 'part3', purpose: 'Supporting an idea', starter: 'A good example of this would be…', example: 'A good example of this would be a city that offers discounted travel to students.', guidance: 'Use an example to clarify the idea; avoid making unsupported sweeping claims.' },
  { id: 'p3-balance', part: 'part3', purpose: 'Showing balance', starter: 'That said, it’s also worth considering…', example: 'That said, it’s also worth considering the cost of maintaining these services.', guidance: 'Acknowledge a relevant limitation while keeping your main position clear.' },
  { id: 'p3-compare', part: 'part3', purpose: 'Comparing perspectives', starter: 'Compared with the past,…', example: 'Compared with the past, people can now access news much more quickly, although they may see less reliable sources.', guidance: 'Make the basis of comparison explicit and explain what has changed.' },
  { id: 'p3-future', part: 'part3', purpose: 'Discussing the future', starter: 'In the long term, I suspect…', example: 'In the long term, I suspect more people will work remotely, but face-to-face collaboration will remain important.', guidance: 'Signal that it is a prediction and briefly explain why it is plausible.' },
  { id: 'p1-reason', part: 'part1', purpose: 'Explaining why', starter: 'The main reason I enjoy it is…', example: 'The main reason I enjoy it is that it gives me time to slow down and think.', guidance: 'Connect your preference to one clear personal reason.' },
  { id: 'p1-uncertain', part: 'part1', purpose: 'Qualifying an answer', starter: 'I haven’t really thought about it before, but…', example: 'I haven’t really thought about it before, but I suppose I use my phone most for keeping in touch.', guidance: 'Use this naturally if you need a moment, then answer the question.' },
  { id: 'p2-people', part: 'part2', purpose: 'Describing a person', starter: 'The first thing that comes to mind is…', example: 'The first person that comes to mind is my former teacher, who encouraged me to speak with confidence.', guidance: 'Identify the person and explain your connection before giving details.' },
  { id: 'p2-feelings', part: 'part2', purpose: 'Describing a reaction', starter: 'At the time, I felt…, because…', example: 'At the time, I felt quite nervous, because I had never spoken in front of such a large group.', guidance: 'Link a feeling to the event that caused it.' },
  { id: 'p3-cause', part: 'part3', purpose: 'Explaining causes and effects', starter: 'This is largely because…', example: 'This is largely because people can compare options quickly and learn from other users’ experiences.', guidance: 'Follow the claim with a specific explanation of the cause.' },
  { id: 'p3-general', part: 'part3', purpose: 'Making a general observation', starter: 'In many cases,…', example: 'In many cases, people are more likely to use a service when it is affordable and convenient.', guidance: 'Avoid claiming that a point applies to everyone unless you can support it.' },
]

const exampleStoragePrefix = 'speakia-vocabulary-upgrade-examples-v1:'

function loadCustomExamples(username: string): Record<string, string[]> {
  try {
    const stored = localStorage.getItem(`${exampleStoragePrefix}${username.toLocaleLowerCase()}`)
    if (!stored) return {}
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].every((sentence) => typeof sentence === 'string'),
    ))
  } catch (error) {
    console.error('Unable to load saved Vocabulary Upgrade examples.', error)
    return {}
  }
}

export function VocabularyUpgradePage({ apiKey, username, onStartCoachLive }: {
  apiKey: string
  username: string
  onStartCoachLive: (title: string, context: string) => void
}) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All')
  const [search, setSearch] = useState('')
  const [customExamples, setCustomExamples] = useState<Record<string, string[]>>(() => loadCustomExamples(username))
  const [exampleEditor, setExampleEditor] = useState<{ itemId: string; index: number | null } | null>(null)
  const [exampleDraft, setExampleDraft] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(`${exampleStoragePrefix}${username.toLocaleLowerCase()}`, JSON.stringify(customExamples))
    } catch (error) {
      console.error('Unable to save Vocabulary Upgrade examples.', error)
    }
  }, [customExamples, username])

  const filteredUpgrades = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return upgrades.filter((item) => (category === 'All' || item.category === category)
      && (!query || [item.basic, item.precise, item.phrase, ...item.examples, item.category, item.note ?? ''].some((value) => value.toLocaleLowerCase().includes(query))))
  }, [category, search])
  const filteredStarters = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return sentenceStarters.filter((item) => (
      (category === 'All' || category === 'Sentence starters')
      && (!query || [item.starter, item.purpose, item.example, item.guidance, item.part].some((value) => value.toLocaleLowerCase().includes(query)))
    ))
  }, [category, search])

  function saveExample(event: React.FormEvent<HTMLFormElement>, itemId: string, index: number | null) {
    event.preventDefault()
    const sentence = exampleDraft.trim()
    if (!sentence) return
    setCustomExamples((current) => ({
      ...current,
      [itemId]: index === null
        ? [...(current[itemId] ?? []), sentence]
        : (current[itemId] ?? []).map((example, exampleIndex) => exampleIndex === index ? sentence : example),
    }))
    setExampleDraft('')
    setExampleEditor(null)
  }

  function renderExampleEditor(itemId: string, phrase: string, index: number | null) {
    return <form className="vocab-upgrade-example-edit-form" onSubmit={(event) => saveExample(event, itemId, index)}>
      <textarea aria-label={`${index === null ? 'Write' : 'Edit'} an example using ${phrase}`} value={exampleDraft} onChange={(event) => setExampleDraft(event.target.value)} maxLength={400} rows={2} placeholder="Write your own example sentence..." />
      <button type="submit" aria-label={index === null ? 'Add example sentence' : 'Save example sentence'} title={index === null ? 'Add example sentence' : 'Save example sentence'} disabled={!exampleDraft.trim()}>{index === null ? <Plus size={15} /> : <Sparkles size={14} />}</button>
      <button type="button" aria-label="Cancel example edit" title="Cancel" onClick={() => { setExampleEditor(null); setExampleDraft('') }}><X size={14} /></button>
    </form>
  }

  function askCoach(item: VocabularyUpgrade, examples: string[]) {
    onStartCoachLive(item.phrase, [
      'Vocabulary Upgrade row context:',
      `Everyday wording: ${item.basic}`,
      `More precise alternatives: ${item.precise}`,
      `Natural IELTS phrase: ${item.phrase}`,
      `Category: ${item.category}`,
      ...(item.note ? [`Register and usage note: ${item.note}`] : []),
      'Preset and candidate-written example sentences:',
      ...examples.map((example, index) => `${index + 1}. ${example}`),
      'Give focused IELTS Speaking guidance: explain meaning and nuance, distinguish the precise alternatives, show how to use the natural phrase accurately, and help the learner adapt it to their own answer. Do not encourage memorised or forced language.',
    ].join('\n'))
  }

  function practiseStarter(item: SpeakingSentenceStarter) {
    onStartCoachLive(item.starter, [
      'IELTS Speaking sentence-starter practice:',
      `Test part: ${item.part.replace('part', 'Part ')}`,
      `Purpose: ${item.purpose}`,
      `Sentence starter: ${item.starter}`,
      `Example: ${item.example}`,
      `Usage guidance: ${item.guidance}`,
      'Start a real-time speaking practice. Ask the learner an IELTS Speaking question suited to this purpose, listen to their answer, and help them use or adapt the starter naturally. Do not require them to repeat the example verbatim.',
    ].join('\n'))
  }

  return <div className="page-content inner-page vocab-upgrade-page">
    <header className="vocab-upgrade-heading">
      <div>
        <p className="eyebrow">LEXIS - SPEAK WITH PRECISION</p>
        <h1>Vocabulary Upgrade</h1>
        <p className="page-subtitle">Upgrade basic everyday wording to precise, natural IELTS Speaking vocabulary.</p>
      </div>
      <span className="vocab-upgrade-count"><Sparkles size={15} /> {category === 'Sentence starters' ? `${filteredStarters.length} starters` : `${filteredUpgrades.length} comparisons`}</span>
    </header>

    <section className="vocab-upgrade-controls" aria-label="Find vocabulary resources">
      <label className="vocab-upgrade-search"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={category === 'Sentence starters' ? 'Search starters, examples, or purpose...' : 'Search a word, phrase, or example...'} aria-label="Search Vocabulary Upgrade resources" /></label>
      <div className="vocab-upgrade-categories" role="group" aria-label="Filter Vocabulary Upgrade resources">
        {categories.map((item) => <button type="button" key={item} aria-pressed={category === item} className={category === item ? 'vocab-upgrade-category-active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
    </section>

    <div>
      <p className="vocab-upgrade-guidance">{category === 'Sentence starters'
        ? 'Use these flexible openings to organize an answer, not as scripts. Adapt them to the question and your own meaning.'
        : 'Choose language that fits your meaning. Clear, accurate vocabulary is stronger than an advanced phrase used unnaturally.'}</p>

    {category === 'Sentence starters' ? (filteredStarters.length > 0 ? <div className="vocab-upgrade-table-wrap">
      <table className="vocab-upgrade-table">
        <thead><tr><th scope="col">Purpose</th><th scope="col">IELTS part</th><th scope="col">Sentence starter</th><th scope="col">In context</th></tr></thead>
        <tbody>{filteredStarters.map((item) => <tr key={item.id}>
          <td data-label="Purpose"><span>{item.purpose}</span></td>
          <td data-label="IELTS part"><strong>{item.part.replace('part', 'Part ')}</strong></td>
          <td data-label="Sentence starter">
            <span className="vocab-upgrade-phrase">{item.starter}</span>
            <div className="vocab-upgrade-row-actions">
              <LexicalPronunciationButton term={item.starter.replace(/[.…]+$/, '')} apiKey={apiKey} />
              <button type="button" className="vocab-upgrade-ask" onClick={() => practiseStarter(item)}><MessageCircle size={15} /> Practise with Speakia</button>
            </div>
          </td>
          <td data-label="In context"><div className="vocab-upgrade-example-list"><div className="vocab-upgrade-example"><p>{item.example}</p></div></div><small>{item.guidance}</small></td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="vocab-upgrade-empty"><Search size={18} /><strong>No sentence starters found</strong><span>Try another search.</span></div>) : filteredUpgrades.length > 0 ? <div className="vocab-upgrade-table-wrap">
      <table className="vocab-upgrade-table">
        <thead><tr><th scope="col">Everyday wording</th><th scope="col">More precise</th><th scope="col">Natural phrase</th><th scope="col">In context</th></tr></thead>
        <tbody>{filteredUpgrades.map((item) => {
          const itemId = `${item.category}:${item.basic}`
          const examples = [
            ...item.examples.map((text, index) => ({ text, kind: 'preset' as const, index })),
            ...(customExamples[itemId] ?? []).map((text, index) => ({ text, kind: 'custom' as const, index })),
          ]
          return <tr key={itemId}>
          <td data-label="Everyday wording"><span>{item.basic}</span></td>
          <td data-label="More precise">
            <strong>{item.precise}</strong>
            <div className="vocab-upgrade-precise-audio"><LexicalPronunciationButton term={item.precise.replace(/\s*\/\s*/g, ' or ')} apiKey={apiKey} /></div>
          </td>
          <td data-label="Natural phrase">
            <span className="vocab-upgrade-phrase">{item.phrase}</span>
            {item.note && <small>{item.note}</small>}
            <div className="vocab-upgrade-row-actions">
              <LexicalPronunciationButton term={item.phrase} example={item.examples[0]} apiKey={apiKey} />
              <button type="button" className="vocab-upgrade-ask" onClick={() => askCoach(item, examples.map((example) => example.text))}><MessageCircle size={15} /> Ask Speakia</button>
            </div>
          </td>
          <td data-label="In context">
            <div className="vocab-upgrade-example-list">{examples.map((example) => <div className="vocab-upgrade-example" key={`${itemId}:${example.kind}:${example.index}`}>
              {example.kind === 'custom' && exampleEditor?.itemId === itemId && exampleEditor.index === example.index
                ? renderExampleEditor(itemId, item.phrase, example.index)
                : <>
                  <p>{example.text}</p>
                  {example.kind === 'custom' && <span className="vocab-upgrade-example-actions">
                  <button type="button" aria-label={`Edit custom example using ${item.phrase}`} title="Edit example" onClick={() => { setExampleEditor({ itemId, index: example.index }); setExampleDraft(example.text) }}><Pencil size={14} /></button>
                  <button type="button" aria-label={`Remove custom example using ${item.phrase}`} title="Remove example" onClick={() => setCustomExamples((current) => ({ ...current, [itemId]: (current[itemId] ?? []).filter((_, index) => index !== example.index) }))}><X size={14} /></button>
                  </span>}
                </>}
            </div>)}</div>
            <div className="vocab-upgrade-example-editor">
              {exampleEditor?.itemId === itemId && exampleEditor.index === null
                ? renderExampleEditor(itemId, item.phrase, null)
                : <button type="button" className="vocab-upgrade-add-example" onClick={() => { setExampleEditor({ itemId, index: null }); setExampleDraft('') }}><Plus size={14} /> Add example</button>}
            </div>
            <small>{item.category}</small>
          </td>
        </tr>})}</tbody>
      </table>
  </div> : <div className="vocab-upgrade-empty"><Search size={18} /><strong>No comparisons found</strong><span>Try another word or category.</span></div>}
  </div>
  </div>
}