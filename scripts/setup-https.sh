#!/usr/bin/env bash
# ============================================================
# setup-https.sh — Install Nginx + Let's Encrypt on EC2
# Run once on the EC2 instance to enable HTTPS for awareness.market
#
# Prerequisites:
#   1. DNS A record: awareness.market → 44.220.181.78
#   2. DNS A record: www.awareness.market → 44.220.181.78
#   3. EC2 Security Group: inbound TCP 80 and 443 open
#
# Usage:
#   bash setup-https.sh
# ============================================================

set -euo pipefail

DOMAIN="awareness.market"
EMAIL="noreply@awareness.market"   # Let's Encrypt expiry alerts

echo "======================================================"
echo " HTTPS Setup for $DOMAIN"
echo "======================================================"

# ── 1. Install Nginx ───────────────────────────────────────
echo ""
echo "[1/6] Installing Nginx..."
sudo amazon-linux-extras install nginx1 -y 2>/dev/null || sudo yum install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
echo "  Nginx installed and started."

# ── 2. Install Certbot (snap) ──────────────────────────────
echo ""
echo "[2/6] Installing Certbot..."
sudo yum install -y augeas-libs 2>/dev/null || true
# Try snap first (preferred), fall back to pip
if command -v snap &>/dev/null; then
    sudo snap install --classic certbot
    sudo ln -sf /snap/bin/certbot /usr/bin/certbot
elif ! command -v certbot &>/dev/null; then
    # Amazon Linux 2: use pip
    sudo python3 -m venv /opt/certbot/
    sudo /opt/certbot/bin/pip install --upgrade pip
    sudo /opt/certbot/bin/pip install certbot certbot-nginx
    sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot
fi
echo "  Certbot installed."

# ── 3. Create webroot dir for ACME challenges ──────────────
echo ""
echo "[3/6] Creating ACME challenge directory..."
sudo mkdir -p /var/www/certbot
sudo chown nginx:nginx /var/www/certbot

# ── 4. Deploy Nginx config ─────────────────────────────────
echo ""
echo "[4/6] Deploying Nginx configuration..."
sudo cp /home/ec2-user/Awareness-Market/nginx/awareness.market.conf \
    /etc/nginx/conf.d/awareness.market.conf

# Disable default nginx site if exists
sudo rm -f /etc/nginx/conf.d/default.conf

# For initial certificate request, use simple HTTP-only config
sudo tee /etc/nginx/conf.d/awareness.market.conf > /dev/null <<'NGINX_TEMP'
server {
    listen 80;
    listen [::]:80;
    server_name awareness.market www.awareness.market;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_TEMP

sudo nginx -t
sudo systemctl reload nginx
echo "  Nginx config deployed."

# ── 5. Obtain Let's Encrypt certificate ────────────────────
echo ""
echo "[5/6] Obtaining SSL certificate..."
sudo certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --domains "$DOMAIN,www.$DOMAIN"

echo "  Certificate obtained!"
echo "  Location: /etc/letsencrypt/live/$DOMAIN/"

# ── 6. Deploy full HTTPS Nginx config ─────────────────────
echo ""
echo "[6/6] Deploying full HTTPS Nginx config..."
sudo cp /home/ec2-user/Awareness-Market/nginx/awareness.market.conf \
    /etc/nginx/conf.d/awareness.market.conf

sudo nginx -t
sudo systemctl reload nginx

# ── Auto-renew via cron ────────────────────────────────────
echo ""
echo "Setting up auto-renewal cron job..."
(sudo crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | sudo crontab -

# ── Security: block direct port 3001 from internet ─────────
echo ""
echo "Configuring firewall (iptables) to block direct port 3001..."
sudo iptables -A INPUT -p tcp --dport 3001 -i eth0 -j DROP 2>/dev/null || \
    echo "  (iptables not available — block port 3001 via AWS Security Group)"

echo ""
echo "======================================================"
echo " HTTPS setup complete!"
echo " Site: https://$DOMAIN"
echo "======================================================"
echo ""
echo "Next steps:"
echo "  1. Verify DNS: dig +short $DOMAIN (should return 44.220.181.78)"
echo "  2. Test HTTPS: curl -I https://$DOMAIN"
echo "  3. Update Stripe webhook URL to https://$DOMAIN/api/stripe/webhook"
echo "  4. Update OAuth callback URLs in GitHub/Google apps"
