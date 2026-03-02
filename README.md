# OTS API — DevSecOps Hardening

A Node.js API wrapper around [OneTimeSecret](https://onetimesecret.com) with a secure CI/CD pipeline, hardened container, secrets management, and Kubernetes Helm chart.

---

## Table of Contents

1. [How to Run Locally](#how-to-run-locally)
2. [Part 1 – Secure CI/CD Pipeline](#part-1--secure-cicd-pipeline)
3. [Part 2 – Container & Runtime Security](#part-2--container--runtime-security)
4. [Part 3 – Secrets Management](#part-3--secrets-management)
5. [Part 4 – Helm Chart](#part-4--helm-chart)
6. [Security Improvements Summary](#security-improvements-summary)

---

## How to Run Locally

### Without Docker

**Prerequisites:** Node.js >= 20

```bash
cd app
cp ../.env.example .env       # fill in your OTS credentials
npm install
npm start
```

The API will be available at `http://localhost:3000`.

### With Docker

```bash
docker build -t ots-api .
docker run --rm \
  -e OTS_USER=your_user \
  -e OTS_KEY=your_api_key \
  -e OTS_HOST=https://onetimesecret.com/api \
  -p 3000:3000 \
  ots-api
```

### With Docker Compose (local development only)

```bash
cp .env.example .env          # fill in your OTS credentials
docker compose up
```

> **Note:** Docker Compose is for local development only. Do not use it in production.

### Running the test suite

```bash
cd app
OTS_USER=test-user OTS_KEY=test-key OTS_HOST=https://onetimesecret.com/api npm test
```

---

## Part 1 – Secure CI/CD Pipeline

### 1.1 Pipeline Setup

**File:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

The CI pipeline triggers on every push to `main` and on all pull requests targeting `main`. It runs two sequential jobs:

| Job | Steps |
|-----|-------|
| `install-and-lint` | `npm install` → ESLint (`eslint src/`) |
| `test` | `npm install` → Jest (`--runInBand --forceExit`) |

The `test` job only runs if `install-and-lint` passes (`needs: install-and-lint`), preventing test runs against code that fails linting.

### 1.2 Security Checks

**File:** [`.github/workflows/snyk.yml`](.github/workflows/snyk.yml)

Three parallel Snyk jobs run on every push to `main` and on all pull requests:

| Job | Tool | What it scans |
|-----|------|---------------|
| `snyk-deps` | `snyk test` | Production npm dependencies (`--omit=dev`) |
| `snyk-code` | `snyk code test` | Application source code (SAST) |
| `snyk-container` | `snyk container test` | Built Docker image layers and OS packages |

**Why Snyk?** It covers all three surfaces (dependencies, code, container) in a single tool, integrates directly into GitHub Actions without additional infrastructure, and produces actionable fix recommendations.

**Why ESLint alongside Snyk SAST?** ESLint's `no-eval` rule catches `eval()` usage at lint time — before code even reaches Snyk — giving faster feedback in the developer's editor.

### 1.3 Security Gates & Branch Protection

**Threshold:** All three Snyk jobs use `--severity-threshold=high`. The pipeline fails if any HIGH or CRITICAL vulnerability is found that is not documented in the [`.snyk` policy file](app/.snyk).

**Recommended branch protection rules for `main`:**

1. **Require status checks to pass before merging** — add all four jobs as required:
   - `Install & Lint`
   - `Unit Tests`
   - `Dependency Scan`
   - `Code Scan (SAST)`
   - `Container Scan`

2. **Require pull request reviews** — at least 1 approval from a code owner before merge.

3. **Dismiss stale pull request approvals** — a new push to a PR invalidates existing approvals, preventing stale approvals from bypassing updated security findings.

4. **Do not allow bypassing the above settings** — including for administrators.

These settings are configured under **Settings → Branches → Branch protection rules** in GitHub.

---

## Part 2 – Container & Runtime Security

### 2.1 Dockerfile Hardening

**File:** [`Dockerfile`](Dockerfile)

| Change | Security Reason |
|--------|----------------|
| Multi-stage build (`builder` → `runtime`) | Build tools and `devDependencies` never reach the runtime image |
| `node:20-alpine` base | Minimal attack surface; ~5MB vs ~900MB for `node:20` |
| `npm install --omit=dev` in builder | Only production dependencies copied to runtime stage |
| `npm install -g npm@11.11.0` in runtime | Replaces npm@10.x bundled with Alpine, fixing known CVEs in the package manager |
| `addgroup -S / adduser -S` + `USER appuser` | Process runs as UID 1000, not root; limits blast radius if exploited |
| `chown -R appuser:appgroup /app` | Ensures the non-root user owns only the app directory |
| `ENV NODE_ENV=production` | Disables development-mode features in Express and other libraries |
| `HEALTHCHECK` via `wget` | Built-in Alpine tool; no additional package needed |
| `CMD ["node", "src/index.js"]` | Array form prevents shell injection; no debug flags |

**Removed from original Dockerfile:**
- Root user execution
- Hardcoded `OTS_USER` / `OTS_KEY` in `ENV`
- `--inspect=0.0.0.0:9229` debug port

### 2.2 Container Scanning

Container scanning runs as the `snyk-container` job in `.github/workflows/snyk.yml`. It builds the image from the `Dockerfile` and scans it with `snyk container test --severity-threshold=high`.

Accepted CVEs that exist only within npm's own bundled packages (not reachable from application runtime code) are documented in [`app/.snyk`](app/.snyk) with reasons and expiry dates.

### Runtime Recommendations

**Run the container in production with these options:**

```bash
docker run \
  --read-only \
  --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --user 1000:1000 \
  -e OTS_USER="$OTS_USER" \
  -e OTS_KEY="$OTS_KEY" \
  -e OTS_HOST="https://onetimesecret.com/api" \
  -p 3000:3000 \
  ots-api:latest
```

| Flag | Why |
|------|-----|
| `--read-only` | Container filesystem is immutable at runtime |
| `--tmpfs /tmp` | Allows writes only to an ephemeral in-memory mount |
| `--cap-drop ALL` | Removes all Linux capabilities |
| `--security-opt no-new-privileges` | Prevents privilege escalation via setuid binaries |
| `--user 1000:1000` | Enforces non-root even if the image default changes |

For Kubernetes, see the [Helm chart](#part-4--helm-chart) which encodes these settings as `securityContext` fields.

---

## Part 3 – Secrets Management

### 3.1 How to Provide Secrets

**Locally:**

```bash
cp .env.example .env
# Edit .env and fill in your credentials
```

The app reads `OTS_USER`, `OTS_KEY`, and `OTS_HOST` from environment variables via `dotenv`. If any required variable is missing at startup, the process exits immediately with a clear error message — it does not start with unsafe defaults.

**In CI (GitHub Actions):**

Secrets are stored in **GitHub Actions Secrets** (`Settings → Secrets and variables → Actions`) and injected as environment variables:

```yaml
env:
  OTS_USER: ${{ secrets.OTS_USER }}
  OTS_KEY: ${{ secrets.OTS_KEY }}
```

Secrets are never printed to logs, never hardcoded in YAML files, and never committed to the repository. The `.gitignore` blocks `.env` files from being committed.

### 3.2 Secret Storage Strategy & Rotation

#### Production Secret Storage

**Primary recommendation: HashiCorp Vault**

Vault is the recommended solution for this service. It provides:
- Dynamic secret generation with short-lived leases
- Native Kubernetes integration via the Vault Agent Injector
- Fine-grained policy engine
- Built-in audit logging

For teams already on a cloud provider, **AWS Secrets Manager** or **GCP Secret Manager** are viable alternatives with less operational overhead. The Vault setup described below is provisioned via Terraform (IaC), not manually.

#### Secret Rotation

`OTS_USER` and `OTS_KEY` are stored as static KV secrets in Vault. Rotation is handled as follows:

1. **Scheduled rotation via Vault Lease TTL** — secrets are issued with a TTL (e.g., 24 hours). The Vault Agent Injector renews or re-fetches the secret before expiry with zero pod restarts.
2. **Manual rotation** — write new credentials with `vault kv put secret/ots-api OTS_KEY=<new>`. Pods pick up the new value on next lease renewal.
3. **Break-glass revocation** — in the event of a compromise, `vault lease revoke -prefix secret/ots-api` immediately invalidates all issued leases across all pods.

#### Least-Privilege Access

Access to secrets is scoped using a Vault policy bound to a Kubernetes ServiceAccount:

```hcl
# vault-policy.hcl
path "secret/data/ots-api" {
  capabilities = ["read"]
}
```

The pod authenticates using the **Kubernetes auth method** — bound to a specific ServiceAccount in a specific namespace. No other workload can access this path. The policy, role binding, and Kubernetes auth configuration are all managed by Terraform.

#### Auditability

Vault's audit device ships all access events to a SIEM:

```bash
vault audit enable file file_path=/vault/logs/audit.log
```

Every secret access is logged with:
- **Who** — the Kubernetes ServiceAccount and pod identity
- **What** — the exact secret path accessed
- **When** — timestamp with nanosecond precision
- **Result** — allowed or denied

This provides a complete, tamper-evident record of who accessed what and when, without any custom application instrumentation.

---

## Part 4 – Helm Chart

**Location:** [`infra/helm/ots-api/`](infra/helm/ots-api/)

```
infra/helm/ots-api/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── _helpers.tpl
    ├── deployment.yaml
    ├── service.yaml
    ├── secret.yaml
    └── networkpolicy.yaml
```

### Installation

```bash
helm install ots-api ./infra/helm/ots-api \
  --set secrets.otsUser=<your_ots_user> \
  --set secrets.otsKey=<your_ots_key>
```

### Providing Secrets

Secrets are passed at install time via `--set` flags and are stored as a Kubernetes `Secret` object. They are injected into the pod as environment variables via `secretKeyRef` — they never appear in the pod spec or Helm release history as plaintext.

For production, replace `--set` with an external secrets operator (e.g., [External Secrets Operator](https://external-secrets.io) syncing from Vault or AWS Secrets Manager) to avoid passing secrets on the command line.

### Security Measures

| Measure | Resource | Why It Matters |
|---------|----------|----------------|
| `runAsNonRoot: true` + `runAsUser: 1000` | Deployment | Matches the non-root user created in the Dockerfile |
| `readOnlyRootFilesystem: true` | Deployment | Prevents writes to the container filesystem at runtime |
| `allowPrivilegeEscalation: false` | Deployment | Blocks privilege escalation via setuid binaries |
| `capabilities: drop: [ALL]` | Deployment | Removes all Linux capabilities from the container |
| `automountServiceAccountToken: false` | Deployment | App never calls the K8s API — no token mounted needlessly |
| `ClusterIP` service type | Service | Not exposed externally; requires an Ingress or port-forward |
| Secrets via `secretKeyRef` | Deployment | No plaintext values in the pod spec |
| NetworkPolicy default-deny | NetworkPolicy | Limits blast radius if a pod is compromised |
| Ingress: port 3000 only | NetworkPolicy | No other inbound traffic accepted |
| Egress: DNS + port 443 only | NetworkPolicy | Pod can only reach DNS and the OTS API over HTTPS |

### Testing Locally with kind

> **Windows note:** Use `kindest/node:v1.31.4` explicitly — the default node image
> (Kubernetes 1.35) has a kubelet compatibility issue with Docker Desktop on Windows.

```bash
# Create cluster with a stable node image
kind create cluster --name ots-cluster --image kindest/node:v1.31.4

# Verify the cluster is ready
kubectl config use-context kind-ots-cluster
kubectl get nodes

# Build the Docker image
docker build -t ots-api:local .

# Load image into kind (kind has its own image store, separate from Docker)
kind load docker-image ots-api:local --name ots-cluster

# Install the chart
helm install ots-api ./infra/helm/ots-api \
  --set image.repository=ots-api \
  --set image.tag=local \
  --set image.pullPolicy=Never \
  --set secrets.otsUser=<your_ots_user> \
  --set secrets.otsKey=<your_ots_key> \
  --set secrets.otsHost=https://onetimesecret.com/api

# Watch the pod come up
kubectl get pods -w

# Forward port and test
kubectl port-forward svc/ots-api 3000:80
curl http://localhost:3000/health
```

### Teardown

```bash
kind delete cluster --name ots-cluster
```

---

## Security Improvements Summary

The following vulnerabilities were present in the original codebase and have been remediated:

### Application

| Vulnerability | Original | Fixed |
|---------------|----------|-------|
| Arbitrary code execution | `/admin/eval` endpoint executed `eval(req.body.code)` | Endpoint removed |
| Secret exposure | `/env` endpoint returned all environment variables | Endpoint removed |
| TLS verification disabled | `rejectUnauthorized: false` in axios config | Removed; default strict TLS enforced |
| API key logged on startup | `console.log` printed `this.apikey` | Log statement removed |
| Hardcoded credentials in `package.json` | `config` block with `OTS_USER`/`OTS_KEY` plaintext | Block removed |
| No startup validation | App started silently with missing credentials | Exits with clear error if `OTS_USER` or `OTS_KEY` missing |
| Unsafe axios defaults | `validateStatus: () => true` accepted all HTTP responses | Removed; axios uses default status validation |
| Unlimited request timeout | `timeout: 0` | Fixed to `timeout: 5000` ms |
| Overly permissive CORS | `origin: '*'` with all methods | Restricted to GET/POST only; origin configurable |
| Large body limit | `limit: '50mb'` | Reduced to `1mb` |
| Stack traces in error responses | Full stack sent to client | Generic message returned; stack logged server-side only |

### Container

| Vulnerability | Original | Fixed |
|---------------|----------|-------|
| Running as root | No `USER` directive | Non-root user `appuser` (UID 1000) |
| Large image with dev tools | Single-stage build | Multi-stage; only production deps in runtime image |
| Hardcoded secrets in image | `ENV OTS_USER=...` in Dockerfile | Removed; secrets injected at runtime |
| Debug port exposed | `EXPOSE 9229` | Removed |
| Outdated npm with known CVEs | npm@10.x bundled with Alpine | Upgraded to npm@11.11.0 in runtime stage |

### Docker Compose

| Vulnerability | Original | Fixed |
|---------------|----------|-------|
| Privileged mode | `privileged: true` | Removed |
| Docker socket mounted | `/var/run/docker.sock` bind mount | Removed |
| Plaintext credentials in compose file | `OTS_USER: admin` / `OTS_KEY: secret` | Replaced with `${OTS_USER}` / `${OTS_KEY}` from `.env` |
| Debug port exposed | `9229:9229` | Removed |
| `npm run dev` as entrypoint | Ran with `--inspect=0.0.0.0:9229` | Changed to `npm start` |
