# Catan Online — Deployment Guide

## Quick Start (Local)

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Docker

```bash
# Build
docker build -t catan-online .

# Run
docker run -p 3000:3000 catan-online

# With custom port
docker run -p 8080:3000 -e PORT=3000 catan-online
```

## EC2 Deployment

### 1. Launch Instance
- **AMI:** Amazon Linux 2023 or Ubuntu 22.04
- **Instance type:** t3.small (sufficient for ~50 concurrent games)
- **Security group:** Allow inbound TCP 3000 (or 80/443 with reverse proxy)

### 2. Install Docker
```bash
# Amazon Linux
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Ubuntu
sudo apt update && sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
```

### 3. Deploy
```bash
# Copy your code to EC2 (or git clone)
scp -r . ec2-user@<EC2_IP>:~/catan

# SSH in and build
ssh ec2-user@<EC2_IP>
cd ~/catan
docker build -t catan-online .
docker run -d --restart unless-stopped -p 3000:3000 --name catan catan-online
```

### 4. (Optional) Nginx Reverse Proxy
```bash
sudo apt install -y nginx

# /etc/nginx/sites-available/catan
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

The `Upgrade` and `Connection` headers are critical for Socket.IO WebSocket connections.

### 5. (Optional) SSL with Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Set to `production` for optimized builds |

## Health Check

```bash
curl http://localhost:3000/
```

Returns the game lobby page. The Docker healthcheck pings this every 30s.
