import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import SupportModal from './SupportModal';

export default function FloatingSupport() {
  const [isOpen, setIsOpen] = useState(false);

  // Approximate screen boundaries relative to the bottom-right starting position
  const dragConstraints = {
    left: -window.innerWidth + 80,
    right: 0,
    top: -window.innerHeight + 80,
    bottom: 0
  };

  return (
    <>
      <motion.div
        drag
        dragConstraints={dragConstraints}
        dragElastic={0.15}
        dragMomentum={false}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[9998] cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none' }}
      >
        <div className="relative group">
          {/* Subtle glow animation */}
          <div className="absolute inset-0 bg-[#ff6b00] rounded-2xl blur-md opacity-25 group-hover:opacity-40 transition-opacity duration-200" />
          
          <button
            onClick={() => setIsOpen(true)}
            className="relative px-4 py-3 bg-gradient-to-tr from-[#ff6b00] to-orange-500 rounded-2xl flex flex-col items-center justify-center text-white border border-white/10 hover:border-white/30 shadow-xl shadow-orange-500/25 active:scale-95 transition-all duration-150 cursor-pointer text-center group"
          >
            <MessageSquare className="w-7 h-7 group-hover:rotate-12 transition-transform duration-200" />
            <span className="text-[10px] font-black uppercase tracking-widest mt-1 text-white/95 group-hover:text-white transition-colors">Help Desk</span>
            
            {/* Pulsing online support status badge */}
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <SupportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
