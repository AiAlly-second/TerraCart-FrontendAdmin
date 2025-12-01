import React from 'react';

const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange, className = '' }) => {
  return (
    <div className={`flex flex-col md:flex-row gap-4 ${className}`}>
      <div className="flex-1">
        <label className="block text-sm font-medium text-[#6b4423] mb-1">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
        />
      </div>
      <div className="flex-1">
        <label className="block text-sm font-medium text-[#6b4423] mb-1">End Date</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d86d2a]"
        />
      </div>
    </div>
  );
};

export default DateRangePicker;

