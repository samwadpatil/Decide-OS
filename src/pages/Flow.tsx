import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button, Card, Input, Label, Select } from "@/components/ui";
import { getUserProfile, saveToHistory } from "@/lib/userModel";
import {
  classifyDecision,
  processLogical,
  processEmotional,
  processImpulse,
  processPreference,
  processAmbiguous,
  DecisionType,
  DecisionOutput,
} from "@/lib/decisionEngine";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  BrainCircuit,
  Scale,
  Zap,
  Lightbulb,
} from "lucide-react";

export default function Flow() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q") || "";

  const [type, setType] = useState<DecisionType | null>(null);
  const [output, setOutput] = useState<DecisionOutput | null>(null);

  // Logical State
  const [options, setOptions] = useState([
    { name: "", scores: {} as Record<string, number> },
    { name: "", scores: {} },
  ]);
  const [criteria, setCriteria] = useState([
    { name: "Cost", weight: 5 },
    { name: "Time", weight: 5 },
  ]);

  // Emotional State
  const [emotionalAnswers, setEmotionalAnswers] = useState(["", "", ""]);

  // Impulse State
  const [craving, setCraving] = useState("");

  // Preference State
  const [prefContext, setPrefContext] = useState({
    mood: "neutral",
    energy: "medium",
    groupSize: "1",
  });

  // Ambiguous State
  const [reframed, setReframed] = useState("");

  useEffect(() => {
    if (!query) navigate("/");
    const classified = classifyDecision(query);
    setType(classified);
    if (classified === "impulse") setCraving(query);
  }, [query, navigate]);

  const handleProcess = () => {
    const profile = getUserProfile();
    if (!profile || !type) return;

    let result: DecisionOutput | null = null;

    switch (type) {
      case "logical":
        result = processLogical(
          options.filter((o) => o.name),
          criteria.filter((c) => c.name),
          profile,
        );
        break;
      case "emotional":
        result = processEmotional(emotionalAnswers, profile);
        break;
      case "impulse":
        result = processImpulse(craving, profile);
        break;
      case "preference":
        result = processPreference(prefContext, profile);
        break;
      case "ambiguous":
        result = processAmbiguous(reframed, profile);
        break;
    }

    if (result) {
      setOutput(result);
      saveToHistory({
        id: Date.now().toString(),
        date: new Date().toISOString(),
        query,
        type,
        ...result,
      });
    }
  };

  if (!type) return null;

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{query}</h1>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-neutral-200 text-sm font-medium capitalize">
            {type} Decision
          </div>
        </div>

        {!output ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6">
              {type === "logical" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold">
                    Define your parameters
                  </h2>

                  <div className="space-y-4">
                    <Label>Options</Label>
                    {options.map((opt, i) => (
                      <Input
                        key={i}
                        value={opt.name}
                        onChange={(e) => {
                          const newOpts = [...options];
                          newOpts[i].name = e.target.value;
                          setOptions(newOpts);
                        }}
                        placeholder={`Option ${i + 1}`}
                      />
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOptions([...options, { name: "", scores: {} }])
                      }
                    >
                      Add Option
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <Label>Criteria (1-10 Weight)</Label>
                    {criteria.map((crit, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={crit.name}
                          onChange={(e) => {
                            const newCrit = [...criteria];
                            newCrit[i].name = e.target.value;
                            setCriteria(newCrit);
                          }}
                          placeholder="Criteria name"
                        />
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={crit.weight}
                          onChange={(e) => {
                            const newCrit = [...criteria];
                            newCrit[i].weight = parseInt(e.target.value) || 1;
                            setCriteria(newCrit);
                          }}
                          className="w-24"
                        />
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCriteria([...criteria, { name: "", weight: 5 }])
                      }
                    >
                      Add Criteria
                    </Button>
                  </div>

                  {options.some((o) => o.name) &&
                    criteria.some((c) => c.name) && (
                      <div className="space-y-4 pt-4 border-t">
                        <Label>Score Options (1-10)</Label>
                        {options
                          .filter((o) => o.name)
                          .map((opt, i) => (
                            <div
                              key={i}
                              className="space-y-2 p-4 bg-neutral-50 rounded-lg border"
                            >
                              <div className="font-medium">{opt.name}</div>
                              {criteria
                                .filter((c) => c.name)
                                .map((crit, j) => (
                                  <div
                                    key={j}
                                    className="flex items-center justify-between gap-4"
                                  >
                                    <span className="text-sm text-neutral-600">
                                      {crit.name}
                                    </span>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="10"
                                      className="w-24"
                                      value={opt.scores[crit.name] || ""}
                                      onChange={(e) => {
                                        const newOpts = [...options];
                                        newOpts[i].scores[crit.name] =
                                          parseInt(e.target.value) || 0;
                                        setOptions(newOpts);
                                      }}
                                      placeholder="Score"
                                    />
                                  </div>
                                ))}
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              )}

              {type === "emotional" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold">
                    Reflect on the situation
                  </h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>
                        What is the core emotion you are feeling right now?
                      </Label>
                      <Input
                        value={emotionalAnswers[0]}
                        onChange={(e) =>
                          setEmotionalAnswers([
                            e.target.value,
                            emotionalAnswers[1],
                            emotionalAnswers[2],
                          ])
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Is this a recurring pattern or a one-off event?
                      </Label>
                      <Input
                        value={emotionalAnswers[1]}
                        onChange={(e) =>
                          setEmotionalAnswers([
                            emotionalAnswers[0],
                            e.target.value,
                            emotionalAnswers[2],
                          ])
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        What is the worst-case scenario if you do nothing?
                      </Label>
                      <Input
                        value={emotionalAnswers[2]}
                        onChange={(e) =>
                          setEmotionalAnswers([
                            emotionalAnswers[0],
                            emotionalAnswers[1],
                            e.target.value,
                          ])
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === "impulse" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold">Impulse Check</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>What exactly are you craving or avoiding?</Label>
                      <Input
                        value={craving}
                        onChange={(e) => setCraving(e.target.value)}
                      />
                    </div>
                    <p className="text-sm text-neutral-500">
                      The engine will help you reframe this urge.
                    </p>
                  </div>
                </div>
              )}

              {type === "preference" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold">Context Check</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Current Energy Level</Label>
                      <Select
                        value={prefContext.energy}
                        onChange={(e) =>
                          setPrefContext({
                            ...prefContext,
                            energy: e.target.value,
                          })
                        }
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Group Size</Label>
                      <Input
                        type="number"
                        min="1"
                        value={prefContext.groupSize}
                        onChange={(e) =>
                          setPrefContext({
                            ...prefContext,
                            groupSize: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {type === "ambiguous" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold">Clarify Intent</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>
                        If you had to summarize what you actually want in one
                        sentence, what is it?
                      </Label>
                      <Input
                        value={reframed}
                        onChange={(e) => setReframed(e.target.value)}
                        placeholder="e.g., I want to feel more fulfilled daily."
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button className="w-full mt-8" onClick={handleProcess}>
                Generate Decision
              </Button>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="p-6 border-l-4 border-l-green-500">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 text-green-500 mt-1" />
                <div>
                  <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">
                    Recommendation
                  </h3>
                  <p className="text-xl font-semibold mt-1">
                    {output.recommendation}
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 space-y-2">
                <div className="flex items-center gap-2 text-neutral-500 mb-2">
                  <BrainCircuit className="w-5 h-5" />
                  <h3 className="font-medium">Reasoning</h3>
                </div>
                <p className="text-neutral-700 leading-relaxed">
                  {output.reasoning}
                </p>
              </Card>

              <Card className="p-6 space-y-2">
                <div className="flex items-center gap-2 text-neutral-500 mb-2">
                  <Scale className="w-5 h-5" />
                  <h3 className="font-medium">Trade-offs</h3>
                </div>
                <p className="text-neutral-700 leading-relaxed">
                  {output.tradeOffs}
                </p>
              </Card>
            </div>

            <Card className="p-6 space-y-2 bg-neutral-900 text-neutral-50">
              <div className="flex items-center gap-2 text-neutral-400 mb-2">
                <Zap className="w-5 h-5" />
                <h3 className="font-medium">Alternative</h3>
              </div>
              <p className="leading-relaxed">{output.alternative}</p>
            </Card>

            {output.insight && (
              <Card className="p-6 space-y-2 border-dashed border-2 bg-blue-50/50">
                <div className="flex items-center gap-2 text-blue-600 mb-2">
                  <Lightbulb className="w-5 h-5" />
                  <h3 className="font-medium">Pattern Insight</h3>
                </div>
                <p className="text-blue-900 leading-relaxed">
                  {output.insight}
                </p>
              </Card>
            )}

            <div className="pt-8 flex justify-center">
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="px-8"
              >
                Make Another Decision
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
