Your company has a small web API service (/app) packaged as a Docker image.

Currently, developers:
- Build images manually on their laptops
- Push images to a registry
- SSH into a VM and run docker run ...

There is no CI/CD pipeline, no automated security scanning, and secrets are handled in an unsafe way.

Your task is to introduce basic DevSecOps practices around this service.

Set up a secure delivery pipeline for the provided application and improve its security posture.
You may use these CI platforms: GitHub Actions, GitLab CI

Please include a short `README` explaining what you did and how to run your solution.

# Part 1 – Secure CI/CD Pipeline
**Goal:** Build a basic CI pipeline with security checks.

## 1.1 Basic pipeline setup
Create a CI configuration (e.g. .github/workflows/ci.yml, .gitlab-ci.yml, etc.) that:

* Triggers on:

    * Push to the main branch

    * Pull requests targeting main (or equivalent)

* Runs:

    * Dependency install

    * Unit tests

    * A linter or style checker (if available for this language)

**Deliverable:**

* CI config file in the repo

* Pipeline must be green on your final commit (describe in README if you can’t actually run it)

## 1.2 Add basic security checks
Extend the pipeline to add at least:

* SAST or code scanning (can be language-specific or generic)

* Dependency vulnerability scanning (e.g., npm audit, pip-audit, etc.)

* Build the Docker image as part of the pipeline

**Deliverable:**

* Updated CI config showing where security steps run

* Mention in the README which tools you chose and why

## 1.3 Security gates & PR protections
Enhance the pipeline so that:

* The pipeline fails if vulnerabilities of a certain severity are found (you decide thresholds and document them).

* It’s clear which jobs must pass before merging (e.g., required status checks, environment rules, manual approvals, etc.).

You can either express this in CI config (e.g., required jobs) or explain in a short “How to configure branch protection” section.

**Deliverable:**

* CI config with a security gate (e.g., fails on “high” vulnerabilities)

* Short description (in README) of recommended branch protection rules/approval flows

# Part 2 – Container & Runtime Security

## 2.1 Harden the Docker image
Update the Dockerfile and harden it in line with best security practices.

**Deliverable:**

* Updated Dockerfile

* Short comment in README describing the key hardening changes

## 2.2 Container scanning & secure run recommendations
Integrate a container image scan in the CI pipeline (e.g., with any container scanning tool).

Create a short “Runtime Recommendations” section in the README explaining:

* How you’d run the container in production

* Example docker run (or Kubernetes manifest snippets) showing safer runtime options.

**Deliverable:**

* CI changes for container scanning

* Runtime recommendations written down

# Part 3 – Secrets Management
Currently, the app reads an API key from a file that’s checked into the repo (e.g., config.js or .env committed).

## 3.1 Basic secret hygiene
Refactor the app (or configuration) so secrets are not stored in the repository.

Make sure the app:

* Fails clearly if the required secrets are missing.

* Can still be run locally via a sample .env.example, or similar.

**Deliverable:**

* Code/config changes

* Example .env.example, or config sample

* README section: “How to provide secrets locally and in CI.”

## 3.2 Secret storage strategy & rotation
Write a short section in the README describing:

* Which secret storage solution would you use in production (e.g., cloud KMS/secret manager, Vault, etc.).

* How you would handle:

    * Secret rotation

    * Least-privilege access to secrets

    * Auditability (who accessed what, when)

You do not have to implement the actual cloud setup, but your description should be concrete and realistic.

# Part 4 – Infrastructure as Code & Cloud Security
## 4.1 Helm Chart Development
Create a Helm chart to deploy the web API service to Kubernetes with security best practices.

Proposed chart structure:

```
infra/helm/ots-api/
├── Chart.yaml
├── values.yaml         # Configurable values (image, replicas, secrets placeholders)
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── secret.yaml
│   └── networkpolicy.yaml
```
**Deliverable:**

* Complete Helm chart in infra/helm/ots-api/

* Brief README section explaining:

* Installation: helm install ots-api ./infra/helm/ots-api

* How to provide secrets: --set secrets.otsUser=... --set secrets.otsKey=...

* Security measures implemented and why they matter

Note: Can be tested locally with kind or minikube. Focus on security best practices—advanced Helm features are optional.

# Part 5 – Documentation & Security Thinking
## 5.1 Basic documentation
Create/update a README.md that covers:

* How to run the app locally (with and without Docker)

* How to run or simulate the CI pipeline

* How secrets are handled now

* A brief list of security improvements you implemented

This doesn’t have to be perfect; we care about how you think.