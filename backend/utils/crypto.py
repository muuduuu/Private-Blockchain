import hashlib
from typing import Tuple
import os
import json
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization

def sha256_hash(data) -> str:
    if isinstance(data,dict):
        data_string= json.dumps(data, sort_keys=True)
    elif isinstance(data, list):
        data_string= json.dumps(data)
    else:
        data_string=str(data)
    return hashlib.sha256(data_string.encode('utf-8')).hexdigest()

def generate_keypair() -> Tuple[str, str]:
    private_key_obj = ed25519.Ed25519PrivateKey.generate()
    public_key_obj = private_key_obj.public_key()
    private_key_bites= private_key_obj.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption()
    )
    public_key_bites= public_key_obj.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )
    public_key_hex = public_key_bites.hex()
    private_key_hex = private_key_bites.hex()
    return (public_key_hex, private_key_hex)

def sign_message(message: str, private_key_hex: str) -> str:
    private_key_bites = bytes.fromhex(private_key_hex)
    private_key_obj = ed25519.Ed25519PrivateKey.from_private_bytes(private_key_bites)
    signature = private_key_obj.sign(message.encode('utf-8'))
    return signature.hex()

def verify_signature(message: str, signature_hex: str, public_key_hex: str) -> bool:
    public_key_bites = bytes.fromhex(public_key_hex)
    public_key_obj = ed25519.Ed25519PublicKey.from_public_bytes(public_key_bites)
    signature_bites = bytes.fromhex(signature_hex)
    try:
        public_key_obj.verify(signature_bites, message.encode('utf-8'))
        return True
    except Exception:
        return False
