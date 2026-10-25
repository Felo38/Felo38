import { describe, expect, it } from 'vitest'
import { ACTIVE_STATUSES, ORDER_STATUSES, STAFF_MOVES } from './status'

describe('order status map', () => {
  it('covers every status', () => {
    expect(Object.keys(STAFF_MOVES).sort()).toEqual([...ORDER_STATUSES].sort())
  })

  it('has no move out of a final status', () => {
    expect(STAFF_MOVES.picked_up).toEqual([])
    expect(STAFF_MOVES.rejected).toEqual([])
    expect(STAFF_MOVES.cancelled).toEqual([])
  })

  it('never lets a branch skip preparing', () => {
    expect(STAFF_MOVES.pending).not.toContain('ready')
    expect(STAFF_MOVES.pending).not.toContain('picked_up')
  })

  it('lists only open statuses on the dashboard', () => {
    expect(ACTIVE_STATUSES).not.toContain('picked_up')
    expect(ACTIVE_STATUSES).not.toContain('rejected')
  })
})
