# aaPanel — Site PHP → Static

SGMS reverse proxy zaten çalışıyorsa (`127.0.0.1:3100`), aaPanel site tipini **Static** yapmak isteğe bağlıdır.

## Adımlar (aaPanel)

1. **Website** → `sgms.cicibyte.com` → **Site directory**
2. **Running directory** / site type: **Static** (veya PHP kapalı)
3. **Reverse proxy** kuralını koruyun:
   - Target: `http://127.0.0.1:3100`
   - `/_next/static/` için Nginx alias (bkz. `docs/deployment/NGINX-AAPANEL.md`)
4. PHP sürümünü bu site için devre dışı bırakın (gereksiz yorumlayıcı yükü kalkar)
5. SSL / Cloudflare ayarları değişmez

## Doğrulama

```bash
curl -sI https://sgms.cicibyte.com/login | head -5
pnpm deploy:verify
```

## Not

- Bu adım yalnızca panel yapılandırmasıdır; repo içinde otomatikleştirilmez.
- `license.cicibyte.com` komşu sitesine dokunmayın.
