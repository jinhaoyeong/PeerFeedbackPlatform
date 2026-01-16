'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { AuthForm } from '@/components/auth-form'
import { Footer } from '@/components/landing/footer'
import { HeroSection } from '@/components/landing/hero-section'
import { SecondaryHeroSection } from '@/components/landing/secondary-hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { MessageSquare, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')

  if (isAuthenticated) {
    // Redirect to dashboard if already authenticated
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
      return null
    }
  }

  const scrollToAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode)
    const authSection = document.getElementById('auth')
    if (authSection) {
      authSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 relative selection:bg-blue-100 dark:selection:bg-blue-900/30">
      {/* Animated Background - Fixed to viewport but layered behind */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Top Left - Blue */}
        <div className="absolute -top-20 -left-20 w-[40rem] h-[40rem] bg-blue-200 dark:bg-blue-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
        
        {/* Top Right - Sky */}
        <div className="absolute top-0 -right-20 w-[35rem] h-[35rem] bg-sky-200 dark:bg-sky-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        
        {/* Middle Left - Indigo */}
        <div className="absolute top-[40%] -left-20 w-[45rem] h-[45rem] bg-indigo-200 dark:bg-indigo-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        
        {/* Middle Right - Purple */}
        <div className="absolute top-[30%] -right-32 w-[38rem] h-[38rem] bg-purple-200 dark:bg-purple-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        
        {/* Bottom Left - Blue */}
        <div className="absolute -bottom-32 left-0 w-[40rem] h-[40rem] bg-blue-200 dark:bg-blue-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
        
        {/* Bottom Right - Cyan */}
        <div className="absolute -bottom-40 -right-20 w-[40rem] h-[40rem] bg-cyan-200 dark:bg-cyan-900/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="bg-gradient-to-br from-blue-600 to-sky-600 p-2 rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/20">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">PeerFeedback</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => scrollToAuth('login')}
                className="hidden sm:block px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => scrollToAuth('register')}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 dark:bg-blue-600 rounded-xl hover:bg-slate-800 dark:hover:bg-blue-700 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <SecondaryHeroSection />

        <HeroSection />

        <FeaturesSection />

        {/* Auth Section */}
        <section id="auth" className="py-24 relative overflow-hidden z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="text-center lg:text-left"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
                  Start Your Growth Journey Today
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                  Join a community of professionals, students, and teams who are mastering the art of constructive feedback.
                </p>
                
                <div className="space-y-4 max-w-md mx-auto lg:mx-0">
                  {[
                    'Free for individuals and small teams',
                    'No credit card required',
                    'Instant access to all features'
                  ].map((text, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 + 0.3 }}
                      className="flex items-center space-x-3 text-slate-700 dark:text-slate-300"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex justify-center"
              >
                <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-blue-200/50 dark:shadow-blue-900/20 border border-slate-100 dark:border-slate-800 p-8">
                  <AuthForm mode={authMode} onModeChange={setAuthMode} />
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
