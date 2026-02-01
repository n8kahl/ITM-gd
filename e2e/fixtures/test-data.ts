import { faker } from '@faker-js/faker'

export function generateMockJournalEntry() {
  const isWinner = faker.datatype.boolean()
  return {
    id: faker.string.uuid(),
    user_id: faker.string.uuid(),
    trade_date: faker.date.recent({ days: 30 }).toISOString().split('T')[0],
    symbol: faker.helpers.arrayElement(['SPX', 'TSLA', 'AAPL', 'NVDA', 'QQQ']),
    trade_type: faker.helpers.arrayElement(['long', 'short', 'call', 'put']),
    entry_price: parseFloat(faker.finance.amount({ min: 100, max: 500 })),
    exit_price: parseFloat(faker.finance.amount({ min: 100, max: 500 })),
    profit_loss: isWinner
      ? parseFloat(faker.finance.amount({ min: 50, max: 500 }))
      : -parseFloat(faker.finance.amount({ min: 50, max: 300 })),
    is_winner: isWinner,
    setup_notes: faker.lorem.sentence(),
    created_at: faker.date.recent().toISOString(),
  }
}

export function generateMockCourse() {
  return {
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    description: faker.lorem.paragraph(),
    slug: faker.helpers.slugify(faker.commerce.productName()).toLowerCase(),
    thumbnail_url: faker.image.url(),
    is_published: true,
    display_order: faker.number.int({ min: 1, max: 10 }),
    discord_role_required: faker.helpers.arrayElement([null, 'core_sniper', 'pro_sniper']),
    lessons: [],
  }
}

export function generateMockRoleMapping() {
  return {
    discord_role_id: faker.string.numeric(18),
    discord_role_name: faker.helpers.arrayElement(['Core Sniper', 'Pro Sniper', 'Executive Sniper']),
    permission_ids: [faker.string.uuid()],
    mapping_ids: [faker.string.uuid()],
  }
}

export function generateMockSetting(key: string, masked = false) {
  return {
    key,
    value: masked ? '••••••••••••' : faker.string.alphanumeric(20),
    description: faker.lorem.sentence(),
    is_masked: masked,
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
  }
}
