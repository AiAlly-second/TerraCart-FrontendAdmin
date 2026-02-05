# Deployment Checklist

## Pre-Deployment Checks

### 1. Environment Variables
- [ ] Create `.env` file with production values:
  ```
  VITE_NODE_API_URL=https://your-backend-url.com
  VITE_CUSTOMER_BASE_URL=https://your-customer-frontend-url.com
  ```
- [ ] Verify all environment variables are set (no localhost URLs in production)
- [ ] Test API connectivity with production backend

### 2. Build Configuration
- [ ] Run `npm run build` successfully
- [ ] Check for build warnings/errors
- [ ] Verify `dist/` folder is generated correctly
- [ ] Test production build locally: `npm run preview`

### 3. Code Quality
- [x] All console.log/error/warn wrapped in `import.meta.env.DEV` checks
- [x] No hardcoded localhost URLs (except fallbacks)
- [x] Error boundaries in place
- [ ] All async operations have error handling
- [ ] No commented-out code that should be removed

### 4. Runtime Issues
- [ ] Test all major user flows:
  - [ ] Login/Logout
  - [ ] Navigation between pages
  - [ ] API calls (purchases, inventory, recipes, menu items)
  - [ ] Form submissions
  - [ ] Data fetching and display
- [ ] Check browser console for errors
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test responsive design on mobile/tablet

### 5. Performance
- [ ] Check bundle size (should be reasonable)
- [ ] Verify code splitting is working
- [ ] Test page load times
- [ ] Check for memory leaks (long-running sessions)

### 6. Security
- [ ] Verify API endpoints use HTTPS in production
- [ ] Check CORS configuration on backend
- [ ] Verify authentication tokens are handled securely
- [ ] No sensitive data in client-side code

### 7. Deployment Platform Specific
#### For Vercel:
- [ ] `vercel.json` is configured correctly
- [ ] Environment variables set in Vercel dashboard
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`

#### For Netlify:
- [ ] `netlify.toml` configured (if needed)
- [ ] Environment variables set in Netlify dashboard
- [ ] Build command: `npm run build`
- [ ] Publish directory: `dist`

#### For Other Platforms:
- [ ] Configure build and output directory
- [ ] Set environment variables
- [ ] Configure routing (SPA fallback to index.html)

## Post-Deployment Checks

1. [ ] Verify site loads correctly
2. [ ] Test login functionality
3. [ ] Check API connectivity
4. [ ] Monitor error logs
5. [ ] Test critical user flows
6. [ ] Verify all features work as expected

## Common Issues to Watch For

1. **CORS Errors**: Ensure backend CORS allows your frontend domain
2. **API Timeouts**: Backend may need time to wake up (especially Render.com free tier)
3. **Environment Variables**: Must be set in deployment platform
4. **Routing Issues**: SPA routing requires fallback to index.html
5. **Socket.IO Connection**: May need proxy or CORS configuration

## Environment Variables Required

```bash
# Required
VITE_NODE_API_URL=https://your-backend-url.com

# Optional but recommended
VITE_CUSTOMER_BASE_URL=https://your-customer-frontend-url.com
VITE_USE_PROXY=false  # Set to false for production
VITE_FEATURE_COSTING_ENABLED=true
```




























