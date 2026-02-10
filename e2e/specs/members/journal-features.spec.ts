import { test, expect, type Page, type Route } from '@playwright/test'

const SAMPLE_ANALYTICS = {
  period: '30d',
  period_start: '2026-01-10T00:00:00.000Z',
  total_trades: 24,
  closed_trades: 24,
  winning_trades: 14,
  losing_trades: 10,
  win_rate: 58.33,
  total_pnl: 1240.55,
  avg_pnl: 51.69,
  expectancy: 34.12,
  profit_factor: 1.47,
  avg_r_multiple: 0.62,
  sharpe_ratio: 0.78,
  sortino_ratio: 0.95,
  max_drawdown: -312.44,
  max_drawdown_duration_days: 4,
  avg_hold_minutes: 78,
  avg_mfe_percent: 1.6,
  avg_mae_percent: 0.7,
  hourly_pnl: [{ hour_of_day: 9, pnl: 420, trade_count: 8 }],
  day_of_week_pnl: [{ day_of_week: 1, pnl: 300, trade_count: 5 }],
  monthly_pnl: [{ month: '2026-01', pnl: 1240.55, trade_count: 24 }],
  symbol_stats: [{ symbol: 'SPX', pnl: 780, trade_count: 12, win_rate: 66.6 }],
  direction_stats: [{ direction: 'long', pnl: 640, trade_count: 16, win_rate: 62.5 }],
  dte_buckets: [{ bucket: '0-7', pnl: 430, trade_count: 9, win_rate: 55.5 }],
  equity_curve: [{ trade_date: '2026-01-10T14:30:00.000Z', equity: 120, drawdown: 0 }],
  r_multiple_distribution: [{ bucket: '0', count: 5 }, { bucket: '1', count: 9 }],
  mfe_mae_scatter: [{ id: 'entry-1', mfe: 1.9, mae: 0.8, pnl: 120 }],
}

async function enableMembersBypass(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({
    'x-e2e-bypass-auth': '1',
  })
}

async function setupJournalFeatureMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'home', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'book', path: '/members/journal' },
          { tab_id: 'ai-coach', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'AI Coach', icon: 'sparkles', path: '/members/ai-coach' },
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'Library', icon: 'book-open', path: '/members/academy/courses' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 5, label: 'Profile', icon: 'user', path: '/members/profile' },
        ],
      }),
    })
  })

  await page.route('**/api/members/playbooks**', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'playbook-1',
            name: 'ORB Breakout',
            description: 'First 15 minute breakout setup',
            is_active: true,
            updated_at: '2026-02-09T10:00:00.000Z',
          }],
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  })

  await page.route('**/api/members/insights/behavioral**', async (route: Route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith('/dismiss')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'insight-1' } }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [{
          id: 'insight-1',
          analysis_date: '2026-02-08',
          insight_type: 'tilt',
          title: 'Tilt Pattern Detected',
          description: 'Three losses in a row with increased position size.',
          recommendation: 'Reduce size after a loss streak.',
          severity: 'warning',
        }],
      }),
    })
  })

  await page.route('**/api/members/journal**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    const method = request.method()

    if (pathname === '/api/members/journal' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'entry-1',
            user_id: '00000000-0000-4000-8000-000000000001',
            trade_date: '2026-02-07T14:35:00.000Z',
            symbol: 'SPX',
            direction: 'long',
            entry_price: 5200,
            exit_price: 5210,
            position_size: 1,
            pnl: 10,
            pnl_percentage: 0.19,
            is_winner: true,
            screenshot_url: null,
            screenshot_storage_path: null,
            ai_analysis: { grade: 'B+', summary: 'Solid execution.' },
            setup_notes: 'Breakout above opening range high.',
            execution_notes: null,
            lessons_learned: null,
            tags: ['Breakout'],
            smart_tags: ['Opening Range'],
            rating: 4,
            market_context: null,
            verification: null,
            entry_timestamp: null,
            exit_timestamp: null,
            stop_loss: null,
            initial_target: null,
            strategy: 'ORB Breakout',
            hold_duration_min: 45,
            mfe_percent: 1.1,
            mae_percent: 0.4,
            contract_type: 'stock',
            strike_price: null,
            expiration_date: null,
            dte_at_entry: null,
            dte_at_exit: null,
            iv_at_entry: null,
            iv_at_exit: null,
            delta_at_entry: null,
            theta_at_entry: null,
            gamma_at_entry: null,
            vega_at_entry: null,
            underlying_at_entry: null,
            underlying_at_exit: null,
            mood_before: null,
            mood_after: null,
            discipline_score: null,
            followed_plan: null,
            deviation_notes: null,
            session_id: null,
            draft_status: null,
            is_draft: false,
            draft_expires_at: null,
            is_open: false,
            enriched_at: null,
            share_count: 0,
            created_at: '2026-02-07T14:40:00.000Z',
            updated_at: '2026-02-07T14:40:00.000Z',
          }],
          streaks: {
            current_streak: 3,
            longest_streak: 8,
            total_entries: 24,
            total_winners: 14,
            total_losers: 10,
          },
        }),
      })
      return
    }

    if (pathname === '/api/members/journal/open-positions' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'open-1',
            symbol: 'NDX',
            direction: 'long',
            entry_price: 18000,
            position_size: 1,
            current_price: 18024,
            live_pnl: 24,
            live_pnl_percentage: 0.13,
          }],
        }),
      })
      return
    }

    if (pathname === '/api/members/journal/drafts' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'draft-1',
            user_id: '00000000-0000-4000-8000-000000000001',
            trade_date: '2026-02-08T21:05:00.000Z',
            symbol: 'AAPL',
            direction: 'short',
            entry_price: null,
            exit_price: null,
            position_size: null,
            pnl: null,
            pnl_percentage: null,
            is_winner: null,
            screenshot_url: null,
            screenshot_storage_path: null,
            ai_analysis: null,
            setup_notes: 'Auto-draft from AI Coach session.',
            execution_notes: null,
            lessons_learned: null,
            tags: ['ai-session-draft'],
            smart_tags: ['Auto Draft'],
            rating: null,
            market_context: null,
            verification: null,
            entry_timestamp: null,
            exit_timestamp: null,
            stop_loss: null,
            initial_target: null,
            strategy: null,
            hold_duration_min: null,
            mfe_percent: null,
            mae_percent: null,
            contract_type: 'stock',
            strike_price: null,
            expiration_date: null,
            dte_at_entry: null,
            dte_at_exit: null,
            iv_at_entry: null,
            iv_at_exit: null,
            delta_at_entry: null,
            theta_at_entry: null,
            gamma_at_entry: null,
            vega_at_entry: null,
            underlying_at_entry: null,
            underlying_at_exit: null,
            mood_before: null,
            mood_after: null,
            discipline_score: null,
            followed_plan: null,
            deviation_notes: null,
            session_id: 'session-1',
            draft_status: 'pending',
            is_draft: true,
            draft_expires_at: '2026-02-10T21:05:00.000Z',
            is_open: false,
            enriched_at: null,
            share_count: 0,
            created_at: '2026-02-08T21:05:00.000Z',
            updated_at: '2026-02-08T21:05:00.000Z',
          }],
        }),
      })
      return
    }

    if (pathname === '/api/members/journal/analytics' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: SAMPLE_ANALYTICS }),
      })
      return
    }

    if (pathname.startsWith('/api/members/journal/drafts/') && pathname.endsWith('/confirm') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'draft-1' } }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
}

test.describe('Trade Journal Feature Flows', () => {
  test.beforeEach(async ({ page }) => {
    await enableMembersBypass(page)
    await setupJournalFeatureMocks(page)
  })

  test('renders journal feature panels and progressive entry flow', async ({ page }) => {
    await page.goto('/members/journal', { timeout: 30000 })

    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Open Positions' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'CSV Import Wizard' })).toBeVisible()

    await page.getByRole('button', { name: /Log/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Log Trade' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save & Add Details' })).toBeVisible()

    await page.getByRole('button', { name: 'Save & Add Details' }).click()
    await expect(page.getByText('Options Details')).toBeVisible()
    await expect(page.getByText('Psychology & Discipline')).toBeVisible()
  })

  test('supports contract type filtering and clear-all reset', async ({ page }) => {
    await page.goto('/members/journal', { timeout: 30000 })

    await page.getByRole('button', { name: /^call$/i }).first().click()
    await expect(page.getByRole('button', { name: /Type: call/i })).toBeVisible()

    await page.getByRole('button', { name: /Clear All/i }).click()
    await expect(page.getByRole('button', { name: /Type: call/i })).toHaveCount(0)
  })

  test('renders analytics dashboard with playbooks and behavioral insights', async ({ page }) => {
    await page.goto('/members/journal/analytics', { timeout: 30000 })

    await expect(page.getByRole('heading', { name: 'Journal Analytics', level: 1 })).toBeVisible()
    await expect(page.getByText('Win Rate', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Expectancy', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Risk' }).click()
    await expect(page.getByText('R-Multiple Distribution')).toBeVisible()
    await expect(page.getByText('ORB Breakout')).toBeVisible()
    await expect(page.getByText('Tilt Pattern Detected')).toBeVisible()
  })
})
