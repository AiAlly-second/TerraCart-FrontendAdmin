/**
 * Quick Integration Example: Add Auto-Print to Orders Page
 * 
 * This shows how to integrate automatic KOT printing when new orders are created
 */

// ============================================
// STEP 1: Import the auto-print utility
// ============================================

import { autoPrintKOT } from '../utils/networkPrinter';

// ============================================
// STEP 2: Add auto-print after KOT creation
// ============================================

// Example: In your handleConfirmOrder or similar function
const handleConfirmOrder = async () => {
  try {
    // Your existing order creation logic
    const response = await api.post('/orders', orderData);
    const newOrder = response.data;
    
    // Get the latest KOT
    const latestKOT = newOrder.kotLines[newOrder.kotLines.length - 1];
    const kotIndex = newOrder.kotLines.length - 1;
    
    // 🎯 AUTO-PRINT THE KOT
    const printResult = await autoPrintKOT(newOrder, latestKOT, kotIndex);
    
    if (printResult.success) {
      console.log('✅ KOT printed automatically to network printer');
      // Optional: Show success toast
      // toast.success('Order confirmed and KOT printed!');
    } else {
      console.warn('⚠️ Auto-print failed, falling back to browser print');
      // Fallback to existing browser print
      printKOT(newOrder, latestKOT, kotIndex);
    }
    
    // Continue with your existing logic
    // ...
    
  } catch (error) {
    console.error('Order creation error:', error);
  }
};

// ============================================
// STEP 3: (Optional) Add manual print button
// ============================================

import { printToNetworkPrinter } from '../utils/networkPrinter';

const handleManualPrint = async (order, kot, kotIndex) => {
  // Get printer settings from localStorage
  const adminUser = JSON.parse(localStorage.getItem('adminUser'));
  
  if (!adminUser?.printerSettings?.enabled) {
    alert('Network printing is disabled. Enable it in Settings.');
    return;
  }
  
  const { ip, port } = adminUser.printerSettings;
  
  // Send to network printer
  const result = await printToNetworkPrinter(order, kot, kotIndex, ip, port);
  
  if (result.success) {
    alert('✅ KOT sent to printer successfully!');
  } else {
    alert(`❌ Print failed: ${result.error}\n\nFalling back to browser print...`);
    // Fallback to browser print
    printKOT(order, kot, kotIndex);
  }
};

// ============================================
// EXAMPLE: Full Integration in Orders.jsx
// ============================================

/*
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { printKOT } from '../utils/kotPrinter'; // Existing browser print
import { autoPrintKOT } from '../utils/networkPrinter'; // NEW: Network auto-print

const Orders = () => {
  const [orders, setOrders] = useState([]);
  
  // When creating a new order
  const createOrder = async (orderData) => {
    try {
      const response = await api.post('/orders', orderData);
      const newOrder = response.data;
      
      // Get latest KOT
      const kotLines = newOrder.kotLines || [];
      if (kotLines.length > 0) {
        const latestKOT = kotLines[kotLines.length - 1];
        const kotIndex = kotLines.length - 1;
        
        // 🎯 AUTO-PRINT
        const printResult = await autoPrintKOT(newOrder, latestKOT, kotIndex);
        
        if (!printResult.success) {
          // Fallback to browser print if network print fails
          console.warn('Network print failed, using browser print');
          printKOT(newOrder, latestKOT, kotIndex);
        }
      }
      
      // Update state
      setOrders([...orders, newOrder]);
      
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };
  
  return (
    <div>
      {/* Your existing UI *\/}
    </div>
  );
};

export default Orders;
*/

// ============================================
// TESTING
// ============================================

/*
1. Configure printer IP in Settings → Printer Config
2. Enable "Local Printing"
3. Click "Test Print" to verify
4. Create a new order
5. KOT should print automatically!

If it doesn't print:
- Check browser console for errors
- Verify printer IP is correct
- Ensure printer is ON and connected
- Check backend logs for connection errors
*/
