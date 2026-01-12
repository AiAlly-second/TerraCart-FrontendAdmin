# Cart Details Page - Document Display Issue Fix

## Problem Identified

The `CartDetails.jsx` page shows cart information, but there's an issue with how document URLs are being handled. The current `getDocumentUrl` function (lines 216-222) is too simple and doesn't handle:

1. **Signed URLs** - Backend returns signed URLs with `?expires=` and `signature=` parameters
2. **S3 URLs** - When USE_S3=true, backend returns full S3 URLs starting with `https://`
3. **Path normalization** - Some paths might not start with `/`

## Current Code (BROKEN)
```javascript
const getDocumentUrl = (docPath) => {
  if (!docPath) return null;
  const nodeApiBase = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
  const baseUrl = nodeApiBase.replace(/\/$/, "");
  return `${baseUrl}${docPath}`;
};
```

## Fixed Code (PASTE THIS - Lines 216-232)
```javascript
const getDocumentUrl = (docPath) => {
  if (!docPath) return null;
  
  // If the path contains signed URL parameters or is already a full URL, use it directly
  if (docPath.includes('?expires=') || docPath.includes('signature=') || 
      docPath.startsWith('http://') || docPath.startsWith('https://')) {
    return docPath;
  }
  
  // Otherwise, construct the URL using the API base
  const nodeApiBase = import.meta.env.VITE_NODE_API_URL || "http://localhost:5001";
  const baseUrl = nodeApiBase.replace(/\/$/, "");
  
  // Ensure the path starts with /
  const normalizedPath = docPath.startsWith('/') ? docPath : `/${docPath}`;
  
  return `${baseUrl}${normalizedPath}`;
};
```

## Why This Fixes It

1. **Handles Signed URLs**: If backend returns `/api/files/secure/uploads/...?expires=...&signature=...`, it uses it directly
2. **Handles S3 URLs**: If backend returns `https://bucket.s3.amazonaws.com/...`, it uses it directly  
3. **Handles Regular Paths**: If it's just `/uploads/document.pdf`, it constructs the full URL
4. **Path Normalization**: Ensures paths always start with `/` before appending to base URL

## Testing

After applying the fix:

1. Navigate to a cart details page: `/carts/:id`
2. Check the "Owner Documents" section
3. Click "View Document →" links
4. Documents should now open correctly whether they are:
   - Signed secured URLs
   - S3 object URLs  
   - Regular local file paths

## Manual Fix Instructions

1. Open `admin/src/pages/CartDetails.jsx`
2. Find lines 216-222 (the current `getDocumentUrl` function)
3. Replace with the fixed code above
4. Save the file
5. The dev server will hot-reload automatically

The fix is backward compatible - works with all URL types!
