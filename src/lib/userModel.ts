export type Priority = "growth" | "money" | "health" | "peace";
export type DecisionStyle = "fast" | "thoughtful";
export type Struggle = "overthinking" | "impulsiveness";

export interface UserProfile {
  priority: Priority;
  decisionStyle: DecisionStyle;
  struggle: Struggle;
}

export interface DecisionRecord {
  id: string;
  date: string;
  query: string;
  type: string;
  recommendation: string;
  reasoning: string;
  tradeOffs: string;
  alternative: string;
  insight?: string;
  regretStatus?: "good" | "bad" | "neutral";
}

export const getUserProfile = (): UserProfile | null => {
  const data = localStorage.getItem("ude_user_profile");
  return data ? JSON.parse(data) : null;
};

export const saveUserProfile = (profile: UserProfile) => {
  localStorage.setItem("ude_user_profile", JSON.stringify(profile));
};

export const getHistory = (): DecisionRecord[] => {
  const data = localStorage.getItem("ude_history");
  return data ? JSON.parse(data) : [];
};

export const saveToHistory = (record: DecisionRecord) => {
  const history = getHistory();
  localStorage.setItem("ude_history", JSON.stringify([record, ...history]));
};

export const updateHistoryRecord = (
  id: string,
  updates: Partial<DecisionRecord>,
) => {
  const history = getHistory();
  const updated = history.map((r) => (r.id === id ? { ...r, ...updates } : r));
  localStorage.setItem("ude_history", JSON.stringify(updated));
};
