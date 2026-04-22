/**
 * 20 synthetic B2-ish ESL essays for demo metrics.
 *
 * These are hand-written to mimic authentic L2 writing: realistic errors
 * (tense, article, preposition, vocab near-miss, occasional spelling drift)
 * distributed naturally across the text. Three length buckets:
 *   - short:  ~50-100 words  (5 essays)
 *   - medium: ~180-250 words (10 essays) — the target range per the rubric
 *   - long:   ~350-500 words (5 essays)
 *
 * CAVEAT FOR INTERPRETATION: these are cleaner than real student writing.
 * Latency/cost numbers are a lower bound on real-world values.
 *
 * Topic mix is intentional: travel, work, community, family, school, hobbies,
 * environment. The rubric vocab (accomplish, challenge, community, ...) is
 * sparsely but deliberately seeded across the essays so the grader has real
 * matches to find without every essay being a vocabulary carpet-bomb.
 */

export const essays = [
  // ───────────────────────────────── SHORT (5) ─────────────────────────────────
  {
    id: 'short-01',
    nickname: 'Maria',
    bucket: 'short',
    text: `Last summer I have visited my grandmother in the village. She live in a small house near the forest. Every morning we was walking together and she told me stories about her childhood. It was a significant experience for me because I learn to appreciate the simple life. I hope to go back next year.`,
  },
  {
    id: 'short-02',
    nickname: 'Kenji',
    bucket: 'short',
    text: `My best friend is called Tomas. We know each other since we are six years old. He always help me when I have a problem and I try to do same for him. Last month we had a small fight but we talked and now everything is fine. A good friend is one of most important things in life.`,
  },
  {
    id: 'short-03',
    nickname: 'Fatima',
    bucket: 'short',
    text: `I think technology change our life very fast. Before, people wrote letters and waited many days for answer. Now we send message in seconds. But sometimes I miss the old way, because people was more patient. If I could choose, I would keep both the old and the new tradition.`,
  },
  {
    id: 'short-04',
    nickname: 'Lucas',
    bucket: 'short',
    text: `In my community there is a big problem with rubbish in the street. Last year some volunteers started to clean the park every Saturday. I joined them two months ago and I am happy I did. We cleaned almost all the area and now children can play safely. Small actions can make a big diference.`,
  },
  {
    id: 'short-05',
    nickname: 'Anya',
    bucket: 'short',
    text: `When I was child, my father taught me how to ride a bicycle. At the begining I was very scared and I fall many times. But he was patient and he never shouted at me. After one week I could ride alone. Now, every time I ride a bike, I remember this day with a smile.`,
  },

  // ──────────────────────────────── MEDIUM (10) ────────────────────────────────
  {
    id: 'medium-01',
    nickname: 'Isabella',
    bucket: 'medium',
    text: `One of the most significant experiences of my life was when I moved to another country for my studies. At first, it was a big challenge because I did not know anybody and I struggled with the language. I remember the first day at university very clearly. I arrived late because I have taken the wrong bus, and when I entered the classroom everybody looked at me. I felt like I wanted to disappear. However, the teacher was very kind and she introduced me to another students. That day I meet my best friend, Sara, who is from Brazil.

During the first months, I had many moments when I wanted to go back home. The food was different, the weather was colder, and sometimes I could not understand what people was saying. But slowly, I started to make friends and to feel more comfortable. I learned that if I would give up, I would never know my real capacity. Now, two years later, I can say that this experience has changed me completely. I have learned to be more independent, more patient, and to see the world from a different perspective. It was not easy, but it was worth every difficult moment.`,
  },
  {
    id: 'medium-02',
    nickname: 'Diego',
    bucket: 'medium',
    text: `Last year I had the opportunity to work as a volunteer in a summer camp for children. It was one of the most rewarding experience I have ever had, even though at the begining I was not sure if I would be able to do it. My main responsibility was to organize sports activities for kids between eight and twelve years old. I have never worked with children before, so I felt nervous.

The first day was a disaster. Two kids started to fight during a football game and I did not know how to react. Another child began to cry because he missed his mother. I remember thinking that I was not made for this job. But my supervisor, who was a very experienced teacher, took me aside and said: "Don't worry, every new volunteer feels like this. Just listen to them and be patient."

After that conversation, everything changed. I started to really listen to the children and I discovered that each one of them had their own story. By the end of the camp, I had learned much more from them than they had learned from me. The experience taught me that being with children requires a lot of energy, but it also gives you a kind of happiness that is hard to find anywhere else. I would love to do it again next summer.`,
  },
  {
    id: 'medium-03',
    nickname: 'Priya',
    bucket: 'medium',
    text: `I have always been interested in the environment, but it was not until last year that I really started to change my daily habits. The turning point was a documentary I watched about plastic pollution in the ocean. After seeing the images of animals trapped in plastic, I could not continue my life as before.

I started with small things. I bought a metal water bottle and I stopped using plastic bags at the supermarket. I also began to separate the rubbish more carefully at home. At the begining my family thought I was exaggerating, specially my brother who said that my efforts would not change anything. But I did not give up.

If every person in the world would do small actions like these, the difference would be enormous. I think the main problem is that people feel their individual action is not important, but this is not true. Last month, my brother started to use a reusable bottle too, and he even convinced two friends. This shows that our behaviour can influence the people around us.

It is a huge challenge to protect our environment, and governments must take bigger responsibility, but I believe that each of us has a role to play. I will continue to learn and to share what I know, because this is the only planet we have.`,
  },
  {
    id: 'medium-04',
    nickname: 'Mateo',
    bucket: 'medium',
    text: `My grandfather passed away two years ago, and since then I often think about all the things he taught me. He was a farmer all his life and he had a special relationship with the land. When I was a child, I used to spend every summer at his farm, and those are some of my best memories.

He didn't have much education, but he was one of the wisest people I have ever known. He used to tell me that the most important thing in life is to be honest, with others but specially with yourself. I did not understand it very well when I was eight years old, but now his words makes complete sense.

One day, when I was maybe ten, I broke a window playing football. I was very scared and I tried to hide it. When my grandfather found out, he was not angry that I broke the window. He was angry because I did not tell the truth. That day I learned a lesson I will never forget.

Now, whenever I have to make a difficult decision, I ask myself what he would do. It is like he is still with me, giving me advice. Family is the most important thing in life, and I am grateful for the tradition of wisdom he has passed to me.`,
  },
  {
    id: 'medium-05',
    nickname: 'Aiko',
    bucket: 'medium',
    text: `Three years ago I decided to learn how to play the guitar. I had always wanted to play an instrument, but I kept postponing the decision because I thought I was too old or not talented enough. Now I realize these were just excuses.

In the begining, progress was painfully slow. My fingers hurt and I could not even play a simple chord without making a terrible sound. There was moments when I wanted to give up completely. My teacher, who is a very patient woman, told me that everybody feels like this at the start.

What really helped me was to set small goals. Instead of trying to play a full song, I focused on playing just one chord perfectly, then two, then a transition between them. Slowly, I began to see real progress. After six months, I could play my first complete song, and I felt like I had accomplished something important.

Now, three years later, I play almost every day. I am not a professional, and I will probably never be, but that is not the point. The priority for me is the joy I feel when I play. It is my way to relax after a long day of work. If I had listened to my excuses, I would have missed all this happiness. Sometimes the best decisions are the ones we almost did not take.`,
  },
  {
    id: 'medium-06',
    nickname: 'Noah',
    bucket: 'medium',
    text: `Last December I had a very unusual experience that changed the way I see strangers. I was traveling alone by train to visit my cousin, and it was a journey of almost six hours. At one of the stations, an old woman sat next to me. She looked very tired and she was carrying a lot of bags.

At first I did not pay much attention to her. I was listening to music and reading a book. But after some time, she started to talk to me. Normally I do not like to talk with strangers in public transport, but there was something very friendly about her. She told me she was going to visit her son, who she had not seen for almost two years.

During the rest of the journey, she told me many stories about her life. She had lived in three different countries, she had worked as a nurse during a war, and she had raised five children mostly alone. I was impressed by her strength and by the way she told everything without complaining.

When we arrived at the final station, she thanked me for listening. I was the one who should have thanked her. That day I understood that every person around us has a whole world of experiences inside them, and we usually never know. Since then, I try to be more open with the people I meet.`,
  },
  {
    id: 'medium-07',
    nickname: 'Sofia',
    bucket: 'medium',
    text: `For many years, my dream was to run a marathon. I talked about it often, but I never did anything concrete. Every January I would promise myself that this would be the year, and every December I had not even started training. Last year something finally changed.

A colleague at my work was training for his first marathon, and he invited me to join his running group. At the begining I said no because I thought I was not ready. But he insisted, and finally I went to one training. It was terrible. I could only run for ten minutes before I had to stop. I was embarrassed and I wanted to leave.

However, the other runners were very supportive. Nobody laughed at me. They told me that everybody starts from zero. Little by little, week after week, I began to improve. After three months I could run five kilometers without stopping. After six months, ten kilometers.

Finally, last November, I ran my first marathon. I did not win, of course, and my time was not impressive. But crossing the finish line was one of the most emotional moments of my life. All those months of training, all the mornings when I wanted to stay in bed, all the small victories — everything came together in that moment. I learned that big goals are possible if you break them into small steps and if you have the right community around you.`,
  },
  {
    id: 'medium-08',
    nickname: 'Viktor',
    bucket: 'medium',
    text: `I grew up in a family where reading was considered very important. My mother used to read to me every night before sleep, and later my father introduced me to adventure novels. Because of this, I developed a strong passion for books from a very young age.

However, when I became a teenager, I almost stopped reading completely. I was more interested in video games and social media, like most of my friends. For about five years, I barely opened a book. I remember my mother giving me novels for my birthday, and I would put them on the shelf without even reading the first page.

Things changed during my first year at university. I had to read a lot for my classes, and at first I found it very difficult to concentrate. But slowly, I remembered how much I used to enjoy reading. I started to pick up books that were not assigned, just for pleasure. It was like meeting an old friend again.

Now I read every day, usually for thirty or forty minutes before sleep. Books have given me so much: knowledge, empathy, and a way to escape from the stress of daily life. If I would give advice to young people, I would say never lose the habit of reading. It is a tradition worth keeping alive, and it opens your mind to perspectives you would never find otherwise.`,
  },
  {
    id: 'medium-09',
    nickname: 'Zara',
    bucket: 'medium',
    text: `Working from home has been one of the biggest changes in my professional life. When the pandemic started, my company decided that everybody should work remotely. At first I was very happy because I hated the long commute. I was sure that my productivity would increase.

The first weeks were great. I could wake up later, I had more time for breakfast, and I did not need to wear formal clothes. But after about a month, I started to notice some problems. My apartment is small, and I did not have a proper workspace. I was working from the kitchen table, and my back began to hurt. Also, I missed talking with my colleagues face to face.

The most difficult thing was to separate work from personal life. When you work from home, it is very easy to continue working until late in the night, because there is no clear moment when the day ends. I found myself answering emails at eleven p.m., which was something I never did before.

After some months, I learned to create better boundaries. I bought a proper desk and chair, I set fixed working hours, and I started to take real breaks during the day. Now I can say that remote work has advantages and disadvantages. If I could choose, I would work from home three days and go to the office two days. That would be the perfect balance for me.`,
  },
  {
    id: 'medium-10',
    nickname: 'Omar',
    bucket: 'medium',
    text: `Last year I took a cooking class, and it has become one of my favorite hobbies. I signed up mostly because my girlfriend was tired of me only knowing how to make pasta and scrambled eggs. I did not expect to enjoy it so much.

The class was every Tuesday evening, for three hours. Our teacher was an Italian chef with forty years of experience. He was very strict but also very funny. On the first day, he told us that cooking is not just about following a recipe, it is about understanding the ingredients and respecting the tradition behind each dish.

I was not the best student in the class, but I was one of the most enthusiastic. I remember the day we made fresh pasta for the first time. The dough was sticky, my kitchen was a complete disaster, and the final result did not look at all like the teacher's version. But it tasted amazing, and I felt like I had really accomplished something.

Since then, I cook at home at least three times a week. I have learned to make many different dishes, from risotto to curry to homemade bread. My girlfriend is very happy, and our friends now expect me to cook when they come to visit. Cooking has taught me patience and creativity, and it has given me a new way to share time with the people I love. It is a small thing, but it has made my life better.`,
  },

  // ───────────────────────────────── LONG (5) ─────────────────────────────────
  {
    id: 'long-01',
    nickname: 'Elena',
    bucket: 'long',
    text: `When I finished high school, I did not know what I wanted to do with my life. All my friends seemed to have a clear plan: some were going to study medicine, others engineering, others business. I felt lost and pressured. My parents, who had always supported me, started to ask me every day what I was going to do, and their good intentions made me feel even more anxious.

After many weeks of indecision, I made a decision that surprised everybody, including myself. I decided to take a gap year and travel. I had saved some money from a part-time job during the summer, and I convinced my parents that this was not a waste of time but an investment in understanding myself better. They were not happy at first, but finally they accepted.

The next twelve months were the most transformative of my life. I traveled to five different countries, mostly alone, sometimes with people I met along the way. I worked in a hostel in Portugal for two months, I volunteered at an animal shelter in Greece, and I took a cooking course in Thailand. Every experience taught me something different about myself and about the world.

The most important thing I learned was that the life I had imagined for myself was not really mine. It was a combination of what my parents expected, what my teachers recommended, and what society considered successful. During my travels, I met people with completely different backgrounds and values, and I started to question many things I had taken for granted.

When I returned home, I knew exactly what I wanted to study: international relations. It was not a career I had ever considered before my trip, but after meeting so many people from different cultures and seeing different social realities, I felt a real passion for understanding how the world works and how different communities can cooperate.

Now I am in my third year at university, and I am certain I made the right choice. Looking back, taking that gap year was one of the best decisions I have ever made. It gave me time to think, to grow, and to find my own path. I would recommend it to any young person who feels lost. Sometimes the most significant progress happens when we stop and look around instead of running forward without direction.`,
  },
  {
    id: 'long-02',
    nickname: 'Rafael',
    bucket: 'long',
    text: `Five years ago, I was diagnosed with a chronic illness that changed my life completely. I was twenty-three years old, I had just finished my master's degree, and I had started a very promising job at a technology company. Everything seemed perfect. Then, during a routine medical check, the doctors found a problem that would require lifetime treatment and significant changes in my daily habits.

The first months were the hardest. I fell into a deep depression. I could not understand why this was happening to me. I had always been healthy and active. I blamed my genetics, my bad luck, even myself for not paying enough attention to some symptoms I had ignored. I isolated myself from my friends because I did not want them to see me weak, and I started to miss days at work. My boss was understanding at first, but I could feel that the situation was becoming unsustainable.

What saved me, in the end, was a combination of professional help and an unexpected friendship. My doctor referred me to a psychologist who specialized in patients with chronic conditions, and through her I joined a support group. At first I did not want to go. I thought it would be depressing to be surrounded by other sick people. But I was completely wrong.

In that group I met people from all ages and all backgrounds who were facing similar challenges. I met a seventy-year-old woman who had been living with diabetes for forty years and was more optimistic than most healthy people I knew. I met a young father who had lost a leg in an accident and who had become a wheelchair basketball coach. Their stories gave me a new perspective on what is possible.

Slowly, I started to rebuild my life. I learned to manage my condition, to recognize my limits without being defined by them, and to prioritize what really matters. I changed jobs and found a company with more flexibility. I started exercising again, adapted to my new reality. I reconnected with friends and family.

Today, I can honestly say that my illness, as difficult as it has been, has made me a better person. I have developed a deeper appreciation for small things, I have become more empathetic with others who are struggling, and I have learned that our worth does not depend on our productivity or our physical abilities. It has been a huge challenge, but also an opportunity to discover a strength I did not know I had.`,
  },
  {
    id: 'long-03',
    nickname: 'Hannah',
    bucket: 'long',
    text: `My grandmother lived with us for the last eight years of her life, and taking care of her taught me more about love, patience, and responsibility than anything else I have experienced. When she moved in, she was eighty-four years old and had recently been diagnosed with Alzheimer's. My parents made the decision to bring her to live with us instead of putting her in a nursing home, and although at first I was not very happy about it, now I understand it was the right thing to do.

In the beginning, her condition was mild. She forgot names sometimes, or she asked the same question twice in a short time, but she was still mostly herself. She would help my mother in the kitchen, she told us stories about her childhood during the war, and she was always ready to give advice, wanted or not. I remember those first years with a lot of warmth.

But the illness progressed, as it always does. Gradually, she forgot more and more. She started to confuse family members. Sometimes she called me by my mother's name, or she asked who I was when I came into the room. That was the most painful part, especially for my mother. Watching her own mother forget her was a slow, silent tragedy.

We all had to adjust our lives. My mother reduced her working hours. My father took on more responsibilities at home. I had to learn to be patient in ways I never imagined. I could not get angry when she repeated the same story for the fifth time in one afternoon. I could not feel hurt when she did not recognize me. Every day was different, and every day required a kind of emotional flexibility that was exhausting.

But there were also beautiful moments. Sometimes, out of nowhere, she would have a moment of clarity. She would look at me with her old sharp eyes and say something wise, or she would laugh at a joke with her real, true laugh. Those moments were gifts. We learned to live for them, to appreciate them without expecting them.

She passed away peacefully last spring, at ninety-two. At her funeral, my mother said something that will stay with me forever. She said that taking care of my grandmother had been the hardest and most meaningful thing she had ever done in her life. I understand now what she meant. Those eight years taught me that love is not just a feeling, it is a daily practice, sometimes inconvenient, sometimes painful, always worth it. I am a different person because of her, and I will try to pass that lesson to my own children one day.`,
  },
  {
    id: 'long-04',
    nickname: 'Jamal',
    bucket: 'long',
    text: `Growing up in a small town had both advantages and disadvantages. On one hand, everybody knew everybody, which created a strong sense of community. On the other hand, opportunities were very limited, and if you wanted to achieve something big in life, you had to leave. That was the unwritten rule, and most young people of my generation accepted it without questioning.

When I turned eighteen, I did what almost everybody expected me to do: I left. I moved to the capital to study at the university, and I was determined to never return. I had a very clear plan: good university, good job, good apartment in the big city, maybe travel abroad for a few years. My parents were proud of me. My teachers told me I had a bright future. And for about ten years, things went exactly according to plan.

But around my thirtieth birthday, something unexpected happened. I started to feel that something was missing in my life. I had a good job, a nice apartment, interesting friends, but there was a kind of emptiness I could not name. I thought it was normal, that everybody feels like this sometimes, and I tried to ignore it. But the feeling grew stronger with each month.

One day I visited my parents for a weekend, and something struck me. In my hometown, people still greeted me on the street. The baker remembered that I liked a specific type of bread. My old neighbor asked me about my work with real interest, not just politeness. I realized that in ten years in the capital, I had never had this kind of interaction. I had many acquaintances there, but very few real connections.

That visit was the seed of a decision that I made six months later. I asked my company if I could work remotely, and thanks to the pandemic situation, they agreed. I moved back to my hometown, and I have been here for two years now. I cannot say everything has been easy. Sometimes I miss the energy and the opportunities of the big city, especially the cultural activities. But the peace I feel here, and the sense of belonging to a real community, have more than compensated for what I left behind.

I have also discovered that the idea that "you have to leave" is not entirely true anymore. With modern technology, it is possible to have a meaningful career without living in a huge city. Some of my childhood friends have also moved back, and together we are trying to bring new energy to our town. We have started a small cultural association, we organize events, and we support local businesses.

I do not know if I will stay here forever. Life is unpredictable, and maybe in ten years I will move again. But right now, I am exactly where I need to be. My experience has taught me that success cannot be measured only by income, job title, or the size of the city where you live. It must include how connected you feel to the people around you, and how much meaning you find in your daily life. For me, coming back home was not a step backwards. It was a step toward a more complete version of myself.`,
  },
  {
    id: 'long-05',
    nickname: 'Leila',
    bucket: 'long',
    text: `The relationship with my father has been the most complicated of my life, and also the one that has taught me the most about forgiveness, growth, and the difference between loving someone and agreeing with them. For many years, I believed that I would never be able to have a real conversation with him. Today, at thirty-five, I can say that we are closer than I ever imagined possible.

My father is a man of his time and his culture. He grew up in a very conservative family, he worked in the same company for forty years, and he believes in traditional values that, in many cases, are not mine. When I was a teenager, every conversation with him ended in an argument. We disagreed about almost everything: politics, religion, lifestyle, how I should dress, what career I should choose. I remember slamming my bedroom door so many times that the lock eventually broke.

The turning point of our relationship came when I decided to study abroad, against his explicit wish. He wanted me to stay close, study at the local university, and follow a more predictable path. I wanted to see the world, challenge myself, and find my own voice. When I announced my decision, he did not speak to me for almost three weeks. It was one of the hardest periods of my life. I felt that I had betrayed him, but I also felt that I had to follow my own path.

The four years I spent studying abroad were transformative, but they were also painful because of the distance, both physical and emotional, from my father. We talked occasionally, always about superficial things. My mother tried to be a bridge between us, but it was not enough. I returned home for Christmas each year, and the visits were always tense.

What changed everything was my grandmother's illness, when I was in my late twenties. My father and I had to spend a lot of time together in the hospital, taking turns to sit with her. At first, the silence between us was uncomfortable. But little by little, in those long hospital hours, we started to talk. Not about politics or careers, but about small things, and then bigger things. He told me stories about his own father, about his youth, about dreams he had given up to support his family. For the first time, I saw him not just as my father, but as a person with his own fears and regrets.

After my grandmother passed away, something had shifted permanently between us. We still disagreed about many things, and we still do. But we had developed a mutual respect that had been missing for years. I understood that his conservative values came from a specific history and context, and that his love for me had always been real, even when it was expressed in ways I did not like. He understood, in turn, that my different choices were not a rejection of him, but an expression of who I had become.

Today, my father is one of my most important confidants. I call him at least twice a week, and our conversations are rich and honest. We still disagree sometimes, but we do it with love. If someone had told me twenty years ago that this would be possible, I would not have believed it. The lesson I have learned is that difficult relationships are worth the effort, and that people can change, even when we think they cannot. Sometimes all they need is an opportunity to be seen, and the patience to be understood.`,
  },
];

export const rubric = {
  cefrLevel: 'B2',
  vocabulary: [
    'accomplish',
    'challenge',
    'community',
    'environment',
    'influence',
    'opportunity',
    'perspective',
    'priority',
    'responsibility',
    'significant',
    'struggle',
    'tradition',
  ],
  grammar: [
    'present perfect',
    'past simple',
    'relative clauses',
    'second conditional',
  ],
  requiredWordCountMin: 200,
  requiredWordCountMax: 250,
};

export const prompt =
  "Write about a meaningful experience you've had and what you learned from it. 200-250 words.";
