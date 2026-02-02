// BEFORE: Component without translations
import React, { useState } from 'react';
import { FaSave, FaTrash, FaEdit } from 'react-icons/fa';

const OrdersPageBefore = () => {
  const [orders, setOrders] = useState([]);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      
      <button className="btn-primary mb-4">
        New Order
      </button>
      
      <table className="w-full">
        <thead>
          <tr>
            <th>Order Number</th>
            <th>Table Number</th>
            <th>Status</th>
            <th>Total Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td>#{order.number}</td>
              <td>{order.table}</td>
              <td>
                {order.status === 'pending' && 'Pending'}
                {order.status === 'preparing' && 'Preparing'}
                {order.status === 'ready' && 'Ready'}
              </td>
              <td>₹{order.total}</td>
              <td>
                <button title="Edit">
                  <FaEdit /> Edit
                </button>
                <button title="Delete">
                  <FaTrash /> Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// AFTER: Component WITH translations
// ============================================

import React, { useState } from 'react';
import { FaSave, FaTrash, FaEdit } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext'; // ← Add this

const OrdersPageAfter = () => {
  const { t } = useLanguage(); // ← Add this
  const [orders, setOrders] = useState([]);
  
  return (
    <div className="p-6">
      {/* Replace hardcoded text with t('key') */}
      <h1 className="text-2xl font-bold mb-4">
        {t('orders')}
      </h1>
      
      <button className="btn-primary mb-4">
        {t('newOrder')}
      </button>
      
      <table className="w-full">
        <thead>
          <tr>
            <th>{t('orderNumber')}</th>
            <th>{t('tableNumber')}</th>
            <th>{t('orderStatus')}</th>
            <th>{t('totalAmount')}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td>#{order.number}</td>
              <td>{order.table}</td>
              <td>
                {/* Translate status */}
                {t(order.status)}
              </td>
              <td>₹{order.total}</td>
              <td>
                <button title={t('edit')}>
                  <FaEdit /> {t('edit')}
                </button>
                <button title={t('delete')}>
                  <FaTrash /> {t('delete')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export { OrdersPageBefore, OrdersPageAfter };
