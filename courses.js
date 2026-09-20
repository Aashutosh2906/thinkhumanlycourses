// =====================================================================
//  THE LIST OF COURSES
//  The home page and the dashboard both read this list.
//
//  To add a course:
//    1. Upload the course file into the "courses" folder on GitHub,
//       e.g. courses/ai-and-images.html
//    2. Add an entry below (copy the example at the bottom).
//       "id" must be the file name without ".html".
//
//  hidden: true   keeps a course off the home page, but its link still works.
//  insights       is optional. It tells the dashboard which charts to draw.
//                 Without it the dashboard still shows progress and every answer.
// =====================================================================
window.SAWAAL_COURSES = [

  {
    id: "sawaal-better",
    title: "Sawaal Better",
    summary: "Get real thinking out of AI, and don't get played by it. Six activities on prompting, checking and staying safe.",
    minutes: 65,
    ages: "12 to 18",
    screens: 52,
    insights: {
      // Activity scores: how many students got each score.
      scored: [
        { id: "drivers_score", label: "Spot the driver", max: 5 },
        { id: "hunt_score", label: "Hallucination hunt (fakes caught)", max: 4 },
        { id: "light_score", label: "Green, amber, red", max: 10 },
        { id: "rescue_score", label: "Rescue the chat", max: 3 },
        { id: "roti_prompt", label: "ROTI prompt strength", max: 100, bucket: 20 }
      ],
      // The same question asked at the start (pre) and the end (post).
      prePost: [
        { pre: "b1", post: "p1", type: "likert", label: "making AI answers fit their class and syllabus" },
        { pre: "b2", post: "p2", type: "likert", label: "knowing what they want before opening a chatbot" },
        { pre: "b3", post: "p3", type: "likert", label: "telling when an AI answer might be wrong" },
        { pre: "b4", post: "p4", type: "choice", label: "what they do when an AI answer doesn't help", highlight: "Change my whole approach" }
      ],
      // Confident (rated 4 or 5) but scored low on the matching activity.
      gapChecks: [
        { confidence: "b3", high: 4, performance: "hunt_score", below: 3,
          confidenceLabel: "telling when an AI answer might be wrong",
          performanceLabel: "the hallucination hunt (out of 4 fakes)" },
        { confidence: "m2a", high: 4, performance: "roti_prompt", below: 60,
          confidenceLabel: "turning a weak prompt into a strong one",
          performanceLabel: "the prompt they actually built (out of 100)" },
        { confidence: "m5a", high: 4, performance: "light_score", below: 7,
          confidenceLabel: "knowing what should never go into a chatbot",
          performanceLabel: "green, amber, red (out of 10)" }
      ],
      // Headlines like "5 of 12 students said ..."
      counts: [
        { item: "m4b", values: ["Never"], label: "said that before today they had never checked an AI claim against another source" },
        { item: "b5", values: ["Most days", "Every day"], label: "use AI for schoolwork most days or every day" },
        { item: "m1b", values: ["Passenger"], label: "said they had mostly been a passenger with AI over the last month" },
        { item: "m7a", values: ["No, I peeked first", "No, I skipped it"], label: "admitted they looked at the AI's summary before writing their own" }
      ],
      // Written answers to read through.
      freeText: [
        { id: "b6", label: "What they want to be able to do with AI" },
        { id: "m1c", label: "One thing they'll do differently in their next chat" },
        { id: "roti_prompt", label: "The prompt they built with ROTI" },
        { id: "m2d", label: "What changed when they used a full prompt" },
        { id: "m4d", label: "Something they used from AI without checking" },
        { id: "m5d", label: "The safety scenario that made them think hardest" },
        { id: "m6c", label: "A chat that went in circles on them" },
        { id: "capA_own", label: "Capstone: their own summary, written first" },
        { id: "m7d", label: "Capstone: what the AI missed or got wrong" },
        { id: "capB_final", label: "Capstone: their final research question" },
        { id: "p7", label: "What was confusing, boring or missing" },
        { id: "p8", label: "One thing they're going to stop doing with AI" }
      ]
    }
  },
  {
    id: "make-it-run-data-code",
    title: "Make It Run — Data and Code With AI",
    summary: "Data and code with an AI that writes both in seconds. How to read what it gave you, check what it claims, and avoid shipping something you don't understand.",
    minutes: 65,
    ages: "12 to 16",
    screens: 30,
    insights: {
      scored: [
        { id: "canask_score", label: "Can this table answer that?", max: 3 },
        { id: "claims_score", label: "Which claims survive (flaws caught)", max: 4 },
        { id: "ethics_score", label: "Would you do it?", max: 4 }
      ],
      prePost: [
        { pre: "b1", post: "p1", type: "likert", label: "telling what a set of data can and cannot prove" },
        { pre: "b2", post: "p2", type: "likert", label: "checking how a chart was made before believing it" },
        { pre: "b3", post: "p3", type: "likert", label: "explaining what code does line by line" },
        { pre: "b4", post: "p4", type: "choice", label: "what they do when code or a formula doesn't work", highlight: "Read the error message carefully" }
      ],
      counts: [
        { item: "b5", values: ["None"], label: "had done no coding at all before today" },
        { item: "m3a", values: ["All three"], label: "predicted all three code outputs correctly" },
        { item: "m6b", values: ["Ignored it", "Did not notice it"], label: "ignored or didn't notice the outlier student in the capstone" },
        { item: "m4c", values: ["Yes, I solved it myself", "Yes, a partial idea"], label: "said writing the bug report gave them an idea about the cause" }
      ],
      freeText: [
        { id: "m1c", label: "A claim they've seen where the data didn't measure what was claimed" },
        { id: "m2d", label: "Why two things moving together isn't the same as one causing the other" },
        { id: "bug_insight", label: "Whether writing the bug report gave them an idea about the cause" },
        { id: "cap_final", label: "Capstone: their final, honest conclusion" },
        { id: "p7", label: "What was confusing, boring or missing" },
        { id: "p8", label: "One thing they'll always do before running code they didn't write" }
      ]
    }
},

  // ----- Example of a new course (remove the // to use it) -----
  // {
  //   id: "ai-and-images",
  //   title: "AI and Images",
  //   summary: "Spot fake photos and videos.",
  //   minutes: 40,
  //   ages: "12 to 18",
  //   screens: 30
  // },

];
