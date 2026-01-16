'use client'

import { useState } from 'react'
import { User, CheckCircle2, ShieldCheck, Sparkles, ArrowRight, LayoutDashboard } from 'lucide-react'
import { motion } from 'framer-motion'

export function HeroSection() {
  const [isHovered, setIsHovered] = useState(false)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut' as const
      }
    }
  }

  const dashboardVariants = {
    hidden: { opacity: 0, x: 100 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.8,
        ease: 'easeOut' as const,
        delay: 0.6
      }
    }
  }

  return (
    <section className="relative py-32 px-6 overflow-hidden z-10">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        {/* Left Column: Text Content */}
        <motion.div 
          className="text-left relative z-10"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          {/* Main heading */}
          <motion.h2 variants={itemVariants} className="text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-8 leading-tight tracking-tight">
            Say hello to <br />
            <span className="text-blue-600 dark:text-blue-500">
              Peer Feedback
            </span>
          </motion.h2>

          {/* Subheading */}
          <motion.p variants={itemVariants} className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-xl leading-relaxed">
            An open source design system built for personal growth. 
            Give and receive constructive feedback in a safe, anonymous environment.
          </motion.p>

          {/* Trust indicators */}
          <motion.div variants={itemVariants} className="flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span>100% Anonymous & Secure</span>
             </div>
             <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span>Privacy First Architecture</span>
             </div>
             <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <span>Structured Feedback Analysis</span>
             </div>
          </motion.div>
        </motion.div>

        {/* Right Column: Hero illustration / Dashboard Mockup */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={dashboardVariants}
          className="relative lg:ml-auto w-full max-w-lg lg:max-w-none"
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

          {/* Grid Pattern Decoration */}
          <div className="absolute inset-0 z-0 opacity-[0.1] pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(#2644e7 1px, transparent 1px), linear-gradient(90deg, #2644e7 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
          </div>

          {/* Main Abstract Composition matching NewsKit style */}
          <div className="relative z-10">
            {/* Floating Cards Composition */}
            <div className="relative">
              {/* Card 1: Main Interface */}
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-200 dark:border-slate-800 p-6 mb-8 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                 <div className="flex items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                          <LayoutDashboard className="w-5 h-5" />
                       </div>
                       <div>
                          <div className="font-bold text-slate-900 dark:text-white">Feedback Session</div>
                          <div className="text-xs text-slate-500">Active Now</div>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                       <div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                    </div>
                 </div>
                 
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                       <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Review Criteria</span>
                       <div className="w-4 h-4 border-2 border-blue-600 rounded-sm flex items-center justify-center">
                          <div className="w-2 h-2 bg-blue-600 rounded-[1px]"></div>
                       </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                       <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Presentation</span>
                       <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                       <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Technical Depth</span>
                       <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    </div>
                 </div>
              </div>

              {/* Floating Element 1 */}
              <div className="absolute -right-4 top-1/3 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 transform translate-x-1/4">
                 <div className="text-xs font-bold text-slate-400 uppercase mb-1">Rating</div>
                 <div className="flex gap-2 text-sm font-medium">
                    <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">Fair</div>
                    <div className="px-2 py-1 bg-blue-600 rounded text-white shadow-lg shadow-blue-600/30">Good</div>
                    <div className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">Great</div>
                 </div>
              </div>

              {/* Floating Element 2 */}
              <div className="absolute -left-8 bottom-0 bg-blue-600 text-white p-4 rounded-xl shadow-xl shadow-blue-600/30 transform -rotate-3 max-w-[200px]">
                 <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                    <span className="text-xs font-bold uppercase opacity-80">New Feedback</span>
                 </div>
                 <div className="text-sm font-medium">
                    "Great job explaining the complex logic!"
                 </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
