#!/usr/bin/env bash
set -euo pipefail

apt-get update -y
apt-get install -y nginx

# Nginx: force UTF-8
cat >/etc/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.html;

    charset utf-8;
    charset_types text/html text/plain text/css application/javascript application/json;

    location / {
        try_files $uri $uri/ =404;
    }
}
EOF

# HTML: unicorn ASCII only (no text)
cat >/var/www/html/index.html <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title></title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      background: #ffffff;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    pre {
      margin: 0;
      font-family: "Courier New", monospace;
      font-size: 16px;
      line-height: 1.1;
      color: #111111;
      white-space: pre;
    }
  </style>
</head>
<body>
<pre>
                   \
                    \
                     \\
                      \\
                       >\/7
                   _.-(6'  \
                  (=___._/` \
                       )  \ |
                      /   / |
                     /    > /
                    j    < _\
                _.-' :      ``.
                \ r=._\        `.
               <`\\_  \         .`-.
                \ r-7  `-. ._  ' .  `\
                 \`,      `-.`7  7)   )
                  \/         \|  \'  / `-._
                             ||    .'
                              \\  (
                               >\  >
                           ,.-' >.'
                          <.'_.''
                            <'
</pre>
</body>
</html>
EOF

nginx -t
systemctl enable nginx
systemctl restart nginx
