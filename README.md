# Secret-Secret

## Secure Messaging by Physical Separation

This application implements an intentionally inconvenient—but extremely robust—security model for exchanging encrypted messages. It is designed for users who prioritize security, and want to minimize attack surface over convenience.

The system requires two Android devices (Android 10+) and uses QR codes as a physical data transfer layer, creating a literal air gap between cryptographic operations and any networked environment.

### Security Architecture
#### Two-Device Threat Model

Transport Phone (Online)
- Your everyday Android device
- Can access cellular networks, Wi-Fi, and messaging platforms
- Handles message transport only
- Never stores long-term secrets

Client Phone (Offline)
- Dedicated, isolated device
- Intended to remain in airplane mode at all times
- Never connects to the internet
- Performs all cryptographic operations
- Stores keys locally in plain text to ensure transparency and verifiability

By separating message transport from key handling, the system eliminates entire classes of remote attacks, including malware, network interception, and remote exploitation.

### Air-Gapped Communication

Messages are transferred exclusively via:

- Camera
- QR codes

No Bluetooth, NFC, USB, Wi-Fi, or cellular data is ever used between devices.

This physical transfer method ensures:

- No hidden data channels
- No background transmissions
- No remote exfiltration of keys or plaintext
- Human-verifiable data flow


### Cryptography Details

Symmetric Encryption: AES-GCM

IV Size: 96-bit (per NIST recommendations)

Key Derivation: PBKDF2 with SHA-256

Default Key Material:
Randomly generated 8-word passphrases sourced from the BIP-39 word list

Keys are derived locally on the offline device and never leave it in digital form.

### Design Philosophy

This app assumes:

- Networks are hostile
- Online devices are compromised
- Convenience is the enemy of security

By forcing cryptographic operations onto an offline device and using a visible, physical transfer medium, the application dramatically reduces risk—even in high-threat environments.

There are no accounts, no cloud services, no telemetry, and no background connectivity.

Who This Is For

- Security researchers
- Journalists and activists
- Red-team / blue-team professionals
- Anyone who wants verifiable, offline-first encryption
- Users who understand that security comes from constraints

Minimum Requirements

- Android 10 or later
- Two Android devices
- A willingness to trade convenience for control

Review Appuse.drawio.pdf for more information.

Be sure to download the QRTool on the Transport Phone!