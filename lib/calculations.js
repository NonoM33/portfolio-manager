/**
 * Portfolio Manager - Core Calculation Logic
 * All business logic is pure functions for easy testing
 */

/**
 * Calculate the entry ratio for a new investor
 * This captures the portfolio performance at the moment they join
 * @param {number} totalCapital - Current total capital
 * @param {number} initialCapital - Current initial capital (sum of all investments)
 * @returns {number} Entry ratio (1.0 if no existing portfolio)
 */
function calculateEntryRatio(totalCapital, initialCapital) {
  if (initialCapital <= 0) return 1.0
  return totalCapital / initialCapital
}

/**
 * Calculate current portfolio performance ratio
 * @param {number} totalCapital - Current total capital
 * @param {number} initialCapital - Initial capital
 * @returns {number} Current ratio
 */
function calculateCurrentRatio(totalCapital, initialCapital) {
  if (initialCapital <= 0) return 1.0
  return totalCapital / initialCapital
}

/**
 * Calculate an investor's current value based on their entry ratio
 * @param {number} capital - Investor's invested capital
 * @param {number} entryRatio - Ratio at time of investment
 * @param {number} currentRatio - Current portfolio ratio
 * @returns {number} Current value of investment
 */
function calculateCurrentValue(capital, entryRatio, currentRatio) {
  if (entryRatio <= 0) return capital
  const performanceSinceEntry = currentRatio / entryRatio
  return capital * performanceSinceEntry
}

/**
 * Calculate an investor's gains (can be negative for losses)
 * @param {number} capital - Investor's invested capital
 * @param {number} currentValue - Current value of investment
 * @returns {number} Gains (positive) or losses (negative)
 */
function calculateGains(capital, currentValue) {
  return currentValue - capital
}

/**
 * Calculate commission available for an investor
 * Commission is only on positive gains
 * Special case: trader (0% commission) can reinvest 100% of their gains
 * @param {number} gains - Investor's gains
 * @param {number} commissionRate - Commission rate as percentage (e.g., 50 for 50%)
 * @returns {number} Available commission (0 if no gains)
 */
function calculateCommission(gains, commissionRate) {
  if (gains <= 0) return 0
  if (commissionRate > 100) commissionRate = 100
  // Special case: trader with 0% commission can reinvest 100% of gains
  if (commissionRate <= 0) return gains
  return gains * (commissionRate / 100)
}

/**
 * Calculate all financial metrics for an investor
 * @param {Object} investor - Investor object with capital, entryRatio, commissionRate
 * @param {number} totalCapital - Current total portfolio capital
 * @param {number} initialCapital - Total initial capital
 * @returns {Object} Calculated metrics
 */
function calculateInvestorMetrics(investor, totalCapital, initialCapital) {
  const currentRatio = calculateCurrentRatio(totalCapital, initialCapital)
  const entryRatio = investor.entryRatio || 1.0
  const currentValue = calculateCurrentValue(investor.capital, entryRatio, currentRatio)
  const gains = calculateGains(investor.capital, currentValue)
  const commission = calculateCommission(gains, investor.commissionRate || 0)
  const share = initialCapital > 0 ? (investor.capital / initialCapital) * 100 : 0
  
  return {
    currentRatio,
    entryRatio,
    currentValue: roundToCents(currentValue),
    gains: roundToCents(gains),
    commission: roundToCents(commission),
    share: roundToPercent(share),
  }
}

/**
 * Calculate metrics for multiple investors (batch)
 * Uses snapshot values - order doesn't affect results
 * @param {Array} investors - Array of investor objects
 * @param {number} totalCapital - Current total portfolio capital
 * @param {number} initialCapital - Total initial capital
 * @returns {Object} Map of investorId -> metrics
 */
function calculateBatchMetrics(investors, totalCapital, initialCapital) {
  const results = {}
  for (const investor of investors) {
    results[investor.id] = {
      ...calculateInvestorMetrics(investor, totalCapital, initialCapital),
      name: investor.name,
      capital: investor.capital,
    }
  }
  return results
}

/**
 * Validate reinvestment amounts against available commissions
 * @param {Array} reinvestments - Array of {investorId, amount}
 * @param {Object} metricsMap - Map of investorId -> metrics (from calculateBatchMetrics)
 * @returns {Object} {valid: boolean, errors: Array, validated: Array}
 */
function validateReinvestments(reinvestments, metricsMap) {
  const errors = []
  const validated = []
  
  for (const r of reinvestments) {
    const metrics = metricsMap[r.investorId]
    
    if (!metrics) {
      errors.push({ investorId: r.investorId, error: 'Investor not found' })
      continue
    }
    
    const amount = r.amount !== undefined ? r.amount : metrics.commission
    const maxAmount = metrics.commission
    
    // Allow small tolerance for rounding
    if (amount > maxAmount + 0.01) {
      errors.push({
        investorId: r.investorId,
        name: metrics.name,
        error: `Cannot reinvest ${amount}€, max is ${maxAmount}€`,
        requested: amount,
        max: maxAmount,
      })
      continue
    }
    
    if (amount > 0) {
      validated.push({
        investorId: r.investorId,
        name: metrics.name,
        amount: roundToCents(Math.min(amount, maxAmount)),
        action: r.action || 'reinvest',
      })
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    validated,
  }
}

/**
 * Calculate new portfolio state after adding an investor
 * @param {number} currentTotal - Current total capital
 * @param {number} currentInitial - Current initial capital
 * @param {number} newInvestorCapital - New investor's capital
 * @returns {Object} New portfolio state
 */
function calculateStateAfterAddInvestor(currentTotal, currentInitial, newInvestorCapital) {
  return {
    totalCapital: currentTotal + newInvestorCapital,
    initialCapital: currentInitial + newInvestorCapital,
    entryRatio: calculateEntryRatio(currentTotal, currentInitial),
  }
}

/**
 * Calculate new portfolio state after reinvestment
 * @param {number} currentTotal - Current total capital
 * @param {number} currentInitial - Current initial capital
 * @param {number} reinvestAmount - Amount being reinvested
 * @returns {Object} New portfolio state
 */
function calculateStateAfterReinvest(currentTotal, currentInitial, reinvestAmount) {
  // Reinvestment increases initial capital but not total (money stays in portfolio)
  return {
    totalCapital: currentTotal,
    initialCapital: currentInitial + reinvestAmount,
  }
}

/**
 * Calculate new entry ratio for an investor after reinvestment/commission action
 * After taking commission (reinvest or withdraw), the investor "resets" their gains tracking
 * This ensures they don't get commission twice on the same gains
 * @param {number} totalCapital - Total portfolio capital
 * @param {number} newInitialCapital - Initial capital AFTER reinvestment is applied
 * @returns {number} New entry ratio (equals current ratio, so gains reset to 0)
 */
function calculateEntryRatioAfterReinvest(totalCapital, newInitialCapital) {
  // After commission action, entry ratio = current ratio
  // This resets the investor's gains to 0 (they've already claimed their commission)
  if (newInitialCapital <= 0) return 1.0
  return totalCapital / newInitialCapital
}

/**
 * Calculate new portfolio state after withdrawal
 * @param {number} currentTotal - Current total capital
 * @param {number} currentInitial - Current initial capital
 * @param {number} withdrawAmount - Amount being withdrawn
 * @returns {Object} New portfolio state
 */
function calculateStateAfterWithdraw(currentTotal, currentInitial, withdrawAmount) {
  // Withdrawal reduces total capital
  return {
    totalCapital: currentTotal - withdrawAmount,
    initialCapital: currentInitial,
  }
}

/**
 * Calculate new portfolio state after capital adjustment for an investor
 * @param {number} currentTotal - Current total capital
 * @param {number} currentInitial - Current initial capital
 * @param {number} oldCapital - Investor's old capital
 * @param {number} newCapital - Investor's new capital
 * @returns {Object} New portfolio state and capital diff
 */
function calculateStateAfterCapitalAdjustment(currentTotal, currentInitial, oldCapital, newCapital) {
  const capitalDiff = newCapital - oldCapital
  return {
    totalCapital: currentTotal, // Total doesn't change - it's a correction
    initialCapital: currentInitial + capitalDiff,
    capitalDiff,
  }
}

// Utility functions
function roundToCents(value) {
  return Math.round(value * 100) / 100
}

function roundToPercent(value) {
  return Math.round(value * 100) / 100
}

module.exports = {
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
  calculateEntryRatioAfterReinvest,
  roundToCents,
  roundToPercent,
}
