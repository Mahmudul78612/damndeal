#!/bin/bash
set -e

echo "=== 1. Backup .env ==="
cp /var/www/damndeal/.env /var/www/damndeal/.env.bak.$(date +%s)
grep CORS_ORIGINS /var/www/damndeal/.env

echo "=== 2. Update CORS_ORIGINS ==="
if ! grep -q "https://damndeal.com" /var/www/damndeal/.env; then
  sed -i 's|^CORS_ORIGINS=.*|&,https://damndeal.com,https://www.damndeal.com|' /var/www/damndeal/.env
fi
grep CORS_ORIGINS /var/www/damndeal/.env

echo "=== 3. Enable nginx site ==="
ln -sf /etc/nginx/sites-available/damndeal.com /etc/nginx/sites-enabled/damndeal.com
mkdir -p /var/www/html/.well-known/acme-challenge

echo "=== 4. nginx -t ==="
nginx -t

echo "=== 5. reload nginx ==="
systemctl reload nginx

echo "=== 6. certbot ==="
certbot --nginx -d damndeal.com -d www.damndeal.com --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "=== 7. final nginx reload ==="
nginx -t && systemctl reload nginx

echo "=== 8. restart api ==="
pm2 restart damndeal-api --update-env

echo "=== DONE ==="
pm2 list
