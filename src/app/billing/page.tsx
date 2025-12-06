'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { CreditCard, Check, Crown, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SubscriptionData {
  currentPlan: string
  status: string
  nextBillingDate: string | null
  cancelAtPeriodEnd: boolean
}

export default function BillingPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'month',
      features: [
        '5 feedback sessions per month',
        'Up to 10 members per group',
        'Basic analytics',
        'Community support'
      ],
      buttonText: 'Current Plan',
      disabled: true,
      popular: false
    },
    {
      id: 'pro',
      name: 'Professional',
      price: '$29',
      period: 'month',
      features: [
        'Unlimited feedback sessions',
        'Up to 50 members per group',
        'Advanced analytics',
        'Priority support',
        'Custom themes',
        'API access'
      ],
      buttonText: 'Upgrade to Pro',
      disabled: false,
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      period: 'month',
      features: [
        'Everything in Pro',
        'Unlimited members per group',
        'White-label options',
        'Dedicated support',
        'Custom integrations',
        'On-premise deployment',
        'SLA guarantee'
      ],
      buttonText: 'Contact Sales',
      disabled: false,
      popular: false
    }
  ]

  useEffect(() => {
    if (user) {
      fetchSubscriptionData()
    }
  }, [user])

  const fetchSubscriptionData = async () => {
    try {
      setSubscription({
        currentPlan: 'free',
        status: 'active',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false
      })
    } catch (error) {
      console.error('Error fetching subscription:', error)
    }
  }

  const handleUpgrade = async (planId: string) => {
    setLoading(true)
    setMessage(null)

    try {
      if (planId === 'enterprise') {
        // Redirect to contact form or open email client
        window.location.href = 'mailto:sales@peerfeedbackplatform.com?subject=Enterprise Plan Inquiry'
        return
      }

      // This would call a real billing API
      setMessage({
        type: 'success',
        text: `Upgrade to ${plans.find(p => p.id === planId)?.name} plan coming soon!`
      })

      // In real implementation:
      // const response = await fetch('/api/billing/upgrade', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify({ planId })
      // })
    } catch (error) {
      console.error('Error upgrading plan:', error)
      setMessage({ type: 'error', text: 'Failed to upgrade plan' })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      setMessage({
        type: 'success',
        text: 'Subscription cancellation feature coming soon!'
      })

      // In real implementation:
      // const response = await fetch('/api/billing/cancel', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`
      //   }
      // })
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      setMessage({ type: 'error', text: 'Failed to cancel subscription' })
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = () => {
    setMessage({ type: 'success', text: 'Billing management portal coming soon!' })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Please log in to view billing information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-start mb-4">
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back()
                } else {
                  router.push('/dashboard')
                }
              }}
              className="inline-flex items-center space-x-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          </div>
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-2xl">
              <CreditCard className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Billing & Subscription</h1>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Choose the perfect plan for your feedback needs. Upgrade, downgrade, or cancel at any time.
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-8 max-w-3xl mx-auto p-4 rounded-xl flex items-center border ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
              : 'bg-rose-50 text-rose-800 border-rose-100'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* Current Plan Status */}
        <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 opacity-50 pointer-events-none"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Current Plan</h2>
              <p className="text-slate-600 dark:text-slate-400 mt-1">You are currently on the <span className="font-semibold text-indigo-600 dark:text-indigo-400">Free plan</span></p>
              {subscription?.nextBillingDate && (
                <p className="text-sm text-slate-500 mt-2">
                  Next billing date: {new Date(subscription.nextBillingDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">Free</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">$0/month</p>
            </div>
          </div>
          {/* Actions */}
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4">
             <button 
               onClick={handleManageBilling}
               className="text-slate-600 hover:text-indigo-600 text-sm font-medium transition-colors"
             >
               Manage Billing Method
             </button>
          </div>
        </div>

        {/* Pricing Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border ${
                plan.popular 
                  ? 'border-indigo-500 ring-4 ring-indigo-500/10' 
                  : 'border-slate-200 dark:border-slate-800'
              } relative flex flex-col transition-all duration-300 hover:shadow-md`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="flex items-center space-x-1 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
                    <Crown className="h-3.5 w-3.5" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}

              <div className="p-8 flex-1 flex flex-col">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-slate-500 dark:text-slate-400 ml-1">/month</span>}
                  </div>
                </div>

                <div className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-400 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={plan.disabled || loading}
                  className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 ${
                    plan.disabled
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                      : plan.popular
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {loading ? 'Processing...' : plan.buttonText}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Billing History */}
        <div className="mt-16 max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-900">Billing History</h2>
          </div>
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-slate-900 font-medium">No billing history available</p>
            <p className="text-sm text-slate-500 mt-2">Your billing activity will appear here once you subscribe to a paid plan.</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Can I change my plan anytime?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately. If you downgrade, the new rate will apply at the start of the next billing cycle.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">We accept all major credit cards (Visa, Mastercard, American Express), debit cards, and PayPal for all paid plans.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Is there a free trial?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Yes, the Professional plan comes with a 14-day free trial. You won't be charged until the trial ends, and you can cancel anytime before then.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Can I cancel anytime?</h3>
              <p className="text-slate-600 text-sm leading-relaxed">Yes, you can cancel your subscription at any time. Your access to premium features will continue until the end of your current billing period.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
