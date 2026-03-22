'use client'

import { Suspense } from 'react'
import {
  AlertCircle,
  Archive,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
  ArrowLeft,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ConversationItem, LeadScoreFlames, MessageBubble } from '@/components/admin/chat/chat-conversation-list'
import { useChatManagement } from '@/hooks/use-chat-management'

function ChatManagementContent() {
  const {
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
    messagesEndRef, conversationRefs,
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
  } = useChatManagement()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gradient-champagne mb-1 lg:mb-2">
            Chat Conversations
          </h1>
          <p className="text-platinum/60 text-sm lg:text-base hidden sm:block">
            Manage visitor conversations and AI escalations
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant={chatWidgetVisible ? 'default' : 'outline'}
            onClick={toggleChatWidget}
            disabled={togglingChatWidget}
            className={`${chatWidgetVisible ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
            size="sm"
          >
            {togglingChatWidget ? (
              <>
                <Loader2 className="w-4 h-4 lg:mr-2 animate-spin" />
                <span className="hidden lg:inline">Updating...</span>
              </>
            ) : chatWidgetVisible ? (
              <>
                <Eye className="w-4 h-4 lg:mr-2" />
                <span className="hidden lg:inline">Chat Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 lg:mr-2" />
                <span className="hidden lg:inline">Chat Hidden</span>
              </>
            )}
          </Button>

          <Button
            variant={notificationsEnabled ? 'default' : 'outline'}
            onClick={notificationsEnabled ? () => setNotificationsEnabled(false) : requestNotificationPermission}
            className={`${notificationsEnabled ? 'bg-emerald-500 hover:bg-emerald-600' : ''}`}
            size="sm"
          >
            {notificationsEnabled ? (
              <>
                <Bell className="w-4 h-4 lg:mr-2" />
                <span className="hidden lg:inline">Notifications On</span>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 lg:mr-2" />
                <span className="hidden lg:inline">Enable Notifications</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-4">
        <Card className="glass-card-heavy">
          <CardHeader className="p-2 lg:pb-2 lg:p-4">
            <CardTitle className="text-xs lg:text-sm font-medium text-platinum/60">Total</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 lg:p-4 lg:pt-0">
            <div className="text-xl lg:text-2xl font-bold text-ivory">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="glass-card-heavy">
          <CardHeader className="p-2 lg:pb-2 lg:p-4">
            <CardTitle className="text-xs lg:text-sm font-medium text-platinum/60 flex items-center gap-1">
              <MessageSquare className="w-3 h-3 hidden lg:block" />Active
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 lg:p-4 lg:pt-0">
            <div className="text-xl lg:text-2xl font-bold text-blue-400">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="glass-card-heavy">
          <CardHeader className="p-2 lg:pb-2 lg:p-4">
            <CardTitle className="text-xs lg:text-sm font-medium text-platinum/60 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 hidden lg:block" />Escalated
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0 lg:p-4 lg:pt-0">
            <div className="text-xl lg:text-2xl font-bold text-orange-400">{stats.escalated}</div>
          </CardContent>
        </Card>
        <Card className="glass-card-heavy hidden lg:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card className="glass-card-heavy hidden lg:block">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <Archive className="w-3 h-3" />Archived
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-platinum/40">{stats.archived}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chat Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <div className={`lg:col-span-1 ${isMobileView && selectedConv ? 'hidden' : ''}`}>
          <Card className="glass-card-heavy">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />Conversations
                </CardTitle>
              </div>
              <div className="flex gap-2 mt-4">
                {(['active', 'resolved', 'archived'] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={statusFilter === s ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(s)}
                    className="text-xs"
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}
              </div>
              {statusFilter === 'resolved' && filteredConversations.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearResolvedChats}
                  disabled={archivingResolved}
                  className="mt-3 w-full text-xs text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
                >
                  {archivingResolved ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Archiving...</>
                  ) : (
                    <><Trash2 className="w-3 h-3 mr-1" />Archive All Resolved ({filteredConversations.length})</>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2 max-h-[calc(100vh-350px)] lg:max-h-[calc(100vh-450px)] overflow-y-auto p-3 lg:p-4">
                {filteredConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConv?.id === conv.id}
                    onClick={() => setSelectedConv(conv)}
                    onTakeOver={() => takeOverChat(conv.id)}
                    onResolve={() => quickResolveChat(conv.id)}
                    isMobile={isMobileView}
                    ref={(el) => {
                      if (el) {
                        conversationRefs.current.set(conv.id, el)
                      } else {
                        conversationRefs.current.delete(conv.id)
                      }
                    }}
                  />
                ))}
                {filteredConversations.length === 0 && (
                  <div className="text-center py-8 text-platinum/40">No conversations found</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Window */}
        <div className={`lg:col-span-2 ${isMobileView && !selectedConv ? 'hidden' : ''} ${isMobileView ? 'col-span-full' : ''}`}>
          {selectedConv ? (
            <Card className={`glass-card-heavy flex flex-col ${isMobileView ? 'h-[calc(100vh-180px)] fixed inset-x-0 bottom-0 top-[140px] z-40 rounded-none' : 'h-[calc(100vh-250px)]'}`}>
              <CardHeader className="border-b border-border/40 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isMobileView && (
                      <Button variant="ghost" size="icon" onClick={() => setSelectedConv(null)} className="mr-1 -ml-2">
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {selectedConv.visitor_name || 'Anonymous Visitor'}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-platinum/60 mt-1 flex-wrap">
                        {selectedConv.ai_handled ? (
                          <span className="flex items-center gap-1 text-blue-400"><Sparkles className="w-3 h-3" />AI Handled</span>
                        ) : (
                          <span className="flex items-center gap-1 text-emerald-400"><User className="w-3 h-3" />Human</span>
                        )}
                        {selectedConv.escalation_reason && (
                          <><span className="text-platinum/40">•</span><span className="text-orange-400">{selectedConv.escalation_reason}</span></>
                        )}
                        {selectedConv.lead_score && selectedConv.lead_score > 0 && (
                          <><span className="text-platinum/40">•</span><LeadScoreFlames score={selectedConv.lead_score} /></>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
                    {selectedConv.status !== 'resolved' && (
                      <Button variant="outline" size="sm" onClick={() => setShowResolveModal(true)} className="px-2 lg:px-3">
                        <CheckCircle2 className="w-4 h-4 lg:mr-1" /><span className="hidden lg:inline">Resolve</span>
                      </Button>
                    )}
                    {selectedConv.status !== 'archived' && (
                      <Button variant="outline" size="sm" onClick={() => setShowArchiveDialog(true)} className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10 px-2 lg:px-3">
                        <Archive className="w-4 h-4 lg:mr-1" /><span className="hidden lg:inline">Archive</span>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setSelectedConv(null)} className="hidden lg:flex">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-background/50 to-background/80">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 lg:p-4 border-t border-border/40 bg-background/95 backdrop-blur sticky bottom-0 flex-shrink-0">
                <div className="relative mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCannedResponses(!showCannedResponses)}
                    className="text-xs min-h-[44px] px-4"
                  >
                    <Zap className="w-4 h-4 mr-2" />Quick Responses
                    <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showCannedResponses ? 'rotate-180' : ''}`} />
                  </Button>

                  {showCannedResponses && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 lg:w-80 bg-background/95 backdrop-blur border border-border/40 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                      {cannedResponses.map((response, i) => (
                        <button
                          key={i}
                          onClick={() => insertCannedResponse(response.text)}
                          className="w-full text-left px-4 py-3 hover:bg-accent/10 border-b border-border/20 last:border-0 transition-colors min-h-[56px] active:bg-accent/20"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-ivory">{response.label}</span>
                            <span className="text-xs text-platinum/40 font-mono">{response.shortcut}</span>
                          </div>
                          <p className="text-xs text-platinum/60 mt-0.5 line-clamp-1">
                            {response.text.slice(0, 60)}...
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={sendMessage} className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Type your response..."
                    className="flex-1 min-h-[44px] text-base"
                  />
                  <Button type="submit" disabled={!inputValue.trim()} className="min-h-[44px] min-w-[44px] px-4">
                    <Send className="w-5 h-5" />
                  </Button>
                </form>
                <p className="text-xs text-platinum/40 mt-1 hidden lg:block">
                  Shortcuts: /pricing, /stats, /join, /refund, /executive
                </p>
              </div>
            </Card>
          ) : (
            <Card className="glass-card-heavy h-[calc(100vh-250px)] hidden lg:flex flex-col items-center justify-center">
              <MessageSquare className="w-16 h-16 text-platinum/20 mb-4" />
              <p className="text-platinum/60">Select a conversation to view messages</p>
            </Card>
          )}
        </div>
      </div>

      {/* Resolve Chat Modal */}
      {showResolveModal && selectedConv && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border/40 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ivory">Resolve Conversation</h3>
              <button onClick={() => setShowResolveModal(false)} className="p-1 hover:bg-accent/10 rounded">
                <X className="w-5 h-5 text-platinum/60" />
              </button>
            </div>
            <p className="text-platinum/60 text-sm mb-6">
              Would you like to send a transcript of this conversation to the visitor?
            </p>
            {selectedConv.visitor_email ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Transcript will be sent to:</span>
                </div>
                <p className="text-ivory mt-1 font-medium">{selectedConv.visitor_email}</p>
              </div>
            ) : (
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-orange-400">
                  <AlertCircle className="w-4 h-4" />No email address available for this visitor
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => resolveChat(false)} disabled={sendingTranscript} className="flex-1">
                Resolve Only
              </Button>
              {selectedConv.visitor_email && (
                <Button onClick={() => resolveChat(true)} disabled={sendingTranscript} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {sendingTranscript ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                  ) : (
                    <><Mail className="w-4 h-4 mr-2" />Send & Resolve</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent className="bg-background border-border/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-ivory">
              <Archive className="w-5 h-5 text-orange-400" />Archive Conversation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-platinum/60">
              This will move the conversation to the archives and hide it from your active list.
              The visitor can still reopen the conversation by sending a new message.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border/40">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={archiveChat} className="bg-orange-500 hover:bg-orange-600 text-white">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function ChatManagementPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-champagne mx-auto mb-4" />
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    }>
      <ChatManagementContent />
    </Suspense>
  )
}
