:8080 {
  root * /srv
  encode zstd gzip

  @health path /healthz
  respond @health 200 {
    body "ok"
    close
  }

  try_files {path} /index.html
  file_server

  header {
    X-Content-Type-Options "nosniff"
    Referrer-Policy "no-referrer"
    Permissions-Policy "camera=(), microphone=(), geolocation=()"
    -Server
  }
}
