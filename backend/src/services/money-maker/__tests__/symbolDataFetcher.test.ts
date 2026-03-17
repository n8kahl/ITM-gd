import { fetchSymbolBars, fetchAllSymbolData } from '../symbolDataFetcher'
import { massiveClient } from '../../../config/massive'

jest.mock('../../../config/massive', () => ({
    massiveConfig: {
        baseUrl: 'https://api.massive.com',
        apiKey: 'test-key'
    },
    massiveClient: {
        get: jest.fn()
    }
}))

describe('SymbolDataFetcher', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('fetchSymbolBars', () => {
        const mockMassiveBar = {
            t: 1678455000000,
            o: 250.0,
            h: 255.0,
            l: 249.0,
            c: 252.0,
            v: 10000
        }

        it('should map Massive bars to internal CandleBar array', async () => {
            ; (massiveClient.get as jest.Mock).mockResolvedValue({
                data: {
                    results: [mockMassiveBar]
                }
            })

            const bars = await fetchSymbolBars({ symbol: 'TSLA', timeframe: '5Min' })

            expect(bars).toHaveLength(1)
            expect(bars[0]).toEqual({
                timestamp: 1678455000000,
                open: 250.0,
                high: 255.0,
                low: 249.0,
                close: 252.0,
                volume: 10000
            })

            expect(massiveClient.get).toHaveBeenCalledWith(
                expect.stringContaining('/v2/aggs/ticker/TSLA/range/5/minute/'),
                expect.objectContaining({
                    params: { adjusted: true, sort: 'desc', limit: 500 }
                })
            )
        })

        it('should return empty array on API error', async () => {
            ; (massiveClient.get as jest.Mock).mockRejectedValue(new Error('API Error'))
            const bars = await fetchSymbolBars({ symbol: 'TSLA', timeframe: '5Min' })
            expect(bars).toEqual([])
        })
    })

    describe('fetchAllSymbolData', () => {
        it('should fetch multiple timeframes for multiple symbols', async () => {
            ; (massiveClient.get as jest.Mock).mockResolvedValue({
                data: { results: [] }
            })

            const results = await fetchAllSymbolData(['SPY', 'TSLA'])

            expect(results).toHaveProperty('SPY')
            expect(results).toHaveProperty('TSLA')

            expect(results['SPY']).toHaveProperty('5Min')
            expect(results['SPY']).toHaveProperty('10Min')
            expect(results['SPY']).toHaveProperty('2Min')
            expect(results['SPY']).toHaveProperty('1H')
            expect(results['SPY']).toHaveProperty('1D')

            // 2 symbols * 5 timeframes = 10 calls
            expect(massiveClient.get).toHaveBeenCalledTimes(10)
        })
    })
})
