import { describe, expect, it } from 'vitest'
import { isNetworkError } from './outbox'

describe('isNetworkError', () => {
  it('no signal counts as a network problem', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError({ message: 'TypeError: Load failed', code: '' })).toBe(true)
  })
  it('a refusal by the database is not (it must be shown, not retried)', () => {
    expect(isNetworkError({ message: 'new row violates row-level security policy', code: '42501' })).toBe(false)
    expect(isNetworkError({ message: 'value too long', code: '22001' })).toBe(false)
  })
})
