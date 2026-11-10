import { useState } from 'react'
import { ArrowLeftRight, BookOpen, CheckCircle2, GraduationCap, Info } from 'lucide-react'

export type BandDescriptorProduct = 'speaking' | 'writing'

type Criterion = {
  id: string
  name: string
  focus: string
  bands: Record<number, string>
  example: string
  annotation: string
}

const bandNumbers = [4, 5, 6, 7, 8, 9]
const bandSummaries: Record<number, string> = {
  4: 'Meaning is sometimes difficult to follow; frequent limits in control or development affect the response.',
  5: 'The main message is usually understandable, but limitations in development, flexibility, or accuracy are noticeable.',
  6: 'Communication is generally effective, though uneven development or recurring language issues may reduce precision.',
  7: 'Ideas are developed clearly with good control and flexibility; occasional weaknesses remain.',
  8: 'Performance is consistently clear and well controlled, with only occasional imprecision.',
  9: 'Performance is consistently precise, fluent, and fully effective for the task.',
}

const speakingCriteria: Criterion[] = [
  {
    id: 'fluency',
    name: 'Fluency and Coherence',
    focus: 'How smoothly ideas are sustained, organised, and connected in speech.',
    bands: {
      4: 'Long pauses and repetition often interrupt the message; connections between ideas are limited.',
      5: 'Can keep talking about familiar topics, but hesitation, repetition, or uneven organisation is common.',
      6: 'Usually speaks at length and keeps a clear line of thought, despite some hesitation or linking issues.',
      7: 'Sustains speech well and organises ideas logically; hesitation rarely disrupts the message.',
      8: 'Speaks fluently with coherent development; any hesitation is mostly about content rather than language.',
      9: 'Communicates effortlessly and coherently, with precise development throughout.',
    },
    example: 'I would choose the smaller city. It is less crowded, so commuting is easier; for example, I can get to work without losing an hour in traffic.',
    annotation: 'The response states a choice, develops a reason, and adds a relevant example in a connected sequence.',
  },
  {
    id: 'lexical',
    name: 'Lexical Resource',
    focus: 'How accurately, flexibly, and naturally vocabulary expresses meaning.',
    bands: {
      4: 'A narrow range makes it difficult to express more than basic ideas; word choice is often inaccurate.',
      5: 'Uses familiar vocabulary to communicate, but repetition and imprecise word choice are frequent.',
      6: 'Has enough range to discuss topics, with occasional awkward wording or inaccurate collocations.',
      7: 'Uses a flexible range of vocabulary with generally natural choices and effective paraphrasing.',
      8: 'Uses a wide range precisely and flexibly; uncommon wording is usually natural and well controlled.',
      9: 'Uses vocabulary with consistently precise meaning, natural collocation, and strong flexibility.',
    },
    example: 'The neighbourhood has become more accessible since the council extended the bus service.',
    annotation: '“Extended the bus service” and “more accessible” express the change specifically without relying on inflated vocabulary.',
  },
  {
    id: 'grammar',
    name: 'Grammatical Range and Accuracy',
    focus: 'The variety of sentence forms and the accuracy with which they are used.',
    bands: {
      4: 'Sentence patterns are limited and frequent errors can obscure intended meaning.',
      5: 'Simple sentences are more reliable than complex ones; errors are noticeable throughout.',
      6: 'Uses both simple and complex forms, though errors in longer sentences remain.',
      7: 'Uses varied sentence structures with generally good control; errors do not often impede understanding.',
      8: 'Uses a wide range of structures flexibly and accurately, with only occasional slips.',
      9: 'Uses a wide range of structures naturally and accurately throughout.',
    },
    example: 'Although the journey takes longer by train, I prefer it because I can read while I travel.',
    annotation: 'A subordinate clause and a reason clause express a clear relationship while keeping the sentence controlled.',
  },
  {
    id: 'pronunciation',
    name: 'Pronunciation',
    focus: 'How intelligibly speech is produced, including sounds, stress, rhythm, and intonation.',
    bands: {
      4: 'Pronunciation problems frequently make parts of the message difficult to understand.',
      5: 'The main message is often understandable, but mispronunciation or limited rhythm causes effort for the listener.',
      6: 'Usually intelligible; word stress, sounds, or rhythm may occasionally affect clarity.',
      7: 'Uses a range of pronunciation features to support meaning; the message is easy to follow overall.',
      8: 'Is easy to understand throughout and uses stress and intonation effectively, with only occasional lapses.',
      9: 'Is consistently easy to understand, using pronunciation features flexibly and naturally.',
    },
    example: 'A speaker contrasts “I wanted the blue one” with “I wanted the new one” using clear word stress and distinct initial sounds.',
    annotation: 'This illustrates how sound clarity and stress can distinguish meaning; it is not a required accent model.',
  },
]

const writingCriteria: Criterion[] = [
  {
    id: 'task',
    name: 'Task Achievement / Task Response',
    focus: 'Whether the response addresses the task, develops its requirements, and supports relevant ideas.',
    bands: {
      4: 'Important parts of the task are missed or unclear; ideas receive little relevant support.',
      5: 'The task is addressed in a limited way; development or position may be incomplete or repetitive.',
      6: 'The main requirements are covered, though some points may be insufficiently developed or imprecise.',
      7: 'The task is addressed clearly and relevantly, with a developed position or overview as appropriate.',
      8: 'All key requirements are covered well; ideas are relevant, extended, and supported.',
      9: 'The task is fully and appropriately addressed with consistently relevant, well-supported development.',
    },
    example: 'Overall, public transport use rose, while car use declined; the sharpest change occurred after 2015.',
    annotation: 'For a chart overview, this selects major patterns and a notable period rather than listing every figure.',
  },
  {
    id: 'coherence',
    name: 'Coherence and Cohesion',
    focus: 'How clearly ideas progress, paragraphs are organised, and connections guide the reader.',
    bands: {
      4: 'Organisation is difficult to follow and connections between ideas are often unclear.',
      5: 'There is some organisation, but progression can be uneven and linking may be repetitive.',
      6: 'The response is generally organised with a clear progression, despite occasional weak links.',
      7: 'Ideas progress logically in well-shaped paragraphs; cohesive devices are used with good control.',
      8: 'The response is easy to follow, with effective paragraphing and flexible cohesion.',
      9: 'The organisation is effortless to follow, with cohesion and progression consistently well managed.',
    },
    example: 'One reason is the lower cost. This matters particularly to students, many of whom have limited income.',
    annotation: 'The second sentence develops the reason and clarifies who is affected, rather than adding an unrelated point.',
  },
  {
    id: 'lexical',
    name: 'Lexical Resource',
    focus: 'How accurately and flexibly vocabulary communicates ideas in an appropriate register.',
    bands: {
      4: 'A limited range and frequent inaccurate choices make precise expression difficult.',
      5: 'Vocabulary communicates basic ideas, but repetition and imprecision are common.',
      6: 'Vocabulary is adequate for the task, with some effective choices and occasional awkward use.',
      7: 'Uses a varied range with generally accurate, appropriate word choice and some flexibility.',
      8: 'Uses a wide range precisely and naturally, with only occasional lapses.',
      9: 'Uses vocabulary with consistently precise meaning, appropriate register, and natural collocation.',
    },
    example: 'The proportion of households using solar power increased steadily over the period.',
    annotation: '“Proportion,” “increased steadily,” and “over the period” are precise choices for describing a trend.',
  },
  {
    id: 'grammar',
    name: 'Grammatical Range and Accuracy',
    focus: 'The range of sentence structures and the accuracy of grammar and punctuation.',
    bands: {
      4: 'Sentence forms are limited and frequent errors make parts of the response hard to understand.',
      5: 'Simple forms are more reliable; errors in complex sentences are frequent.',
      6: 'Uses a mix of sentence forms, though grammar and punctuation errors remain noticeable.',
      7: 'Uses varied structures with good control; most sentences are accurate.',
      8: 'Uses a wide range of structures accurately and flexibly, with occasional minor errors.',
      9: 'Uses a wide range of structures with consistently strong accuracy and control.',
    },
    example: 'If cities invest in reliable buses, fewer commuters may depend on private cars.',
    annotation: 'A conditional structure expresses a clear relationship between a proposed action and a possible result.',
  },
]

const writingTaskDetails = {
  task2: {
    focus: 'Whether the response addresses every part of the question, presents a clear position, and develops relevant ideas with support.',
    example: 'Although online learning is convenient, universities should retain in-person classes because discussion and immediate feedback are difficult to replace.',
    annotation: 'The position is clear and the reason is relevant; a complete response would develop and support each main point across the essay.',
  },
  academic1: {
    focus: 'Whether the report selects and accurately summarises the key features, comparisons, or stages shown in the visual, including a clear overview.',
    example: 'Overall, public transport use rose, while car use declined; the sharpest change occurred after 2015.',
    annotation: 'The overview highlights major patterns and a notable period rather than listing every figure or speculating about causes.',
  },
  general1: {
    focus: 'Whether the letter fulfils its purpose, covers all required points, and uses a tone suited to the recipient and situation.',
    example: 'I am writing to request a change to my booking because the revised travel dates now conflict with a work commitment.',
    annotation: 'The purpose is clear and the reason is relevant; the full letter should address each prompt point in an appropriate register.',
  },
} as const

export function BandDescriptorsPage({
  product,
  initialCriterion,
  initialBand,
}: {
  product: BandDescriptorProduct
  initialCriterion?: string
  initialBand?: number
}) {
  const criteria = product === 'speaking' ? speakingCriteria : writingCriteria
  const [criterionId, setCriterionId] = useState(() => criteria.find((item) => item.id === initialCriterion)?.id ?? criteria[0].id)
  const [band, setBand] = useState(() => bandNumbers.find((value) => value === initialBand) ?? 6)
  const [compareHigher, setCompareHigher] = useState(true)
  const [writingTaskType, setWritingTaskType] = useState<keyof typeof writingTaskDetails>('task2')
  const criterion = criteria.find((item) => item.id === criterionId) ?? criteria[0]
  const taskDetails = product === 'writing' && criterion.id === 'task' ? writingTaskDetails[writingTaskType] : null
  const comparisonBand = band + (compareHigher ? (band === 9 ? -1 : 1) : (band === 4 ? 1 : -1))
  const comparisonDirection = compareHigher ? 'higher' : 'lower'

  return <main className="band-guide-page">
    <header className="band-guide-hero">
      <div className="band-guide-icon"><GraduationCap size={24} /></div>
      <div><p className="band-guide-kicker">IELTS ASSESSMENT, MADE CLEAR</p>
        <h1>IELTS {product === 'speaking' ? 'Speaking' : 'Writing'} Band Descriptors</h1>
        <p>Explore what examiners assess, compare nearby bands, and use the criteria to decide what to practise next.</p>
      </div>
    </header>

    <aside className="band-guide-notice"><Info size={17} /><p><strong>A learning guide, not an official score.</strong> These original plain-language explanations and examples summarise assessment concepts; they are not official IELTS wording. Speakia and Writia results are indicative practice estimates, not official IELTS results.</p></aside>

    <section className="band-guide-controls" aria-label="Choose assessment criterion and band">
      <label>Assessment criterion<select value={criterionId} onChange={(event) => setCriterionId(event.target.value)}>{criteria.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {product === 'writing' && <label>Task type<select value={writingTaskType} onChange={(event) => {
        const selected = event.target.value
        if (selected === 'task2' || selected === 'academic1' || selected === 'general1') setWritingTaskType(selected)
      }}><option value="task2">Task 2 · Academic and General Training</option><option value="academic1">Academic Task 1 · report</option><option value="general1">General Training Task 1 · letter</option></select></label>}
      <label>Band to explore<select value={band} onChange={(event) => setBand(Number(event.target.value))}>{bandNumbers.map((value) => <option key={value} value={value}>Band {value}</option>)}</select></label>
    </section>

    <div className="band-guide-content">
      <section className="band-guide-card band-guide-criterion">
        <span className="band-guide-kicker">WHAT THIS CRITERION MEASURES</span>
        <h2>{criterion.name}</h2><p>{taskDetails?.focus ?? criterion.focus}</p>
        <div className="band-guide-selected-band"><span>Band {band}</span><p>{bandSummaries[band]}<small>For {criterion.name}: {criterion.bands[band]}</small></p></div>
      </section>
      <section className="band-guide-card band-guide-compare">
        <div className="band-guide-card-heading"><div><span className="band-guide-kicker">COMPARE ADJACENT BANDS</span><h2>What changes from one band to the next?</h2></div>
          <button type="button" onClick={() => setCompareHigher((current) => !current)} disabled={compareHigher ? band === 9 : band === 4} aria-label={`Compare with the ${compareHigher ? 'lower' : 'higher'} adjacent band`}><ArrowLeftRight size={15} /> Compare {comparisonDirection}</button>
        </div>
        <div className="band-guide-comparison">
          {[band, comparisonBand].sort((a, b) => a - b).map((value) => <article key={value}><span>Band {value}</span><p>{criterion.bands[value]}</p></article>)}
        </div>
        <p className="band-guide-comparison-note">A band reflects the overall quality of evidence across a response, not a single phrase or isolated error.</p>
      </section>
      <section className="band-guide-card band-guide-example">
        <div className="band-guide-card-heading"><div><span className="band-guide-kicker">ORIGINAL LEARNING EXAMPLE</span><h2>Notice the evidence</h2></div><BookOpen size={19} /></div>
        <blockquote>{taskDetails?.example ?? criterion.example}</blockquote>
        <p><CheckCircle2 size={16} /><span>{taskDetails?.annotation ?? criterion.annotation}</span></p>
      </section>
      <section className="band-guide-next-step">
        <GraduationCap size={19} /><div><strong>Put the descriptor to work</strong><p>Review your practice feedback against this criterion, then choose one specific improvement to apply in your next response.</p></div>
      </section>
    </div>
  </main>
}
