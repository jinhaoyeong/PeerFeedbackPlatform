'use client'

import { useState } from 'react'
import { Shield, Users, MessageSquare, BarChart3, Lock, Zap, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

const features = [
  {
    icon: Shield,
    title: 'Complete Anonymity',
    description: 'Share feedback without revealing your identity. Anonymous mode is built in.',
  },
  {
    icon: Users,
    title: 'Smart Group Management',
    description: 'Create and manage feedback groups with role-based permissions and privacy controls.',
  },
  {
    icon: MessageSquare,
    title: 'Constructive Feedback',
    description: 'Structured prompts and rating scales keep feedback helpful, respectful, and actionable.',
  },
  {
    icon: BarChart3,
    title: 'Actionable Insights',
    description: 'Track progress with simple charts, session summaries, and activity timelines.',
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'Secure authentication, role-based access, and audit logs protect your data.',
  },
  {
    icon: Zap,
    title: 'Real-time Updates',
    description: 'Get instant notifications when new feedback arrives with real-time updates.',
  }
]

export function FeaturesSection() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut' as const
      }
    }
  }

  return (
    <section id="features" className="py-24 px-6 relative overflow-hidden z-10">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-4xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight"
          >
            Explore Features
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed"
          >
            Our platform combines cutting-edge technology with psychological safety to create
            the ideal environment for honest, constructive feedback.
          </motion.p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon
            const isHovered = hoveredFeature === index

            return (
              <motion.div
                key={index}
                variants={itemVariants}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
                className={`bg-white dark:bg-slate-900 rounded-lg p-8 border transition-all duration-300 cursor-pointer group ${
                  isHovered
                    ? 'border-blue-600 dark:border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/20'
                    : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700'
                }`}
              >
                <div className="mb-6">
                  <div className={`inline-flex p-3 rounded-lg transition-colors duration-300 ${
                    isHovered ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                  {feature.description}
                </p>

                <div className={`flex items-center text-blue-600 dark:text-blue-400 font-bold text-sm transition-all duration-300 ${
                  isHovered ? 'translate-x-1' : ''
                }`}>
                  Learn more
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
