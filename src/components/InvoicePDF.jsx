import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

// Use system fonts for offline-first PDF generation
// This ensures PDFs can be generated without network connectivity
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica', // System font - available offline
    fontSize: 10,
    color: '#333',
    lineHeight: 1.5
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: 1,
    borderColor: '#eee',
    paddingBottom: 20
  },
  bizName: { fontSize: 18, fontWeight: 700, color: '#000', marginBottom: 4 },
  bizInfo: { fontSize: 9, color: '#666' },
  
  invBadge: {
    textAlign: 'right'
  },
  invTitle: { fontSize: 16, fontWeight: 700, textTransform: 'uppercase', color: '#B45309' }, // Amber-700
  invMeta: { fontSize: 9, color: '#666', marginTop: 2 },

  partyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30
  },
  partyBox: { width: '45%' },
  sectionLabel: { fontSize: 8, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  partyName: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  partyInfo: { fontSize: 9, color: '#444' },

  table: { marginTop: 10 },
  tableHeader: {
    flexDirection: 'row',
    background: '#f8f8f8',
    borderBottom: 1,
    borderColor: '#eee',
    padding: '8 10',
    fontWeight: 700,
    fontSize: 9,
    color: '#666'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderColor: '#eee',
    padding: '8 10',
    fontSize: 9,
    alignItems: 'center'
  },
  colNo: { width: '8%' },
  colDesc: { width: '47%' },
  colQty: { width: '10%', textAlign: 'center' },
  colRate: { width: '15%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right', fontWeight: 700 },

  footerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40
  },
  notesBox: { width: '50%' },
  summaryBox: { width: '40%' },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: 1,
    borderColor: '#f9f9f9'
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: '10 0',
    borderTop: 2,
    borderColor: '#000',
    fontWeight: 700,
    fontSize: 12
  },
  paidContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    color: '#059669' // Teal-600
  },
  dueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    color: '#DC2626' // Red-600
  },

  stamp: {
    marginTop: 60,
    paddingTop: 10,
    borderTop: 1,
    borderColor: '#eee',
    fontSize: 8,
    color: '#999',
    textAlign: 'center'
  }
});

/**
 * InvoicePDF - A4 Professional Invoice Template
 * Supports GST details, itemized totals, and outstanding balances.
 */
export const InvoicePDF = ({ transaction, party, items, config }) => {
  const formatMoney = (val) => '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* TOP HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.bizName}>{config.business_name}</Text>
            <Text style={styles.bizInfo}>{config.address}</Text>
            <Text style={styles.bizInfo}>GSTIN: {config.gstin || 'N/A'}</Text>
            <Text style={styles.bizInfo}>Ph: {config.phone || 'N/A'}</Text>
          </View>
          <View style={styles.invBadge}>
            <Text style={styles.invTitle}>{transaction.doc_type || 'Tax Invoice'}</Text>
            <Text style={styles.invMeta}>Invoice #: {transaction.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.invMeta}>Date: {new Date(transaction.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            <Text style={styles.invMeta}>Time: {new Date(transaction.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>

        {/* BILLING INFO */}
        <View style={styles.partyGrid}>
          <View style={styles.partyBox}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.partyName}>{party?.name || 'Cash Customer'}</Text>
            <Text style={styles.partyInfo}>{party?.address || 'No address provided'}</Text>
            <Text style={styles.partyInfo}>GST: {party?.gstin || 'Unregistered'}</Text>
            <Text style={styles.partyInfo}>Ph: {party?.phone || 'N/A'}</Text>
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.sectionLabel}>Ship From</Text>
            <Text style={styles.partyName}>Main Warehouse</Text>
            <Text style={styles.partyInfo}>Location ID: {transaction.location_id || 'Default'}</Text>
            <Text style={styles.partyInfo}>Channel: {transaction.sale_channel || 'Retail'}</Text>
          </View>
        </View>

        {/* ITEM TABLE */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colNo}>#</Text>
            <Text style={styles.colDesc}>DESCRIPTION</Text>
            <Text style={styles.colQty}>QTY</Text>
            <Text style={styles.colRate}>RATE</Text>
            <Text style={styles.colTotal}>TOTAL</Text>
          </View>

          {items.map((item, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <Text style={styles.colNo}>{index + 1}</Text>
              <Text style={styles.colDesc}>{item.item_name}</Text>
              <Text style={styles.colQty}>{item.qty} {item.unit || ''}</Text>
              <Text style={styles.colRate}>{formatMoney(item.unit_price)}</Text>
              <Text style={styles.colTotal}>{formatMoney(item.line_total)}</Text>
            </View>
          ))}
        </View>

        {/* FOOTER & SUMMARY */}
        <View style={styles.footerGrid}>
          <View style={styles.notesBox}>
            <Text style={styles.sectionLabel}>Terms & Notes</Text>
            <Text style={styles.partyInfo}>{transaction.notes || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.\n3. Payment due upon receipt.'}</Text>
          </View>
          
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.bizInfo}>Subtotal</Text>
              <Text style={styles.bizInfo}>{formatMoney(transaction.subtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.bizInfo}>Tax (GST Inc.)</Text>
              <Text style={styles.bizInfo}>{formatMoney(transaction.gst_amount)}</Text>
            </View>
            
            <View style={styles.totalContainer}>
              <Text>TOTAL AMOUNT</Text>
              <Text>{formatMoney(transaction.total)}</Text>
            </View>

            <View style={styles.paidContainer}>
              <Text style={{ fontSize: 9 }}>Amount Paid</Text>
              <Text style={{ fontSize: 9 }}>{formatMoney(transaction.paid_amount)}</Text>
            </View>

            {transaction.balance_due > 0 && (
              <View style={styles.dueContainer}>
                <Text style={{ fontSize: 9, fontWeight: 700 }}>Balance Due</Text>
                <Text style={{ fontSize: 9, fontWeight: 700 }}>{formatMoney(transaction.balance_due)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* METADATA */}
        <View style={styles.stamp}>
          <Text>This is a computer-generated document. No signature required.</Text>
          <Text style={{ marginTop: 2 }}>Generated via Business OS Core Engine</Text>
        </View>
      </Page>
    </Document>
  );
};
