import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface CursorProps {
  sequence: { x: string | number; y: string | number; click?: boolean; time: number }[];
  sceneStartTime: number;
}

export function Cursor({ sequence, sceneStartTime }: CursorProps) {
  const [pos, setPos] = useState({ x: '50%', y: '100%' });
  const [isClicking, setIsClicking] = useState(false);
  const [ripples, setRipples] = useState<{id: number, x: string|number, y: string|number}[]>([]);
  const rippleIdCounter = useRef(0);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    
    // Initial enter
    timeouts.push(setTimeout(() => {
      if (sequence.length > 0) {
        setPos({ x: sequence[0].x, y: sequence[0].y });
      }
    }, 500));

    // Schedule movements and clicks
    sequence.forEach((step, index) => {
      timeouts.push(setTimeout(() => {
        setPos({ x: step.x, y: step.y });
        
        if (step.click) {
          timeouts.push(setTimeout(() => {
            setIsClicking(true);
            const id = rippleIdCounter.current++;
            setRipples(prev => [...prev, { id, x: step.x, y: step.y }]);
            
            timeouts.push(setTimeout(() => {
              setIsClicking(false);
            }, 150));
            
            timeouts.push(setTimeout(() => {
              setRipples(prev => prev.filter(r => r.id !== id));
            }, 1000));
            
          }, 300)); // slight delay after reaching target before clicking
        }
      }, step.time));
    });

    return () => timeouts.forEach(clearTimeout);
  }, [sequence, sceneStartTime]);

  return (
    <>
      {ripples.map(ripple => (
        <div 
          key={ripple.id}
          className="absolute z-50 pointer-events-none"
          style={{ left: ripple.x, top: ripple.y, transform: 'translate(-50%, -50%)' }}
        >
          <div className="w-12 h-12 border-2 border-blue-400 rounded-full animate-ping opacity-0" 
               style={{ animationDuration: '0.8s', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' }} />
          <div className="w-8 h-8 border-2 border-blue-300 rounded-full absolute top-2 left-2 animate-ping opacity-0"
               style={{ animationDuration: '0.8s', animationDelay: '0.1s', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' }} />
        </div>
      ))}
      
      <motion.div
        className="absolute z-50 pointer-events-none drop-shadow-lg"
        animate={{ 
          left: pos.x, 
          top: pos.y,
          scale: isClicking ? 0.8 : 1
        }}
        transition={{ 
          left: { duration: 0.8, ease: "easeInOut" },
          top: { duration: 0.8, ease: "easeInOut" },
          scale: { duration: 0.1 }
        }}
        style={{ marginLeft: '-8px', marginTop: '-8px' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 3.21V20.8C5.5 21.46 6.26 21.84 6.78 21.44L11.44 17.8C11.66 17.63 11.94 17.54 12.23 17.54H18.5C19.16 17.54 19.54 16.78 19.14 16.26L6.59 2.66C6.16 2.2 5.5 2.5 5.5 3.21Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </motion.div>
    </>
  );
}
