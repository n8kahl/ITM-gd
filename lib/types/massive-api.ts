import { z } from 'zod'

/**
 * Single OHLCV aggregate bar returned by Massive.com.
 */
export const MassiveBarSchema = z.object({
  t: z.number(),
  o: z.number(),
  h: z.number(),
  l: z.number(),
  c: z.number(),
  v: z.number(),
  vw: z.number().optional(),
  n: z.number().optional(),
})

/**
 * Aggregate bars response payload returned by Massive.com.
 */
export const MassiveAggsResponseSchema = z.object({
  ticker: z.string().optional(),
  adjusted: z.boolean().optional(),
  queryCount: z.number().optional(),
  resultsCount: z.number().optional(),
  status: z.string().optional(),
  request_id: z.string().optional(),
  results: z.array(MassiveBarSchema).default([]),
})

export type MassiveBar = z.infer<typeof MassiveBarSchema>
export type MassiveAggsResponse = z.infer<typeof MassiveAggsResponseSchema>
