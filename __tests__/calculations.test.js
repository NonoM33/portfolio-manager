const {
  calculateEntryRatio,
  calculateCurrentRatio,
  calculateCurrentValue,
  calculateGains,
  calculateCommission,
  calculateInvestorMetrics,
  calculateBatchMetrics,
  validateReinvestments,
  calculateStateAfterAddInvestor,
  calculateStateAfterReinvest,
  calculateStateAfterWithdraw,
  calculateStateAfterCapitalAdjustment,
  roundToCents,
  roundToPercent,
} = require('../lib/calculations')

describe('Portfolio Manager Calculations', () => {
  
  // ==========================================
  // ENTRY RATIO TESTS
  // ==========================================
  describe('calculateEntryRatio', () => {
    test('returns 1.0 when initialCapital is 0', () => {
      expect(calculateEntryRatio(0, 0)).toBe(1.0)
      expect(calculateEntryRatio(1000, 0)).toBe(1.0)
    })

    test('returns 1.0 when initialCapital is negative', () => {
      expect(calculateEntryRatio(1000, -100)).toBe(1.0)
    })

    test('calculates correct ratio when portfolio has gains', () => {
      // Portfolio grew from 10000 to 11000 (10% gain)
      expect(calculateEntryRatio(11000, 10000)).toBe(1.1)
    })

    test('calculates correct ratio when portfolio has losses', () => {
      // Portfolio dropped from 10000 to 9000 (10% loss)
      expect(calculateEntryRatio(9000, 10000)).toBe(0.9)
    })

    test('returns 1.0 when no gains or losses', () => {
      expect(calculateEntryRatio(10000, 10000)).toBe(1.0)
    })
  })

  // ==========================================
  // CURRENT RATIO TESTS
  // ==========================================
  describe('calculateCurrentRatio', () => {
    test('returns 1.0 when initialCapital is 0', () => {
      expect(calculateCurrentRatio(0, 0)).toBe(1.0)
    })

    test('returns 1.0 when initialCapital is negative', () => {
      expect(calculateCurrentRatio(1000, -100)).toBe(1.0)
    })

    test('calculates correct positive ratio', () => {
      expect(calculateCurrentRatio(12000, 10000)).toBe(1.2)
    })

    test('calculates correct ratio below 1', () => {
      expect(calculateCurrentRatio(8000, 10000)).toBe(0.8)
    })
  })

  // ==========================================
  // CURRENT VALUE TESTS
  // ==========================================
  describe('calculateCurrentValue', () => {
    test('returns capital when entryRatio is 0', () => {
      expect(calculateCurrentValue(1000, 0, 1.2)).toBe(1000)
    })

    test('returns capital when entryRatio is negative', () => {
      expect(calculateCurrentValue(1000, -1, 1.2)).toBe(1000)
    })

    test('returns capital when entry and current ratio are equal (no change)', () => {
      expect(calculateCurrentValue(1000, 1.0, 1.0)).toBe(1000)
    })

    test('calculates gain when portfolio grew after entry', () => {
      // Entered at ratio 1.0, now at 1.2 (20% gain since entry)
      expect(calculateCurrentValue(1000, 1.0, 1.2)).toBe(1200)
    })

    test('calculates loss when portfolio dropped after entry', () => {
      // Entered at ratio 1.0, now at 0.8 (20% loss since entry)
      expect(calculateCurrentValue(1000, 1.0, 0.8)).toBe(800)
    })

    test('new investor gets no inherited gains', () => {
      // Investor joined when ratio was 1.5, now it's 1.5 (no change since entry)
      expect(calculateCurrentValue(1000, 1.5, 1.5)).toBe(1000)
    })

    test('new investor gains only from performance after entry', () => {
      // Joined at ratio 1.5, now at 1.8 (20% gain since entry, not overall)
      expect(calculateCurrentValue(1000, 1.5, 1.8)).toBe(1200)
    })

    test('handles fractional ratios correctly', () => {
      expect(calculateCurrentValue(1000, 1.1, 1.21)).toBeCloseTo(1100, 2)
    })
  })

  // ==========================================
  // GAINS TESTS
  // ==========================================
  describe('calculateGains', () => {
    test('calculates positive gains', () => {
      expect(calculateGains(1000, 1200)).toBe(200)
    })

    test('calculates negative gains (losses)', () => {
      expect(calculateGains(1000, 800)).toBe(-200)
    })

    test('returns 0 when no change', () => {
      expect(calculateGains(1000, 1000)).toBe(0)
    })

    test('handles zero capital', () => {
      expect(calculateGains(0, 0)).toBe(0)
    })
  })

  // ==========================================
  // COMMISSION TESTS
  // ==========================================
  describe('calculateCommission', () => {
    test('returns 0 when gains are 0', () => {
      expect(calculateCommission(0, 50)).toBe(0)
    })

    test('returns 0 when gains are negative', () => {
      expect(calculateCommission(-100, 50)).toBe(0)
    })

    test('returns 0 when commission rate is 0', () => {
      expect(calculateCommission(200, 0)).toBe(0)
    })

    test('returns 0 when commission rate is negative', () => {
      expect(calculateCommission(200, -10)).toBe(0)
    })

    test('calculates 50% commission correctly', () => {
      expect(calculateCommission(200, 50)).toBe(100)
    })

    test('calculates 55% commission correctly', () => {
      expect(calculateCommission(200, 55)).toBeCloseTo(110, 2)
    })

    test('calculates 100% commission correctly', () => {
      expect(calculateCommission(200, 100)).toBe(200)
    })

    test('caps commission rate at 100%', () => {
      expect(calculateCommission(200, 150)).toBe(200)
    })

    test('handles small gains', () => {
      expect(calculateCommission(0.50, 50)).toBe(0.25)
    })
  })

  // ==========================================
  // INVESTOR METRICS TESTS
  // ==========================================
  describe('calculateInvestorMetrics', () => {
    test('calculates metrics for investor with gains', () => {
      const investor = { capital: 1000, entryRatio: 1.0, commissionRate: 50 }
      const metrics = calculateInvestorMetrics(investor, 12000, 10000)
      
      expect(metrics.currentRatio).toBe(1.2)
      expect(metrics.entryRatio).toBe(1.0)
      expect(metrics.currentValue).toBe(1200)
      expect(metrics.gains).toBe(200)
      expect(metrics.commission).toBe(100)
    })

    test('calculates metrics for investor with losses', () => {
      const investor = { capital: 1000, entryRatio: 1.0, commissionRate: 50 }
      const metrics = calculateInvestorMetrics(investor, 8000, 10000)
      
      expect(metrics.currentValue).toBe(800)
      expect(metrics.gains).toBe(-200)
      expect(metrics.commission).toBe(0) // No commission on losses
    })

    test('calculates metrics for new investor (no inherited gains)', () => {
      // Portfolio already at 20% profit, new investor joins
      const investor = { capital: 1000, entryRatio: 1.2, commissionRate: 50 }
      const metrics = calculateInvestorMetrics(investor, 12000, 10000)
      
      expect(metrics.currentValue).toBe(1000) // No change since entry
      expect(metrics.gains).toBe(0)
      expect(metrics.commission).toBe(0)
    })

    test('calculates metrics for investor with 0% commission rate', () => {
      const investor = { capital: 1000, entryRatio: 1.0, commissionRate: 0 }
      const metrics = calculateInvestorMetrics(investor, 12000, 10000)
      
      expect(metrics.gains).toBe(200)
      expect(metrics.commission).toBe(0) // 0% commission = owner/trader
    })

    test('handles missing entryRatio (defaults to 1.0)', () => {
      const investor = { capital: 1000, commissionRate: 50 }
      const metrics = calculateInvestorMetrics(investor, 12000, 10000)
      
      expect(metrics.entryRatio).toBe(1.0)
      expect(metrics.currentValue).toBe(1200)
    })

    test('handles missing commissionRate (defaults to 0)', () => {
      const investor = { capital: 1000, entryRatio: 1.0 }
      const metrics = calculateInvestorMetrics(investor, 12000, 10000)
      
      expect(metrics.commission).toBe(0)
    })

    test('calculates share percentage correctly', () => {
      const investor = { capital: 2000, entryRatio: 1.0, commissionRate: 50 }
      const metrics = calculateInvestorMetrics(investor, 12000, 10000)
      
      expect(metrics.share).toBe(20) // 2000/10000 = 20%
    })

    test('returns 0 share when initialCapital is 0', () => {
      const investor = { capital: 1000, entryRatio: 1.0, commissionRate: 50 }
      const metrics = calculateInvestorMetrics(investor, 0, 0)
      
      expect(metrics.share).toBe(0)
    })
  })

  // ==========================================
  // BATCH METRICS TESTS
  // ==========================================
  describe('calculateBatchMetrics', () => {
    test('calculates metrics for multiple investors', () => {
      const investors = [
        { id: 'a', name: 'Alice', capital: 5000, entryRatio: 1.0, commissionRate: 50 },
        { id: 'b', name: 'Bob', capital: 5000, entryRatio: 1.0, commissionRate: 50 },
      ]
      // Total=12000, Initial=10000 -> ratio=1.2 -> 20% gain since entry
      // Each investor: 5000 * 1.2 = 6000 value, 1000 gains, 500 commission
      const metrics = calculateBatchMetrics(investors, 12000, 10000)
      
      expect(metrics['a'].gains).toBe(1000)
      expect(metrics['b'].gains).toBe(1000)
      expect(metrics['a'].commission).toBe(500)
      expect(metrics['b'].commission).toBe(500)
    })

    test('handles mixed entry ratios correctly', () => {
      const investors = [
        { id: 'old', name: 'Old', capital: 5000, entryRatio: 1.0, commissionRate: 50 },
        { id: 'new', name: 'New', capital: 5000, entryRatio: 1.2, commissionRate: 50 },
      ]
      // Current ratio = 12000/10000 = 1.2
      const metrics = calculateBatchMetrics(investors, 12000, 10000)
      
      // Old investor: entered at 1.0, now 1.2 -> 20% gain -> 5000*1.2=6000, gains=1000
      expect(metrics['old'].gains).toBe(1000)
      expect(metrics['old'].commission).toBe(500)
      
      // New investor: entered at 1.2, now 1.2 -> 0% gain since entry
      expect(metrics['new'].gains).toBe(0)
      expect(metrics['new'].commission).toBe(0)
    })

    test('includes name and capital in results', () => {
      const investors = [
        { id: 'a', name: 'Alice', capital: 1000, entryRatio: 1.0, commissionRate: 50 },
      ]
      const metrics = calculateBatchMetrics(investors, 11000, 10000)
      
      expect(metrics['a'].name).toBe('Alice')
      expect(metrics['a'].capital).toBe(1000)
    })
  })

  // ==========================================
  // VALIDATE REINVESTMENTS TESTS
  // ==========================================
  describe('validateReinvestments', () => {
    const metricsMap = {
      'a': { name: 'Alice', capital: 1000, commission: 100 },
      'b': { name: 'Bob', capital: 1000, commission: 50 },
    }

    test('validates correct reinvestment amounts', () => {
      const reinvestments = [
        { investorId: 'a', amount: 100 },
        { investorId: 'b', amount: 50 },
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.validated).toHaveLength(2)
    })

    test('rejects reinvestment exceeding available commission', () => {
      const reinvestments = [
        { investorId: 'a', amount: 150 }, // Max is 100
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].investorId).toBe('a')
    })

    test('allows small tolerance for rounding', () => {
      const reinvestments = [
        { investorId: 'a', amount: 100.005 }, // Just over 100, within tolerance
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.valid).toBe(true)
      expect(result.validated[0].amount).toBe(100) // Capped at max
    })

    test('rejects unknown investor', () => {
      const reinvestments = [
        { investorId: 'unknown', amount: 50 },
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.valid).toBe(false)
      expect(result.errors[0].error).toBe('Investor not found')
    })

    test('uses max commission when amount not specified', () => {
      const reinvestments = [
        { investorId: 'a' }, // No amount specified
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.valid).toBe(true)
      expect(result.validated[0].amount).toBe(100) // Uses max
    })

    test('skips zero amounts', () => {
      const reinvestments = [
        { investorId: 'a', amount: 0 },
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.valid).toBe(true)
      expect(result.validated).toHaveLength(0)
    })

    test('defaults action to reinvest', () => {
      const reinvestments = [
        { investorId: 'a', amount: 50 },
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.validated[0].action).toBe('reinvest')
    })

    test('preserves custom action', () => {
      const reinvestments = [
        { investorId: 'a', amount: 50, action: 'withdraw' },
      ]
      const result = validateReinvestments(reinvestments, metricsMap)
      
      expect(result.validated[0].action).toBe('withdraw')
    })
  })

  // ==========================================
  // STATE CHANGE TESTS
  // ==========================================
  describe('calculateStateAfterAddInvestor', () => {
    test('adds capital to both total and initial', () => {
      const result = calculateStateAfterAddInvestor(11000, 10000, 1000)
      
      expect(result.totalCapital).toBe(12000)
      expect(result.initialCapital).toBe(11000)
    })

    test('calculates correct entry ratio', () => {
      const result = calculateStateAfterAddInvestor(11000, 10000, 1000)
      
      expect(result.entryRatio).toBe(1.1) // 11000/10000
    })

    test('handles empty portfolio', () => {
      const result = calculateStateAfterAddInvestor(0, 0, 1000)
      
      expect(result.totalCapital).toBe(1000)
      expect(result.initialCapital).toBe(1000)
      expect(result.entryRatio).toBe(1.0)
    })
  })

  describe('calculateStateAfterReinvest', () => {
    test('increases initial but not total', () => {
      const result = calculateStateAfterReinvest(11000, 10000, 500)
      
      expect(result.totalCapital).toBe(11000) // Unchanged
      expect(result.initialCapital).toBe(10500) // Increased
    })
  })

  describe('calculateStateAfterWithdraw', () => {
    test('decreases total but not initial', () => {
      const result = calculateStateAfterWithdraw(11000, 10000, 500)
      
      expect(result.totalCapital).toBe(10500) // Decreased
      expect(result.initialCapital).toBe(10000) // Unchanged
    })
  })

  describe('calculateStateAfterCapitalAdjustment', () => {
    test('adjusts initial capital upward', () => {
      const result = calculateStateAfterCapitalAdjustment(11000, 10000, 1000, 1500)
      
      expect(result.totalCapital).toBe(11000) // Unchanged
      expect(result.initialCapital).toBe(10500) // +500
      expect(result.capitalDiff).toBe(500)
    })

    test('adjusts initial capital downward', () => {
      const result = calculateStateAfterCapitalAdjustment(11000, 10000, 1000, 700)
      
      expect(result.totalCapital).toBe(11000) // Unchanged
      expect(result.initialCapital).toBe(9700) // -300
      expect(result.capitalDiff).toBe(-300)
    })
  })

  // ==========================================
  // UTILITY TESTS
  // ==========================================
  describe('roundToCents', () => {
    test('rounds to 2 decimal places', () => {
      expect(roundToCents(100.456)).toBe(100.46)
      expect(roundToCents(100.454)).toBe(100.45)
      expect(roundToCents(100.455)).toBe(100.46) // Banker's rounding
    })
  })

  describe('roundToPercent', () => {
    test('rounds to 2 decimal places', () => {
      expect(roundToPercent(50.456)).toBe(50.46)
    })
  })

  // ==========================================
  // INTEGRATION SCENARIO TESTS
  // ==========================================
  describe('Integration Scenarios', () => {
    test('Scenario: Two investors same capital, same entry, same reinvest', () => {
      // This was the original bug - order of selection shouldn't matter
      const investors = [
        { id: 'a', name: 'Alice', capital: 1000, entryRatio: 1.0, commissionRate: 50 },
        { id: 'b', name: 'Bob', capital: 1000, entryRatio: 1.0, commissionRate: 50 },
      ]
      
      // Portfolio at 10% gain
      const metrics = calculateBatchMetrics(investors, 11000, 10000)
      
      // Both should have identical metrics
      expect(metrics['a'].gains).toBe(metrics['b'].gains)
      expect(metrics['a'].commission).toBe(metrics['b'].commission)
      expect(metrics['a'].currentValue).toBe(metrics['b'].currentValue)
    })

    test('Scenario: New investor joins profitable portfolio', () => {
      // Portfolio was at 20% gain (ratio 1.2)
      // New investor joins at this point (entryRatio = 1.2)
      // Portfolio stays flat - current ratio still 1.2
      
      const existingInvestor = { id: 'old', name: 'Old', capital: 1000, entryRatio: 1.0, commissionRate: 50 }
      const newInvestor = { id: 'new', name: 'New', capital: 1000, entryRatio: 1.2, commissionRate: 50 }
      
      // After new investor: total=13200, initial=11000 -> ratio=1.2 (same as entry)
      const metrics = calculateBatchMetrics(
        [existingInvestor, newInvestor],
        13200, // Current total
        11000  // Current initial (10000 + 1000 new)
      )
      
      // Old investor: entered at 1.0, now 1.2 -> 20% gain -> 200 gains
      expect(metrics['old'].gains).toBe(200)
      expect(metrics['old'].commission).toBe(100)
      
      // New investor: entered at 1.2, now 1.2 -> 0% gain since entry
      expect(metrics['new'].gains).toBe(0)
      expect(metrics['new'].commission).toBe(0)
    })

    test('Scenario: Investor modifies capital after creation', () => {
      // Initial state: total=10000, initial=10000
      // Investor has 1000 capital
      // Capital is adjusted to 1500
      
      const result = calculateStateAfterCapitalAdjustment(10000, 10000, 1000, 1500)
      
      expect(result.initialCapital).toBe(10500)
      expect(result.totalCapital).toBe(10000) // Total unchanged
    })
  })
})
