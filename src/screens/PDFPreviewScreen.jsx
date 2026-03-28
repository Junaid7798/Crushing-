import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PDFViewer, PDFDownloadLink, BlobProvider } from '@react-pdf/renderer'
import { useDB } from '../contexts/DBContext.jsx'
import { useRxQuery } from '../hooks/useRxQuery.js'
import { useConfig } from '../hooks/useConfig.js'
import { useToast } from '../components/ui/Toast.jsx'
import { InvoicePDF } from '../components/InvoicePDF.jsx'
import { ThermalPDF } from '../components/ThermalPDF.jsx'

/**
 * PDFPreviewScreen - Screen to view and download/print transaction invoices.
 * Supports A4 Invoice and Thermal Receipt formats.
 */
export default function PDFPreviewScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { db } = useDB()
  const { config } = useConfig()
  const toast = useToast()

  const [pdfType, setPdfType] = useState('invoice') // 'invoice' | 'thermal'

  // Fetch Transaction
  const { result: transaction, loading: txLoading } = useRxQuery(
    db?.transactions.findOne(id),
    { live: true, isDoc: true }
  )

  // Fetch Items
  const { result: items, loading: itemsLoading } = useRxQuery(
    db?.transaction_lines.find({ selector: { transaction_id: id } }),
    { live: true }
  )

  // Fetch Party - handle null party_id properly
  const { result: party, loading: partyLoading } = useRxQuery(
    transaction?.party_id ? db?.parties.findOne(transaction.party_id) : null,
    { live: true, isDoc: true }
  )

  const loading = txLoading || itemsLoading || partyLoading

  if (loading) return <div style={s.loading}>Loading Preview Engine...</div>
  if (!transaction) return <div style={s.error}>Transaction not found.</div>

  const PDFTemplate = pdfType === 'invoice' ? InvoicePDF : ThermalPDF

  return (
    <div style={s.root}>
      {/* Topbar */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <button style={s.backBtn} onClick={() => navigate(-1)}>←</button>
          <div style={s.titleBox}>
            <h1 style={s.title}>Invoice #{transaction.id.slice(0, 8).toUpperCase()}</h1>
            <p style={s.subTitle}>{party?.name || 'Cash Customer'} • ₹{transaction.total.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div style={s.headerRight}>
           <div style={s.toggle}>
              <button style={{ ...s.toggleBtn, ...(pdfType === 'invoice' ? s.toggleActive : {}) }} onClick={() => setPdfType('invoice')}>A4 Invoice</button>
              <button style={{ ...s.toggleBtn, ...(pdfType === 'thermal' ? s.toggleActive : {}) }} onClick={() => setPdfType('thermal')}>POS Receipt</button>
           </div>
           
           <PDFDownloadLink 
              document={<PDFTemplate transaction={transaction} party={party} items={items} config={config} />} 
              fileName={`${pdfType}-${transaction.id.slice(0, 8)}.pdf`}
              style={s.downloadBtn}
           >
             {({ loading }) => (loading ? 'Generating...' : 'Download PDF')}
           </PDFDownloadLink>
        </div>
      </header>

      {/* Preview Container */}
      <div style={s.viewerContainer}>
        <PDFViewer style={s.viewer} showToolbar={false}>
           <PDFTemplate transaction={transaction} party={party} items={items} config={config} />
        </PDFViewer>
      </div>

      {/* Share Actions Overlay */}
      <div style={s.actions}>
         <button style={s.actionBtn} onClick={() => toast.addToast('Native printing available in Tauri desktop build.', 'info')}>🖨️ Print Native</button>
         <button style={{ ...s.actionBtn, background: 'var(--teal-dim)', color: 'var(--teal)' }} onClick={() => {
           if (navigator.share) {
             navigator.share({ title: `Invoice #${transaction.id.slice(0,8)}`, text: `Invoice from ${config.business_name}` }).catch(() => {})
           } else {
             toast.addToast('Web Share API not available. Use the download button.', 'info')
           }
         }}>📱 Share via WhatsApp</button>
      </div>
    </div>
  )
}

const s = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  header: { padding: '20px 24px', background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { width: '42px', height: '42px', borderRadius: '14px', background: 'var(--glass-highlight)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text)' },
  titleBox: { display: 'flex', flexDirection: 'column' },
  title: { fontSize: '15px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' },
  subTitle: { fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginTop: '2px' },

  headerRight: { display: 'flex', alignItems: 'center', gap: '24px' },
  toggle: { display: 'flex', background: 'var(--glass-highlight)', padding: '4px', borderRadius: '14px', border: '1px solid var(--glass-border)' },
  toggleBtn: { padding: '10px 18px', fontSize: '12px', borderRadius: '10px', color: 'var(--text3)', border: 'none', transition: 'all 0.2s', cursor: 'pointer', fontWeight: 600 },
  toggleActive: { background: 'var(--bg)', color: 'var(--amber)', fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' },
  
  downloadBtn: { textDecoration: 'none', background: 'var(--grad-amber)', color: '#000', padding: '12px 24px', borderRadius: '14px', fontSize: '13px', fontWeight: 800, boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)', border: 'none' },

  viewerContainer: { flex: 1, padding: '24px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', overflow: 'hidden' },
  viewer: { width: '100%', height: '100%', border: 'none', borderRadius: '20px', boxShadow: 'var(--glass-shadow)' },

  actions: { 
    position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)', 
    display: 'flex', gap: '16px', padding: '16px', borderRadius: '24px', 
    background: 'var(--glass)', backdropFilter: 'var(--glass-blur)', border: '1px solid var(--glass-border)',
    boxShadow: 'var(--glass-shadow)', zIndex: 100
  },
  actionBtn: { padding: '14px 28px', borderRadius: '14px', border: '1px solid var(--glass-border)', background: 'var(--glass-highlight)', color: 'var(--text)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' },

  loading: { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: '12px', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 },
  error: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', fontSize: '16px', fontWeight: 800 },
}
