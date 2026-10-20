# Trade-Off Analysis

**Platform:** Cloud-Native Application on Kubernetes  
**RQF Level 5 Requirement:** Decision-making rationale and trade-off analysis  
**Author:** Muhammad Rasikh Riaz

---

## 1. HPA vs VPA — Autoscaling Strategy

| Factor | HPA (Horizontal Pod Autoscaler) | VPA (Vertical Pod Autoscaler) |
|--------|--------------------------------|-------------------------------|
| **Mechanism** | Adds/removes pod replicas | Adjusts CPU/memory of existing pods |
| **Downtime** | Zero — new pods start alongside old ones | Requires pod restart to apply new limits |
| **Best for** | Stateless apps (like our Node.js app) | Stateful apps, databases, single-instance workloads |
| **Cost** | More pods = more resource consumption | Same pod count, better right-sizing |
| **Complexity** | Simple — just set target CPU% | Needs careful tuning to avoid OOM during resize |

**Our decision: HPA**  
Our Node.js application is stateless and horizontally scalable. HPA allows us to scale from 2 to 5 replicas with zero downtime. VPA would require pod restarts, which is unacceptable for a production HTTP service. HPA also pairs naturally with the Kubernetes Service load balancer, distributing traffic across all replicas.

**When VPA would be better:** If we had a database pod (e.g., PostgreSQL) that cannot be replicated easily, VPA would right-size its memory allocation based on actual usage patterns.

---

## 2. GitOps (ArgoCD) vs Traditional CI/CD (kubectl apply)

| Factor | GitOps (ArgoCD) | Traditional CI/CD |
|--------|-----------------|-------------------|
| **Source of truth** | Git repository | CI pipeline state |
| **Drift detection** | Yes — ArgoCD alerts and self-heals | No — cluster can diverge silently |
| **Rollback** | Git revert = instant rollback | Must re-run pipeline with old config |
| **Audit trail** | Full Git history | Pipeline logs (often purged) |
| **Learning curve** | Higher — requires ArgoCD setup | Lower — just kubectl in CI |
| **Emergency fixes** | Must go through Git (or disable auto-sync) | kubectl apply directly |

**Our decision: GitOps with ArgoCD**  
GitOps provides a complete audit trail of every change. If an examiner asks "who changed what, and when?", the Git log answers that question. Self-healing means any manual kubectl change is automatically reverted, enforcing discipline. The trade-off is that emergency fixes are slower — you must push to Git and wait for sync (up to 3 minutes). In a real emergency, we can temporarily disable auto-sync.

---

## 3. Self-Managed Kubernetes (kubeadm) vs Managed Kubernetes (EKS/GKE/AKS)

| Factor | kubeadm (Self-Managed) | EKS / GKE / AKS (Managed) |
|--------|----------------------|---------------------------|
| **Control** | Full — you manage everything | Cloud provider manages control plane |
| **Cost** | Lower — only EC2 instances | Higher — management fee + instances |
| **Maintenance** | You handle upgrades, patches, etcd backups | Provider handles control plane upgrades |
| **Learning** | Deep understanding of K8s internals | Abstracts away complexity |
| **HA setup** | Manual — must configure multi-master yourself | Built-in — provider manages HA |
| **Networking** | Must install CNI plugin (Calico) | Pre-configured (VPC-native) |

**Our decision: kubeadm**  
For this diploma assessment, kubeadm demonstrates deeper understanding of Kubernetes internals — cluster bootstrapping, etcd, CNI plugins, and certificate management. This aligns with RQF Level 5 expectations for analytical thinking and justification. In production, we would likely choose EKS for reduced operational burden.

**When managed K8s is better:** Teams without dedicated platform engineers, or organisations that need SLA guarantees on the control plane.

---

## 4. Prometheus + Grafana vs Cloud-Native Monitoring (CloudWatch / Datadog)

| Factor | Prometheus + Grafana | CloudWatch / Datadog |
|--------|---------------------|---------------------|
| **Cost** | Free (open source) | Pay per metric/host |
| **Flexibility** | Full control over queries and dashboards | Pre-built dashboards, limited customisation |
| **Kubernetes integration** | Native — built for K8s | Requires agents and plugins |
| **Data retention** | You manage storage | Managed retention policies |
| **Alerting** | Alertmanager (requires setup) | Built-in alerting |

**Our decision: Prometheus + Grafana**  
Both are open-source and are the industry standard for Kubernetes observability. Prometheus uses a pull-based model that naturally integrates with Kubernetes service discovery. Our Node.js app exposes a `/metrics` endpoint that Prometheus scrapes directly. The trade-off is that we must manage storage and retention ourselves.

---

## 5. Calico vs Flannel — CNI Plugin Selection

| Factor | Calico | Flannel |
|--------|--------|---------|
| **Network Policies** | Full support | No support |
| **Performance** | High (eBPF mode available) | Good (VXLAN overlay) |
| **Complexity** | Medium | Low |
| **Security features** | NetworkPolicy enforcement, encryption | None |

**Our decision: Calico**  
Network Policies are a mandatory security requirement. Calico enforces our NetworkPolicy manifests that restrict pod-to-pod traffic. Flannel would be simpler but offers zero network security — any pod could communicate with any other pod, which violates the principle of least privilege.

---

## 6. NodePort vs LoadBalancer vs Ingress — Service Exposure

| Factor | NodePort | LoadBalancer | Ingress |
|--------|----------|-------------|---------|
| **Cost** | Free | Cloud LB cost (~$18/month on AWS) | Ingress controller + optional LB |
| **SSL/TLS** | Manual (not included) | Can terminate SSL | Built-in SSL termination |
| **Port range** | 30000-32767 only | Standard ports (80, 443) | Standard ports |
| **Production ready** | No — exposes node IPs | Yes | Yes |

**Our decision: NodePort**  
For a demo/assessment environment, NodePort is sufficient and free. It exposes our services on high ports (30080, 30090, 30030, 30443) accessible via any node IP. In production, we would use an Ingress controller (NGINX or Traefik) with an AWS ALB for SSL termination and proper DNS.
