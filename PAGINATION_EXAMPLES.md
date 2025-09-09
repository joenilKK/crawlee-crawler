# Pagination Configuration Examples

This document shows how to configure different pagination URL structures for your crawler.

## Configuration Options

In your `config.js` file, you can configure pagination using the following options:

```javascript
pagination: {
    // Type of pagination: 'query' or 'path'
    type: 'query',
    // Pattern for query-based pagination (uses {page} placeholder)
    queryPattern: 'page={page}',
    // Pattern for path-based pagination (uses {page} placeholder)
    pathPattern: '/page/{page}/',
    // Base URL for pagination (if different from startUrl)
    baseUrl: null, // Uses startUrl by default
    // Starting page number (usually 1)
    startPage: 1
}
```

## Example Configurations

### 1. Query Parameter Pagination (Default)

For URLs like: `https://example.com/specialists/?page=2`

```javascript
pagination: {
    type: 'query',
    queryPattern: 'page={page}',
    startPage: 1
}
```

### 2. Different Query Parameter Name

For URLs like: `https://example.com/specialists/?p=2`

```javascript
pagination: {
    type: 'query',
    queryPattern: 'p={page}',
    startPage: 1
}
```

### 3. Path-based Pagination

For URLs like: `https://example.com/specialists/page/2/`

```javascript
pagination: {
    type: 'path',
    pathPattern: '/page/{page}/',
    startPage: 1
}
```

### 4. Different Path Pattern

For URLs like: `https://example.com/specialists/p/{page}/`

```javascript
pagination: {
    type: 'path',
    pathPattern: '/p/{page}/',
    startPage: 1
}
```

### 5. WordPress-style Pagination

For URLs like: `https://example.com/specialists/page/{page}/`

```javascript
pagination: {
    type: 'path',
    pathPattern: '/page/{page}/',
    startPage: 1
}
```

### 6. Zero-based Pagination

For URLs like: `https://example.com/specialists/?page=0` (starting from 0)

```javascript
pagination: {
    type: 'query',
    queryPattern: 'page={page}',
    startPage: 0
}
```

### 7. Different Base URL for Pagination

If pagination URLs use a different base URL:

```javascript
pagination: {
    type: 'query',
    queryPattern: 'page={page}',
    baseUrl: 'https://api.example.com/specialists/',
    startPage: 1
}
```

## How to Change Configuration

1. Open `src/config/config.js`
2. Modify the `pagination` object within `SITE` configuration
3. Set the appropriate `type`, pattern, and starting page
4. Save the file and run your crawler

## Supported Patterns

- **Query patterns**: Any query parameter name with `{page}` placeholder
  - `page={page}`
  - `p={page}`
  - `pagenum={page}`
  - `offset={page}`

- **Path patterns**: Any URL path structure with `{page}` placeholder
  - `/page/{page}/`
  - `/p/{page}/`
  - `/{page}/`
  - `/pages/{page}`

The `{page}` placeholder will be replaced with the actual page number during crawling.
