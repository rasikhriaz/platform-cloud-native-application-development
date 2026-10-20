# Platform Engineering & Cloud-Native Application Development

**Name:** Muhammad Rasikh Riaz  
**Email:** mo.rasikh11@gmail.com  
**Diploma:** EduQual Level 5 Diploma in DevSysOps Engineering  
**GitHub:** [rasikhriaz/platform-cloud-native-application-development](https://github.com/rasikhriaz/platform-cloud-native-application-development)

---

## Project Overview

This project demonstrates a complete cloud-native platform engineering solution built using open-source technologies. The platform supports the full lifecycle of a cloud-native application — from source code to automated deployment, auto-scaling, and real-time monitoring — running on a production-grade 3-node Kubernetes cluster provisioned on AWS EC2.

The solution applies platform engineering principles: developers push code to Git, and the platform handles everything else — building, deploying, scaling, monitoring, and self-healing — with zero manual intervention.

---

## Tech Stack

| Tool | Role |
|------|------|
| **Docker** | Containerise the Node.js application |
| **Kubernetes (kubeadm)** | Orchestrate and manage containerised workloads |
| **ArgoCD** | GitOps continuous delivery — auto-sync from GitHub |
| **Prometheus** | Metrics collection and observability |
| **Grafana** | Real-time dashboards — CPU, Memory, HTTP Requests |
| **GitHub Actions** | CI pipeline — build, push, update deployment |
| **Calico** | CNI plugin with NetworkPolicy enforcement |
| **AWS EC2** | 3 x t2.medium nodes (1 control-plane + 2 workers) |

---

## Learning Objectives Covered

| Objective | How it is met |
|-----------|---------------|
| **A** Develop platforms for deploying cloud-native apps | ArgoCD GitOps pipeline auto-deploys from GitHub to Kubernetes |
| **B** Use Kubernetes and Docker to orchestrate containers | Kubernetes Deployment with 2 replicas, health probes, NodePort service |
| **C** Optimize for scalability and resource efficiency | HPA auto-scales pods 2 → 5 based on CPU, Prometheus monitors performance |

---

## Repository Structure

```
platform-cloud-native-application-development/
├── .github/
│   └── workflows/
│       └── app-build.yml              # CI — build, push, update deployment
├── app/
│   ├── index.js                       # Node.js app with /metrics and /health
│   └── index.html                     # IronVeil Defense landing page
├── docker/
│   └── Dockerfile                     # Container image definition
├── kubernetes/
│   ├── base/
│   │   ├── namespace.yaml             # platform-demo namespace
│   │   ├── deployment.yml             # 2 replicas + health probes
│   │   ├── service.yaml               # NodePort — port 80 → 3000
│   │   ├── hpa.yml                    # Auto-scale 2 → 5 pods at 50% CPU
│   │   ├── metrics-server.yaml        # Metrics Server for HPA CPU signal
│   │   └── rbac.yaml                  # Role + RoleBinding for platform-demo
│   ├── argocd/
│   │   └── application.yml            # ArgoCD app pointing to this repo
│   └── policies/
│       ├── network-policy.yaml        # Ingress/egress traffic restrictions
│       ├── pod-disruption-budget.yaml # Availability during maintenance
│       ├── resource-quota.yaml        # Namespace resource limits + LimitRange
│       └── image-policy.yaml          # Image approval policy + rollback procedure
├── monitoring/
│   ├── prometheus.yml                 # ConfigMap + Deployment + Service
│   ├── grafana.yaml                   # Deployment + Service
│   └── service-account.yml            # ClusterRole + ClusterRoleBinding for Prometheus
└── docs/
    ├── TRADE-OFF-ANALYSIS.md          # HPA vs VPA, GitOps vs CI/CD, kubeadm vs EKS
    ├── FAILURE-RECOVERY-RUNBOOK.md    # 7 failure scenarios with recovery steps
    └── PLATFORM-GOVERNANCE.md         # Deployment, rollback, RBAC, and compliance policies
```

---

## Platform Architecture

```
Developer
    │
    │  git push
    ▼
GitHub Repository
    │
    ├──► GitHub Actions
    │       │
    │       ├── Build Docker image
    │       ├── Push rasikh11/cloud-native-app:<sha>
    │       └── Update image tag in deployment.yml
    │
    └──► ArgoCD (watches repo)
            │
            │  auto-sync
            ▼
    Kubernetes Cluster [namespace: platform-demo]
            │
            ├── Deployment (2 replicas, health probes)
            ├── Service (NodePort :30080)
            ├── HPA ◄── Metrics Server (CPU signal)
            ├── NetworkPolicy (traffic restrictions)
            ├── ResourceQuota (namespace limits)
            ├── PodDisruptionBudget (availability guarantee)
            │
            └── Prometheus ──► Grafana (dashboards)
```

---

## Application

A lightweight Node.js HTTP server exposing three endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/` | Serves the IronVeil Defense HTML landing page |
| `/health` | Kubernetes liveness and readiness probes |
| `/metrics` | Prometheus scrape target — exposes `http_requests_total` |

---

## CI/CD Pipeline — GitHub Actions + ArgoCD

### How it works

```
Developer git push
        │
        ▼
GitHub Actions triggered
        │
        ├── Build Docker image
        ├── Push rasikh11/cloud-native-app:<sha> to Docker Hub
        └── Update image tag in kubernetes/base/deployment.yml
        │
        ▼
ArgoCD detects change in GitHub repo
        │
        ▼
Auto-syncs new deployment to Kubernetes cluster
        │
        ▼
Pods rolling updated — zero downtime
```

### Key GitOps principles applied

- **Git is the single source of truth** — every cluster change goes through GitHub
- **Auto-sync enabled** — ArgoCD applies changes within 3 minutes of a push
- **Self-heal enabled** — ArgoCD corrects any manual changes made directly to the cluster
- **Drift detection** — ArgoCD alerts if cluster state differs from repo state

### ArgoCD sync policy

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
  syncOptions:
    - CreateNamespace=true
```

---

## Kubernetes Setup — kubeadm

### Step 1 — Run on ALL 3 nodes

```bash
# Disable swap
swapoff -a
sed -i '/ swap / s/^\(.*\)$/#\1/g' /etc/fstab

# Load kernel modules
modprobe overlay
modprobe br_netfilter

# Install containerd
apt-get install -y containerd.io
systemctl enable containerd

# Install kubeadm kubelet kubectl
apt-get install -y kubelet=1.29.0-1.1 kubeadm=1.29.0-1.1 kubectl=1.29.0-1.1
apt-mark hold kubelet kubeadm kubectl
```

### Step 2 — Run on MASTER only

```bash
kubeadm init \
  --apiserver-advertise-address=<MASTER_PRIVATE_IP> \
  --pod-network-cidr=192.168.0.0/16

# Set up kubectl
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config

# Install Calico network plugin
kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/calico.yaml

# Install Metrics Server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

### Step 3 — Run on WORKER nodes

```bash
kubeadm join <MASTER_IP>:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

---

## Deploy the Application

```bash
# Apply namespace first
kubectl apply -f kubernetes/base/namespace.yaml

# Deploy RBAC and app
kubectl apply -f kubernetes/base/rbac.yaml
kubectl apply -f kubernetes/base/deployment.yml
kubectl apply -f kubernetes/base/service.yaml
kubectl apply -f kubernetes/base/hpa.yml

# Apply governance policies
kubectl apply -f kubernetes/policies/network-policy.yaml
kubectl apply -f kubernetes/policies/pod-disruption-budget.yaml
kubectl apply -f kubernetes/policies/resource-quota.yaml
kubectl apply -f kubernetes/policies/image-policy.yaml

# Verify everything is running
kubectl get all -n platform-demo
```

---

## Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Expose UI
kubectl patch svc argocd-server -n argocd \
  -p '{"spec":{"type":"NodePort","ports":[{"port":443,"targetPort":8080,"nodePort":30443,"protocol":"TCP","name":"https"}]}}'

# Get admin password
kubectl get secret argocd-initial-admin-secret \
  -n argocd -o jsonpath="{.data.password}" | base64 -d && echo
```

Access ArgoCD UI: `https://YOUR_NODE_IP:30443`  
Username: `admin` | Password: from command above

```bash
# Connect ArgoCD to this repo
kubectl apply -f kubernetes/argocd/application.yml
```

---

## Deploy Monitoring (Prometheus + Grafana)

```bash
# Apply Prometheus RBAC, ConfigMap, Deployment and Service
kubectl apply -f monitoring/service-account.yml
kubectl apply -f monitoring/prometheus.yml

# Deploy Grafana
kubectl apply -f monitoring/grafana.yaml

# Verify
kubectl get all -n platform-demo
```

Access Prometheus UI: `http://YOUR_NODE_IP:30090`  
Access Grafana UI: `http://YOUR_NODE_IP:30030` — Username: `admin` | Password: `admin123`

### Connect Prometheus as Grafana Data Source

1. Go to **Connections → Data Sources → Add data source → Prometheus**
2. Set URL to: `http://prometheus.platform-demo.svc.cluster.local:9090`
3. Click **Save & Test** — should show green tick

### Dashboard Panels

| Panel | Query | Visualization |
|-------|-------|---------------|
| HTTP Requests Total | `http_requests_total` | Time series |
| CPU Usage per Pod | `sum(rate(container_cpu_usage_seconds_total{namespace="platform-demo"}[5m])) by (pod)` | Time series |
| Memory Usage per Pod | `sum(container_memory_usage_bytes{namespace="platform-demo"}) by (pod)` | Time series |
| Running Pods | `count(kube_pod_info{namespace="platform-demo"})` | Stat |

---

## HPA Auto-Scaling Test

Open three terminals:

**Terminal 1 — Watch HPA:**
```bash
watch kubectl get hpa -n platform-demo
```

**Terminal 2 — Watch pods:**
```bash
watch kubectl get pods -n platform-demo
```

**Terminal 3 — Run load generator:**
```bash
kubectl run load-generator \
  --image=busybox \
  --restart=Never \
  -n platform-demo \
  -- /bin/sh -c "while true; do wget -q -O- http://platform-demo.platform-demo.svc.cluster.local/; done"
```

### Expected scaling behaviour

```
CPU: 12%  → pods: 2  (baseline)
CPU: 62%  → pods: 3  (HPA triggers)
CPU: 81%  → pods: 4  (scaling up)
CPU: 48%  → pods: 5  (max replicas)
```

**Stop load test:**
```bash
kubectl delete pod load-generator -n platform-demo
# Pods scale back to 2 after ~5 minutes
```

---

## Security and Governance

This platform implements multiple layers of security and governance:

| Layer | Mechanism | File |
|-------|-----------|------|
| **Network Security** | NetworkPolicies restrict pod-to-pod traffic | `kubernetes/policies/network-policy.yaml` |
| **Resource Governance** | ResourceQuota + LimitRange cap namespace usage | `kubernetes/policies/resource-quota.yaml` |
| **Availability** | PodDisruptionBudget ensures uptime during maintenance | `kubernetes/policies/pod-disruption-budget.yaml` |
| **Image Policy** | Only tagged images from trusted registry allowed | `kubernetes/policies/image-policy.yaml` |
| **Access Control** | RBAC with least-privilege ServiceAccount | `kubernetes/base/rbac.yaml` |
| **Change Management** | All changes via Git PR → ArgoCD auto-sync | `.github/workflows/app-build.yml` |
| **Audit Trail** | Git commit history = full audit log | GitHub repository |

For detailed policies, see [docs/PLATFORM-GOVERNANCE.md](docs/PLATFORM-GOVERNANCE.md).

---

## Trade-Off Analysis

Key architectural decisions with justification (required for RQF Level 5):

| Decision | Chosen | Alternative | Rationale |
|----------|--------|-------------|-----------|
| Autoscaling | HPA | VPA | Stateless app benefits from horizontal scaling; VPA requires pod restarts |
| Deployment | GitOps (ArgoCD) | Traditional CI/CD | Git as single source of truth, drift detection, self-healing |
| Cluster management | kubeadm | Managed K8s (EKS) | Demonstrates deeper K8s understanding for assessment; EKS better for production |
| Monitoring | Prometheus + Grafana | CloudWatch | Open-source, K8s-native, full control over queries and dashboards |
| CNI plugin | Calico | Flannel | NetworkPolicy support required for security; Flannel has none |
| Service exposure | NodePort | Ingress / LoadBalancer | Sufficient for demo; Ingress with ALB recommended for production |

Full analysis: [docs/TRADE-OFF-ANALYSIS.md](docs/TRADE-OFF-ANALYSIS.md)

---

## Failure Recovery

Seven failure scenarios are documented with detection, recovery steps, and prevention:

1. Pod crash / OOMKilled
2. Worker node failure
3. Control plane failure
4. ArgoCD connectivity loss
5. HPA not scaling
6. Prometheus targets down
7. Network partition between nodes

Full runbook: [docs/FAILURE-RECOVERY-RUNBOOK.md](docs/FAILURE-RECOVERY-RUNBOOK.md)

---

## Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| App | `http://NODE_IP:30080` | — |
| Prometheus | `http://NODE_IP:30090` | — |
| Grafana | `http://NODE_IP:30030` | admin / admin123 |
| ArgoCD | `https://NODE_IP:30443` | admin / (generated) |

---

## AWS Security Group Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH access |
| 6443 | TCP | Kubernetes API server |
| 2379-2380 | TCP | etcd |
| 10250 | TCP | kubelet API |
| 30000-32767 | TCP | NodePort services |
| All traffic | All | Between nodes in same security group |

---

## GitHub Actions Secrets Required

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | `rasikh11` |
| `DOCKERHUB_TOKEN` | Your Docker Hub access token |

---

## Common Issues and Fixes

**Nodes show NotReady after restart:**
```bash
sudo systemctl restart kubelet
kubectl get nodes
```

**ArgoCD connection refused after node restart:**
```bash
kubectl rollout restart deployment -n argocd
kubectl get pods -n argocd
```

**HPA shows unknown CPU:**
```bash
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

**Prometheus targets down:**
```bash
kubectl rollout restart deployment/prometheus -n platform-demo
```

---

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [kubeadm Setup Guide](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/)
- [Calico NetworkPolicy Guide](https://docs.tigera.io/calico/latest/network-policy/)
- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
