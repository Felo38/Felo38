import { describe, expect, it } from 'vitest'
import { addToCart, cartCount, MAX_QUANTITY, parseCart, setQuantity } from './cart'

describe('cart', () => {
  it('starts a cart for a branch', () => {
    const c = addToCart(null, 'otr-cornich', 'latte')
    expect(c).toEqual({ branchSlug: 'otr-cornich', lines: [{ productId: 'latte', quantity: 1 }] })
  })

  it('adds one more of an existing item', () => {
    let c = addToCart(null, 'otr-cornich', 'latte')
    c = addToCart(c, 'otr-cornich', 'latte')
    expect(c.lines).toEqual([{ productId: 'latte', quantity: 2 }])
    expect(cartCount(c)).toBe(2)
  })

  it('caps quantity per line', () => {
    let c = addToCart(null, 'otr-cornich', 'latte')
    for (let i = 0; i < MAX_QUANTITY + 5; i++) c = addToCart(c, 'otr-cornich', 'latte')
    expect(c.lines[0].quantity).toBe(MAX_QUANTITY)
  })

  it('drops items from another branch when the branch changes', () => {
    const c = addToCart(addToCart(null, 'otr-cornich', 'latte'), 'otr-dokki', 'espresso')
    expect(c).toEqual({ branchSlug: 'otr-dokki', lines: [{ productId: 'espresso', quantity: 1 }] })
  })

  it('removes a line when quantity drops to zero', () => {
    const c = setQuantity(addToCart(null, 'otr-cornich', 'latte'), 'latte', 0)
    expect(c.lines).toEqual([])
  })

  it('ignores corrupt stored data', () => {
    expect(parseCart('not json')).toBeNull()
    expect(parseCart(JSON.stringify({ branchSlug: 1, lines: [] }))).toBeNull()
    expect(parseCart(JSON.stringify({ branchSlug: 'x', lines: [{ productId: 'a', quantity: -1 }] }))).toEqual({
      branchSlug: 'x',
      lines: [],
    })
  })
})
