#!/usr/bin/env python3
"""Generate an ed25519 SSH keypair in OpenSSH format (replaces ssh-keygen)."""
import os
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

KEY_DIR = "/home/z/my-project/ssh"
PRIV_PATH = os.path.join(KEY_DIR, "leados_ed25519")
PUB_PATH = PRIV_PATH + ".pub"
COMMENT = "leados-agent"

os.makedirs(KEY_DIR, exist_ok=True)

# Generate the key
key = Ed25519PrivateKey.generate()

# Private key -> OpenSSH PEM format (unencrypted, no passphrase)
priv_pem = key.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.OpenSSH,
    encryption_algorithm=serialization.NoEncryption(),
)

# Public key -> OpenSSH one-line format
pub_openssh = key.public_key().public_bytes(
    encoding=serialization.Encoding.OpenSSH,
    format=serialization.PublicFormat.OpenSSH,
)

with open(PRIV_PATH, "wb") as f:
    f.write(priv_pem)
os.chmod(PRIV_PATH, 0o600)

with open(PUB_PATH, "wb") as f:
    f.write(pub_openssh + b" " + COMMENT.encode() + b"\n")
os.chmod(PUB_PATH, 0o644)

print("KEY_GENERATED_OK")
print("PUB:", pub_openssh.decode(), COMMENT)
