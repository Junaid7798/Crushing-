import { useMemo } from 'react'
import { useDB } from '../contexts/DBContext.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { formatMoney } from '../helpers.js'

/**
 * ReportsScreen - Executive Financial Analysis & P&L.
 */
export default function ReportsScreen() {
  const { db } = useDB()
  const { currentUser } = useAuth()

  // ── DATE RANGE FILTER (last 90 days) ──────────────────
  const ninetyDaysAgo = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  }, [])

  // ── DATA AGGREGATION ────────────────────────────────
  const { result: transactions } = useRxQuery(
    db?.transactions.find({
      selector: { 
        business_id: currentUser?.business_id,
        date: { $gte: ninetyDaysAgo }
      },
      sort: [{ date: 'desc' }]
    }), 
    { live: true }
  )
  const { result: lines } = useRxQuery(
    db?.transaction_lines.find({ 
      selector: { 
        business_id: currentUser?.business_id,
        created_at: { $gte: ninetyDaysAgo }
      }
    }), 
    { live: true }
  )
  const { result: expenses } = useRxQuery(
    db?.expenses.find({ 
      selector: { 
        business_id: currentUser?.business_id,
        date: { $gte: ninetyDaysAgo }
      }
    }), 
    { live: true }
  )
  const { result: parties } = useRxQuery(
    db?.parties.find({ selector: { business_id: currentUser?.business_id } }), 
    { live: true }
  )

  const financialStats = useMemo(() => {
    if (!transactions || !lines) return null

    // 1. Net Sales
    const totalSales = transactions
      .filter(t => t.tx_type === 'sale')
      .reduce((sum, t) => sum + t.total, 0)

    // 2. COGS (Cost of Goods Sold)
    const saleTxIds = new Set(transactions.filter(t => t.tx_type === 'sale').map(t => t.id))
    const totalCogs = lines
      .filter(l => saleTxIds.has(l.transaction_id))
      .reduce((sum, l) => sum + (l.qty * (l.cost_price || 0)), 0)

    // 3. Operating Expenses
    const totalExpenses = (expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0)

    // 4. Receivables & Payables
    const receivables = (parties || []).filter(p => p.balance < 0).reduce((sum, p) => sum + Math.abs(p.balance), 0)
    const payables = (parties || []).filter(p => p.balance > 0).reduce((sum, p) => sum + p.balance, 0)

    // Derived Metrics
    const grossProfit = totalSales - totalCogs
    const netProfit = grossProfit - totalExpenses
    const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0

    return {
      totalSales, totalCogs, totalExpenses,
      grossProfit, netProfit, grossMargin,
      receivables, payables
    }
  }, [transactions, lines, expenses, parties])

  if (!financialStats) return (
    <div style={s.loading}>
      <div style={s.spinner}>Computing Ledger Insights...</div>
    </div>
  )

  const { totalSales, totalCogs, totalExpenses, grossProfit, netProfit, grossMargin, receivables, payables } = financialStats

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div>
           <h1 style={s.title}>Executive Analysis</h1>
           <p style={s.subTitle}>Real-time Financial Integrity Reports</p>
        </div>
        <div style={s.dateTag}>90D Fiscal Period</div>
      </header>

      <div style={s.body}>
        {/* P&L Statement Card */}
        <section style={s.section}>
          <div style={s.card}>
            <div style={s.cardHeader}>
               <h2 style={s.cardTitle}>Statement of Profit & Loss</h2>
               <div style={s.marginPill}>Gross Margin: {grossMargin.toFixed(1)}%</div>
            </div>
            
            <div style={s.pnlGrid}>
              <div style={s.pnlRow}>
                <span style={s.pnlLabel}>Gross Operating Revenue (Sales)</span>
                <span style={s.pnlVal}>{formatMoney(totalSales)}</span>
              </div>
              <div style={s.pnlRow}>
                <span style={s.pnlLabel}>Inventory Cost of Sales (COGS)</span>
                <span style={{ ...s.pnlVal, color: 'var(--red)' }}>- {formatMoney(totalCogs)}</span>
              </div>
              
              <div style={s.divider} />
              
              <div style={s.pnlRow}>
                <span style={{ ...s.pnlLabel, fontWeight: 800, color: 'var(--text)' }}>Gross Operating Profit</span>
                <span style={{ ...s.pnlVal, fontWeight: 800 }}>{formatMoney(grossProfit)}</span>
              </div>
              
              <div style={s.pnlRow}>
                <span style={s.pnlLabel}>General & Admin Expenses</span>
                <span style={{ ...s.pnlVal, color: 'var(--red)' }}>- {formatMoney(totalExpenses)}</span>
              </div>
              
              <div style={{ ...s.pnlResult, background: netProfit >= 0 ? 'var(--teal-dim)' : 'var(--red-dim)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>Net Fiscal Position</span>
                  <span style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'var(--mono)', letterSpacing: '-0.03em' }}>{formatMoney(netProfit)}</span>
                </div>
                <div style={s.profitStatus}>{netProfit >= 0 ? 'SURPLUS' : 'DEFICIT'}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Balance Sheet Summary */}
        <section style={s.section}>
           <div style={s.gridRow}>
              <div style={s.smallCard}>
                 <span style={s.cardLabel}>Market Receivables</span>
                 <span style={{ ...s.statVal, color: 'var(--teal)' }}>{formatMoney(receivables)}</span>
                 <p style={s.cardHint}>Asset Liquidity Locked in Credit</p>
              </div>
              <div style={s.smallCard}>
                 <span style={s.cardLabel}>Supplier Payables</span>
                 <span style={{ ...s.statVal, color: 'var(--red)' }}>{formatMoney(payables)}</span>
                 <p style={s.cardHint}>Outstanding Liability Exposure</p>
              </div>
           </div>
        </section>

        {/* Future Insights Placeholder */}
        <div style={s.insightBox}>
           <div style={{ fontSize: '20px', marginBottom: '8px' }}>🤖 AI Financial Advisor</div>
           <p style={{ fontSize: '13px', opacity: 0.8, lineHeight: 1.5 }}>
             Your COGS is <b>{totalSales > 0 ? ((totalCogs/totalSales)*100).toFixed(1) : '0.0'}%</b> of revenue. {totalSales > 0 ? `Reducing this by 2% would add ${formatMoney(totalSales * 0.02)} to your monthly net profit.` : ''}
             {totalSales > 0 ? ' Consider renegotiating supplier terms for high-volume items.' : 'No sales data available for analysis.'}
           </p>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: { padding: '32px', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  title: { fontSize: '24px', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: '4px' },
  dateTag: { padding: '10px 20px', background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', borderRadius: '24px', fontSize: '11px', fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.05em' },

  body: { flex: 1, padding: '40px', overflowY: 'auto' },
  section: { marginBottom: '40px' },
  card: { background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderRadius: '32px', border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: 'var(--glass-shadow)' },
  cardHeader: { padding: '28px 36px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' },
  marginPill: { background: 'rgba(0,0,0,0.3)', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, border: '1px solid var(--glass-border)', color: 'var(--amber)' },
  
  pnlGrid: { padding: '36px' },
  pnlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pnlLabel: { fontSize: '14px', color: 'var(--text2)', fontWeight: 600 },
  pnlVal: { fontSize: '18px', fontWeight: 800, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' },
  divider: { height: '1px', background: 'var(--glass-border)', margin: '24px 0' },
  
  pnlResult: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', padding: '24px 32px', borderRadius: '24px', border: '1px solid var(--glass-border)' },
  profitStatus: { padding: '6px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em' },

  gridRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' },
  smallCard: { background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderRadius: '32px', padding: '32px', border: '1px solid var(--glass-border)', boxShadow: 'var(--glass-shadow)' },
  cardLabel: { fontSize: '12px', color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' },
  statVal: { display: 'block', fontSize: '32px', fontWeight: 900, margin: '16px 0', fontFamily: 'var(--mono)', letterSpacing: '-0.04em' },
  cardHint: { fontSize: '11px', color: 'var(--text3)', fontWeight: 600, opacity: 0.6 },

  insightBox: { padding: '32px', background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', borderRadius: '32px', color: 'var(--text)' },
  loading: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  spinner: { fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--mono)', letterSpacing: '0.1em' },
}
