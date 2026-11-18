import type { PracticeSet, SkillQuestion } from '@/features/skills/questionTypes'

let questionNumber = 0

function multipleChoice(prompt: string, options: string[], answer: number, explanation: string): SkillQuestion {
  const shift = questionNumber++ % options.length
  const balancedOptions = [...options.slice(shift), ...options.slice(0, shift)]
  return { type: 'multiple-choice', prompt, options: balancedOptions, answer: options[answer], explanation }
}

export const fullLengthListeningTest: PracticeSet = {
  id: 'listening-full-mock-1',
  title: 'Full IELTS Listening simulation · Test 1',
  level: 'Intermediate',
  minutes: 30,
  fullLength: true,
  instructions: 'Complete four listening sections and 40 questions in 30 minutes. Start the recording once, listen through all four sections, and answer as you go. The transcript is available only after submission.',
  audioSections: [
    {
      title: 'Section 1 · A community sports centre',
      script: 'Centre staff: Good morning, Westfield Sports Centre. How can I help? Caller: I would like to join the beginner swimming course. Staff: Certainly. The next course starts on Tuesday the fourteenth of June and runs for six weeks. Classes are on Tuesday evenings at quarter past six, not seven as shown on the old leaflet. Caller: Is there a changing room? Staff: Yes, the accessible changing room is next to reception. Please bring your own towel, but we can lend you goggles for the first session. Caller: How much is the course? Staff: It is sixty-eight pounds, including pool entry. You can pay at reception by card. The first lesson is in lane three, and your instructor will be Daniel. Please arrive ten minutes early to complete a short health form.'
    },
    {
      title: 'Section 2 · Riverside wildlife reserve',
      script: 'Welcome to Riverside Wildlife Reserve. The visitor centre is open daily from nine until five, while the café closes at half past four. The north footpath is temporarily closed because a bridge is being repaired; follow the blue signs to the eastern trail instead. The bird hide is open, but visitors should keep voices low and avoid using flash photography. Families can borrow a free activity pack from the desk. A guided walk leaves at eleven each morning and lasts about fifty minutes. It begins beside the old clock, not at the car park. Binoculars are available to rent for three pounds, and the rental desk accepts cash only. Please do not feed the ducks, as bread can harm them.'
    },
    {
      title: 'Section 3 · Students planning a research project',
      script: 'Tutor: Have you decided how to study the effects of the new cycle route? Student A: We first thought about counting cyclists at the main junction, but that would miss people who use the quieter streets. Student B: We could combine short observations at three locations with an online survey. Tutor: Good. Make sure the survey asks about journeys before and after the route opened. Student A: We will work on Monday, Wednesday, and Saturday, because weekend use may be different. Student B: The council has offered us a map, but not individual travel data. Tutor: That is useful. You should also interview two local shop owners. For analysis, compare journey purpose and approximate travel time, rather than trying to identify each cyclist. Submit your draft report by the twentieth of October.'
    },
    {
      title: 'Section 4 · Planning a wetland restoration',
      script: 'This lecture describes the restoration of a wetland near Elmford. Earlier drainage schemes reduced seasonal flooding but also dried the upper marsh. The new project will block two drainage channels and reopen a shallow stream on the western edge. Researchers will measure water depth at six marked points each month. They will also record plant cover in spring and late summer, when seasonal differences are easiest to compare. The team expects reeds to expand first, although a rapid increase is not guaranteed. A boardwalk will protect sensitive ground and keep visitors away from the monitoring points. The project is funded for three years; after that, the regional trust will decide whether to continue. Local volunteers will help remove litter, but specialist contractors will install the water gates. The first review is scheduled for March.'
    },
  ],
  questions: [
    multipleChoice('When does the swimming course begin?', ['14 June', '14 July', '16 June', '16 July'], 0, 'The staff member says the next course starts on Tuesday the fourteenth of June.'),
    multipleChoice('What time does the class start?', ['6:15 p.m.', '6:45 p.m.', '7:00 p.m.', '7:15 p.m.'], 0, 'The corrected class time is quarter past six.'),
    multipleChoice('Where is the accessible changing room?', ['Next to reception.', 'Beside the pool entrance.', 'On the first floor.', 'Near lane three.'], 0, 'The staff member locates it next to reception.'),
    multipleChoice('What can the centre lend the caller?', ['Goggles.', 'A towel.', 'A swimming costume.', 'A health form.'], 0, 'Goggles can be borrowed for the first session.'),
    multipleChoice('How much does the course cost?', ['£68.', '£60.', '£86.', '£98.'], 0, 'The course costs sixty-eight pounds including pool entry.'),
    multipleChoice('How can the caller pay?', ['By card at reception.', 'By cash to the instructor.', 'Online after the first lesson.', 'By bank transfer only.'], 0, 'Payment can be made at reception by card.'),
    multipleChoice('Which lane is used for the first lesson?', ['Lane three.', 'Lane two.', 'Lane four.', 'Lane six.'], 0, 'The first lesson is in lane three.'),
    multipleChoice('Who will teach the course?', ['Daniel.', 'David.', 'Martin.', 'Michael.'], 0, 'The instructor is named Daniel.'),
    multipleChoice('How early should participants arrive?', ['Ten minutes early.', 'Five minutes early.', 'Twenty minutes early.', 'At the exact start time.'], 0, 'Participants should arrive ten minutes early for a health form.'),
    multipleChoice('What must participants complete before the lesson?', ['A health form.', 'A written test.', 'A membership interview.', 'A safety video.'], 0, 'The staff member asks them to complete a short health form.'),
    multipleChoice('When does the visitor centre open?', ['9:00 a.m.', '8:30 a.m.', '10:00 a.m.', '11:00 a.m.'], 0, 'The centre opens at nine.'),
    multipleChoice('When does the café close?', ['4:30 p.m.', '4:00 p.m.', '5:00 p.m.', '5:30 p.m.'], 0, 'The café closes at half past four.'),
    multipleChoice('Why is the north footpath closed?', ['A bridge is being repaired.', 'The trail is flooded.', 'Wildlife is nesting there.', 'The visitor centre is rebuilding it.'], 0, 'The north footpath is closed while a bridge is repaired.'),
    multipleChoice('Which route should visitors use instead?', ['The eastern trail.', 'The northern track.', 'The riverside road.', 'The western entrance.'], 0, 'Visitors are directed by blue signs to the eastern trail.'),
    multipleChoice('What should visitors avoid at the bird hide?', ['Flash photography.', 'Using binoculars.', 'Sitting near the window.', 'Taking written notes.'], 0, 'The announcement asks visitors to avoid flash photography.'),
    multipleChoice('Where can families get an activity pack?', ['At the visitor-centre desk.', 'At the bird hide.', 'From the café.', 'At the car park.'], 0, 'Free activity packs are available from the desk.'),
    multipleChoice('When does the guided walk leave?', ['11:00 a.m.', '10:00 a.m.', '11:30 a.m.', '12:00 noon.'], 0, 'The walk leaves at eleven each morning.'),
    multipleChoice('Where does the guided walk begin?', ['Beside the old clock.', 'At the car park.', 'Outside the café.', 'At the bird hide.'], 0, 'The start point is beside the old clock.'),
    multipleChoice('How much does binocular rental cost?', ['£3.', '£2.', '£5.', '£8.'], 0, 'Binoculars cost three pounds to rent.'),
    multipleChoice('What payment does the rental desk accept?', ['Cash only.', 'Cards only.', 'Cash or card.', 'Mobile payment only.'], 0, 'The rental desk accepts cash only.'),
    multipleChoice('Why did the students reject counting cyclists at one junction?', ['It would miss people using quieter streets.', 'The junction was closed at weekends.', 'The council would not allow observations.', 'It would take too long to count everyone.'], 0, 'The first method would overlook cyclists on quieter streets.'),
    multipleChoice('What methods do the students decide to combine?', ['Observations at three sites and an online survey.', 'Interviews and a laboratory experiment.', 'A phone app and traffic cameras.', 'A paper survey and a library search.'], 0, 'They propose short observations at three locations and an online survey.'),
    multipleChoice('What should the survey ask participants to compare?', ['Journeys before and after the route opened.', 'Cycling with public transport only.', 'Weekday and holiday spending.', 'The cost of bicycles and repairs.'], 0, 'The tutor advises asking about journeys before and after the route opened.'),
    multipleChoice('On which days will the students collect observations?', ['Monday, Wednesday, and Saturday.', 'Monday, Tuesday, and Thursday.', 'Wednesday, Friday, and Sunday.', 'Tuesday, Thursday, and Saturday.'], 0, 'The students select Monday, Wednesday, and Saturday.'),
    multipleChoice('What information has the council offered?', ['A map.', 'Individual travel histories.', 'A list of cyclists.', 'Shop sales records.'], 0, 'The council offers a map but not personal travel data.'),
    multipleChoice('How many shop owners should the students interview?', ['Two.', 'One.', 'Three.', 'Six.'], 0, 'The tutor recommends interviewing two local shop owners.'),
    multipleChoice('What should the students compare in their analysis?', ['Journey purpose and approximate travel time.', 'Each cyclist’s identity and exact route.', 'Bicycle prices and shop opening hours.', 'Weather conditions and road construction costs.'], 0, 'They should compare purpose and approximate travel time, not identify individuals.'),
    multipleChoice('When is the draft report due?', ['20 October.', '12 October.', '20 November.', '22 October.'], 0, 'The draft report is due by the twentieth of October.'),
    multipleChoice('What was one effect of the earlier drainage schemes?', ['The upper marsh became drier.', 'The stream moved to the east.', 'The wetland became deeper year-round.', 'The boardwalk was damaged.'], 0, 'Drainage reduced flooding but also dried the upper marsh.'),
    multipleChoice('What will the project do to the drainage channels?', ['Block two of them.', 'Deepen all of them.', 'Move them to the eastern edge.', 'Use them as visitor paths.'], 0, 'The plan is to block two drainage channels.'),
    multipleChoice('Where will the shallow stream be reopened?', ['On the western edge.', 'In the centre of the marsh.', 'Along the northern boundary.', 'Near the visitor entrance.'], 0, 'The stream will be reopened on the western edge.'),
    multipleChoice('How many points will researchers use to measure water depth?', ['Six.', 'Four.', 'Eight.', 'Ten.'], 0, 'Water depth will be measured at six marked points.'),
    multipleChoice('When will plant cover be recorded?', ['In spring and late summer.', 'Every week in winter.', 'Only at the end of the project.', 'In early spring and mid-winter.'], 0, 'Plant cover will be recorded in spring and late summer.'),
    multipleChoice('Which plant is expected to expand first?', ['Reeds.', 'Willows.', 'Water lilies.', 'Wild grasses.'], 0, 'The researchers expect reeds to expand first.'),
    multipleChoice('What will the boardwalk help protect?', ['Sensitive ground.', 'The water gates.', 'The monitoring equipment.', 'The visitor-centre roof.'], 0, 'The boardwalk will protect sensitive ground and keep visitors away from measurement points.'),
    multipleChoice('How long is the project initially funded for?', ['Three years.', 'Two years.', 'Four years.', 'Five years.'], 0, 'The project is funded for three years.'),
    multipleChoice('Who will decide whether work continues after the funding period?', ['The regional trust.', 'The local school.', 'The specialist contractors.', 'The volunteer group.'], 0, 'The regional trust will decide whether to continue.'),
    multipleChoice('What will local volunteers do?', ['Help remove litter.', 'Install the water gates.', 'Measure water depth each month.', 'Build the stream channel.'], 0, 'Volunteers will help with litter removal.'),
    multipleChoice('Who will install the water gates?', ['Specialist contractors.', 'Local volunteers.', 'Museum staff.', 'The regional trust board.'], 0, 'Specialist contractors will install the gates.'),
    multipleChoice('When is the first review scheduled?', ['March.', 'January.', 'April.', 'September.'], 0, 'The first review is scheduled for March.'),
  ],
}
