from pwdlib import PasswordHash

# Argon2 via pwdlib's recommended config. Store only hashes, never plaintext.
_password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return _password_hash.verify(password, hashed_password)
