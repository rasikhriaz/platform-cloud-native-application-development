# Failure Recovery Runbook

**Platform:** Cloud-Native Application on Kubernetes (kubeadm)  
**Cluster:** 3-node AWS EC2 (1 control-plane + 2 workers)  
**Author:** Muhammad Rasikh Riaz

---

## Scenario 1: Pod Crash / OOMKilled

**Symptom:** Pod status shows `CrashLoopBackOff` or `OOMKilled`

**Detection:**
- Kubernetes liveness probe fails → kubelet restarts the pod automatically
- Prometheus alert: `kube_pod_container_status_restarts_total` increases
- Grafana dashboard shows pod restart count spike

**Automatic Recovery:**
- Kubernetes self-healing restarts the pod (restartPolicy: Always)
- HPA maintains minimum 2 replicas — if one crashes, the other serves traffic

**Manual Investigation:**
```bash
kubectl describe pod <pod-name> -n platform-demo
kubectl logs <pod-name> -n platform-demo --previous
kubectl top pod -n platform-demo   # check memory usage
```

**Root Cause Fix:**
- If OOMKilled → increase memory limits in deployment.yml
- If CrashLoopBackOff → check application logs for startup errors

---

## Scenario 2: Node Failure (Worker Node Goes Down)

**Symptom:** `kubectl get nodes` shows a worker as `NotReady`

**Detection:**
- Node controller marks node as NotReady after 40 seconds (default)
- Pods on that node are evicted after 5 minutes (default toleration)
- Prometheus: `kube_node_status_condition{condition="Ready",status="true"}` drops

**Automatic Recovery:**
- Kubernetes scheduler reschedules pods to the healthy worker node
- PodDisruptionBudget ensures at least 1 pod remains available
- HPA scales up if CPU threshold is exceeded on remaining pods

**Manual Steps:**
```bash
# Check node status
kubectl get nodes
kubectl describe node <failed-node>

# If EC2 instance is stopped, restart it
aws ec2 start-instances --instance-ids <instance-id>

# After node comes back
sudo systemctl restart kubelet
kubectl get nodes   # should show Ready within 1-2 minutes
```

**Prevention:**
- Use multiple availability zones for worker nodes
- Set pod anti-affinity to spread replicas across nodes

---

## Scenario 3: Control Plane Failure (Master Node Down)

**Symptom:** `kubectl` commands timeout or return connection refused

**Impact:** 
- Existing pods continue running (kubelet manages them locally)
- No new scheduling, scaling, or deployments are possible
- ArgoCD cannot sync changes
- HPA cannot scale pods (API server unreachable)

**Recovery:**
```bash
# SSH into the master node
ssh ubuntu@<master-ip>

# Restart control plane components
sudo systemctl restart kubelet

# Check etcd, API server, controller-manager, scheduler
sudo crictl pods --namespace kube-system

# If etcd is corrupted, restore from backup
# (This is why etcd backups are critical in production)
```

**Prevention:**
- In production: use multi-master HA setup (3 control-plane nodes)
- Schedule regular etcd snapshots:
```bash
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%Y%m%d).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

---

## Scenario 4: ArgoCD Loses Connectivity to Cluster

**Symptom:** ArgoCD UI shows application as "Unknown" or "ConnectionRefused"

**Detection:**
- ArgoCD dashboard shows sync status as Unknown
- No new deployments are applied despite Git changes

**Impact:**
- GitOps pipeline is broken — changes in Git are not applied
- Existing pods continue running normally
- Manual `kubectl apply` still works as a fallback

**Recovery:**
```bash
# Restart ArgoCD components
kubectl rollout restart deployment argocd-server -n argocd
kubectl rollout restart deployment argocd-repo-server -n argocd
kubectl rollout restart deployment argocd-application-controller -n argocd

# Check ArgoCD pods
kubectl get pods -n argocd

# Verify cluster connection
kubectl exec -n argocd deployment/argocd-server -- argocd cluster list

# If cluster credentials expired, re-add
argocd cluster add <context-name>
```

**Trade-off:** ArgoCD self-heal is a double-edged sword. If someone manually fixes a critical issue via kubectl, ArgoCD will revert it within 3 minutes. In emergencies, temporarily disable auto-sync:
```bash
argocd app set platform-demo --sync-policy none
```

---

## Scenario 5: HPA Not Scaling (Shows "unknown" CPU)

**Symptom:** `kubectl get hpa -n platform-demo` shows `<unknown>/50%` for CPU

**Root Cause:** Metrics Server is not running or cannot reach kubelets

**Recovery:**
```bash
# Check Metrics Server
kubectl get pods -n kube-system | grep metrics-server

# Common fix: add --kubelet-insecure-tls flag
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Verify
kubectl top nodes
kubectl top pods -n platform-demo
```

---

## Scenario 6: Prometheus Targets Down

**Symptom:** Prometheus UI → Targets shows endpoints as DOWN

**Detection:**
- Grafana dashboards show "No Data"
- `up{job="platform-demo"}` returns 0

**Recovery:**
```bash
# Check Prometheus pod
kubectl logs deployment/prometheus -n platform-demo

# Verify service discovery
kubectl get endpoints -n platform-demo

# Restart Prometheus
kubectl rollout restart deployment/prometheus -n platform-demo

# If scrape config is wrong, edit the ConfigMap
kubectl edit configmap prometheus-config -n platform-demo
```

---

## Scenario 7: Network Partition Between Nodes

**Symptom:** Pods on one worker cannot communicate with pods on another

**Detection:**
- Intermittent 5xx errors from the application
- `kubectl exec` into a pod and curl another pod's IP fails
- Calico logs show dropped packets

**Recovery:**
```bash
# Check Calico status
kubectl get pods -n kube-system | grep calico

# Restart Calico on affected node
kubectl delete pod calico-node-<hash> -n kube-system

# Verify node-to-node connectivity
kubectl exec -n platform-demo <pod-on-node1> -- ping <pod-ip-on-node2>

# Check AWS security group rules — ensure all traffic between nodes is allowed
```

---

## Recovery Priority Matrix

| Scenario | Severity | Auto-Recovery? | Time to Recover |
|----------|----------|---------------|-----------------|
| Pod crash | Low | Yes (kubelet restart) | 10-30 seconds |
| Worker node failure | Medium | Partial (rescheduling) | 2-5 minutes |
| Control plane failure | Critical | No | 5-15 minutes |
| ArgoCD connectivity loss | Medium | No | 2-5 minutes |
| HPA not scaling | Low | No | 1-2 minutes |
| Prometheus down | Low | No | 1-2 minutes |
| Network partition | High | Partial (Calico self-heal) | 2-10 minutes |
