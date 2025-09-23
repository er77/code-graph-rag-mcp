# Deployment Workflow

This document outlines the deployment procedures for xldb_proxy across different environments.

## Deployment Environments

### Development
- **Purpose**: Local development and feature testing
- **Configuration**: Debug mode, verbose logging, hot reload
- **Data**: Test databases, mock data
- **Security**: Relaxed settings for development ease

### Staging
- **Purpose**: Pre-production testing and validation
- **Configuration**: Production-like settings with additional logging
- **Data**: Sanitized production data or comprehensive test datasets
- **Security**: Production security with test certificates

### Production
- **Purpose**: Live system serving real users
- **Configuration**: Optimized performance, essential logging only
- **Data**: Live production databases
- **Security**: Full security hardening, production certificates

## Pre-deployment Checklist

### Code Quality Verification

```bash
# Run complete test suite
pytest --cov=xldb_proxy --cov-report=term-missing

# Verify code formatting
black --check .
isort --check-only .

# Type checking
mypy .

# Security scanning
bandit -r . -f json -o security-report.json

# Dependency vulnerability scanning
safety check
```

### Configuration Validation

```bash
# Validate configuration files
python -c "import xldb_config; print('Config validation: OK')"

# Check for sensitive data in config
grep -r "password\|secret\|key" xldb-sql-proxy.conf

# Validate environment-specific settings
python scripts/validate_config.py --env production
```

### Database Migration Preparation

```bash
# Backup current state database
cp data/state.db backups/state_$(date +%Y%m%d_%H%M%S).db

# Test migrations in staging
python migrations/run_migrations.py --dry-run

# Verify migration rollback procedures
python migrations/rollback.py --verify
```

## Docker Deployment

### Build Process

```bash
# Build production image
docker build -t xldb-proxy:latest .

# Build with specific version tag
docker build -t xldb-proxy:v1.2.3 .

# Multi-architecture build
docker buildx build --platform linux/amd64,linux/arm64 -t xldb-proxy:latest .
```

### Container Configuration

#### Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  xldb-proxy:
    image: xldb-proxy:v1.2.3
    restart: unless-stopped
    ports:
      - "55080:55080"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./config:/app/config
      - ./backups:/app/backups
    environment:
      - XLDB_ENV=production
      - XLDB_CONFIG_FILE=/app/config/xldb-sql-proxy.conf
      - XLDB_LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:55080/ping"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - xldb-proxy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  log-aggregator:
    image: fluent/fluent-bit:latest
    volumes:
      - ./logs:/var/log/xldb:ro
      - ./fluent-bit/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro
    depends_on:
      - xldb-proxy
```

### Container Orchestration

#### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: xldb-proxy
  labels:
    app: xldb-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: xldb-proxy
  template:
    metadata:
      labels:
        app: xldb-proxy
    spec:
      containers:
      - name: xldb-proxy
        image: xldb-proxy:v1.2.3
        ports:
        - containerPort: 55080
        env:
        - name: XLDB_ENV
          value: "production"
        - name: XLDB_CONFIG_FILE
          value: "/app/config/xldb-sql-proxy.conf"
        volumeMounts:
        - name: config-volume
          mountPath: /app/config
        - name: data-volume
          mountPath: /app/data
        - name: logs-volume
          mountPath: /app/logs
        livenessProbe:
          httpGet:
            path: /ping
            port: 55080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ping
            port: 55080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi" 
            cpu: "1000m"
      volumes:
      - name: config-volume
        configMap:
          name: xldb-config
      - name: data-volume
        persistentVolumeClaim:
          claimName: xldb-data-pvc
      - name: logs-volume
        persistentVolumeClaim:
          claimName: xldb-logs-pvc
```

## Traditional Server Deployment

### System Service Setup

#### Create System User

```bash
# Create dedicated user
sudo useradd -r -s /bin/false xldbproxy
sudo mkdir -p /opt/xldb
sudo chown xldbproxy:xldbproxy /opt/xldb
```

#### Application Installation

```bash
# Deploy application files
sudo -u xldbproxy git clone <repository> /opt/xldb/app
cd /opt/xldb/app

# Create virtual environment
sudo -u xldbproxy python3 -m venv venv
sudo -u xldbproxy venv/bin/pip install -r requirements.txt

# Set up configuration
sudo -u xldbproxy cp xldb-sql-proxy.conf.example xldb-sql-proxy.conf
sudo nano /opt/xldb/app/xldb-sql-proxy.conf
```

#### Systemd Service Configuration

```ini
# /etc/systemd/system/xldb-proxy.service
[Unit]
Description=XLDB Proxy Service
After=network.target

[Service]
Type=exec
User=xldbproxy
Group=xldbproxy
WorkingDirectory=/opt/xldb/app
Environment=PATH=/opt/xldb/app/venv/bin
ExecStart=/opt/xldb/app/venv/bin/uvicorn main:app --host 0.0.0.0 --port 55080 --workers 4 --log-config uvicorn.yaml
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=3

# Security settings
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/opt/xldb/data /opt/xldb/logs

[Install]
WantedBy=multi-user.target
```

#### Service Management

```bash
# Install and start service
sudo systemctl daemon-reload
sudo systemctl enable xldb-proxy
sudo systemctl start xldb-proxy

# Monitor service
sudo systemctl status xldb-proxy
sudo journalctl -u xldb-proxy -f
```

## Database Migration Workflow

### Migration Scripts

```python
# migrations/migration_001.py
def up():
    """Apply migration"""
    state_db.execute("""
        ALTER TABLE connections 
        ADD COLUMN ssl_config TEXT
    """)

def down():
    """Rollback migration"""
    state_db.execute("""
        ALTER TABLE connections 
        DROP COLUMN ssl_config
    """)
```

### Migration Execution

```bash
# Run pending migrations
python migrations/run_migrations.py

# Rollback last migration
python migrations/rollback.py --steps 1

# Check migration status
python migrations/status.py
```

### Zero-Downtime Migration Strategy

1. **Phase 1: Additive Changes**
   ```python
   # Add new columns/tables without removing old ones
   def migration_phase1():
       add_new_columns()
       create_new_tables()
   ```

2. **Phase 2: Data Migration**
   ```python
   # Migrate data to new structures
   def migration_phase2():
       migrate_existing_data()
       validate_data_integrity()
   ```

3. **Phase 3: Cleanup**
   ```python
   # Remove old structures after validation
   def migration_phase3():
       drop_old_columns()
       drop_old_tables()
   ```

## Load Balancer Configuration

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/xldb-proxy
upstream xldb_backend {
    least_conn;
    server 10.0.1.10:55080 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:55080 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:55080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name xldb-proxy.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xldb-proxy.example.com;
    
    ssl_certificate /etc/ssl/certs/xldb-proxy.crt;
    ssl_certificate_key /etc/ssl/private/xldb-proxy.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req zone=api burst=20 nodelay;
    
    location / {
        proxy_pass http://xldb_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check for load balancing
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### HAProxy Configuration

```
# /etc/haproxy/haproxy.cfg
global
    daemon
    log stdout local0 info
    
defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    
frontend xldb_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/xldb-proxy.pem
    redirect scheme https if !{ ssl_fc }
    
    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request reject if { sc_http_req_rate(0) gt 100 }
    
    default_backend xldb_backend

backend xldb_backend
    balance roundrobin
    option httpchk GET /ping
    
    server xldb1 10.0.1.10:55080 check inter 5s rise 2 fall 3
    server xldb2 10.0.1.11:55080 check inter 5s rise 2 fall 3
    server xldb3 10.0.1.12:55080 check inter 5s rise 2 fall 3
```

## Monitoring and Alerting

### Health Checks

```python
# health_check.py
import requests
import time
import logging

def check_health():
    try:
        response = requests.get("http://localhost:55080/ping", timeout=5)
        if response.status_code == 200:
            return True, "Service healthy"
        else:
            return False, f"HTTP {response.status_code}"
    except requests.exceptions.RequestException as e:
        return False, f"Connection error: {e}"

def check_database_connectivity():
    try:
        response = requests.get("http://localhost:55080/connections", timeout=10)
        return response.status_code == 200, f"Database check: {response.status_code}"
    except requests.exceptions.RequestException as e:
        return False, f"Database connectivity error: {e}"
```

### Monitoring Setup

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  prometheus_data:
  grafana_data:
```

### Alert Configuration

```yaml
# monitoring/alerts.yml
groups:
- name: xldb-proxy
  rules:
  - alert: ServiceDown
    expr: up{job="xldb-proxy"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "XLDB Proxy service is down"
      description: "XLDB Proxy has been down for more than 1 minute"
      
  - alert: HighResponseTime
    expr: http_request_duration_seconds{quantile="0.95"} > 5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"
      
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} requests per second"
```

## Rollback Procedures

### Application Rollback

```bash
#!/bin/bash
# rollback.sh

PREVIOUS_VERSION=$1
BACKUP_DIR="/opt/xldb/backups"

if [ -z "$PREVIOUS_VERSION" ]; then
    echo "Usage: $0 <previous_version>"
    exit 1
fi

echo "Rolling back to version $PREVIOUS_VERSION"

# Stop current service
sudo systemctl stop xldb-proxy

# Backup current version
sudo cp -r /opt/xldb/app "/opt/xldb/backups/app_$(date +%Y%m%d_%H%M%S)"

# Restore previous version
sudo rm -rf /opt/xldb/app
sudo cp -r "$BACKUP_DIR/app_$PREVIOUS_VERSION" /opt/xldb/app
sudo chown -R xldbproxy:xldbproxy /opt/xldb/app

# Restore database if needed
if [ -f "$BACKUP_DIR/state_$PREVIOUS_VERSION.db" ]; then
    sudo cp "$BACKUP_DIR/state_$PREVIOUS_VERSION.db" /opt/xldb/data/state.db
fi

# Start service
sudo systemctl start xldb-proxy

# Verify rollback
sleep 10
curl -f http://localhost:55080/ping && echo "Rollback successful" || echo "Rollback failed"
```

### Database Rollback

```python
# rollback_database.py
def rollback_to_migration(target_migration):
    current = get_current_migration()
    
    while current > target_migration:
        migration_file = f"migrations/migration_{current:03d}.py"
        module = import_module(migration_file)
        
        print(f"Rolling back migration {current}")
        module.down()
        
        update_migration_version(current - 1)
        current -= 1
    
    print(f"Rollback complete. Current migration: {current}")
```

## Security Hardening

### SSL/TLS Configuration

```bash
# Generate SSL certificates
openssl req -new -newkey rsa:4096 -days 365 -nodes -x509 \
    -keyout xldb-proxy.key \
    -out xldb-proxy.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=xldb-proxy.example.com"

# Set proper permissions
chmod 600 xldb-proxy.key
chmod 644 xldb-proxy.crt
```

### Firewall Configuration

```bash
# UFW configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from 10.0.0.0/8 to any port 55080
sudo ufw enable
```

### Security Scanning

```bash
# Container security scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy image xldb-proxy:latest

# Infrastructure scanning
nmap -sV -sC xldb-proxy.example.com

# SSL/TLS testing
sslyze --regular xldb-proxy.example.com
```

## Backup and Recovery

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/xldb/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup state database
cp /opt/xldb/data/state.db "$BACKUP_DIR/state_db_$DATE.db"
gzip "$BACKUP_DIR/state_db_$DATE.db"

# Backup configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" -C /opt/xldb config/

# Backup logs (last 7 days)
find /opt/xldb/logs -name "*.log" -mtime -7 -exec tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" {} +

# Cleanup old backups
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $DATE"
```

### Recovery Procedures

```bash
#!/bin/bash
# recover.sh

BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
    echo "Available backups:"
    ls -la /opt/xldb/backups/ | grep state_db
    echo "Usage: $0 <backup_date>"
    exit 1
fi

# Stop service
sudo systemctl stop xldb-proxy

# Restore database
gunzip -c "/opt/xldb/backups/state_db_$BACKUP_DATE.db.gz" > /opt/xldb/data/state.db

# Restore configuration if available
if [ -f "/opt/xldb/backups/config_$BACKUP_DATE.tar.gz" ]; then
    tar -xzf "/opt/xldb/backups/config_$BACKUP_DATE.tar.gz" -C /opt/xldb/
fi

# Set permissions
sudo chown -R xldbproxy:xldbproxy /opt/xldb/data /opt/xldb/config

# Start service
sudo systemctl start xldb-proxy

echo "Recovery completed from backup: $BACKUP_DATE"
```

This deployment workflow ensures reliable, secure, and scalable deployment of xldb_proxy across different environments while maintaining data integrity and system availability.