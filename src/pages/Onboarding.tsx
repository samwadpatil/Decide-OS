import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Label, Select } from "@/components/ui";
import {
  saveUserProfile,
  Priority,
  DecisionStyle,
  Struggle,
} from "@/lib/userModel";
import { motion } from "motion/react";

export default function Onboarding() {
  const navigate = useNavigate();
  const [priority, setPriority] = useState<Priority>("growth");
  const [style, setStyle] = useState<DecisionStyle>("thoughtful");
  const [struggle, setStruggle] = useState<Struggle>("overthinking");

  const handleSave = () => {
    saveUserProfile({ priority, decisionStyle: style, struggle });
    navigate("/");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="p-6 space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome to UDE
            </h1>
            <p className="text-sm text-neutral-500">
              Let's personalize your decision engine.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What is your core priority right now?</Label>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="growth">Growth & Learning</option>
                <option value="money">Financial Stability</option>
                <option value="health">Health & Well-being</option>
                <option value="peace">Peace of Mind</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>What is your natural decision style?</Label>
              <Select
                value={style}
                onChange={(e) => setStyle(e.target.value as DecisionStyle)}
              >
                <option value="thoughtful">Thoughtful & Analytical</option>
                <option value="fast">Fast & Intuitive</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>What is your biggest struggle?</Label>
              <Select
                value={struggle}
                onChange={(e) => setStruggle(e.target.value as Struggle)}
              >
                <option value="overthinking">
                  Overthinking / Analysis Paralysis
                </option>
                <option value="impulsiveness">
                  Impulsiveness / Acting too fast
                </option>
              </Select>
            </div>
          </div>

          <Button className="w-full" onClick={handleSave}>
            Initialize Engine
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}
