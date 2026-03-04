// Shared order domain logic for Terra Cart Admin
// UNIFIED sequential flow for both DINE_IN and TAKEAWAY
// Flow: Preparing → Ready → Served → Paid
// Legacy statuses are mapped forward to this simplified flow.

export const ORDER_SEQUENCE = {
	Pending: 'Preparing',
	Confirmed: 'Preparing',
	Accept: 'Preparing',
	Accepted: 'Preparing',
	Preparing: 'Ready',
	'Being Prepared': 'Ready',
	BeingPrepared: 'Ready',
	Ready: 'Served',
	Served: 'Paid',
	Completed: 'Paid',    // Legacy alias for Served
	Finalized: 'Paid',       // Legacy: keep for backward compat
	Paid: null,         // End of flow
	Cancelled: null,         // End of flow
	Returned: null,         // End of flow
	Exit: null,
};

const TERMINAL_STATUSES = new Set(['Paid', 'Cancelled', 'Returned', 'Exit']);

const STATUS_ALIASES = {
	NEW: 'Pending',
	PENDING: 'Pending',
	CONFIRMED: 'Confirmed',
	ACCEPT: 'Accept',
	ACCEPTED: 'Accepted',
	PREPARING: 'Preparing',
	'BEING PREPARED': 'Being Prepared',
	BEINGPREPARED: 'BeingPrepared',
	READY: 'Ready',
	SERVED: 'Served',
	COMPLETED: 'Served',
	FINALIZED: 'Finalized',
	PAID: 'Paid',
	CANCELLED: 'Cancelled',
	CANCELED: 'Cancelled',
	RETURNED: 'Returned',
	EXIT: 'Exit',
};

const toCanonicalStatus = (status) => {
	if (!status) return '';
	const trimmed = String(status).trim();
	if (!trimmed) return '';
	return STATUS_ALIASES[trimmed.toUpperCase()] || trimmed;
};

// Get next sequential status (unified for both service types)
export const getNextStatus = (currentStatus) => {
	const canonicalStatus = toCanonicalStatus(currentStatus);
	if (!canonicalStatus) return null;

	const nextStatus = ORDER_SEQUENCE[canonicalStatus];
	if (typeof nextStatus === 'string') return nextStatus;
	if (TERMINAL_STATUSES.has(canonicalStatus)) return null;

	// Fallback for unknown/legacy statuses: let operator move order into flow.
	return 'Preparing';
};

// Check if order can be cancelled (always available except for Paid/Cancelled)
export const canCancel = (status) => {
	const canonicalStatus = toCanonicalStatus(status);
	return !['Paid', 'Cancelled', 'Returned'].includes(canonicalStatus);
};

export const canReturn = (status) => toCanonicalStatus(status) === 'Paid';

// Full transitions for edit modal (backward compatibility)
// Unified transitions for both DINE_IN and TAKEAWAY
export const ORDER_TRANSITIONS = {
	Pending: ['Preparing', 'Confirmed', 'Cancelled'],
	Confirmed: ['Preparing', 'Cancelled'],
	Preparing: ['Ready', 'Cancelled'],
	Ready: ['Served', 'Cancelled'],
	Served: ['Paid', 'Cancelled'],
	Completed: ['Paid', 'Cancelled'],  // Legacy alias for Served
	Finalized: ['Paid', 'Cancelled'],     // Legacy
	Paid: ['Returned'],
	Cancelled: [],
	Returned: [],
	// Legacy takeaway statuses
	Accept: ['Preparing', 'Cancelled'],
	Accepted: ['Preparing', 'Cancelled'],
	'Being Prepared': ['Ready', 'Cancelled'],
	BeingPrepared: ['Ready', 'Cancelled'],
};

export const canAccept = () => false;
export const nextStatusOnAccept = 'Preparing';

// Takeaway: first-come-first-serve accept when Pending
export const canAcceptTakeaway = () => false;

// UNIFIED: getNextStatusTakeaway now uses the same logic as getNextStatus
// This ensures Takeaway behaves identically to Dine-In
export const getNextStatusTakeaway = (status) => getNextStatus(status);

