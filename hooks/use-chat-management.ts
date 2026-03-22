'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { playLuxuryPlink, isSoundEnabled } from '@/lib/sounds'
import { BRAND_LOGO_SRC } from '@/lib/brand'
import type {
  CannedResponse,
  ChatStats,
  Conversation,
  Message,
  PricingTierApiRow,
} from '@/components/admin/chat/chat-types'
import {
  DEFAULT_CANNED_RESPONSES,
  DEFAULT_PRICE_MAP,
  getAdminSessionId,
  normalizePrice,
  resolveCannedResponseTemplates,
} from '@/components/admin/chat/chat-types'

export function useChatManagement() {
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'archived'>('active')
  const [stats, setStats] = useState<ChatStats>({
    total: 0,
    active: 0,
    resolved: 0,
    archived: 0,
    escalated: 0
  })
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [showCannedResponses, setShowCannedResponses] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [sendingTranscript, setSendingTranscript] = useState(false)
  const [archivingResolved, setArchivingResolved] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>(DEFAULT_CANNED_RESPONSES)
  const [chatWidgetVisible, setChatWidgetVisible] = useState(true)
  const [togglingChatWidget, setTogglingChatWidget] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const conversationRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const previousEscalatedIds = useRef<Set<string>>(new Set())
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const adminSessionId = useRef<string>(getAdminSessionId())
  const previousHighValueIds = useRef<Set<string>>(new Set())

  // Fetch canned responses from app_settings and resolve live pricing
  useEffect(() => {
    const fetchCannedResponses = async () => {
      let templates = DEFAULT_CANNED_RESPONSES
      let priceMap = { ...DEFAULT_PRICE_MAP }

      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'chat_canned_responses')
          .single()

        if (!error && data?.value) {
          try {
            const parsed = JSON.parse(data.value)
            if (Array.isArray(parsed) && parsed.length > 0) {
              templates = parsed
            }
          } catch {
            // Invalid JSON, use defaults
          }
        }
      } catch {
        // Use default canned responses on error
      }

      try {
        const response = await fetch('/api/admin/packages')
        if (response.ok) {
          const payload = await response.json()
          const tiers = (payload.tiers || []) as PricingTierApiRow[]
          const tierById = new Map<string, PricingTierApiRow>()
          tiers.forEach((tier) => tierById.set(tier.id.toLowerCase(), tier))

          priceMap = {
            core_price: normalizePrice(tierById.get('core')?.monthly_price) || DEFAULT_PRICE_MAP.core_price,
            pro_price: normalizePrice(tierById.get('pro')?.monthly_price) || DEFAULT_PRICE_MAP.pro_price,
            exec_price: normalizePrice(tierById.get('executive')?.monthly_price) || DEFAULT_PRICE_MAP.exec_price,
          }
        }
      } catch {
        // Keep default fallback prices
      }

      setCannedResponses(resolveCannedResponseTemplates(templates, priceMap))
    }

    fetchCannedResponses()
  }, [])

  // Detect mobile view
  useEffect(() => {
    const checkMobileView = () => setIsMobileView(window.innerWidth < 1024)
    checkMobileView()
    window.addEventListener('resize', checkMobileView)
    return () => window.removeEventListener('resize', checkMobileView)
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Check notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission)
      setNotificationsEnabled(Notification.permission === 'granted')
    }
  }, [])

  // Load chat widget visibility setting
  useEffect(() => {
    const loadChatWidgetSetting = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'chat_widget_visible')
        .single()
      setChatWidgetVisible(data?.value !== 'false')
    }
    loadChatWidgetSetting()
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser')
      return
    }
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    setNotificationsEnabled(permission === 'granted')
  }, [])

  const toggleChatWidget = useCallback(async () => {
    setTogglingChatWidget(true)
    try {
      const newValue = !chatWidgetVisible
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: 'chat_widget_visible',
          value: newValue.toString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })

      if (error) {
        console.error('Failed to toggle chat widget:', error)
        alert('Failed to update chat widget visibility')
        return
      }
      setChatWidgetVisible(newValue)
    } catch (err) {
      console.error('Error toggling chat widget:', err)
      alert('Error updating chat widget visibility')
    } finally {
      setTogglingChatWidget(false)
    }
  }, [chatWidgetVisible])

  const broadcastTypingStatus = useCallback(async (conversationId: string, isTyping: boolean) => {
    try {
      if (isTyping) {
        await supabase
          .from('team_typing_indicators')
          .upsert({
            conversation_id: conversationId,
            user_id: adminSessionId.current,
            user_name: 'TradeITM',
            is_typing: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'conversation_id,user_id' })
      } else {
        await supabase
          .from('team_typing_indicators')
          .delete()
          .eq('conversation_id', conversationId)
          .eq('user_id', adminSessionId.current)
      }
    } catch (error) {
      console.warn('Failed to broadcast typing status:', error)
    }
  }, [])

  const showEscalationNotification = useCallback((conv: Conversation, reason?: string) => {
    if (!notificationsEnabled || notificationPermission !== 'granted') return

    const isHighValue = conv.lead_score && conv.lead_score >= 7
    const title = isHighValue && !conv.escalation_reason
      ? '🔥 High-Value Lead!'
      : '🚨 Chat Escalated!'

    const body = conv.escalation_reason
      ? `${conv.visitor_name || 'Visitor'}: ${conv.escalation_reason}${isHighValue ? ` • Lead Score: ${conv.lead_score}` : ''}`
      : `${conv.visitor_name || 'Visitor'} ${reason || 'needs attention'}${isHighValue ? ` • Lead Score: ${conv.lead_score}` : ''}`

    const notification = new Notification(title, {
      body,
      icon: BRAND_LOGO_SRC,
      tag: `escalation-${conv.id}`,
      requireInteraction: true
    })

    notification.onclick = () => {
      window.focus()
      setSelectedConv(conv)
      notification.close()
    }

    if (isSoundEnabled()) {
      playLuxuryPlink()
    }
    setTimeout(() => notification.close(), 15000)
  }, [notificationsEnabled, notificationPermission])

  const loadConversations = useCallback(async () => {
    const { data } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (data) {
      setConversations(data)
      data.forEach((conv: Conversation) => {
        if (conv.escalation_reason) previousEscalatedIds.current.add(conv.id)
        if (conv.lead_score && conv.lead_score >= 7) previousHighValueIds.current.add(conv.id)
      })

      setStats({
        total: data.length,
        active: data.filter((c: Conversation) => !c.status || c.status === 'active').length,
        resolved: data.filter((c: Conversation) => c.status === 'resolved').length,
        archived: data.filter((c: Conversation) => c.status === 'archived').length,
        escalated: data.filter((c: Conversation) => c.escalation_reason && (!c.status || c.status === 'active')).length
      })
    }
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (data) setMessages(data)
  }, [])

  // Load conversations and subscribe to changes
  useEffect(() => {
    loadConversations()

    const channel = supabase
      .channel('admin-conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations'
      }, (payload: Record<string, unknown>) => {
        loadConversations()

        if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new as Conversation
          if (updated.escalation_reason && !previousEscalatedIds.current.has(updated.id)) {
            previousEscalatedIds.current.add(updated.id)
            showEscalationNotification(updated)
          }
          if (updated.lead_score && updated.lead_score >= 7 && !previousHighValueIds.current.has(updated.id)) {
            previousHighValueIds.current.add(updated.id)
            if (!updated.escalation_reason) showEscalationNotification(updated, 'is a high-value prospect')
          }
        }

        if (payload.eventType === 'INSERT' && payload.new) {
          const newConv = payload.new as Conversation
          if (newConv.escalation_reason) {
            previousEscalatedIds.current.add(newConv.id)
            showEscalationNotification(newConv)
          }
          if (newConv.lead_score && newConv.lead_score >= 7) {
            previousHighValueIds.current.add(newConv.id)
            if (!newConv.escalation_reason) showEscalationNotification(newConv, 'is a high-value prospect')
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadConversations, showEscalationNotification])

  // Handle query parameter to auto-select conversation
  useEffect(() => {
    const conversationId = searchParams.get('id')
    if (conversationId && conversations.length > 0 && !selectedConv) {
      const match = conversations.find(c => c.id === conversationId)
      if (match) {
        const convStatus = match.status || 'active'
        if (convStatus !== statusFilter) setStatusFilter(convStatus as 'active' | 'resolved' | 'archived')
        setSelectedConv(match)
        setTimeout(() => {
          const ref = conversationRefs.current.get(match.id)
          if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
  }, [searchParams, conversations, selectedConv, statusFilter])

  // Filter conversations by status
  useEffect(() => {
    setFilteredConversations(conversations.filter(c => (c.status || 'active') === statusFilter))
  }, [conversations, statusFilter])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConv) return
    loadMessages(selectedConv.id)

    const channel = supabase
      .channel(`admin-conv-${selectedConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${selectedConv.id}`
      }, (payload: Record<string, unknown>) => {
        const newMessage = payload.new as Message
        setMessages(prev => [...prev, newMessage])
        if (newMessage.sender_type === 'visitor' && isSoundEnabled()) playLuxuryPlink()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedConv, loadMessages])

  const insertCannedResponse = useCallback((text: string) => {
    setInputValue(text)
    setShowCannedResponses(false)
  }, [])

  const takeOverChat = useCallback(async (convId: string) => {
    await supabase
      .from('chat_conversations')
      .update({ ai_handled: false, escalation_reason: 'Manually claimed by admin' })
      .eq('id', convId)
    loadConversations()
  }, [loadConversations])

  const resolveChat = useCallback(async (sendTranscript: boolean) => {
    if (!selectedConv) return

    if (sendTranscript && selectedConv.visitor_email) {
      setSendingTranscript(true)
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-chat-transcript`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              conversationId: selectedConv.id,
              recipientEmail: selectedConv.visitor_email
            })
          }
        )
        if (!response.ok) {
          const error = await response.json()
          console.error('Failed to send transcript:', error)
          alert('Failed to send transcript. Resolving chat anyway.')
        }
      } catch (error) {
        console.error('Failed to send transcript:', error)
        alert('Failed to send transcript. Resolving chat anyway.')
      }
      setSendingTranscript(false)
    }

    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConv.id,
        sender_type: 'system',
        sender_name: 'System',
        message_text: 'Conversation marked as resolved.',
        ai_generated: false
      })

    await supabase
      .from('chat_conversations')
      .update({ status: 'resolved' })
      .eq('id', selectedConv.id)

    setShowResolveModal(false)
    loadConversations()
    setSelectedConv(null)
  }, [selectedConv, loadConversations])

  const archiveChat = useCallback(async () => {
    if (!selectedConv) return
    await supabase
      .from('chat_conversations')
      .update({ status: 'archived' })
      .eq('id', selectedConv.id)

    setShowArchiveDialog(false)
    loadConversations()
    setSelectedConv(null)
  }, [selectedConv, loadConversations])

  const clearResolvedChats = useCallback(async () => {
    setArchivingResolved(true)
    const { data: resolvedConvs } = await supabase
      .from('chat_conversations')
      .select('id')
      .eq('status', 'resolved')

    if (resolvedConvs && resolvedConvs.length > 0) {
      await supabase
        .from('chat_conversations')
        .update({ status: 'archived' })
        .in('id', resolvedConvs.map((c: { id: string }) => c.id))
      loadConversations()
    }
    setArchivingResolved(false)
  }, [loadConversations])

  const quickResolveChat = useCallback(async (conversationId: string) => {
    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'system',
        sender_name: 'System',
        message_text: 'Conversation marked as resolved.',
        ai_generated: false
      })

    await supabase
      .from('chat_conversations')
      .update({ status: 'resolved' })
      .eq('id', conversationId)

    if (selectedConv?.id === conversationId) setSelectedConv(null)
    loadConversations()
  }, [selectedConv, loadConversations])

  const sendMessage = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !selectedConv) return

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    broadcastTypingStatus(selectedConv.id, false)

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: selectedConv.id,
        sender_type: 'team',
        sender_name: 'Admin',
        message_text: inputValue.trim(),
        ai_generated: false
      })

    if (!error) setInputValue('')
  }, [inputValue, selectedConv, broadcastTypingStatus])

  const handleInputChange = useCallback((val: string) => {
    setInputValue(val)
    const matchedResponse = cannedResponses.find(r => val === r.shortcut)
    if (matchedResponse) {
      setInputValue(matchedResponse.text)
    }

    if (selectedConv && val.trim()) {
      broadcastTypingStatus(selectedConv.id, true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        if (selectedConv) broadcastTypingStatus(selectedConv.id, false)
      }, 3000)
    } else if (selectedConv && !val.trim()) {
      broadcastTypingStatus(selectedConv.id, false)
    }
  }, [cannedResponses, selectedConv, broadcastTypingStatus])

  return {
    // State
    conversations, filteredConversations,
    selectedConv, setSelectedConv,
    messages, inputValue,
    statusFilter, setStatusFilter,
    stats,
    notificationsEnabled, setNotificationsEnabled,
    showCannedResponses, setShowCannedResponses,
    showResolveModal, setShowResolveModal,
    showArchiveDialog, setShowArchiveDialog,
    sendingTranscript, archivingResolved,
    isMobileView, cannedResponses,
    chatWidgetVisible, togglingChatWidget,
    // Refs
    messagesEndRef, conversationRefs,
    // Actions
    requestNotificationPermission,
    toggleChatWidget,
    insertCannedResponse,
    takeOverChat,
    resolveChat,
    archiveChat,
    clearResolvedChats,
    quickResolveChat,
    sendMessage,
    handleInputChange,
  }
}
