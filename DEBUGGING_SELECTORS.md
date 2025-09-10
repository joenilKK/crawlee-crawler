# Debugging Selectors for MEMC Website

## Current Issue
The crawler is returning 0 records because it can't find specialist links using the current selector.

## Quick Fix - Try These Selectors

Update your `src/config/local-config.js` file and try these selectors one by one:

### 1. URL-based selector (Most Reliable)
```javascript
specialistLinksSelector: 'a[href*="/specialist/"]',
```
This finds any link that contains "/specialist/" in the URL.

### 2. Common class-based selectors
```javascript
specialistLinksSelector: '.doctor-card a, .specialist-card a, .profile-card a',
```

### 3. Generic card selectors
```javascript
specialistLinksSelector: '.card a, .thumbnail a, a.thumbnail',
```

### 4. Broad fallback selector
```javascript
specialistLinksSelector: 'a[href*="specialist"], a[href*="doctor"]',
```

## How to Debug Manually

1. **Run the test script:**
   ```bash
   node quick-test.js
   ```
   This will open a browser and show you what links are found on the page.

2. **Manual browser inspection:**
   - Open https://www.memc.com.sg/specialist/ in your browser
   - Right-click on a specialist profile link
   - Select "Inspect Element"
   - Look at the HTML structure
   - Note the classes and structure around the link

3. **Common patterns to look for:**
   - Links inside cards: `.card a`, `.doctor-card a`
   - Links with specific classes: `a.profile-link`, `a.specialist-link`
   - Links containing keywords in URL: `a[href*="specialist"]`

## Expected HTML Patterns

The crawler is looking for HTML like this:

```html
<!-- Pattern 1: Card-based -->
<div class="specialist-card">
    <a href="/specialist/dr-john-doe">Dr. John Doe</a>
</div>

<!-- Pattern 2: Direct links -->
<a href="/specialist/dr-jane-smith" class="specialist-link">
    Dr. Jane Smith
</a>

<!-- Pattern 3: Thumbnail style -->
<a href="/specialist/dr-bob-wilson" class="thumbnail">
    <img src="photo.jpg">
    <span>Dr. Bob Wilson</span>
</a>
```

## Testing Your Selector

After updating the selector in `local-config.js`, run:
```bash
npm start
```

Look for these log messages:
- ✅ "Specialist links selector found!" = Good!
- ❌ "Selector timed out" = Selector doesn't match anything
- "Found X specialists" at the end = Success!

## Alternative Approach

If none of the selectors work, the website might be:
1. **JavaScript-heavy**: Content loads after page load
2. **Protected**: Requires login or specific headers
3. **Different structure**: Uses unusual HTML patterns

Try increasing the timeout and adding a longer wait:
```javascript
timeout: 30000, // 30 seconds
```

## Contact for Help

If you're still having issues, run `node quick-test.js` and share the output - it will show exactly what links are found on the page.
