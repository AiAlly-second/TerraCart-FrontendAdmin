// Shared order domain logic for Terra Cart Admin
// Sequential flow - only show next step, not all options
export const ORDER_SEQUENCE = {
	Pending:   'Confirmed',
	Confirmed: 'Preparing',
	Preparing: 'Ready',
	Ready:     'Served', // For dine-in orders
	Served:    'Paid',
	Paid:      null, // End of flow
	Cancelled: null, // End of flow
	Returned:  null, // End of flow
	Finalized: 'Paid', // For existing orders
};

// Get next sequential status (only one option)
// For takeaway orders, skip "Served" and go directly from "Ready" to "Paid"
export const getNextStatus = (currentStatus, serviceType = 'DINE_IN') => {
	if (serviceType === 'TAKEAWAY' && currentStatus === 'Ready') {
		return 'Paid'; // Takeaway orders skip "Served"
	}
	return ORDER_SEQUENCE[currentStatus] || null;
};

// Check if order can be cancelled (always available except for Paid/Cancelled)
export const canCancel = (status) => {
	return status !== 'Paid' && status !== 'Cancelled' && status !== 'Returned';
};

export const canReturn = (status) => status === 'Paid';

// Full transitions for edit modal (backward compatibility)
export const ORDER_TRANSITIONS = {
	Pending:   ['Confirmed', 'Cancelled'],
	Confirmed: ['Preparing', 'Cancelled'],
	Preparing: ['Ready', 'Cancelled'],
	Ready:     ['Served', 'Cancelled'],
	Served:    ['Paid', 'Cancelled'],
	Finalized: ['Paid', 'Cancelled'],
	Paid:      ['Returned'],
	Cancelled: [],
	Returned:  [],
};

export const canAccept = (status) => status === 'Confirmed';
export const nextStatusOnAccept = 'Preparing';

// Takeaway: first-come-first-serve accept when Pending
export const canAcceptTakeaway = (status) => status === 'Pending';

// Takeaway flow: Pending -> Accepted -> Being Prepared -> Completed -> Paid
export const getNextStatusTakeaway = (status) => {
  const map = {
    Pending: 'Accepted',      // via accept API, not direct status change
    Accepted: 'Being Prepared',
    'Being Prepared': 'Completed',
    BeingPrepared: 'Completed',
    Completed: 'Paid',
    Paid: null,
    Cancelled: null,
    Returned: null,
  };
  return map[status] || null;
};
