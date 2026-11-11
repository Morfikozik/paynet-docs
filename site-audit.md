# Site audit

```json
{
  "routeChecks": 174,
  "failedRoutes": 0,
  "internalLinks": 50,
  "externalLinks": 8,
  "linkProblems": 0,
  "interactionsFailed": 0,
  "problems": 0
}
```

## Problems

## Link problems

## Interactions
- ✓ legacy redirect #/page/ecommerce: #/guides/integration-options
- ✓ legacy redirect #/page/order-request-v06: #/page/checkout-form
- ✓ legacy redirect #/page/notifications: #/page/notification-simulator
- ✓ search "refund" (en): results visible: true, items 0
- ✓ search "refund" (ru): results visible: true, items 0
- ✓ search "refund" (ro): results visible: true, items 0
- ✓ mobile menu (en): opened and closed
- ✓ mobile menu (ru): opened and closed
- ✓ mobile menu (ro): opened and closed
- ✓ language switch EN → RU: Notifications (webhooks) → Уведомления (webhooks)

## Bundle
```json
{
  "bytes": 955137,
  "knownPublicTestValues": {
    "771064": true,
    "sLgMnGWJ": true,
    "F90D6485-9CCC-458B-96A3-8958AF9B4458": true,
    "D9873689-E5F8-4272-A67F-0D8BA3F9BAA7": true
  },
  "suspicious": []
}
```

## npm audit
```json
{
  "all": {
    "counts": {
      "info": 0,
      "low": 2,
      "moderate": 7,
      "high": 14,
      "critical": 4,
      "total": 27
    },
    "packages": [
      "@babel/core (low)",
      "@babel/helpers (moderate)",
      "@eslint/plugin-kit (low)",
      "@humanfs/node (moderate)",
      "@isaacs/brace-expansion (high)",
      "ajv (moderate)",
      "brace-expansion (high)",
      "browserslist (high)",
      "esbuild (moderate)",
      "fast-uri (high)",
      "fast-xml-parser (critical)",
      "flatted (high)",
      "form-data (critical)",
      "glob (high, direct)",
      "httpsnippet (critical)",
      "js-yaml (high, direct)",
      "minimatch (high)",
      "nanoid (high)",
      "openapi-sampler (moderate)",
      "openapi-snippet (critical, direct)",
      "picomatch (high)",
      "postcss (high, direct)",
      "postcss-selector-parser (moderate)",
      "rollup (high)",
      "source-map-js (high)",
      "vite (high, direct)",
      "yaml (moderate)"
    ]
  },
  "runtimeOnly": {
    "counts": {
      "info": 0,
      "low": 0,
      "moderate": 2,
      "high": 5,
      "critical": 4,
      "total": 11
    },
    "packages": [
      "@isaacs/brace-expansion (high)",
      "ajv (moderate)",
      "fast-uri (high)",
      "fast-xml-parser (critical)",
      "form-data (critical)",
      "glob (high, direct)",
      "httpsnippet (critical)",
      "js-yaml (high, direct)",
      "minimatch (high)",
      "openapi-sampler (moderate)",
      "openapi-snippet (critical, direct)"
    ]
  }
}
```

First load (desktop, en): 746 ms