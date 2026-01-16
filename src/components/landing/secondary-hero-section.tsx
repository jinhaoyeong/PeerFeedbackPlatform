'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, User, MoreHorizontal } from 'lucide-react'

export function SecondaryHeroSection() {
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

  const mockupVariants = {
    hidden: { opacity: 0, y: 40, rotateX: 0 },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.8,
        ease: 'easeOut' as const,
        delay: 0.4
      }
    }
  }

  const browserWindowVariants = {
    initial: { 
      boxShadow: "0 35px 60px -15px rgba(37, 99, 235, 0.3)" // Permanent blue shadow
    },
    hovered: { 
      boxShadow: "0 45px 70px -15px rgba(37, 99, 235, 0.4)", // Slightly stronger on hover
      transition: { 
        duration: 0.5 
      }
    }
  }

  const cardTiltVariants = {
    topLeft: {
      hovered: {
        rotateX: -2,
        rotateY: 2,
        y: -5,
        transition: { duration: 0.4 }
      },
      initial: {
        rotateX: 0,
        rotateY: 0,
        y: 0,
        transition: { duration: 0.4 }
      }
    },
    bottomLeft: {
      hovered: {
        rotateX: 2,
        rotateY: 2,
        y: -5,
        transition: { duration: 0.4 }
      },
      initial: {
        rotateX: 0,
        rotateY: 0,
        y: 0,
        transition: { duration: 0.4 }
      }
    },
    topRight: {
      hovered: {
        rotateX: -2,
        rotateY: -2,
        y: -5,
        transition: { duration: 0.4 }
      },
      initial: {
        rotateX: 0,
        rotateY: 0,
        y: 0,
        transition: { duration: 0.4 }
      }
    },
    bottomRight: {
      hovered: {
        rotateX: 2,
        rotateY: -2,
        y: -5,
        transition: { duration: 0.4 }
      },
      initial: {
        rotateX: 0,
        rotateY: 0,
        y: 0,
        transition: { duration: 0.4 }
      }
    }
  }

  const progressVariants = {
    hovered: {
      width: '95%',
      transition: { duration: 0.8 }
    },
    initial: {
      width: '85%',
      transition: { duration: 0.5 }
    }
  }

  return (
    <section className="min-h-screen pt-32 pb-20 px-6 overflow-hidden flex flex-col justify-center relative z-10">
      <div className="max-w-7xl mx-auto text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={containerVariants}
          className="max-w-4xl mx-auto mb-16"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <div className="inline-flex items-center bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full text-sm font-semibold border border-blue-100 dark:border-blue-800 shadow-sm">
              <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mr-2 animate-pulse"></span>
              Safe & Anonymous Feedback Platform
            </div>
          </motion.div>

          {/* Main Heading */}
          <motion.h2 variants={itemVariants} className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
            Give & Receive <span className="text-blue-600 dark:text-blue-500">Constructive Feedback</span><br />
            In a Safe Space
          </motion.h2>

          {/* Subheading */}
          <motion.p variants={itemVariants} className="text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Transform personal growth through anonymous peer feedback. Built with privacy, security, and emotional intelligence at its core.
          </motion.p>

          {/* Buttons */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-4 mb-12">
            <a
              href="#auth"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all duration-200 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-0.5 flex items-center gap-2"
            >
              Start Giving Feedback
              <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${isHovered ? 'translate-x-1' : ''}`} />
            </a>

            <a
              href="#features"
              className="px-8 py-3.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg font-bold border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200 hover:-translate-y-0.5"
            >
              Learn More
            </a>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-8 text-sm font-medium">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>100% Anonymous</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <span>Privacy First</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              <span>Custom Feedback Criteria</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Mockup */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={mockupVariants}
          className="relative max-w-5xl mx-auto perspective-1000"
          style={{ perspective: '1000px' }}
        >
          {/* Background Glow */}
          <motion.div 
            className="absolute inset-0 bg-blue-500/30 dark:bg-blue-600/20 blur-[80px] rounded-full transform -z-10"
          ></motion.div>

          {/* Browser Window */}
          <motion.div 
            variants={browserWindowVariants}
            animate={isHovered ? "hovered" : "initial"}
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            {/* Browser Header */}
            <div className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
              </div>
              <div className="flex-1 text-center">
                <div className="inline-block px-3 py-1 bg-white dark:bg-slate-900 rounded text-xs text-slate-400 font-medium border border-slate-100 dark:border-slate-800">
                  peer-feedback.app
                </div>
              </div>
              <div className="w-10"></div> {/* Spacer for alignment */}
            </div>

            {/* Content Area */}
            <div className="p-8 grid md:grid-cols-2 gap-8 text-left">
              {/* Left Column: Stats */}
              <div className="space-y-6 perspective-500" style={{ perspective: '500px' }}>
                <motion.div 
                  variants={cardTiltVariants.topLeft}
                  animate={isHovered ? "hovered" : "initial"}
                  className="bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm transform-gpu"
                >
                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">Weekly Feedback</div>
                  <div className="flex items-end gap-3 mb-1">
                    <motion.span 
                      key={isHovered ? "count-hover" : "count-normal"}
                      initial={{ opacity: 0.8, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-4xl font-bold text-slate-900 dark:text-white"
                    >
                      {isHovered ? "28" : "24"}
                    </motion.span>
                    <span className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">Received</span>
                  </div>
                  <div className="text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-2 py-0.5 rounded">
                    {isHovered ? "+18% from last week" : "+12% from last week"}
                  </div>
                </motion.div>

                <motion.div 
                  variants={cardTiltVariants.bottomLeft}
                  animate={isHovered ? "hovered" : "initial"}
                  transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm transform-gpu"
                >
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">Feedback Summary</div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Constructive</span>
                        <span className="text-slate-500">{isHovered ? "88%" : "85%"}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-500 rounded-full" 
                          animate={{ width: isHovered ? "88%" : "85%" }}
                          transition={{ duration: 0.8 }}
                        ></motion.div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-slate-700 dark:text-slate-300">Positive</span>
                        <span className="text-slate-500">{isHovered ? "96%" : "92%"}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-emerald-500 rounded-full" 
                          animate={{ width: isHovered ? "96%" : "92%" }}
                          transition={{ duration: 0.8 }}
                        ></motion.div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Feedback Feed */}
              <div className="space-y-4 perspective-500" style={{ perspective: '500px' }}>
                {/* Feedback Card 1 */}
                <motion.div 
                  variants={cardTiltVariants.topRight}
                  animate={isHovered ? "hovered" : "initial"}
                  transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm transform-gpu"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">Anonymous Peer</div>
                        <div className="text-xs text-slate-500">2m ago</div>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium rounded-full">
                      Helpful
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    "Your presentation skills have improved remarkably. The way you structure your arguments makes complex topics easy to understand."
                  </p>
                </motion.div>

                {/* Feedback Card 2 */}
                <motion.div 
                  variants={cardTiltVariants.bottomRight}
                  animate={isHovered ? "hovered" : "initial"}
                  transition={{ delay: 0.3 }}
                  className="bg-white dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm transform-gpu"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">Team Member</div>
                        <div className="text-xs text-slate-500">15m ago</div>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium rounded-full">
                      Insightful
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    "Consider adding more visual examples to support your points. This could help different learning styles engage better."
                  </p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
