import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Bot,
  User,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { askAttendanceAi, AiResponse } from '../../services/attendanceAiQuery';
import { calculateMonthAttendance } from '../../services/attendanceCalculator';
import { CalculatedMonthData } from '../../types/attendance';
import { Button } from './Button';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  response?: AiResponse;
}

export const AttendanceAiAssistant: React.FC = () => {
  const {
    calculatedData,
    previousMonthData,
    parsedDataset,
    availableMonths,
    officeConfig,
    holidays,
    leaves,
    currentPage,
    setCurrentPage,
    selectedEmployeeIdForProfile,
    setSelectedEmployeeIdForProfile,
    navigateToEmployees,
    navigateToDailyAttendance,
    navigateToExceptions,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-1',
      sender: 'ai',
      text: `Hello! I am your Biometric Attendance Assistant for VR Constructions. Ask me any factual question about employee presence, unnotified absences, late arrivals, working hours, or monthly KPIs.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const quickPrompts = [
    'Who was absent on 22 Aug?',
    'Which employee worked the most hours in August?',
    'Show attendance percentage for Manisha',
    'Who had single punches on 25 Aug?',
    'How many employees were present on 20 Aug?',
    'Summarize attendance between 20 Aug and 2 Sep',
    'Who came late after 10:15 AM?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || inputQuery).trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsThinking(true);

    const historicalList: CalculatedMonthData[] = [];
    if (previousMonthData) {
      historicalList.push(previousMonthData);
    }
    if (parsedDataset && availableMonths && availableMonths.length > 0) {
      const keysToCompute = [
        'OVERALL',
        ...availableMonths.map((m) => m.month_key).filter((k) => k !== calculatedData?.monthKey),
      ];
      for (const k of keysToCompute) {
        if (!historicalList.some((h) => h.monthKey === k) && k !== calculatedData?.monthKey) {
          try {
            const data = calculateMonthAttendance(
              parsedDataset,
              k,
              officeConfig,
              holidays,
              leaves
            );
            historicalList.push(data);
          } catch {
            // Ignore minor errors in secondary period calculations
          }
        }
      }
    }

    // Natural brief processing tick
    setTimeout(() => {
      try {
        const aiResult = askAttendanceAi(q, calculatedData, historicalList, {
          currentPage,
          selectedEmployeeId: selectedEmployeeIdForProfile,
        });

        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiResult.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          response: aiResult,
        };

        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        console.error('Attendance AI query error:', err);
        const fallbackMsg: ChatMessage = {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: 'Attendance AI is temporarily unavailable. The rest of the dashboard remains fully operational.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsThinking(false);
      }
    }, 280);
  };

  const handleDrillDown = (drillDown: NonNullable<AiResponse['drillDown']>) => {
    if (drillDown.page === 'employees') {
      navigateToEmployees(drillDown.params?.employeeFilter);
      if (drillDown.params?.employeeId) {
        setSelectedEmployeeIdForProfile(drillDown.params.employeeId);
      }
    } else if (drillDown.page === 'daily-attendance') {
      navigateToDailyAttendance(drillDown.params?.date);
    } else if (drillDown.page === 'exceptions') {
      navigateToExceptions(drillDown.params?.category);
    } else {
      setCurrentPage(drillDown.page);
    }

    // On smaller screens, close drawer to reveal navigated view
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'ai',
        text: `Conversation cleared. What would you like to know about ${calculatedData?.monthLabel || 'attendance data'}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Launcher Pill */}
      <div className="fixed bottom-5 right-5 z-40">
        <motion.button
          id="btn-open-attendance-ai"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-medium text-xs shadow-xl shadow-black/15 hover:shadow-2xl hover:shadow-black/20 border border-neutral-700/40 dark:border-white/20 transition-all cursor-pointer select-none"
        >
          <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 dark:text-sky-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-sky-400 dark:text-sky-600 animate-pulse" />
          </div>
          <span>Ask Attendance AI</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </motion.button>
      </div>

      {/* Slide-out Intelligence Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Slide-in Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="relative w-full max-w-lg h-full bg-white dark:bg-[#121212] border-l border-neutral-200 dark:border-white/10 shadow-2xl flex flex-col z-10"
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-white/10 flex items-center justify-between bg-neutral-50/70 dark:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-4 h-4 text-sky-400 dark:text-sky-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Attendance Intelligence AI
                      </h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                        Ground Truth
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="w-3 h-3 text-sky-500" />
                      <span>{calculatedData?.monthLabel || 'System'} · Zero Hallucination Mode</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearHistory}
                    title="Clear Conversation"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    title="Close Assistant"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-start gap-2.5 max-w-[90%]">
                      {msg.sender === 'ai' && (
                        <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}

                      <div>
                        {/* Chat bubble */}
                        <div
                          className={`rounded-2xl p-3.5 text-xs leading-relaxed ${
                            msg.sender === 'user'
                              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-normal rounded-tr-xs'
                              : 'bg-neutral-100 dark:bg-white/[0.04] text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-white/5 rounded-tl-xs'
                          }`}
                        >
                          <p>{msg.text}</p>

                          {/* Fact Bullet List if returned from query */}
                          {msg.response?.facts && msg.response.facts.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-neutral-200/60 dark:border-white/5 space-y-1">
                              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider block">
                                Verified Facts:
                              </span>
                              {msg.response.facts.map((fact, idx) => (
                                <div key={idx} className="flex items-start gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                                  <span className="text-sky-500">•</span>
                                  <span>{fact}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Drill-Down Action Button */}
                          {msg.response?.drillDown && (
                            <div className="mt-3 pt-2">
                              <button
                                onClick={() => handleDrillDown(msg.response!.drillDown!)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[11px] font-medium transition-colors cursor-pointer border border-sky-500/20"
                              >
                                <span>{msg.response.drillDown.label}</span>
                                <ArrowRight className="w-3 h-3 text-sky-500" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Metadata bar */}
                        <div className="flex items-center gap-2 mt-1 px-1">
                          <span className="text-[10px] text-neutral-400">{msg.timestamp}</span>
                          {msg.response?.sourceBadge && (
                            <>
                              <span className="text-[10px] text-neutral-300 dark:text-white/20">•</span>
                              <span className="text-[10px] text-neutral-400">{msg.response.sourceBadge}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {msg.sender === 'user' && (
                        <div className="w-6 h-6 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center animate-spin">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span>Consulting deterministic attendance records...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts Carousel */}
              <div className="px-4 py-2 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.01]">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold block mb-1.5">
                  Suggested Questions
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(prompt)}
                      className="whitespace-nowrap px-2.5 py-1 rounded-lg text-[11px] bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-sky-500/40 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Footer */}
              <div className="p-4 border-t border-neutral-200 dark:border-white/10 bg-white dark:bg-[#121212]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    id="input-attendance-ai"
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask about employee attendance, late marks, leaves..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  <Button
                    id="btn-send-attendance-ai"
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!inputQuery.trim() || isThinking}
                    className="shrink-0 px-3 py-2.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
                <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-neutral-400">
                  <span>Press Enter to send query</span>
                  <span className="text-sky-500 font-mono">VR Constructions AI v1.0</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
