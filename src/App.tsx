import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sections, TOTAL_DURATION } from './data/sections';
import { BrowserFrame } from './components/BrowserFrame';
import { Cursor } from './components/Cursor';

export default function App() {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sceneStartTime, setSceneStartTime] = useState(Date.now());
  
  const currentSection = sections[currentSectionIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentSectionIndex((prev) => (prev + 1) % sections.length);
      setSceneStartTime(Date.now());
    }, currentSection.duration);
    
    return () => clearTimeout(timer);
  }, [currentSectionIndex, currentSection.duration]);

  return (
    <div className="w-full h-screen bg-[#060609] overflow-hidden flex items-center justify-center relative font-sans">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-600/10 blur-[120px]"
          animate={{
            x: ['0%', '10%', '-5%', '0%'],
            y: ['0%', '5%', '10%', '0%'],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/20 blur-[100px]"
          animate={{
            x: ['0%', '-10%', '5%', '0%'],
            y: ['0%', '-15%', '0%', '0%'],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      </div>

      {/* Persistent Brand Anchor */}
      <motion.div 
        className="absolute top-8 left-10 z-20 flex items-center gap-3"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
      >
        <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          O
        </div>
        <span className="text-white/90 font-bold tracking-wider text-xl">OPPO CMMS</span>
      </motion.div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10 z-50">
        <motion.div 
          className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentSectionIndex) / sections.length) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full h-full flex items-center justify-center pt-8">
        <BrowserFrame>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={currentSection.id}
              className="absolute inset-0 w-full h-full origin-center"
              initial={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
              animate={{ 
                opacity: 1, 
                scale: currentSection.zoom || 1,
                x: currentSection.pan?.x || '0%',
                y: currentSection.pan?.y || '0%',
                filter: 'blur(0px)'
              }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(5px)' }}
              transition={{ 
                duration: 1.2, 
                ease: [0.16, 1, 0.3, 1],
                scale: { duration: currentSection.duration / 1000, ease: "linear" },
                x: { duration: currentSection.duration / 1000, ease: "linear" },
                y: { duration: currentSection.duration / 1000, ease: "linear" }
              }}
            >
              <img 
                src={currentSection.image} 
                alt={currentSection.title}
                className="w-full h-full object-cover object-left-top"
                onError={(e) => {
                  // Fallback if image not found during dev
                  (e.target as HTMLImageElement).src = `https://placehold.co/1920x1080/0d0d14/3b82f6?text=${currentSection.id}`;
                }}
              />
            </motion.div>
          </AnimatePresence>
          
          {/* Overlay gradient to ensure text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d14] via-transparent to-transparent opacity-60 pointer-events-none"></div>

          {/* Section Title Overlay */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${currentSection.id}`}
              className="absolute bottom-10 left-10 z-20 glass-panel px-6 py-4 rounded-xl max-w-md border-l-4 border-l-blue-500"
              initial={{ y: 30, opacity: 0, clipPath: 'polygon(0 0, 0 0, 0 100%, 0% 100%)' }}
              animate={{ y: 0, opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
              exit={{ y: -20, opacity: 0, clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-blue-400 text-xs font-bold tracking-widest uppercase mb-1"
              >
                SECTION {currentSectionIndex + 1} / {sections.length}
              </motion.div>
              <motion.h2 
                className="text-3xl font-bold text-white mb-2 tracking-tight"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {currentSection.title}
              </motion.h2>
              <motion.p 
                className="text-white/70 text-sm leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {currentSection.subtitle}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          {/* Animated Cursor per Scene */}
          <Cursor 
            key={`cursor-${currentSection.id}`} 
            sequence={currentSection.cursorSequence} 
            sceneStartTime={sceneStartTime} 
          />
        </BrowserFrame>
      </div>
    </div>
  );
}
