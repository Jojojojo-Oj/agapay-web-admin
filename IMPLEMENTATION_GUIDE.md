# Implementation Guide - Clean Architecture for Incidents & Applicants

## Quick Start

### 1. Service Layer Pattern
All data operations are now abstracted into service modules:

```javascript
// Before: Component directly imports Firestore
import { db } from "../services/firebase";
import { collection, onSnapshot } from "firebase/firestore";

// After: Component imports from service
import { subscribeToIncidents } from "../services/incidentsService";
```

### 2. Automatic Sorting (Ascending Order)
Both services now return data sorted by timestamp/creation date:

```javascript
// In incidentsService.js
.sort((a, b) => {
  const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
  const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
  return timeA - timeB;  // Ascending order
});
```

### 3. Filtering Architecture
Unified filter functions for consistent behavior:

```javascript
// Incidents filtering
const filteredReports = filterIncidents(
  reports,
  search,
  disasterTypeFilter,
  statusFilter
);

// Applicants filtering
const filteredUsers = filterUsers(users, search, statusFilter);
```

## Component Usage Examples

### Incidents Component
```javascript
// State management
const [reports, setReports] = useState([]);
const [search, setSearch] = useState("");
const [disasterTypeFilter, setDisasterTypeFilter] = useState("all");
const [statusFilter, setStatusFilter] = useState("all");

// Subscribe to real-time data with automatic sorting
useEffect(() => {
  const unsub = subscribeToIncidents((data) => {
    // data is already sorted in ascending order
    setReports(data);
  });
  return () => unsub();
}, []);

// Apply all filters using memoization
const filteredReports = useMemo(() => {
  return filterIncidents(reports, search, disasterTypeFilter, statusFilter);
}, [reports, search, disasterTypeFilter, statusFilter]);

// Update status through service
const handleStatusChange = async (reportId, newStatus) => {
  try {
    await updateIncidentStatus(reportId, newStatus);
    // Success handling
  } catch (err) {
    // Error handling
  }
};
```

### Applicants Component
```javascript
// Similar pattern with users
const [users, setUsers] = useState([]);
const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState("all");

useEffect(() => {
  const unsub = subscribeToUsers((data) => {
    // Already sorted in ascending order by createdAt
    setUsers(data);
  });
  return () => unsub();
}, []);

const filteredUsers = useMemo(() => {
  return filterUsers(users, search, statusFilter);
}, [users, search, statusFilter]);
```

## Styling Approach

### CSS Classes (Instead of Inline Styles)
```javascript
// Before: Inline styles
<button style={approveBtn}>Approve</button>

// After: CSS classes
<button className="btn-publish">Publish</button>
```

### Status Badges with Color Coding
```javascript
<span className={`badge badge-${r.status || "pending"}`}>
  {r.status || "pending"}
</span>
```

CSS in incidents.css:
```css
.badge-pending { background: #fef3c7; color: #92400e; }
.badge-active { background: #dcfce7; color: #166534; }
.badge-rejected { background: #fee2e2; color: #991b1b; }
```

## Filter Implementation Details

### 1. Disaster Type Filter (Incidents Only)
- Dynamically populated from unique values in data
- Uses `getDisasterTypes()` service function

```javascript
const disasterTypes = useMemo(() => getDisasterTypes(reports), [reports]);

// Render dropdown
<select value={disasterTypeFilter} onChange={(e) => setDisasterTypeFilter(e.target.value)}>
  <option value="all">All Disaster Types</option>
  {disasterTypes.map((type) => (
    <option key={type} value={type}>{type}</option>
  ))}
</select>
```

### 2. Status Filter (Both Components)
- Fixed options: "all", "pending", "active"/"approved", "rejected"
- Consistent across components

### 3. Search Filter
- Matches across multiple fields
- Case-insensitive
- Implemented in service's filter functions

## Performance Optimizations

### useMemo for Filtered Data
```javascript
const filteredReports = useMemo(() => {
  return filterIncidents(reports, search, disasterTypeFilter, statusFilter);
}, [reports, search, disasterTypeFilter, statusFilter]);
```
- Prevents unnecessary recalculations
- Only recalculates when dependencies change

### Unsubscribe on Unmount
```javascript
useEffect(() => {
  const unsub = subscribeToIncidents((data) => {
    setReports(data);
  });
  return () => unsub();  // Clean up listener
}, []);
```

## Testing the Implementation

### 1. Verify Filters Work
- Add new incidents/applicants
- Check they appear in correct sort order
- Test each filter independently
- Test filter combinations

### 2. Verify Status Updates
- Click Publish/Approve button
- Confirm dialog appears
- Check status updates in real-time
- Verify Firestore reflects changes

### 3. Verify Sorting
- Add multiple entries
- Check they appear in ascending chronological order
- Oldest entries should appear first

## Future Enhancements

- Add date range filter
- Add sorting by column headers (click to sort)
- Add bulk actions (select multiple, update all)
- Add export to CSV functionality
- Add advanced search with regex
- Add pagination for large datasets

## Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `src/services/incidentsService.js` | New | Incidents business logic |
| `src/services/applicantsService.js` | New | Applicants business logic |
| `src/styles/incidents.css` | New | Incidents styling |
| `src/pages/Incidents.js` | Modified | Refactored component |
| `src/pages/Applicant.js` | Modified | Refactored component |

## Troubleshooting

### Data Not Sorting
- Verify Firestore has `timestamp` (incidents) or `createdAt` (applicants) field
- Check `subscribeToIncidents()`/`subscribeToUsers()` sort logic
- Ensure field values are valid dates

### Filters Not Working
- Check filter dropdown values match data values exactly
- Verify `filterIncidents()`/`filterUsers()` is receiving correct parameters
- Check console for errors

### Styles Not Applied
- Verify CSS file is imported in component
- Check for conflicting CSS rules
- Check class names match between JSX and CSS
