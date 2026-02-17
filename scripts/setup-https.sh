#!/usr/bin/env bash
# ============================================================
# setup-https.sh — Install Nginx + Let's Encrypt on EC2
# Sets up HTTPS for api.awareness.market (backend API)
# Frontend (awareness.market) is served by Vercel
#
# Prerequisites:
#   1. DNS A record: api.awareness.market → 44.220.181.78
#   2. EC2 Security Group: inbound TCP 80 and 443 open
#
# Usage:
#   bash setup-https.sh
# ============================================================

set -euo pipefail

DOMAIN="api.awareness.market"
EMAIL="noreply@awareness.market"   # Let's Encrypt expiry alerts

echo "======================================================"
echo " HTTPS Setup for $DOMAIN"
echo "======================================================"

# ── 1. Install Nginx ───────────────────────────────────────
echo ""
echo "[1/6] Installing Nginx..."
if command -v nginx &>/dev/null; then
    echo "  Nginx already installed, skipping."
else
    sudo amazon-linux-extras install nginx1 -y 2>/dev/null || sudo yum install nginx -y
fi
sudo systemctl enable nginx
sudo systemctl start nginx
echo "  Nginx ready."

# ── 2. Install Certbot ──────────────────────────────────────
echo ""
echo "[2/6] Installing Certbot..."
if command -v certbot &>/dev/null; then
    echo "  Certbot already installed, skipping."
else
    sudo yum install -y augeas-libs 2>/dev/null || true
    if command -v snap &>/dev/null; then
        sudo snap install --classic certbot
        sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    else
        sudo python3 -m venv /opt/certbot/
        sudo /opt/certbot/bin/pip install --upgrade pip
        sudo /opt/certbot/bin/pip install certbot certbot-nginx
        sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot
    fi
fi
echo "  Certbot ready."

# ── 3. Create webroot dir for ACME challenges ──────────────
echo ""
echo "[3/6] Creating ACME challenge directory..."
sudo mkdir -p /var/www/certbot
sudo chown nginx:nginx /var/www/certbot 2>/dev/null || sudo chown www-data:www-data /var/www/certbot 2>/dev/null || true

# ── 4. Deploy temporary HTTP-only Nginx config for ACME ────
echo ""
echo "[4/6] Deploying temporary Nginx config for certificate request..."

# Remove old configs
sudo rm -f /etc/nginx/conf.d/awareness.market.conf
sudo rm -f /etc/nginx/conf.d/api.awareness.market.conf
sudo rm -f /etc/nginx/conf.d/default.conf

# Write temp HTTP-only config
sudo tee /etc/nginx/conf.d/api.awareness.market.conf > /dev/null <<NGINX_TEMP
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_TEMP

sudo nginx -t
sudo systemctl reload nginx
echo "  Temporary HTTP config deployed."

# ── 5. Obtain Let's Encrypt certificate ────────────────────
echo ""
echo "[5/6] Obtaining SSL certificate for $DOMAIN..."

# Check if cert already exists
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "  Certificate already exists. Attempting renewal..."
    sudo certbot renew --quiet || true
else
    sudo certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --domains "$DOMAIN"
fi

echo "  Certificate ready at /etc/letsencrypt/live/$DOMAIN/"

# ── 6. Deploy full HTTPS Nginx config ─────────────────────
echo ""
echo "[6/6] Deploying full HTTPS Nginx config..."
sudo cp /home/ec2-user/Awareness-Market/nginx/awareness.market.conf \
    /etc/nginx/conf.d/api.awareness.market.conf

sudo nginx -t
sudo systemctl reload nginx
echo "  HTTPS Nginx config active."

# ── Auto-renew via cron ────────────────────────────────────
echo ""
echo "Setting up auto-renewal cron job..."
# Remove duplicate entries, add clean one
(sudo crontab -l 2>/dev/null | grep -v "certbot renew"; echo "0 3 * * * certbot renew --quiet && systemctl reload nginx") | sudo crontab -

# ── Block direct port 3001 from internet ───────────────────
echo ""
echo "Ensuring port 3001 is not directly accessible..."
# Only block if not already blocked
sudo iptables -C INPUT -p tcp --dport 3001 -i eth0 -j DROP 2>/dev/null || \
    sudo iptables -A INPUT -p tcp --dport 3001 -i eth0 -j DROP 2>/dev/null || \
    echo "  (iptables not available — ensure port 3001 is blocked in AWS Security Group)"

echo ""
echo "======================================================"
echo " HTTPS setup complete!"
echo " API: https://$DOMAIN"
echo "======================================================"
echo ""
echo "Verify:"
echo "  curl -I https://$DOMAIN/api-docs/"
echo ""
echo "Next steps:"
echo "  1. Set VITE_API_URL=https://$DOMAIN in Vercel Dashboard"
echo "  2. Update Stripe webhook: https://$DOMAIN/api/stripe/webhook"
echo "  3. Update OAuth callbacks to https://$DOMAIN/api/auth/..."
