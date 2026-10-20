# Platform Governance Policies

**Platform:** Cloud-Native Application on Kubernetes  
**Namespace:** platform-demo  
**Author:** Muhammad Rasikh Riaz

---

## 1. Deployment Policy

All deployments to the platform-demo namespace follow these rules:

- **All changes must go through Git.** Direct `kubectl apply` is prohibited. ArgoCD self-heal will revert any manual change within 3 minutes.
- **Pull Request required.** Every change to Kubernetes manifests must be submitted as a Pull Request to the `main` branch.
- **CI must pass.** GitHub Actions builds and pushes the Docker image before any deployment.
- **Tagged images only.** The `:latest` tag is never used. Every deployment references a specific commit SHA tag (e.g., `rasikh11/cloud-native-app:a1b2c3d`).

## 2. Rollback Procedure

If a deployment causes issues:

1. Identify the last known good commit in GitHub history.
2. Create a revert commit: `git revert <bad-commit>`.
3. Push to `main` — ArgoCD syncs the rollback automatically.
4. Verify: `kubectl get pods -n platform-demo` (all pods should be Running).
5. Confirm health: `curl http://NODE_IP:30080/health`.
6. Check Grafana for error rate stabilisation.

**Alternative (emergency):** `kubectl rollout undo deployment/platform-demo -n platform-demo` — but ArgoCD will revert this, so disable auto-sync first.

## 3. Resource Governance

- **ResourceQuota** limits total CPU and memory the namespace can consume (see `kubernetes/policies/resource-quota.yaml`).
- **LimitRange** sets default and maximum resource requests for containers, preventing any pod from consuming unbounded resources.
- **HPA** manages scaling within the quota boundaries (2–5 replicas).

## 4. Access Control (RBAC)

- A dedicated ServiceAccount (`platform-demo-sa`) is used for application pods.
- The ServiceAccount has minimal permissions — only what is needed to run in the namespace.
- Prometheus uses a ClusterRole with read-only access to metrics endpoints across the cluster.
- ArgoCD has its own namespace and ServiceAccount with permissions to manage resources in `platform-demo`.

## 5. Network Security

- **NetworkPolicies** restrict ingress and egress traffic (see `kubernetes/policies/network-policy.yaml`).
- Application pods only accept traffic on port 3000.
- Prometheus can only be accessed by Grafana and via NodePort.
- DNS egress is allowed for service discovery.

## 6. Monitoring and Alerting

- **Prometheus** scrapes application metrics every 15 seconds.
- **Grafana** dashboards display: HTTP request rate, CPU usage per pod, memory usage per pod, and running pod count.
- In production, Alertmanager would be configured to send Slack/email alerts for critical thresholds.

## 7. Namespace Onboarding Procedure

To onboard a new application to the platform:

1. Create a namespace YAML (`kubectl create namespace <app-name>`).
2. Apply ResourceQuota and LimitRange for the new namespace.
3. Apply NetworkPolicies to restrict traffic.
4. Create RBAC roles and bindings for the application's ServiceAccount.
5. Create an ArgoCD Application manifest pointing to the app's Git repository.
6. Configure Prometheus to scrape the new app's `/metrics` endpoint.
7. Create Grafana dashboards for the new app.

## 8. Compliance Alignment

| Framework | How this platform aligns |
|-----------|------------------------|
| **Principle of Least Privilege** | RBAC restricts ServiceAccount permissions; NetworkPolicies limit pod traffic |
| **Infrastructure as Code** | All configuration stored in Git; no manual cluster changes |
| **Audit Trail** | Git commit history serves as the audit log for every change |
| **Separation of Concerns** | CI (GitHub Actions) builds images; CD (ArgoCD) deploys them |
| **Defence in Depth** | Multiple layers: RBAC + NetworkPolicy + ResourceQuota + image policy |
