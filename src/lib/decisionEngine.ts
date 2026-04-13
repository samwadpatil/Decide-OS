import { UserProfile } from "./userModel";

export type DecisionType =
  | "logical"
  | "emotional"
  | "impulse"
  | "preference"
  | "ambiguous";

export interface DecisionOutput {
  recommendation: string;
  reasoning: string;
  tradeOffs: string;
  alternative: string;
  insight?: string;
}

const KEYWORDS = {
  logical: [
    "job",
    "buy",
    "career",
    "invest",
    "choose between",
    "car",
    "house",
    "laptop",
    "offer",
    "school",
    "college",
    "business",
  ],
  emotional: [
    "breakup",
    "friend",
    "relationship",
    "confront",
    "angry",
    "sad",
    "partner",
    "parents",
    "fight",
    "forgive",
    "feelings",
  ],
  impulse: [
    "smoke",
    "junk food",
    "procrastinate",
    "skip",
    "buy now",
    "cravings",
    "drink",
    "lazy",
    "quit",
    "give up",
    "text ex",
  ],
  preference: [
    "eat",
    "wear",
    "watch",
    "play",
    "football",
    "basketball",
    "movie",
    "dinner",
    "lunch",
    "game",
    "music",
    "weekend",
  ],
  ambiguous: [
    "lost",
    "what should i do",
    "life",
    "purpose",
    "don't know",
    "stuck",
    "confused",
    "meaning",
  ],
};

export const classifyDecision = (query: string): DecisionType => {
  const lowerQuery = query.toLowerCase();

  for (const [type, words] of Object.entries(KEYWORDS)) {
    if (words.some((word) => lowerQuery.includes(word))) {
      return type as DecisionType;
    }
  }

  // Default fallback based on length or just ambiguous
  if (lowerQuery.length < 20) return "preference";
  return "ambiguous";
};

// --- LOGIC ENGINES ---

export const processLogical = (
  options: { name: string; scores: Record<string, number> }[],
  criteria: { name: string; weight: number }[],
  userProfile: UserProfile,
): DecisionOutput => {
  if (options.length === 0) return fallbackOutput("logical");

  const scoredOptions = options
    .map((opt) => {
      let totalScore = 0;
      criteria.forEach((crit) => {
        totalScore += (opt.scores[crit.name] || 0) * crit.weight;
      });
      return { ...opt, totalScore };
    })
    .sort((a, b) => b.totalScore - a.totalScore);

  const best = scoredOptions[0];
  const secondBest = scoredOptions[1] || scoredOptions[0];

  let insight = "";
  if (userProfile.struggle === "overthinking") {
    insight =
      "Pattern Insight: You tend to over-analyze. The numbers show a clear winner. Trust the framework and move forward.";
  }

  return {
    recommendation: `Choose: ${best.name}`,
    reasoning: `Based on your weighted criteria, ${best.name} scored the highest (${best.totalScore} pts), aligning best with your priorities.`,
    tradeOffs: `You gain the benefits of ${best.name}, but miss out on ${secondBest.name}'s specific advantages.`,
    alternative: `If circumstances change, ${secondBest.name} is a solid backup (${secondBest.totalScore} pts).`,
    insight,
  };
};

export const processEmotional = (
  answers: string[],
  userProfile: UserProfile,
): DecisionOutput => {
  let insight = "";
  if (userProfile.priority === "peace") {
    insight =
      "Pattern Insight: You value peace. Ensure this decision protects your long-term emotional baseline rather than just resolving immediate tension.";
  }

  return {
    recommendation: "Take a step back before reacting.",
    reasoning:
      "Emotional decisions require processing time. Your reflections indicate a mix of unresolved feelings. Immediate action might lead to regret.",
    tradeOffs:
      "Waiting means enduring temporary discomfort, but acting now risks permanent damage to the relationship or situation.",
    alternative:
      "Write down exactly what you want to say, but wait 24 hours before delivering it.",
    insight,
  };
};

export const processImpulse = (
  craving: string,
  userProfile: UserProfile,
): DecisionOutput => {
  let insight = "";
  if (userProfile.struggle === "impulsiveness") {
    insight =
      "Pattern Insight: You've noted impulsiveness as a struggle. This is a classic short-term trap. Break the cycle here.";
  }

  return {
    recommendation: "PAUSE. Do not act for the next 10 minutes.",
    reasoning: `This is an impulse driven by short-term dopamine. Your core priority is ${userProfile.priority}, which this action actively works against.`,
    tradeOffs:
      "You lose the immediate gratification, but you gain self-respect and long-term progress toward your goals.",
    alternative:
      "Drink a glass of water, step outside, or do 10 pushups right now to reset your state.",
    insight,
  };
};

export const processPreference = (
  context: { mood: string; energy: string; groupSize: string },
  userProfile: UserProfile,
): DecisionOutput => {
  const isLowEnergy = context.energy === "low";
  const isSolo = context.groupSize === "1";

  let rec = "Go with the low-friction, comfortable option.";
  let alt = "Try something slightly outside your routine if you want a spark.";

  if (!isLowEnergy && !isSolo) {
    rec = "Choose the high-engagement, social option.";
    alt = "Keep it casual and low-stakes if the group is indecisive.";
  }

  let insight = "";
  if (userProfile.decisionStyle === "fast") {
    insight =
      "Pattern Insight: You prefer fast decisions here. Don't overthink it—just pick the first thing that sounds good.";
  }

  return {
    recommendation: rec,
    reasoning: `Based on your ${context.energy} energy and group size of ${context.groupSize}, this fits the current vibe best.`,
    tradeOffs: "You optimize for current comfort over novelty.",
    alternative: alt,
    insight,
  };
};

export const processAmbiguous = (
  reframedGoal: string,
  userProfile: UserProfile,
): DecisionOutput => {
  let insight = "";
  if (userProfile.priority === "growth") {
    insight =
      "Pattern Insight: You prioritize growth. Ambiguity is often where the most growth happens. Embrace the uncertainty.";
  }

  return {
    recommendation: "Break this down into one small, actionable step.",
    reasoning:
      "Ambiguous problems cause paralysis. By defining a single next action related to your reframed goal, you regain momentum.",
    tradeOffs:
      "You sacrifice having the 'whole plan' figured out, but you gain immediate forward motion.",
    alternative:
      "Talk this specific reframed goal out with a trusted mentor or friend to gain external perspective.",
    insight,
  };
};

const fallbackOutput = (type: string): DecisionOutput => ({
  recommendation: "Need more structured input.",
  reasoning: "The engine couldn't process the inputs provided.",
  tradeOffs: "N/A",
  alternative: "Try rephrasing your decision.",
});
