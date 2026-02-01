'use client'

import { FileText, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function JournalPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="bg-[#0a0a0b] border-white/10 max-w-lg w-full">
        <CardContent className="py-16 px-8 text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
            <FileText className="w-12 h-12 text-emerald-500" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Coming Soon
          </h1>

          <p className="text-white/60 text-lg mb-6">
            The trading journal is currently under development.
          </p>

          <div className="flex items-center justify-center gap-2 text-white/40">
            <Lock className="w-4 h-4" />
            <span className="text-sm">Track your trades with AI analysis</span>
          </div>
        </CardContent>
      </Card>
        </div>
        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-600 text-black"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Entry
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          icon={Flame}
          label="Current Streak"
          value={streaks?.current_streak || 0}
          suffix="days"
          color="gold"
        />
        <StatCard
          icon={Trophy}
          label="Longest Streak"
          value={streaks?.longest_streak || 0}
          suffix="days"
          color="purple"
        />
        <StatCard
          icon={FileText}
          label="Total Entries"
          value={streaks?.total_entries || 0}
          color="blue"
        />
        <StatCard
          icon={Target}
          label="Win Rate"
          value={winRate}
          suffix="%"
          color="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Winners"
          value={streaks?.total_winners || 0}
          subValue={`/ ${streaks?.total_losers || 0} losses`}
          color="emerald"
        />
      </div>

      {/* Calendar Heatmap */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-500" />
              Trading Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-white font-medium min-w-[140px] text-center">
                {selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day Labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs text-white/40 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {calendarData.map((day) => {
              const dayNum = parseInt(day.date.split('-')[2])
              const hasEntries = day.entries.length > 0
              const isToday = day.date === new Date().toISOString().split('T')[0]

              return (
                <button
                  key={day.date}
                  onClick={() => {
                    if (hasEntries) {
                      setSelectedEntry(day.entries[0])
                    }
                  }}
                  className={cn(
                    'aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative group',
                    hasEntries ? 'cursor-pointer hover:ring-2 hover:ring-emerald-500/50' : 'cursor-default',
                    day.hasWin && !day.hasLoss && 'bg-emerald-500/20 border border-emerald-500/30',
                    day.hasLoss && !day.hasWin && 'bg-red-500/20 border border-red-500/30',
                    day.hasWin && day.hasLoss && 'bg-yellow-500/20 border border-yellow-500/30',
                    !hasEntries && 'bg-white/5',
                    isToday && 'ring-2 ring-emerald-500'
                  )}
                >
                  <span className={cn(
                    'font-medium',
                    hasEntries ? 'text-white' : 'text-white/40'
                  )}>
                    {dayNum}
                  </span>
                  {hasEntries && (
                    <span className="text-[10px] text-white/60">
                      {day.entries.length} {day.entries.length === 1 ? 'trade' : 'trades'}
                    </span>
                  )}
                  {day.totalPL !== 0 && (
                    <span className={cn(
                      'text-[10px] font-medium',
                      day.totalPL > 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {day.totalPL > 0 ? '+' : ''}{day.totalPL.toFixed(0)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/30" />
              <span className="text-xs text-white/60">Winning Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30" />
              <span className="text-xs text-white/60">Losing Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/30" />
              <span className="text-xs text-white/60">Mixed Day</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Entries List */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-500" />
            Recent Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <p className="text-white/60 mb-4">No journal entries yet</p>
              <Button
                onClick={() => setIsModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Entry
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 10).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition-all text-left"
                >
                  {/* Thumbnail or placeholder */}
                  <div className="w-16 h-12 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    {entry.screenshot_url ? (
                      <img
                        src={entry.screenshot_url}
                        alt="Trade screenshot"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-white/20" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {entry.symbol || 'Trade'}
                      </span>
                      {entry.trade_type && (
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60">
                          {entry.trade_type}
                        </span>
                      )}
                      {entry.ai_analysis && (
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <p className="text-sm text-white/40 truncate">
                      {entry.setup_notes || 'No notes'}
                    </p>
                  </div>

                  {/* P&L and Date */}
                  <div className="text-right flex-shrink-0">
                    {entry.profit_loss !== null && (
                      <div className={cn(
                        'font-medium',
                        entry.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}>
                        {entry.profit_loss >= 0 ? '+' : ''}${entry.profit_loss.toFixed(2)}
                      </div>
                    )}
                    <div className="text-xs text-white/40">
                      {formatDate(entry.trade_date, { format: 'short' })}
                    </div>
                  </div>

                  {/* Win/Loss indicator */}
                  <div className="flex-shrink-0">
                    {entry.is_winner === true && (
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    )}
                    {entry.is_winner === false && (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Entry Modal */}
      <NewEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false)
          loadEntries()
        }}
      />

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  )
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  subValue,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  suffix?: string
  subValue?: string
  color: 'gold' | 'emerald' | 'purple' | 'blue'
}) {
  const colors = {
    gold: 'text-emerald-500 bg-emerald-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    purple: 'text-purple-400 bg-purple-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  }

  return (
    <Card className="bg-[#0a0a0b] border-white/10">
      <CardContent className="pt-6">
        <div className={`w-10 h-10 rounded-lg ${colors[color].split(' ')[1]} flex items-center justify-center mb-3`}>
          <Icon className={`w-5 h-5 ${colors[color].split(' ')[0]}`} />
        </div>
        <div className={`text-2xl font-bold ${colors[color].split(' ')[0]}`}>
          {value}{suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
        </div>
        <p className="text-white/40 text-sm mt-1">{label}</p>
        {subValue && <p className="text-white/30 text-xs">{subValue}</p>}
      </CardContent>
    </Card>
  )
}

// New Entry Modal Component
function NewEntryModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'upload' | 'analyzing' | 'details'>('upload')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [formData, setFormData] = useState({
    trade_date: new Date().toISOString().split('T')[0],
    symbol: '',
    trade_type: '',
    profit_loss: '',
    is_winner: null as boolean | null,
    setup_notes: '',
    execution_notes: '',
    lessons_learned: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      processFile(file)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const processFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setImagePreview(result)
      // Extract base64 data (remove data URL prefix)
      const base64 = result.split(',')[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const analyzeImage = async () => {
    if (!imageBase64) return

    setIsAnalyzing(true)
    setStep('analyzing')

    try {
      const response = await fetch('/api/members/journal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          context: formData.setup_notes,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setAiAnalysis(data.analysis)
        // Auto-fill tags from analysis
        if (data.analysis.tags) {
          // Could update form with suggested tags
        }
      }
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
      setStep('details')
    }
  }

  const handleSubmit = async () => {
    setIsSaving(true)

    try {
      const response = await fetch('/api/members/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_date: formData.trade_date,
          symbol: formData.symbol || null,
          trade_type: formData.trade_type || null,
          profit_loss: formData.profit_loss ? parseFloat(formData.profit_loss) : null,
          is_winner: formData.is_winner,
          setup_notes: formData.setup_notes || null,
          execution_notes: formData.execution_notes || null,
          lessons_learned: formData.lessons_learned || null,
          screenshot_url: imagePreview, // In production, upload to storage first
          ai_analysis: aiAnalysis,
        }),
      })

      if (response.ok) {
        onSuccess()
        // Reset state
        setStep('upload')
        setImagePreview(null)
        setImageBase64(null)
        setAiAnalysis(null)
        setFormData({
          trade_date: new Date().toISOString().split('T')[0],
          symbol: '',
          trade_type: '',
          profit_loss: '',
          is_winner: null,
          setup_notes: '',
          execution_notes: '',
          lessons_learned: '',
        })
      }
    } catch (error) {
      console.error('Failed to save entry:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0a0a0b] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0b] border-b border-white/10 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Journal Entry</h2>
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center transition-all',
                  isDragging
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : imagePreview
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-white/20 hover:border-white/40'
                )}
              >
                {imagePreview ? (
                  <div className="space-y-4">
                    <img
                      src={imagePreview}
                      alt="Trade screenshot"
                      className="max-h-64 mx-auto rounded-lg"
                    />
                    <p className="text-emerald-400 text-sm">Screenshot uploaded</p>
                    <button
                      onClick={() => {
                        setImagePreview(null)
                        setImageBase64(null)
                      }}
                      className="text-white/60 hover:text-white text-sm"
                    >
                      Remove and upload different image
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-12 h-12 mx-auto text-white/40" />
                    <div>
                      <p className="text-white font-medium">Drop your trade screenshot here</p>
                      <p className="text-white/60 text-sm mt-1">or click to browse</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Basic Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Trade Date</label>
                  <input
                    type="date"
                    value={formData.trade_date}
                    onChange={(e) => setFormData({ ...formData, trade_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Symbol</label>
                  <input
                    type="text"
                    placeholder="SPX, TSLA, etc."
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-2">Setup Notes (optional)</label>
                <textarea
                  placeholder="Why did you take this trade?"
                  value={formData.setup_notes}
                  onChange={(e) => setFormData({ ...formData, setup_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-white/20 text-white hover:bg-white/5"
                >
                  Cancel
                </Button>
                <Button
                  onClick={imageBase64 ? analyzeImage : handleSubmit}
                  disabled={!formData.trade_date}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black"
                >
                  {imageBase64 ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze with AI
                    </>
                  ) : (
                    'Save Entry'
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="text-center py-12 space-y-4">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-emerald-500" />
              </div>
              <p className="text-white font-medium">Analyzing your trade...</p>
              <p className="text-white/60 text-sm">Our AI coach is reviewing your chart</p>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6">
              {/* Screenshot and AI Analysis side by side */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Screenshot */}
                {imagePreview && (
                  <div>
                    <h3 className="text-sm font-medium text-white/60 mb-2">Screenshot</h3>
                    <img
                      src={imagePreview}
                      alt="Trade screenshot"
                      className="w-full rounded-lg"
                    />
                  </div>
                )}

                {/* AI Analysis */}
                {aiAnalysis && (
                  <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-medium text-white">Coach&apos;s Notes</h3>
                      {aiAnalysis.grade && (
                        <span className="ml-auto px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 text-sm font-medium">
                          Grade: {aiAnalysis.grade}
                        </span>
                      )}
                    </div>
                    <p className="text-white/80 text-sm mb-4">
                      {aiAnalysis.summary}
                    </p>
                    <p className="text-white/70 text-sm">
                      {aiAnalysis.coaching_notes}
                    </p>
                    {aiAnalysis.risk_management?.score && (
                      <div className="mt-4 pt-4 border-t border-emerald-500/20">
                        <p className="text-xs text-white/40 mb-1">Risk Management Score</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${aiAnalysis.risk_management.score * 10}%` }}
                            />
                          </div>
                          <span className="text-sm text-emerald-500 font-medium">
                            {aiAnalysis.risk_management.score}/10
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Trade Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Trade Type</label>
                  <select
                    value={formData.trade_type}
                    onChange={(e) => setFormData({ ...formData, trade_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select type</option>
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                    <option value="call">Call Option</option>
                    <option value="put">Put Option</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">P&L ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={formData.profit_loss}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData({
                        ...formData,
                        profit_loss: val,
                        is_winner: val ? parseFloat(val) >= 0 : null,
                      })
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Win/Loss Toggle */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Result</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setFormData({ ...formData, is_winner: true })}
                    className={cn(
                      'flex-1 py-3 rounded-lg border transition-all flex items-center justify-center gap-2',
                      formData.is_winner === true
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'border-white/20 text-white/60 hover:border-white/40'
                    )}
                  >
                    <TrendingUp className="w-5 h-5" />
                    Winner
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, is_winner: false })}
                    className={cn(
                      'flex-1 py-3 rounded-lg border transition-all flex items-center justify-center gap-2',
                      formData.is_winner === false
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'border-white/20 text-white/60 hover:border-white/40'
                    )}
                  >
                    <TrendingDown className="w-5 h-5" />
                    Loser
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Lessons Learned</label>
                <textarea
                  placeholder="What did you learn from this trade?"
                  value={formData.lessons_learned}
                  onChange={(e) => setFormData({ ...formData, lessons_learned: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('upload')}
                  className="border-white/20 text-white hover:bg-white/5"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Entry'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Entry Detail Modal Component
function EntryDetailModal({
  entry,
  onClose,
}: {
  entry: JournalEntry
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0a0a0b] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-[#0a0a0b] border-b border-white/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">
              {entry.symbol || 'Trade'} - {formatDate(entry.trade_date, { format: 'short' })}
            </h2>
            {entry.is_winner === true && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-sm">
                Winner
              </span>
            )}
            {entry.is_winner === false && (
              <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-sm">
                Loser
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Screenshot */}
            {entry.screenshot_url && (
              <div>
                <h3 className="text-sm font-medium text-white/60 mb-2">Screenshot</h3>
                <img
                  src={entry.screenshot_url}
                  alt="Trade screenshot"
                  className="w-full rounded-lg"
                />
              </div>
            )}

            {/* AI Analysis */}
            {entry.ai_analysis && (
              <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-medium text-white">Coach&apos;s Notes</h3>
                  {entry.ai_analysis.grade && (
                    <span className="ml-auto px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 text-sm font-medium">
                      Grade: {entry.ai_analysis.grade}
                    </span>
                  )}
                </div>
                <p className="text-white/80 text-sm mb-4">
                  {entry.ai_analysis.summary}
                </p>
                <p className="text-white/70 text-sm">
                  {entry.ai_analysis.coaching_notes}
                </p>

                {/* Detailed Analysis Sections */}
                {entry.ai_analysis.trend_analysis && (
                  <div className="mt-4 pt-4 border-t border-emerald-500/20">
                    <h4 className="text-sm font-medium text-white/60 mb-2">Trend Analysis</h4>
                    <p className="text-sm text-white/80">
                      {entry.ai_analysis.trend_analysis.direction} ({entry.ai_analysis.trend_analysis.strength})
                    </p>
                    <p className="text-xs text-white/60 mt-1">{entry.ai_analysis.trend_analysis.notes}</p>
                  </div>
                )}

                {entry.ai_analysis.risk_management && (
                  <div className="mt-4 pt-4 border-t border-emerald-500/20">
                    <p className="text-xs text-white/40 mb-1">Risk Management Score</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${entry.ai_analysis.risk_management.score * 10}%` }}
                        />
                      </div>
                      <span className="text-sm text-emerald-500 font-medium">
                        {entry.ai_analysis.risk_management.score}/10
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trade Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {entry.trade_type && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-white/40">Type</p>
                <p className="text-white font-medium capitalize">{entry.trade_type}</p>
              </div>
            )}
            {entry.profit_loss !== null && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-white/40">P&L</p>
                <p className={cn(
                  'font-medium',
                  entry.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {entry.profit_loss >= 0 ? '+' : ''}${entry.profit_loss.toFixed(2)}
                </p>
              </div>
            )}
            {entry.entry_price !== null && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-white/40">Entry</p>
                <p className="text-white font-medium">${entry.entry_price}</p>
              </div>
            )}
            {entry.exit_price !== null && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-white/40">Exit</p>
                <p className="text-white font-medium">${entry.exit_price}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          {(entry.setup_notes || entry.execution_notes || entry.lessons_learned) && (
            <div className="space-y-4">
              {entry.setup_notes && (
                <div>
                  <h3 className="text-sm font-medium text-white/60 mb-1">Setup Notes</h3>
                  <p className="text-white/80">{entry.setup_notes}</p>
                </div>
              )}
              {entry.execution_notes && (
                <div>
                  <h3 className="text-sm font-medium text-white/60 mb-1">Execution Notes</h3>
                  <p className="text-white/80">{entry.execution_notes}</p>
                </div>
              )}
              {entry.lessons_learned && (
                <div>
                  <h3 className="text-sm font-medium text-white/60 mb-1">Lessons Learned</h3>
                  <p className="text-white/80">{entry.lessons_learned}</p>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {entry.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full bg-white/10 text-white/60 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
>>>>>>> 6c5a005 (Complete platform-wide "De-Golding": Replace 129 gold instances with Emerald)
    </div>
  )
}
