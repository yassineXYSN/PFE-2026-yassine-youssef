# Company Profile UI & Employee Count Enhancement

**Date:** 2026-06-04  
**Scope:** Fix UI overflow, add editable dropdowns in main content, store employee count

## Summary

Enhance the company profile page to:
- Fix sector/taille overflow in left sidebar
- Make sector/size editable with dropdowns in the main content area (not just sidebar)
- Add numeric employee count field to database
- Include employee count in company onboarding
- Ensure all edits sync across sidebar and main content

## Architecture

### Frontend Changes (CompanyProfile.jsx)

**State additions:**
- Add `employee_count: 0` to formData state

**Edit mode behavior:**
- Left sidebar: sector/size dropdowns (already implemented, keep as-is)
- Main content "Key Info" section: convert sector and size info cards to editable dropdowns when `isEditing=true`
- Both areas use the same formData values, so changes auto-sync
- Employee count: display as numeric field in a new info card in main content, only editable in edit mode

**Overflow fix (CSS):**
- Left sidebar sector/size badges: add `text-overflow: ellipsis`, `white-space: nowrap`, `overflow: hidden`
- Add `title` attribute to show full text on hover

**Display logic:**
- View mode: show sector/size/employee_count as read-only info cards
- Edit mode: sector/size become `<select>` with options, employee_count becomes `<input type="number">`

### Backend Changes (company.py)

**Model updates:**
- Add `employee_count: Optional[int] = None` to CompanyBase
- Add `employee_count: Optional[int] = None` to CompanyUpdate
- Existing `size` field remains for categories (e.g., "100-500 employés")

**API behavior:**
- PUT `/companies/{id}` accepts both `size` and `employee_count`
- Both fields are persisted independently

### Onboarding Changes (CompanyCreation.jsx)

**Minimal addition:**
- Add optional number input field for employee count after company name
- Field label: "Number of employees"
- Passes `employee_count` to company creation payload

## Data Flow

```
User edits sector/size → formData updates → both sidebar & main content reflect change
User enters employee_count → stored in formData → sent to API on save
API persists to MongoDB with both size (category) and employee_count (numeric)
```

## Error Handling

- Employee count: accept positive integers only, allow empty/null
- Sector/size: use predefined options, no free text
- On save failure: show error toast, keep form in edit mode

## Testing Checklist

- [ ] Left sidebar sector/size don't overflow (truncate with ellipsis)
- [ ] Hover shows full text
- [ ] Main content sector/size are editable dropdowns in edit mode
- [ ] Dropdowns match left sidebar options
- [ ] Changes in either area sync instantly
- [ ] Employee count field appears in main content
- [ ] Employee count saves to database
- [ ] Employee count appears in onboarding form
- [ ] Onboarding successfully creates company with employee_count

## Files to Modify

1. `frontend/src/apps/HR/profile/company/CompanyProfile.jsx` - add employee_count state, render edit mode for main content, fix CSS overflow
2. `frontend/src/apps/HR/profile/company/CompanyProfile.css` - add ellipsis classes for sidebar
3. `backend/models/company.py` - add employee_count field
4. `frontend/src/apps/HR/onboarding/CompanyCreation.jsx` - add employee_count input
