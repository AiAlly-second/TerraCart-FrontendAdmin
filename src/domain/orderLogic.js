// Shared order domain logic for Terra Cart Admin
// UNIFIED sequential flow for both DINE_IN and TAKEAWAY
// Flow: Pending → Confirmed → Preparing → Ready → Completed → Paid

export const ORDER_SEQUENCE = {
	Pending: 'Confirmed',
	Confirmed: 'Preparing',
	Preparing: 'Ready',
	Ready: 'Completed',  // Unified: both dine-in and takeaway go to Completed
	Completed: 'Paid',
	Served: 'Paid',       // Legacy dine-in: treat as Completed
	Finalized: 'Paid',       // Legacy: keep for backward compat
	Paid: null,         // End of flow
	Cancelled: null,         // End of flow
	Returned: null,         // End of flow
	// Legacy takeaway statuses - map to unified flow
	Accepted: 'Preparing',  // Accepted → Preparing (same as Confirmed → Preparing)
	'Being Prepared': 'Ready',
	BeingPrepared: 'Ready',
	Exit: null,
};

// Get next sequential status (unified for both service types)
export const getNextStatus = (currentStatus, serviceType = 'DINE_IN') => {
	// For legacy dine-in orders that use "Served", allow transition to Paid
	if (currentStatus === 'Served') {
		return 'Paid';
	}
	return ORDER_SEQUENCE[currentStatus] || null;
};

// Check if order can be cancelled (always available except for Paid/Cancelled)
export const canCancel = (status) => {
	return status !== 'Paid' && status !== 'Cancelled' && status !== 'Returned';
};

export const canReturn = (status) => status === 'Paid';

// Full transitions for edit modal (backward compatibility)
// Unified transitions for both DINE_IN and TAKEAWAY
export const ORDER_TRANSITIONS = {
	Pending: ['Confirmed', 'Cancelled'],
	Confirmed: ['Preparing', 'Cancelled'],
	Preparing: ['Ready', 'Cancelled'],
	Ready: ['Completed', 'Cancelled'],
	Completed: ['Paid', 'Cancelled'],
	Served: ['Paid', 'Cancelled'],     // Legacy
	Finalized: ['Paid', 'Cancelled'],     // Legacy
	Paid: ['Returned'],
	Cancelled: [],
	Returned: [],
	// Legacy takeaway statuses
	Accepted: ['Preparing', 'Being Prepared', 'Cancelled'],
	'Being Prepared': ['Ready', 'Completed', 'Cancelled'],
	BeingPrepared: ['Ready', 'Completed', 'Cancelled'],
};

export const canAccept = (status) => status === 'Confirmed';
export const nextStatusOnAccept = 'Preparing';

// Takeaway: first-come-first-serve accept when Pending
export const canAcceptTakeaway = (status) => status === 'Pending';

// UNIFIED: getNextStatusTakeaway now uses the same logic as getNextStatus
// This ensures Takeaway behaves identically to Dine-In
export const getNextStatusTakeaway = (status) => {
	// Map legacy takeaway statuses to unified flow
	const legacyMap = {
		Pending: null,            // Pending → use Accept button, not status change
		Accepted: 'Preparing',    // For orders that used Accept flow
		'Being Prepared': 'Ready',
		BeingPrepared: 'Ready',
		// Unified flow statuses
		Confirmed: 'Preparing',
		Preparing: 'Ready',
		Ready: 'Completed',
		Completed: 'Paid',
		Served: 'Paid',
		Finalized: 'Paid',
		Paid: null,
		Cancelled: null,
		Returned: null,
	};
	return legacyMap[status] || null;
};

