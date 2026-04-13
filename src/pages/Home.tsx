import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input } from "@/components/ui";
import { getUserProfile } from "@/lib/userModel";
import { motion } from "motion/react";
import { History, Settings } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const profile = getUserProfile();
    if (!profile) {
      navigate("/onboarding");
    }
  }, [navigate]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/flow?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 p-4">
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/history")}
          className="w-10 h-10 p-0"
        >
          <History className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/onboarding")}
          className="w-10 h-10 p-0"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl space-y-8 text-center"
      >
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">
            Universal Decision Engine
          </h1>
          <p className="text-lg text-neutral-500">
            What are you trying to decide today?
          </p>
        </div>

        <form onSubmit={handleStart} className="flex gap-2 max-w-xl mx-auto">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., Should I quit my job? What to eat for dinner?"
            className="h-14 text-lg px-6 rounded-full shadow-sm"
            autoFocus
          />
          <Button type="submit" className="h-14 px-8 rounded-full text-lg">
            Analyze
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
