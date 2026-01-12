# Franchises Page - Master-Detail Design Specification

## New Design Philosophy

**Problem with current design:**
- Expandable rows are cluttered
- Hard to manage carts
- Too much information crammed into one view

**New Design:**
- **Left Panel (60%):** Clean franchise table
- **Right Panel (40%):** Selected franchise's carts
- Click franchise → Shows its carts on the right
- Much cleaner separation of concerns

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Franchises Management                     │
├─────────────────────────────────┬───────────────────────────┤
│  FRANCHISES TABLE (60%)         │  FRANCHISE DETAILS (40%)  │
│                                 │                           │
│  □ Franchise Name   Status      │  📋 XYZ Franchise         │
│  □ ABC Franchise    Active      │                           │
│  □ DEF Franchise    Active   ◄──┼─ Click shows details     │
│  □ GHI Franchise    Inactive    │                           │
│                                 │  🏪 Carts (3):            │
│  [+ Add Franchise]              │  • Cart 1 - Active        │
│                                 │  • Cart 2 - Pending       │
│                                 │  • Cart 3 - Inactive      │
│                                 │                           │
│                                 │  [+ Add Cart]             │
└─────────────────────────────────┴───────────────────────────┘
```

## Features to Keep

✅ Stats cards at top  
✅ Filters (All/Active/Inactive)  
✅ Search  
✅ Sorting columns  
✅ Bulk selection  
✅ Modern table design  

## Features to Change

❌ Remove: Expandable rows  
❌ Remove: Tile/Card view toggle  
✅ Add: Side panel for selected franchise  
✅ Add: Cart management in side panel  
✅ Add: Smooth transitions  

## Implementation Approach

Since the current file is 3000+ lines, I'll create a **NEW** clean file:
- `FranchisesV2.jsx` - New master-detail design
- Keep old `Franchises.jsx` as backup
- You can switch the route when ready

## Benefits

1. **Cleaner UI** - One view, clear purpose
2. **Better UX** - Click to see details, not expand/collapse
3. **Easier Management** - All cart actions in dedicated panel
4. **More Scalable** - Easy to add more features to side panel
5. **Mobile Friendly** - Can stack panels vertically on mobile

Would you like me to create this new clean version?
