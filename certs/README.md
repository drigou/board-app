Put your company's root certificate(s) here as `.crt` or `.pem` (Base-64 / PEM format).
They are trusted while building the Docker image, which is needed behind a corporate
proxy that inspects HTTPS (Zscaler, Netskope, …). Certificate files are git-ignored.
