import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "@/components/ui";
import {
  getHistory,
  updateHistoryRecord,
  DecisionRecord,
} from "@/lib/userModel";
import { ArrowLeft, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { motion } from "motion/react";

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<DecisionRecord[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const handleRegret = (id: string, status: "good" | "bad" | "neutral") => {
    updateHistoryRecord(id, { regretStatus: status });
    setHistory(getHistory());
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-2xl font-bold">Decision History</h1>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            No decisions made yet.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((record, i) => (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-neutral-500 mb-1">
                        {new Date(record.date).toLocaleDateString()} •{" "}
                        {record.type}
                      </div>
                      <h3 className="text-lg font-semibold">{record.query}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-neutral-900 bg-neutral-100 px-3 py-1 rounded-full inline-block">
                        {record.recommendation}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between">
                    <span className="text-sm text-neutral-500">
                      Was this a good decision?
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant={
                          record.regretStatus === "good" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => handleRegret(record.id, "good")}
                        className={
                          record.regretStatus === "good"
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        }
                      >
                        <ThumbsUp className="w-4 h-4 mr-1" /> Good
                      </Button>
                      <Button
                        variant={
                          record.regretStatus === "neutral"
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => handleRegret(record.id, "neutral")}
                        className={
                          record.regretStatus === "neutral"
                            ? "bg-neutral-600 hover:bg-neutral-700"
                            : ""
                        }
                      >
                        <Minus className="w-4 h-4 mr-1" /> Neutral
                      </Button>
                      <Button
                        variant={
                          record.regretStatus === "bad" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => handleRegret(record.id, "bad")}
                        className={
                          record.regretStatus === "bad"
                            ? "bg-red-600 hover:bg-red-700"
                            : ""
                        }
                      >
                        <ThumbsDown className="w-4 h-4 mr-1" /> Bad
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
