---
'@airbolt/sdk': patch
---

Fix URL construction when baseURL has trailing slashes

- Prevents double slashes (e.g., `//api/tokens`) when baseURL ends with `/`
- Handles multiple trailing slashes correctly
- Fixes 404 errors on deployed instances where users provide URLs with trailing slashes
