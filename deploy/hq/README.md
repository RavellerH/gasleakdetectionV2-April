# HQ Windows Frontend

The HQ computer runs only `apps/frontend`. It connects to the VPS GraphQL API
through WireGuard and is built in explicit read-only mode.

After replacing `10.77.0.1` with the VPS WireGuard address, run PowerShell as
the Windows user who will use the dashboard:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\hq\install-hq-frontend.ps1 `
  -ApiUrl "http://10.77.0.1/graphql"
```

The installer runs `npm ci`, builds the frontend with
`NEXT_PUBLIC_READ_ONLY=true`, registers the `GasGuard HQ Frontend` scheduled
task at logon, starts it, and creates a desktop shortcut to
`http://localhost:3000`.

The task binds Next.js to `127.0.0.1`, so the frontend is available only on the
HQ computer. Windows Firewall should also continue blocking inbound port 3000.
