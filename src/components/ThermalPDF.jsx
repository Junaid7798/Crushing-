import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// Use system fonts for offline-first PDF generation
// This ensures PDFs can be generated without network connectivity

// Thermal 80mm is approx 226pt wide. 
const styles = StyleSheet.create({
  page: {
    padding: 10,
    fontFamily: 'Helvetica', // System font - available offline
    fontSize: 9,
    color: '#000',
    width: 226,
  },
  title: { fontSize: 14, fontWeight: 700, textAlign: 'center', marginBottom: 2 },
  subTitle: { fontSize: 8, textAlign: 'center', marginBottom: 10 },
  
  hr: { borderBottom: 1, borderColor: '#000', borderStyle: 'dashed', marginVertical: 6 },
  
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2, fontSize: 8 },
  
  tableHeader: { flexDirection: 'row', borderBottom: 1, borderColor: '#000', paddingVertical: 4, fontWeight: 700 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, alignItems: 'center' },
  
  colDesc: { width: '55%' },
  colQty: { width: '15%', textAlign: 'center' },
  colTotal: { width: '30%', textAlign: 'right' },
  
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, fontWeight: 700, fontSize: 11 },
  
  footer: { marginTop: 20, textAlign: 'center', fontSize: 8 },
});

/**
 * ThermalPDF - 80mm Receipt Template
 * High-contrast, narrow layout for POS printers.
 */
export const ThermalPDF = ({ transaction, party, items, config }) => {
  const formatMoney = (val) => '₹' + (val || 0).toLocaleString('en-IN');

  return (
    <Document title={`Receipt-${transaction.id.slice(0, 8)}`}>
      <Page size={{ width: 226 }} style={styles.page}>
        <Text style={styles.title}>{config.business_name || 'Business OS'}</Text>
        <Text style={styles.subTitle}>{config.address || 'Cash Receipt'}</Text>
        
        <View style={styles.hr} />
        
        <View style={styles.metaRow}><Text>Bill #:</Text><Text>{transaction.id.slice(0, 8).toUpperCase()}</Text></View>
        <View style={styles.metaRow}><Text>Date:</Text><Text>{new Date(transaction.date).toLocaleDateString('en-IN')}</Text></View>
        <View style={styles.metaRow}><Text>Party:</Text><Text>{party?.name || 'Cash Item'}</Text></View>

        <View style={styles.hr} />

        <View style={styles.tableHeader}>
          <Text style={styles.colDesc}>ITEM</Text>
          <Text style={styles.colQty}>QTY</Text>
          <Text style={styles.colTotal}>TOTAL</Text>
        </View>

        {items.map((item, idx) => (
          <View key={idx} style={styles.tableRow} wrap={false}>
            <Text style={styles.colDesc}>{item.item_name}</Text>
            <Text style={styles.colQty}>{item.qty} {item.unit || ''}</Text>
            <Text style={styles.colTotal}>{formatMoney(item.line_total)}</Text>
          </View>
        ))}

        <View style={styles.hr} />

        <View style={styles.summaryRow}><Text>Subtotal:</Text><Text>{formatMoney(transaction.total)}</Text></View>
        <View style={styles.summaryRow}><Text>Tax:</Text><Text>{formatMoney(transaction.gst_amount)}</Text></View>
        <View style={styles.totalRow}><Text>TOTAL:</Text><Text>{formatMoney(transaction.total)}</Text></View>
        
        <View style={styles.hr} />

        <View style={styles.summaryRow}><Text>Paid:</Text><Text>{formatMoney(transaction.paid_amount)}</Text></View>
        {transaction.balance_due > 0 && (
          <View style={styles.summaryRow}><Text style={{ fontWeight: 700 }}>Due:</Text><Text style={{ fontWeight: 700 }}>{formatMoney(transaction.balance_due)}</Text></View>
        )}

        <Text style={styles.footer}>*** Thank You! ***</Text>
        <Text style={styles.footer}>Visit Again</Text>
      </Page>
    </Document>
  );
};
