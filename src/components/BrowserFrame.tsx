import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function BrowserFrame({ children, url = 'cmms.oppo.factory' }: { children: React.ReactNode, url?: string }) {
  return (
    <motion.div 
      className="w-[85vw] h-[80vh] bg-[#0d0d14] rounded-xl overflow-hidden shadow-2xl border border-white/10 flex flex-col relative z-10"
      initial={{ y: 50, opacity: 0, rotateX: 10 }}
      animate={{ y: 0, opacity: 1, rotateX: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1200 }}
    >
      {/* Browser Chrome */}
      <div className="h-12 bg-[#1a1a24] border-b border-white/5 flex items-center px-4 gap-4 shrink-0">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
        </div>
        
        <div className="flex-1 flex justify-center">
          <div className="bg-[#0d0d14] text-white/50 text-xs py-1.5 px-32 rounded-md border border-white/5 flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            {url}
          </div>
        </div>
        
        <div className="w-16"></div>
      </div>
      
      {/* Browser Content */}
      <div className="flex-1 relative overflow-hidden bg-[#0d0d14]">
        {children}
      </div>
    </motion.div>
  );
}
