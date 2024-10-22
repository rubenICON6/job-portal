import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submitResults = mutation({
  args: {
    userId: v.id("users"),
    applicantName: v.string(),
    jobPost: v.string(),
    testId: v.id("aptitude_test"),
    selectedAnswers: v.array(
      v.object({
        question: v.string(),
        selectedAnswer: v.string(),
      })
    ),
    aptitudetestscore: v.number(),
  },
  async handler(ctx, args) {
    const existingResult = await ctx.db.query("results").withIndex("by_userId", (q) =>
      q.eq("userId", args.userId)
    ).first();

    if (existingResult) {
      throw new Error("This user has already attempted the aptitude test.");
    }

    await ctx.db.insert("results", {
      userId: args.userId,
      testId: args.testId,
      selectedAnswers: args.selectedAnswers,
      aptitudetestscore: args.aptitudetestscore,
      applicantName: args.applicantName,
      jobPost: args.jobPost,
      commOne: undefined,
      commTwo: undefined,
      commThree: undefined,
      commFour: undefined,
      oralInterviewAverage: undefined,
      overallAverageScore: undefined,
    });
  },
});

// Query to get results by userId
export const getResultsByUserId = query({
  args: {
    userId: v.id("users"),
  },
  async handler(ctx, { userId }) {
    // Fetch the result for the given user ID
    const results = await ctx.db.query("results").withIndex("by_userId", (q) =>
      q.eq("userId", userId)
    ).collect();

    return results;
  },
});

// Query to get all results (used by commissioners)
export const getAllResults = query({
  args: {},
  async handler(ctx) {
    const results = await ctx.db.query("results").collect();
    return results;
  },
});

// export const addOralInterviewScore1 = mutation({
//   args: {
//     userId: v.id("users"),
//     commissioner: v.string(),  // E.g., "commOne", "commTwo"
//     score: v.number(),
//   },
//   async handler(ctx, args) {
//     const result = await ctx.db.query("results").withIndex("by_userId", (q) =>
//       q.eq("userId", args.userId)
//     ).first();

//     if (!result) {
//       throw new Error("No result found for this user.");
//     }

//     const updatedFields: Partial<Record<string, number>> = {};
//     updatedFields[args.commissioner] = args.score;

//     // Calculate oral interview average if all fields are available
//     const interviewScores = [result.commOne, result.commTwo, result.commThree, result.commFour].filter(Boolean);
//     if (result.commOne !== undefined && result.commTwo !== undefined && result.commThree !== undefined && result.commFour !== undefined) {
//       const interviewScores = [result.commOne, result.commTwo, result.commThree, result.commFour].filter(Boolean);
//       if (interviewScores.length === 4) {
//         updatedFields.oralInterviewAverage = interviewScores.reduce((a, b) => a + b, 0) / 4;
//       }
//     }

//     // Calculate overall average if oral interview average is available
//     if (updatedFields.oralInterviewAverage) {
//       updatedFields.overallAverageScore = (result.aptitudetestscore + updatedFields.oralInterviewAverage) / 2;
//     }

//     // Patch the result
//     await ctx.db.patch(result._id, updatedFields);
//   },
// });

export const addOralInterviewScore = mutation({
  args: {
    userId: v.id("users"),
    commissioner: v.string(),  // E.g., "commOne", "commTwo"
    score: v.number(),
  },
  async handler(ctx, args) {
    const result = await ctx.db.query("results").withIndex("by_userId", (q) =>
      q.eq("userId", args.userId)
    ).first();

    if (!result) {
      throw new Error("No result found for this user.");
    }

    if (args.score > 100 || args.score < 0) {
      throw new Error("Interview score must be between 0 and 100.");
    }

    const updatedFields: Partial<Record<string, number>> = {};
    updatedFields[args.commissioner] = args.score;

    // Update the appropriate commissioner's score
    await ctx.db.patch(result._id, updatedFields);

    // Check if all commissioner scores are filled, then calculate interview average
    const interviewScores = [
      updatedFields.commOne || result.commOne,
      updatedFields.commTwo || result.commTwo,
      updatedFields.commThree || result.commThree,
      updatedFields.commFour || result.commFour,
    ].filter((score) => score !== undefined);

    if (result.commOne !== undefined && result.commTwo !== undefined && result.commThree !== undefined && result.commFour !== undefined) {
      const interviewScores = [
        updatedFields.commOne || result.commOne,
        updatedFields.commTwo || result.commTwo,
        updatedFields.commThree || result.commThree,
        updatedFields.commFour || result.commFour,
      ].filter((score) => score !== undefined);
            if (interviewScores.length === 4) {
              updatedFields.oralInterviewAverage = interviewScores.reduce((a, b) => a + b, 0) / 4;
            }
          }

      // Calculate overall average if oral interview average is available
    if (updatedFields.oralInterviewAverage) {
      updatedFields.overallAverageScore = (result.aptitudetestscore + updatedFields.oralInterviewAverage) / 2;
    }

       // Patch the result
    await ctx.db.patch(result._id, updatedFields);
  },
});


// Mutation to update the commissioner's interview score
export const updateInterviewScore = mutation({
  args: {
    applicantId: v.id("results"),
    score: v.number(),
    field: v.string(), // Field to update (commOne, commTwo, etc.)
  },
  async handler(ctx, { applicantId, score, field }) {
    const result = await ctx.db.get(applicantId);

    if (!result) {
      throw new Error("Applicant result not found");
    }

    // Update the correct commissioner field with the score
    await ctx.db.patch(applicantId, { [field]: score });

    // Recalculate the interview average if all scores are available
    const scores = [result.commOne, result.commTwo, result.commThree, result.commFour].filter(
      (s) => s !== undefined
    );

    if (scores.length === 4) {
      //@ts-ignore
      const oralInterviewAverage = scores.reduce((a, b) => a + b, 0) / 4;
      const overallAverageScore = (oralInterviewAverage + result.aptitudetestscore) / 2;

      await ctx.db.patch(applicantId, {
        oralInterviewAverage,
        overallAverageScore,
      });
    }
  },
});