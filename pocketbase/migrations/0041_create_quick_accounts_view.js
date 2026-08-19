migrate(
  (app) => {
    // View collection (read-only, public) that exposes only the non-sensitive
    // fields needed by the public login screen: id, username, name, role —
    // filtered to the roles that have quick-access accounts (admin/attendant/
    // technician). Queried via the NATIVE PocketBase records API
    // (GET /api/collections/quick_accounts/records) with an absolute URL, so it
    // works in production (no routerAdd, no React Router interference, no auth).
    // Sensitive fields (email, phone, permissions, avatar, ...) are never
    // selected by the view, so they cannot leak to anonymous callers.
    const collection = new Collection({
      type: 'view',
      name: 'quick_accounts',
      listRule: '',
      viewRule: '',
      viewQuery:
        "SELECT id, username, name, role FROM users WHERE role IN ('admin', 'attendant', 'technician')",
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('quick_accounts')
      app.delete(collection)
    } catch (_) {}
  },
)
