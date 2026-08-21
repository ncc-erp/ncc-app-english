import { IELTSSpeakingTopic } from '@/types/ielts';

export const SEED_IELTS_TOPICS: IELTSSpeakingTopic[] = [
  {
    id: 'topic-tech-innovation',
    title: 'Technology & Artificial Intelligence',
    category: 'Technology',
    description: 'Discuss everyday digital devices, smart algorithms, automation, and how modern artificial intelligence reshapes daily routines and employment.',
    part1_questions: [
      {
        id: 'p1-q1',
        topic_title: 'Work / Study & Daily Tech',
        question_text: 'What kind of technology do you use every day for work or study?',
      },
      {
        id: 'p1-q2',
        topic_title: 'Communication Apps',
        question_text: 'Do you prefer communicating with friends face-to-face or via messaging apps?',
      },
      {
        id: 'p1-q3',
        topic_title: 'Future Gadgets',
        question_text: 'Is there any new piece of technology you would like to buy in the future?',
      },
      {
        id: 'p1-q4',
        topic_title: 'Screen Time',
        question_text: 'How much time do you spend on digital devices each day?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue1',
      topic_title: 'Describe a useful technological device',
      cue_card_title: 'Describe a piece of technology that you find very useful in your daily life.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'What it is and when you got it',
        'How often you use this technology',
        'What main features or functions it has',
        'And explain why you consider it so useful to you.',
      ],
      follow_up_question: 'Do you think older people find it easy to use this device?',
    },
    part3_questions: [
      {
        id: 'p3-q1',
        topic_title: 'Impact on Employment',
        question_text: 'How has artificial intelligence changed the job market in your country?',
      },
      {
        id: 'p3-q2',
        topic_title: 'Work-Life Balance',
        question_text: 'Do smartphones make it harder for employees to disconnect from work after hours?',
      },
      {
        id: 'p3-q3',
        topic_title: 'Future Education',
        question_text: 'In your opinion, will virtual classrooms ever completely replace traditional university lectures?',
      },
    ],
  },
  {
    id: 'topic-environment-cities',
    title: 'Urban Environment & Sustainable Living',
    category: 'Environment',
    description: 'Explore green city planning, recycling initiatives, climate awareness, and individual actions toward environmental protection.',
    part1_questions: [
      {
        id: 'p1-env-q1',
        topic_title: 'Hometown & Living Space',
        question_text: 'Do you live in a city or in the countryside?',
      },
      {
        id: 'p1-env-q2',
        topic_title: 'Green Spaces',
        question_text: 'Are there many parks or public gardens near your home?',
      },
      {
        id: 'p1-env-q3',
        topic_title: 'Recycling Habits',
        question_text: 'Does your family regularly recycle household waste?',
      },
      {
        id: 'p1-env-q4',
        topic_title: 'Weather & Mood',
        question_text: 'What type of weather do you enjoy the most?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue2',
      topic_title: 'Describe an eco-friendly place',
      cue_card_title: 'Describe a green park or natural environment you visited that impressed you.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'Where this place is located',
        'Who you went there with and when',
        'What activities people can do in this green space',
        'And explain why you enjoyed visiting this environment.',
      ],
      follow_up_question: 'Would you like to visit this park again in the near future?',
    },
    part3_questions: [
      {
        id: 'p3-env-q1',
        topic_title: 'Government Responsibility',
        question_text: 'What measures should governments take to reduce urban air pollution?',
      },
      {
        id: 'p3-env-q2',
        topic_title: 'Individual vs Corporate Action',
        question_text: 'Do you believe individual efforts or corporate regulations have a greater impact on environmental protection?',
      },
      {
        id: 'p3-env-q3',
        topic_title: 'Eco-Tourism',
        question_text: 'How can tourism be managed sustainably without harming natural heritage sites?',
      },
    ],
  },
  {
    id: 'topic-education-learning',
    title: 'Education & Lifelong Learning',
    category: 'Education',
    description: 'Examine modern study habits, online learning platforms, school memories, and essential skills for modern careers.',
    part1_questions: [
      {
        id: 'p1-edu-q1',
        topic_title: 'School Subjects',
        question_text: 'What was your favorite subject when you were at school?',
      },
      {
        id: 'p1-edu-q2',
        topic_title: 'Study Environment',
        question_text: 'Do you prefer studying alone or in a group with classmates?',
      },
      {
        id: 'p1-edu-q3',
        topic_title: 'Online Learning',
        question_text: 'Have you ever taken an online course or educational webinar?',
      },
      {
        id: 'p1-edu-q4',
        topic_title: 'Teachers & Mentors',
        question_text: 'Did you have a teacher who inspired you during your school years?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue3',
      topic_title: 'Describe a skill you learned',
      cue_card_title: 'Describe a practical skill you learned outside of your school or university curriculum.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'What skill it is and how you learned it',
        'Who taught you or helped you acquire this skill',
        'How long it took you to become proficient in it',
        'And explain why this skill is valuable in your daily life.',
      ],
      follow_up_question: 'Do you think anyone can learn this skill independently?',
    },
    part3_questions: [
      {
        id: 'p3-edu-q1',
        topic_title: 'Role of Examinations',
        question_text: 'Do traditional written exams accurately measure a student’s true potential?',
      },
      {
        id: 'p3-edu-q2',
        topic_title: 'Practical vs Theoretical Education',
        question_text: 'Should universities place greater emphasis on practical job skills over theoretical knowledge?',
      },
      {
        id: 'p3-edu-q3',
        topic_title: 'Lifelong Education',
        question_text: 'Why is continuous lifelong learning becoming essential in modern workplaces?',
      },
    ],
  },
  {
    id: 'topic-travel-culture',
    title: 'Travel, Culture & Global Heritage',
    category: 'Travel',
    description: 'Explore overseas travel experiences, cultural heritage, architectural landmarks, and global tourism trends.',
    part1_questions: [
      {
        id: 'p1-trv-q1',
        topic_title: 'Holiday Destinations',
        question_text: 'Where do you usually go when you have a holiday?',
      },
      {
        id: 'p1-trv-q2',
        topic_title: 'Modes of Transport',
        question_text: 'Do you prefer traveling by plane, train, or car for long journeys?',
      },
      {
        id: 'p1-trv-q3',
        topic_title: 'Souvenirs & Keepsakes',
        question_text: 'Do you buy souvenirs when you visit a new place?',
      },
      {
        id: 'p1-trv-q4',
        topic_title: 'Local Culture',
        question_text: 'What do you enjoy most about exploring traditional local foods during travel?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue4',
      topic_title: 'Describe a country or town you want to visit',
      cue_card_title: 'Describe a country or city you have never been to but would love to visit in the future.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'Where this place is located',
        'How you first heard about or discovered it',
        'What main attractions or activities you would do there',
        'And explain why you are particularly interested in visiting this place.',
      ],
      follow_up_question: 'Do you plan to visit this place within the next few years?',
    },
    part3_questions: [
      {
        id: 'p3-trv-q1',
        topic_title: 'Cultural Preservation',
        question_text: 'How does international tourism affect the preservation of local traditions and culture?',
      },
      {
        id: 'p3-trv-q2',
        topic_title: 'Travel Habits across Generations',
        question_text: 'In what ways do young people travel differently compared to older generations?',
      },
      {
        id: 'p3-trv-q3',
        topic_title: 'Economic Impact of Tourism',
        question_text: 'Are there any drawbacks for cities that rely heavily on foreign tourists for income?',
      },
    ],
  },
  {
    id: 'topic-work-careers',
    title: 'Work, Careers & Remote Workplace',
    category: 'Work',
    description: 'Discuss career aspirations, remote working trends, office environments, and teamwork dynamics.',
    part1_questions: [
      {
        id: 'p1-wrk-q1',
        topic_title: 'Current Occupation',
        question_text: 'Do you currently work or are you a student?',
      },
      {
        id: 'p1-wrk-q2',
        topic_title: 'Ideal Work Environment',
        question_text: 'What kind of work environment makes you feel most productive?',
      },
      {
        id: 'p1-wrk-q3',
        topic_title: 'Team Collaboration',
        question_text: 'Do you prefer working on projects independently or collaborating in a team?',
      },
      {
        id: 'p1-wrk-q4',
        topic_title: 'Overtime & Hours',
        question_text: 'Do people in your country often work long hours or weekends?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue5',
      topic_title: 'Describe a career you admire',
      cue_card_title: 'Describe a job or career path that you find interesting and respect.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'What the job is and what responsibilities it involves',
        'What skills or qualifications are required for it',
        'How you learned about this profession',
        'And explain why you admire or respect people who do this job.',
      ],
      follow_up_question: 'Would you ever consider pursuing this career yourself?',
    },
    part3_questions: [
      {
        id: 'p3-wrk-q1',
        topic_title: 'Remote Work Trends',
        question_text: 'What are the main advantages and disadvantages of working remotely from home?',
      },
      {
        id: 'p3-wrk-q2',
        topic_title: 'Job Satisfaction vs Salary',
        question_text: 'Which factor is more important when choosing a job: high salary or personal job satisfaction?',
      },
      {
        id: 'p3-wrk-q3',
        topic_title: 'Future Work Automation',
        question_text: 'How will technological developments affect traditional office routines over the next decade?',
      },
    ],
  },
  {
    id: 'topic-sports-fitness',
    title: 'Sports, Health & Active Lifestyle',
    category: 'Health',
    description: 'Explore physical exercise habits, competitive sports events, public health campaigns, and balanced nutrition.',
    part1_questions: [
      {
        id: 'p1-spt-q1',
        topic_title: 'Daily Exercise',
        question_text: 'What physical activities or sports do you enjoy doing to stay active?',
      },
      {
        id: 'p1-spt-q2',
        topic_title: 'Spectator Sports',
        question_text: 'Do you watch sports live at stadiums or on television?',
      },
      {
        id: 'p1-spt-q3',
        topic_title: 'Morning Routines',
        question_text: 'Do you think morning exercise helps improve mental focus throughout the day?',
      },
      {
        id: 'p1-spt-q4',
        topic_title: 'Water Sports',
        question_text: 'Have you ever tried swimming or any water-based activities?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue6',
      topic_title: 'Describe a sporting event',
      cue_card_title: 'Describe an exciting sporting event or competition you watched live or on broadcast.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'What the sport was and where the event took place',
        'Who was competing in the match or tournament',
        'Who you watched the event with',
        'And explain why this event was so memorable and exciting for you.',
      ],
      follow_up_question: 'Do you support the same team or athlete today?',
    },
    part3_questions: [
      {
        id: 'p3-spt-q1',
        topic_title: 'Youth Fitness',
        question_text: 'How can primary schools encourage children to participate more actively in sports?',
      },
      {
        id: 'p3-spt-q2',
        topic_title: 'Athlete Salaries',
        question_text: 'Do you think top professional athletes are paid excessively compared to essential workers?',
      },
      {
        id: 'p3-spt-q3',
        topic_title: 'Public Health Initiatives',
        question_text: 'What role should municipal governments play in promoting healthy lifestyles among citizens?',
      },
    ],
  },
  {
    id: 'topic-art-entertainment',
    title: 'Music, Cinema & Performing Arts',
    category: 'Entertainment',
    description: 'Discuss musical preferences, film genres, artistic expression, and streaming platforms in modern culture.',
    part1_questions: [
      {
        id: 'p1-art-q1',
        topic_title: 'Music Preferences',
        question_text: 'What genres of music do you listen to when relaxing?',
      },
      {
        id: 'p1-art-q2',
        topic_title: 'Live Concerts',
        question_text: 'Have you ever attended a live musical concert or stage performance?',
      },
      {
        id: 'p1-art-q3',
        topic_title: 'Cinema vs Home',
        question_text: 'Do you prefer watching movies at a cinema theater or streaming them at home?',
      },
      {
        id: 'p1-art-q4',
        topic_title: 'Artistic Hobbies',
        question_text: 'Did you learn drawing, painting, or playing an instrument when you were young?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue7',
      topic_title: 'Describe a memorable movie or show',
      cue_card_title: 'Describe a film or theatrical production that left a strong impression on you.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'What film or play it was and what the storyline was about',
        'When and where you watched it',
        'Who the main actors or director were',
        'And explain why this production left such a deep impression on you.',
      ],
      follow_up_question: 'Would you recommend this movie to your close friends?',
    },
    part3_questions: [
      {
        id: 'p3-art-q1',
        topic_title: 'Value of Art in Society',
        question_text: 'Why is it important for a society to support and fund public art and cultural galleries?',
      },
      {
        id: 'p3-art-q2',
        topic_title: 'Impact of Streaming Platforms',
        question_text: 'How have online video streaming platforms changed traditional movie production and viewing habits?',
      },
      {
        id: 'p3-art-q3',
        topic_title: 'Celebrity Influence',
        question_text: 'Do famous actors and musicians have a responsibility to act as positive role models for youth?',
      },
    ],
  },
  {
    id: 'topic-shopping-consumerism',
    title: 'Shopping, Commerce & Digital Economy',
    category: 'Daily Life',
    description: 'Examine e-commerce growth, consumer spending habits, advertising tactics, and cashless payment solutions.',
    part1_questions: [
      {
        id: 'p1-shp-q1',
        topic_title: 'Shopping Habits',
        question_text: 'How often do you go shopping for clothes or household items?',
      },
      {
        id: 'p1-shp-q2',
        topic_title: 'Online Shopping',
        question_text: 'Do you prefer buying items online or visiting physical retail stores?',
      },
      {
        id: 'p1-shp-q3',
        topic_title: 'Street Markets',
        question_text: 'Are traditional open-air markets popular in your hometown?',
      },
      {
        id: 'p1-shp-q4',
        topic_title: 'Impulse Buying',
        question_text: 'Have you ever bought something on impulse that you later regretted?',
      },
    ],
    part2_cue_card: {
      id: 'p2-cue8',
      topic_title: 'Describe a useful purchase',
      cue_card_title: 'Describe a product or item you purchased recently that you are very satisfied with.',
      prompt_lead: 'You should say:',
      bullet_points: [
        'What the item is and where you bought it',
        'How much it cost and why you decided to buy it',
        'How frequently you use this product',
        'And explain why you feel so satisfied with this purchase.',
      ],
      follow_up_question: 'Do you think this item offers good long-term value for money?',
    },
    part3_questions: [
      {
        id: 'p3-shp-q1',
        topic_title: 'Impact of Advertising',
        question_text: 'How do modern social media advertisements influence consumer choices and spending habits?',
      },
      {
        id: 'p3-shp-q2',
        topic_title: 'Cashless Society',
        question_text: 'What are the potential risks and benefits of transitioning to a completely cashless society?',
      },
      {
        id: 'p3-shp-q3',
        topic_title: 'Consumerism & Environment',
        question_text: 'Does fast fashion and overconsumption contribute significantly to global environmental waste?',
      },
    ],
  },
];
