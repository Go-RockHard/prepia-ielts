import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, Bookmark, Clock3, Filter, Play, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { speakingPrompts, type SpeakingPrompt } from '@/features/simulator/questions'
import type { TestPart } from '@/features/simulator/types'
import { ModelAnswerAudioPlayer } from './ModelAnswerAudioPlayer'

type TopicCategory = 'People & relationships' | 'Home & places' | 'Work & education' | 'Technology' | 'Travel & transport' | 'Culture & leisure' | 'Nature & environment' | 'Society & community' | 'Daily life'
type BankPrompt = Omit<SpeakingPrompt, 'preparationSeconds' | 'responseSeconds'>
  & Partial<Pick<SpeakingPrompt, 'preparationSeconds' | 'responseSeconds'>>
  & { category: TopicCategory; cuePoints?: string[]; vocabulary: string[]; sampleAnswer?: string }

const additionalPrompts: BankPrompt[] = [
  { id: 'bank-p1-family', part: 'part1', topic: 'Family', category: 'People & relationships', question: 'Who are you closest to in your family?', vocabulary: ['close-knit', 'look up to', 'spend quality time'] },
  { id: 'bank-p1-friends', part: 'part1', topic: 'Friends', category: 'People & relationships', question: 'How do you usually keep in touch with your friends?', vocabulary: ['stay in touch', 'catch up', 'shared interests'] },
  { id: 'bank-p1-home', part: 'part1', topic: 'Accommodation', category: 'Home & places', question: 'What is your favourite room in your home?', vocabulary: ['feel at ease', 'natural light', 'personal space'] },
  { id: 'bank-p1-weather', part: 'part1', topic: 'Weather', category: 'Nature & environment', question: 'What kind of weather do you enjoy most?', vocabulary: ['mild climate', 'bright and breezy', 'seasonal change'] },
  { id: 'bank-p1-music', part: 'part1', topic: 'Music', category: 'Culture & leisure', question: 'What kind of music do you listen to?', vocabulary: ['live performance', 'upbeat rhythm', 'unwind'] },
  { id: 'bank-p1-food', part: 'part1', topic: 'Food and cooking', category: 'Culture & leisure', question: 'Do you enjoy cooking meals at home?', vocabulary: ['home-cooked meal', 'local ingredients', 'comfort food'] },
  { id: 'bank-p1-technology', part: 'part1', topic: 'Technology', category: 'Technology', question: 'Which piece of technology do you use most every day?', vocabulary: ['user-friendly', 'rely on', 'save time'] },
  { id: 'bank-p1-education', part: 'part1', topic: 'Learning', category: 'Work & education', question: 'What subject would you like to learn in the future?', vocabulary: ['broaden my horizons', 'practical skill', 'lifelong learning'] },
  { id: 'bank-p1-books', part: 'part1', topic: 'Books', category: 'Culture & leisure', question: 'Do you prefer reading printed books or e-books?', vocabulary: ['immersive', 'turn the pages', 'convenient format'] },
  { id: 'bank-p1-transport', part: 'part1', topic: 'Public transport', category: 'Travel & transport', question: 'Is public transport convenient where you live?', vocabulary: ['reliable service', 'rush hour', 'traffic congestion'] },
  { id: 'bank-p1-photos', part: 'part1', topic: 'Photography', category: 'Culture & leisure', question: 'Do you like taking photographs?', vocabulary: ['capture a moment', 'look back on', 'striking image'] },
  { id: 'bank-p2-place', part: 'part2', topic: 'A place you enjoy visiting', category: 'Home & places', question: 'Describe a place you enjoy visiting. You should say where it is, how you found out about it, what you do there, and explain why you enjoy going there.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['Where the place is', 'How you first discovered it', 'What you usually do there', 'And explain why it is special to you'], vocabulary: ['a welcome escape', 'picturesque surroundings', 'a sense of belonging'] },
  { id: 'bank-p2-object', part: 'part2', topic: 'A useful object', category: 'Technology', question: 'Describe an object that you use every day. You should say what it is, when you started using it, how it helps you, and explain why it is important to you.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['What the object is', 'When and how you got it', 'How you use it', 'And explain why you find it useful'], vocabulary: ['indispensable', 'serve a practical purpose', 'part of my routine'] },
  { id: 'bank-p2-skill', part: 'part2', topic: 'A skill you learned', category: 'Work & education', question: 'Describe a skill you learned that was useful to you. You should say what the skill is, when you learned it, how you learned it, and explain why it is useful.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['What the skill is', 'When you learned it', 'How you developed it', 'And explain how it has helped you'], vocabulary: ['a steep learning curve', 'hands-on experience', 'put into practice'] },
  { id: 'bank-p2-event', part: 'part2', topic: 'A memorable celebration', category: 'Culture & leisure', question: 'Describe a celebration or special event you remember. You should say what was celebrated, where it took place, who was there, and explain why you remember it.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['What the occasion was', 'Where it took place', 'Who celebrated with you', 'And explain what made it memorable'], vocabulary: ['a joyful atmosphere', 'bring people together', 'a lasting impression'] },
  { id: 'bank-p2-help', part: 'part2', topic: 'A time you helped someone', category: 'People & relationships', question: 'Describe a time when you helped another person. You should say who the person was, what the problem was, what you did, and explain how you felt afterwards.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['Who you helped', 'What they needed help with', 'What you did', 'And explain how the experience made you feel'], vocabulary: ['lend a hand', 'make a difference', 'a rewarding experience'] },
  { id: 'bank-p2-trip', part: 'part2', topic: 'An enjoyable journey', category: 'Travel & transport', question: 'Describe a journey that you particularly enjoyed. You should say where you went, how you travelled, who you went with, and explain what made the journey enjoyable.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['Where you travelled', 'How you got there', 'Who accompanied you', 'And explain why you enjoyed the journey'], vocabulary: ['off the beaten track', 'breathtaking scenery', 'a change of pace'] },
  { id: 'bank-p3-technology', part: 'part3', topic: 'Technology and society', category: 'Technology', question: 'How has technology changed the way people communicate with one another?', vocabulary: ['instant communication', 'bridge the distance', 'face-to-face interaction'] },
  { id: 'bank-p3-education', part: 'part3', topic: 'Education and opportunity', category: 'Work & education', question: 'Should schools focus more on practical skills or academic subjects?', vocabulary: ['well-rounded education', 'job market', 'critical thinking'] },
  { id: 'bank-p3-environment', part: 'part3', topic: 'Protecting the environment', category: 'Nature & environment', question: 'What can governments and individuals do to reduce pollution?', vocabulary: ['sustainable alternatives', 'collective responsibility', 'long-term impact'] },
  { id: 'bank-p3-travel', part: 'part3', topic: 'Tourism and travel', category: 'Travel & transport', question: 'What are the advantages and disadvantages of tourism for local communities?', vocabulary: ['local economy', 'cultural exchange', 'overtourism'] },
  { id: 'bank-p3-work', part: 'part3', topic: 'Work and careers', category: 'Work & education', question: 'How important is job satisfaction compared with a high salary?', vocabulary: ['career progression', 'financial security', 'work-life balance'] },
  { id: 'bank-p3-media', part: 'part3', topic: 'News and media', category: 'Society & community', question: 'How can people decide whether information in the media is trustworthy?', vocabulary: ['reliable source', 'verify information', 'media literacy'] },
  { id: 'bank-p3-cities', part: 'part3', topic: 'Life in cities', category: 'Home & places', question: 'What makes a city a good place for people to live?', vocabulary: ['public amenities', 'sense of community', 'quality of life'] },
  { id: 'bank-p3-traditions', part: 'part3', topic: 'Traditions and change', category: 'Culture & leisure', question: 'Why is it important for people to preserve cultural traditions?', vocabulary: ['cultural heritage', 'pass down', 'shared identity'] },
  { id: 'bank-p3-community', part: 'part3', topic: 'Community life', category: 'Society & community', question: 'How can neighbours build a stronger sense of community?', vocabulary: ['mutual support', 'community spirit', 'get involved'] },
  { id: 'bank-p1-morning', part: 'part1', topic: 'Mornings', category: 'Daily life', question: 'Are you a morning person?', vocabulary: ['get an early start', 'feel refreshed', 'ease into the day'], sampleAnswer: 'More or less, yes. I like getting an early start because the day feels less rushed. I usually have breakfast and plan what I need to do, which helps me feel refreshed before work or study.' },
  { id: 'bank-p1-sports', part: 'part1', topic: 'Sports', category: 'Culture & leisure', question: 'Did you play any sports when you were a child?', vocabulary: ['take up a sport', 'team spirit', 'stay active'], sampleAnswer: 'Yes, I used to play badminton with friends after school. It was a fun way to stay active, and I also learned a lot about teamwork and encouraging other people.' },
  { id: 'bank-p1-gifts', part: 'part1', topic: 'Gifts', category: 'People & relationships', question: 'Do you enjoy giving or receiving gifts?', vocabulary: ['thoughtful gesture', 'mean a lot', 'put effort into'], sampleAnswer: 'I enjoy giving gifts slightly more because choosing something personal is a thoughtful gesture. It does not have to be expensive; I think it means more when you have put effort into finding something the other person will genuinely use.' },
  { id: 'bank-p1-neighbours', part: 'part1', topic: 'Neighbours', category: 'Society & community', question: 'Do you know the people who live next door to you?', vocabulary: ['on good terms', 'lend a hand', 'sense of community'], sampleAnswer: 'I know a few of them, and we are on good terms. We usually have a quick chat when we meet, and it is reassuring to know that people nearby are willing to lend a hand if needed.' },
  { id: 'bank-p1-mobile', part: 'part1', topic: 'Mobile phones', category: 'Technology', question: 'How often do you use your mobile phone?', vocabulary: ['stay connected', 'handy device', 'cut down on screen time'], sampleAnswer: 'I use it several times a day, mainly to stay connected and check practical things like directions. It is a very handy device, although I try to cut down on screen time when I am spending time with other people.' },
  { id: 'bank-p1-park', part: 'part1', topic: 'Parks', category: 'Nature & environment', question: 'Do you often visit parks or other green spaces?', vocabulary: ['green space', 'get some fresh air', 'a change of scenery'], sampleAnswer: 'I try to visit a nearby park at weekends. It gives me a chance to get some fresh air and enjoy a change of scenery, especially after a busy week indoors.' },
  { id: 'bank-p1-shopping', part: 'part1', topic: 'Shopping', category: 'Daily life', question: 'Do you prefer shopping online or in person?', vocabulary: ['browse at my own pace', 'compare prices', 'convenient'], sampleAnswer: 'For everyday items, I prefer shopping online because it is convenient and easy to compare prices. For clothes, though, I would rather go in person so I can check the fit before buying anything.' },
  { id: 'bank-p1-languages', part: 'part1', topic: 'Languages', category: 'Work & education', question: 'What languages would you like to learn in the future?', vocabulary: ['communicate with', 'broaden my horizons', 'pick up a language'], sampleAnswer: 'I would like to learn Spanish. It would help me communicate with more people when travelling, and learning another language would broaden my horizons and give me a better understanding of another culture.' },
  { id: 'bank-p1-chores', part: 'part1', topic: 'Daily routines', category: 'Daily life', question: 'Which household task do you dislike doing?', vocabulary: ['get it out of the way', 'time-consuming', 'keep things tidy'], sampleAnswer: 'I am not very keen on ironing because it can be quite time-consuming. I usually put on a podcast and get it out of the way in one go, so it does not take over my evening.' },
  { id: 'bank-p2-person', part: 'part2', topic: 'A person who taught you something', category: 'People & relationships', question: 'Describe a person who taught you something useful. You should say who the person was, what they taught you, how they taught you, and explain why it was useful.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['Who the person was', 'What they taught you', 'How they taught you', 'And explain why the lesson was useful'], vocabulary: ['patient guidance', 'learn by example', 'put it into practice'], sampleAnswer: 'I’d like to talk about a teacher who showed me how to organise my work more effectively. Rather than simply giving instructions, she demonstrated how to break a large task into smaller steps and encouraged me to try the method myself. I still use that approach whenever I have a deadline. It was useful because it made difficult tasks feel manageable, and I learned the value of patient guidance.' },
  { id: 'bank-p2-book', part: 'part2', topic: 'A book you enjoyed', category: 'Culture & leisure', question: 'Describe a book you enjoyed reading. You should say what it was about, when you read it, why you chose it, and explain what you liked about it.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['What the book was about', 'When you read it', 'Why you chose it', 'And explain what you enjoyed about it'], vocabulary: ['page-turner', 'thought-provoking', 'stay with me'], sampleAnswer: 'A book I really enjoyed was a novel I borrowed during a holiday. It follows a character who has to adapt to a completely new environment, and I chose it because a friend recommended it. The story was easy to get into but also thought-provoking, particularly because it showed how small decisions can shape someone’s future. I finished it in a few days, and some of its ideas have stayed with me.' },
  { id: 'bank-p2-goal', part: 'part2', topic: 'A goal you achieved', category: 'Work & education', question: 'Describe a goal you worked hard to achieve. You should say what the goal was, why it was important, what you did to achieve it, and explain how you felt afterwards.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['What the goal was', 'Why it mattered to you', 'What steps you took', 'And explain how you felt when you achieved it'], vocabulary: ['set a realistic target', 'stay consistent', 'a real sense of accomplishment'], sampleAnswer: 'One goal I worked hard to achieve was improving my English speaking. It mattered because I wanted to communicate more confidently in study and work situations. I set a realistic target, practised a little every day, and recorded myself so I could notice areas to improve. It took longer than I expected, but I stayed consistent. When I could express my ideas more naturally, I felt a real sense of accomplishment.' },
  { id: 'bank-p2-advice', part: 'part2', topic: 'A piece of good advice', category: 'People & relationships', question: 'Describe a piece of advice that you found helpful. You should say what the advice was, who gave it to you, when you received it, and explain why it was helpful.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['What the advice was', 'Who gave it to you', 'When you received it', 'And explain how it helped you'], vocabulary: ['take something on board', 'keep things in perspective', 'make a difference'], sampleAnswer: 'A piece of advice I found genuinely helpful was to focus on what I could control instead of worrying about every possible outcome. A close family member gave it to me when I was feeling overwhelmed by several deadlines. I took it on board and started prioritising one task at a time. It helped me keep things in perspective, and I still use that idea whenever I face a stressful situation.' },
  { id: 'bank-p2-outdoor', part: 'part2', topic: 'An outdoor activity', category: 'Nature & environment', question: 'Describe an outdoor activity you enjoy. You should say what the activity is, where you do it, who you do it with, and explain why you enjoy it.', preparationSeconds: 60, responseSeconds: 120, cuePoints: ['What the activity is', 'Where you do it', 'Who you do it with', 'And explain why you enjoy it'], vocabulary: ['get away from it all', 'take in the scenery', 'clear my mind'], sampleAnswer: 'An outdoor activity I enjoy is going for a long walk on a trail near my home. I usually go with a friend, particularly when the weather is mild. We take our time, talk about what has been happening, and stop to take in the scenery. It is a simple way to get away from it all and clear my mind after a busy week.' },
  { id: 'bank-p3-family', part: 'part3', topic: 'Family relationships', category: 'People & relationships', question: 'How have family relationships changed in recent generations?', vocabulary: ['family structure', 'spend quality time', 'social expectations'] },
  { id: 'bank-p3-workplace', part: 'part3', topic: 'The modern workplace', category: 'Work & education', question: 'Do you think working from home will become more common in the future?', vocabulary: ['flexible arrangement', 'commute', 'collaboration'] },
  { id: 'bank-p3-books', part: 'part3', topic: 'Reading habits', category: 'Culture & leisure', question: 'Why do some people prefer reading books while others prefer watching films?', vocabulary: ['use their imagination', 'visual storytelling', 'attention span'] },
  { id: 'bank-p3-public-transport', part: 'part3', topic: 'Public transport', category: 'Travel & transport', question: 'How can cities encourage more people to use public transport?', vocabulary: ['affordable fares', 'reliable network', 'reduce congestion'] },
  { id: 'bank-p3-phones', part: 'part3', topic: 'Mobile technology', category: 'Technology', question: 'What are the effects of mobile phones on communication between people?', vocabulary: ['instant access', 'stay in touch', 'undivided attention'] },
  { id: 'bank-p3-green-spaces', part: 'part3', topic: 'Green spaces', category: 'Nature & environment', question: 'Why are parks and green spaces important in cities?', vocabulary: ['urban environment', 'mental well-being', 'biodiversity'] },
]

function promptCategory(topic: string): TopicCategory {
  const normalized = topic.toLocaleLowerCase()
  if (/morning|shopping|routine|chores/.test(normalized)) return 'Daily life'
  if (/person|role model|family|friend|inspir/.test(normalized)) return 'People & relationships'
  if (/hometown|home|place|city|community/.test(normalized)) return /community/.test(normalized) ? 'Society & community' : 'Home & places'
  if (/work|study|success|education|learn/.test(normalized)) return 'Work & education'
  if (/technology|media|app|social/.test(normalized)) return 'Technology'
  if (/travel|transport|journey/.test(normalized)) return 'Travel & transport'
  if (/environment|climate|weather|nature/.test(normalized)) return 'Nature & environment'
  if (/culture|music|reading|book|free time|weekend|food|celebr/.test(normalized)) return 'Culture & leisure'
  return 'Society & community'
}

const bankPrompts: BankPrompt[] = [
  ...speakingPrompts.map((prompt) => ({
    ...prompt,
    category: promptCategory(prompt.topic),
    vocabulary: prompt.topic.toLocaleLowerCase().includes('hometown')
      ? ['close-knit community', 'vibrant atmosphere', 'a strong sense of belonging']
      : ['express my point clearly', 'give a specific example', 'reflect on the experience'],
  })),
  ...additionalPrompts,
]

function modelAnswerFor(prompt: BankPrompt): string {
  if (prompt.sampleAnswer) return prompt.sampleAnswer

  const topic = prompt.topic.toLocaleLowerCase()
  if (prompt.part === 'part1') {
    if (/family|friend|person|inspir/.test(topic)) return 'I’m lucky to have supportive people around me. We make an effort to stay in touch, even when everyone is busy, and I really value being able to share both ordinary moments and important news with them.'
    if (/hometown|home|accommodation|place/.test(topic)) return 'What I appreciate most is that it feels comfortable and familiar. There are useful places nearby, but it is also easy to find somewhere quiet to relax, so it suits my everyday routine very well.'
    if (/work|study|learning|reading|book/.test(topic)) return 'I enjoy learning when I can connect an idea to real life. It keeps me curious, and I find that I remember things better when I can discuss them or put them into practice.'
    if (/free time|weekend|music|food|photograph|sport/.test(topic)) return 'I usually choose something that helps me unwind and gives me a change of pace. It does not need to be elaborate; having a little time to enjoy it properly is what matters to me.'
    if (/transport|journey/.test(topic)) return 'I usually choose the most practical option for the distance. If public transport is reliable, I prefer it because I can relax on the way and avoid the stress of finding somewhere to park.'
    if (/weather|park|nature/.test(topic)) return 'I prefer mild, sunny weather because it makes it much easier to spend time outdoors. Even a short walk feels more enjoyable when it is bright and comfortable.'
    if (/technology|phone/.test(topic)) return 'I use technology throughout the day, mainly to organise tasks and stay in touch. It is useful when I use it deliberately, although I try not to let notifications interrupt everything I am doing.'
    return `I’d say ${prompt.topic.toLocaleLowerCase()} is a regular part of my life. I appreciate the way it fits into my routine, and I can think of several small examples where it makes the day more enjoyable or convenient.`
  }

  if (prompt.part === 'part2') {
    if (/person|inspir|taught|help/.test(topic)) return 'I’d like to talk about someone I know well who has had a positive influence on me. They are thoughtful and dependable, and I have learned a lot by watching how they handle everyday challenges. One occasion that stands out was when they took time to help me with a difficult decision. Their advice was practical, but they also listened carefully instead of simply telling me what to do. I still remember that experience because it made me feel supported and taught me how valuable patience can be.'
    if (/place|hometown/.test(topic)) return 'A place I particularly enjoy is a quiet green space not far from where I live. I first went there with a friend, and now I visit whenever I need a break from my usual routine. I like walking along the paths, taking in the scenery and sometimes sitting down with a book. It is not famous or especially large, but it feels peaceful and familiar. For me, it is a welcome escape from a busy day.'
    if (/object|useful/.test(topic)) return 'An object I use every day is my mobile phone. I have had it for a few years, and it has become part of my routine because I use it for messages, directions and keeping track of appointments. It is useful because several everyday tasks are available in one place. I try to use it sensibly rather than constantly checking it, but overall it is an indispensable tool for staying organised.'
    if (/skill|goal/.test(topic)) return 'A skill I worked hard to develop was speaking confidently in front of other people. At first I found it difficult to organise my ideas quickly, so I practised in short sessions and asked for constructive feedback. Gradually, I became more comfortable explaining my opinions and giving examples. It has been useful in both study and work situations, and I am proud that steady practice helped me make progress.'
    if (/celebration|event/.test(topic)) return 'One event I remember fondly was a family celebration held at home. Several relatives came, including some I had not seen for a long time, so the atmosphere was especially warm. We shared a meal, talked about old memories and took plenty of photographs. What made it memorable was not the size of the event but the chance to spend quality time together. It brought everyone closer and left me with a lasting impression.'
    if (/journey|trip/.test(topic)) return 'A journey I particularly enjoyed was a short trip to the countryside with a couple of friends. We travelled by train, which meant we could relax and enjoy the changing scenery. Once we arrived, we explored on foot and found a quiet place to have lunch. The trip was enjoyable because it felt very different from my normal routine, and we had plenty of time to talk. It was a simple but refreshing change of pace.'
    return `I’d like to talk about ${prompt.topic.toLocaleLowerCase()}. It stands out because of the experience surrounding it: I had the chance to learn something new, spend time with people who matter to me, and reflect on what I value. Looking back, the most memorable part was how it made me feel, and that is why I still think about it.`
  }

  if (/technology|mobile|media/.test(topic)) return 'Technology has made communication much faster and more convenient. People can share information instantly, even across long distances, which is particularly helpful for families and colleagues. However, online contact does not always replace a meaningful face-to-face conversation, so I think people need to use it in a balanced way.'
  if (/education|work|career/.test(topic)) return 'I think education and work should combine practical abilities with a strong academic foundation. Practical skills help people deal with real situations, while broader knowledge develops critical thinking. For example, students benefit from applying what they learn to projects. The right balance will depend on their goals, but neither side should be ignored.'
  if (/environment|green|pollution/.test(topic)) return 'Governments can make a difference by providing reliable public transport and supporting cleaner energy, while individuals can reduce waste and make more sustainable choices. These actions may seem small on their own, but they have a greater impact when many people take part. Long-term progress also depends on making greener options affordable and convenient.'
  if (/travel|tourism|transport/.test(topic)) return 'Tourism can bring income and employment to local communities, and visitors can learn about different cultures. On the other hand, too many tourists can put pressure on housing, public spaces and the environment. I think the benefits are greatest when tourism is managed responsibly and local residents have a say in how it develops.'
  if (/city|community|neighbour/.test(topic)) return 'A good community needs both useful public services and opportunities for people to connect. Parks, libraries and safe transport improve daily life, while local events can help neighbours get to know one another. These things build a sense of belonging and make a place more pleasant for different age groups.'
  if (/tradition|culture|book|reading/.test(topic)) return 'Cultural traditions give people a link to their history and a shared sense of identity. They can also bring generations together when families pass stories, food or celebrations on to younger people. Traditions do change over time, though, so I think they should be preserved in a way that remains meaningful to modern life.'
  return 'I think there are advantages and disadvantages, so the best approach depends on the situation. One important benefit is that it can improve people’s daily lives, especially when it is accessible to everyone. At the same time, decision-makers should consider possible long-term effects and listen to the people most affected before making changes.'
}

const categories: ('All Topics' | TopicCategory)[] = [
  'All Topics', 'People & relationships', 'Home & places', 'Work & education', 'Technology',
  'Travel & transport', 'Culture & leisure', 'Nature & environment', 'Society & community', 'Daily life',
]

const partFilters: { value: TestPart | 'all'; label: string }[] = [
  { value: 'all', label: 'All Parts' },
  { value: 'full', label: 'Full Mock Test' },
  { value: 'part1', label: 'Part 1' },
  { value: 'part2', label: 'Part 2 Cue Cards' },
  { value: 'part3', label: 'Part 3' },
]

export function TopicBankPage({
  apiKey,
  pinnedIds,
  onTogglePin,
  onPractice,
  onStartCoachLive,
}: {
  apiKey: string
  pinnedIds: string[]
  onTogglePin: (id: string) => void
  onPractice: (part: TestPart) => void
  onStartCoachLive: (topic: string, context: string) => void
}) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All Topics')
  const [part, setPart] = useState<TestPart | 'all'>('all')
  const [search, setSearch] = useState('')
  const [pinFilter, setPinFilter] = useState<'all' | 'pinned' | 'unpinned'>('all')
  const filteredPrompts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return bankPrompts.filter((prompt) =>
      (part === 'all' || part === 'full' || prompt.part === part)
      && (category === 'All Topics' || prompt.category === category)
      && (pinFilter === 'all' || (pinFilter === 'pinned') === pinnedIds.includes(`topic:${prompt.id}`))
      && (!term || [prompt.topic, prompt.question, ...prompt.vocabulary, ...(prompt.cuePoints ?? []), modelAnswerFor(prompt)]
        .some((value) => value.toLocaleLowerCase().includes(term))),
    ).sort((first, second) => first.part.localeCompare(second.part))
  }, [category, part, pinFilter, pinnedIds, search])

  return (
    <div className="page-content inner-page topic-bank-page">
      <div className="inner-page-heading">
        <div>
          <p className="eyebrow">PRACTISE WITH PURPOSE</p>
          <h1>IELTS Speaking Question &amp; Topic Bank</h1>
          <p className="page-subtitle">Browse practice prompts for Part 1, Part 2 cue cards, Part 3 discussion, or a complete mock-test sequence.</p>
        </div>
        <Badge className="topic-bank-count">{filteredPrompts.length} prompts</Badge>
      </div>

      <Card className="topic-bank-search-card">
        <label className="topic-bank-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics, questions, or useful vocabulary…" aria-label="Search the Topic Bank" /></label>
        <div className="topic-bank-parts" aria-label="Filter questions by test part">
          {partFilters.map((filter) => <button type="button" key={filter.value} className={part === filter.value ? 'topic-bank-filter-active' : ''} aria-pressed={part === filter.value} onClick={() => setPart(filter.value)}><Filter size={13} />{filter.label}</button>)}
        </div>
        <div className="topic-bank-categories" aria-label="Filter by topic category">
          {categories.map((item) => <button type="button" key={item} className={category === item ? 'topic-bank-category-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
        <div className="topic-bank-pin-filters" role="group" aria-label="Filter pinned prompts">
          {([{ id: 'all', label: 'All prompts' }, { id: 'pinned', label: 'Pinned' }, { id: 'unpinned', label: 'Unpinned' }] as const).map((filter) => (
            <button key={filter.id} type="button" className={pinFilter === filter.id ? 'topic-bank-pin-filter-active' : ''} aria-pressed={pinFilter === filter.id} onClick={() => setPinFilter(filter.id)}>{filter.label}<span>{filter.id === 'all' ? bankPrompts.length : bankPrompts.filter((prompt) => pinnedIds.includes(`topic:${prompt.id}`) === (filter.id === 'pinned')).length}</span></button>
          ))}
        </div>
      </Card>

      {part === 'full' && <Card className="topic-bank-mock-callout"><BookOpen size={19} /><div><strong>Full mock-test sequence</strong><p>Work through Part 1 warm-up questions, one Part 2 cue card, and Part 3 discussion prompts. Choose any prompt below to practise that part with Speakia Coach, or launch a full examiner simulation.</p></div><Button className="start-button" onClick={() => onPractice('full')}><Play size={14} /> Start full mock test</Button></Card>}

      <div className="topic-bank-results-heading"><div><h2>{part === 'full' ? 'Mock test question sequence' : category === 'All Topics' ? 'Speaking questions' : category}</h2><p>{filteredPrompts.length} questions · {part === 'full' ? 'all three test parts' : part === 'all' ? 'all test parts' : partFilters.find((item) => item.value === part)?.label}</p></div><span><Clock3 size={15} /> Part 2 preparation: 1 minute</span></div>

      {filteredPrompts.length
        ? <div className="topic-bank-grid">{filteredPrompts.map((prompt) => (
          <Card className={`topic-bank-card ${pinnedIds.includes(`topic:${prompt.id}`) ? 'topic-bank-card-pinned' : ''}`} key={prompt.id}>
            <div className="topic-bank-card-top"><Badge className={`topic-part-badge topic-part-${prompt.part}`}>{prompt.part === 'part1' ? 'PART 1 · WARM-UP' : prompt.part === 'part2' ? 'PART 2 · CUE CARD' : 'PART 3 · DISCUSSION'}</Badge><span>{prompt.category}</span><button type="button" className="learning-pin-button" aria-label={`${pinnedIds.includes(`topic:${prompt.id}`) ? 'Unpin' : 'Pin'} ${prompt.topic}`} aria-pressed={pinnedIds.includes(`topic:${prompt.id}`)} onClick={() => onTogglePin(`topic:${prompt.id}`)}><Bookmark size={15} fill={pinnedIds.includes(`topic:${prompt.id}`) ? 'currentColor' : 'none'} /></button></div>
            <h3>{prompt.topic}</h3>
            <p className="topic-bank-question">{prompt.question}</p>
            {prompt.cuePoints && <div className="topic-cue-points"><strong>You should say:</strong><ul>{prompt.cuePoints.map((point) => <li key={point}>{point}</li>)}</ul></div>}
            <div className="topic-vocab"><span><Sparkles size={13} /> Useful vocabulary</span><div>{prompt.vocabulary.map((word) => <Badge key={word}>{word}</Badge>)}</div></div>
            <details className="topic-model-answer"><summary><BookOpen size={14} /> View model answer</summary><p>{modelAnswerFor(prompt)}</p><small>Use this as an example and adapt the details to your own experience.</small><ModelAnswerAudioPlayer promptId={prompt.id} answer={modelAnswerFor(prompt)} apiKey={apiKey} /></details>
            <div className="topic-bank-card-footer"><span>{prompt.part === 'part2' ? '1 min prep · 1–2 min speaking' : prompt.part === 'part1' ? 'Short personal response' : 'Develop and explain your view'}</span><div className="topic-bank-card-actions"><Button variant="outline" size="sm" onClick={() => onStartCoachLive(prompt.topic, [
              `IELTS Speaking ${prompt.part.replace('part', 'Part ')}`,
              `Question/cue card: ${prompt.question}`,
              ...(prompt.cuePoints?.length ? [`Cue points: ${prompt.cuePoints.join('; ')}`] : []),
              `Useful vocabulary: ${prompt.vocabulary.join(', ')}`,
              `Illustrative model answer: ${modelAnswerFor(prompt)}`,
            ].join('\n'))}><Play size={13} /> Practise this part <ArrowRight size={13} /></Button></div></div>
          </Card>
        ))}</div>
        : <Card className="topic-bank-empty"><Search size={21} /><h2>No matching questions</h2><p>Try another search or clear the topic, test-part, or pinned filters.</p><Button variant="outline" onClick={() => { setSearch(''); setCategory('All Topics'); setPart('all'); setPinFilter('all') }}>Clear filters</Button></Card>}
    </div>
  )
}
