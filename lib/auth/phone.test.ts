import { describe, expect, it } from 'vitest'
import { normalizeEgyptPhone } from './phone'

describe('normalizeEgyptPhone', () => {
  it.each([
    ['01012345678', '+201012345678'],
    ['01112345678', '+201112345678'],
    ['01212345678', '+201212345678'],
    ['01512345678', '+201512345678'],
    ['1012345678', '+201012345678'],
    ['+20 10 1234 5678', '+201012345678'],
    ['0020-1012345678', '+201012345678'],
    ['(010) 1234-5678', '+201012345678'],
    ['٠١٠١٢٣٤٥٦٧٨', '+201012345678'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeEgyptPhone(input)).toBe(expected)
  })

  it.each([
    '',
    '0101234567', // too short
    '010123456789', // too long
    '01312345678', // 013 is not a mobile prefix
    '+966501234567', // not Egypt
    'abc',
  ])('rejects %s', (input) => {
    expect(normalizeEgyptPhone(input)).toBeNull()
  })
})
