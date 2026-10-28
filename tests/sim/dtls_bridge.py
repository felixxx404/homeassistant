"""SIMULATION: DTLS-1.2-PSK-Server (TLS_PSK_WITH_AES_128_GCM_SHA256) wie die Hue Bridge.

Verhalten nach RFC 6347/5487 mit Cookie-Austausch (HelloVerifyRequest). Wie mbedTLS
auf der Bridge toleriert der Server beim zweiten ClientHello die message_seq 0, die
hue-entertainment 0.1.2 sendet (OpenSSL verwirft das; deshalb dieser eigene Server).
Der Server prueft das Client-Finished (gleicher PSK, gleiche Schluessel) und
entschluesselt danach die HueStream-Pakete.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import socket
import struct
import threading
import time
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

DTLS_1_2 = 0xFEFD
CT_CCS, CT_ALERT, CT_HANDSHAKE, CT_APP = 20, 21, 22, 23
HT_CLIENT_HELLO, HT_SERVER_HELLO, HT_HELLO_VERIFY = 1, 2, 3
HT_SERVER_HELLO_DONE, HT_CLIENT_KEY_EXCHANGE, HT_FINISHED = 14, 16, 20
CIPHER_PSK_AES128_GCM_SHA256 = b"\x00\xa8"


@dataclass
class HueStreamFrame:
    received: float
    sequence: int
    color_space: int
    area_id: str
    channels: dict[int, tuple[int, int, int]]


def prf(secret: bytes, label: bytes, seed: bytes, length: int) -> bytes:
    out = b""
    a = hmac.new(secret, label + seed, hashlib.sha256).digest()
    while len(out) < length:
        out += hmac.new(secret, a + label + seed, hashlib.sha256).digest()
        a = hmac.new(secret, a, hashlib.sha256).digest()
    return out[:length]


def parse_huestream(payload: bytes, received: float) -> HueStreamFrame:
    if payload[:9] != b"HueStream":
        raise ValueError("kein HueStream-Header")
    if payload[9:11] != b"\x02\x00":
        raise ValueError(f"HueStream-Version {payload[9:11].hex()} statt 0200")
    sequence = payload[11]
    color_space = payload[14]
    area_id = payload[16:52].decode("ascii")
    body = payload[52:]
    if len(body) % 7:
        raise ValueError("Kanal-Datensatz nicht 7 Byte lang")
    channels: dict[int, tuple[int, int, int]] = {}
    for offset in range(0, len(body), 7):
        ch, r, g, b = struct.unpack("!BHHH", body[offset : offset + 7])
        channels[ch] = (r, g, b)
    return HueStreamFrame(received, sequence, color_space, area_id, channels)


class SimulatedDtlsBridge:
    """SIMULATION: nimmt genau eine DTLS-Sitzung an und sammelt HueStream-Frames."""

    def __init__(self, identity: str, psk_hex: str, host: str = "127.0.0.1", port: int = 2100):
        self.identity = identity.encode()
        self.psk = bytes.fromhex(psk_hex)
        self.frames: list[HueStreamFrame] = []
        self.handshake_ok = threading.Event()
        self.errors: list[str] = []
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind((host, port))
        self._sock.settimeout(0.2)
        self._running = True
        self._thread = threading.Thread(target=self._serve, name="sim-dtls-bridge", daemon=True)
        self._thread.start()

    def close(self) -> None:
        """Server beenden (simuliert Bridge weg / Netz weg)."""
        self._running = False
        self._thread.join(timeout=2)
        self._sock.close()

    # -- Server-Ablauf --

    def _serve(self) -> None:
        peer = None
        cookie = os.urandom(20)
        transcript = bytearray()
        client_random = server_random = b""
        keys: dict[str, bytes] = {}
        state = "hello1"
        out_seq = 0
        while self._running:
            try:
                data, addr = self._sock.recvfrom(4096)
            except TimeoutError:
                continue
            except OSError:
                return
            if peer is None:
                peer = addr
            for ctype, epoch, seq, fragment in _records(data):
                try:
                    if state in ("hello1", "hello2") and ctype == CT_HANDSHAKE and epoch == 0:
                        msg_type, body, full = _handshake(fragment)
                        if msg_type != HT_CLIENT_HELLO:
                            continue
                        hello = _parse_client_hello(body)
                        if CIPHER_PSK_AES128_GCM_SHA256 not in hello["ciphers"]:
                            self.errors.append("Client bietet PSK-AES128-GCM-SHA256 nicht an")
                            continue
                        if not hello["cookie"]:
                            hvr = struct.pack("!HB", DTLS_1_2, len(cookie)) + cookie
                            out_seq = self._send_hs(peer, HT_HELLO_VERIFY, hvr, 0, out_seq)
                            state = "hello2"
                            continue
                        if hello["cookie"] != cookie:
                            self.errors.append("falscher Cookie")
                            continue
                        client_random = hello["random"]
                        server_random = os.urandom(32)
                        transcript = bytearray(full)
                        sh = (
                            struct.pack("!H", DTLS_1_2)
                            + server_random
                            + b"\x00"
                            + CIPHER_PSK_AES128_GCM_SHA256
                            + b"\x00"
                        )
                        sh_msg = _hs_message(HT_SERVER_HELLO, sh, 1)
                        shd_msg = _hs_message(HT_SERVER_HELLO_DONE, b"", 2)
                        transcript += sh_msg + shd_msg
                        packet = _record(CT_HANDSHAKE, 0, out_seq, sh_msg)
                        packet += _record(CT_HANDSHAKE, 0, out_seq + 1, shd_msg)
                        out_seq += 2
                        self._sock.sendto(packet, peer)
                        state = "cke"
                    elif state == "cke" and ctype == CT_HANDSHAKE and epoch == 0:
                        msg_type, body, full = _handshake(fragment)
                        if msg_type != HT_CLIENT_KEY_EXCHANGE:
                            continue
                        (id_len,) = struct.unpack("!H", body[:2])
                        if body[2 : 2 + id_len] != self.identity:
                            self.errors.append("falsche PSK-Identitaet")
                            return
                        transcript += full
                        keys = _derive(self.psk, client_random, server_random)
                        state = "ccs"
                    elif state == "ccs" and ctype == CT_CCS:
                        state = "finished"
                    elif state == "finished" and ctype == CT_HANDSHAKE and epoch == 1:
                        plain = _decrypt(keys, ctype, epoch, seq, fragment)
                        msg_type, verify, full = _handshake(plain)
                        expected = prf(
                            keys["master"],
                            b"client finished",
                            hashlib.sha256(transcript).digest(),
                            12,
                        )
                        if msg_type != HT_FINISHED or verify != expected:
                            self.errors.append("Client-Finished ungueltig (PSK/Schluessel falsch)")
                            return
                        transcript += full
                        self._sock.sendto(_record(CT_CCS, 0, out_seq, b"\x01"), peer)
                        server_verify = prf(
                            keys["master"],
                            b"server finished",
                            hashlib.sha256(transcript).digest(),
                            12,
                        )
                        fin = _hs_message(HT_FINISHED, server_verify, 4)
                        self._sock.sendto(_encrypt(keys, CT_HANDSHAKE, 1, 0, fin), peer)
                        self.handshake_ok.set()
                        state = "stream"
                    elif state == "stream" and ctype == CT_APP and epoch == 1:
                        plain = _decrypt(keys, ctype, epoch, seq, fragment)
                        self.frames.append(parse_huestream(plain, time.monotonic()))
                except Exception as err:  # noqa: BLE001 - Simulator sammelt Fehler fuer den Test
                    self.errors.append(f"{type(err).__name__}: {err}")

    def _send_hs(self, peer, msg_type: int, body: bytes, msg_seq: int, rec_seq: int) -> int:
        self._sock.sendto(
            _record(CT_HANDSHAKE, 0, rec_seq, _hs_message(msg_type, body, msg_seq)), peer
        )
        return rec_seq + 1


def _records(data: bytes):
    offset = 0
    while offset + 13 <= len(data):
        ctype, version, epoch, seq6, length = struct.unpack("!BHH6sH", data[offset : offset + 13])
        if version != DTLS_1_2:
            raise ValueError(f"Record-Version {version:#x}")
        yield ctype, epoch, int.from_bytes(seq6, "big"), data[offset + 13 : offset + 13 + length]
        offset += 13 + length


def _record(ctype: int, epoch: int, seq: int, fragment: bytes) -> bytes:
    return (
        struct.pack("!BHH6sH", ctype, DTLS_1_2, epoch, seq.to_bytes(6, "big"), len(fragment))
        + fragment
    )


def _hs_message(msg_type: int, body: bytes, msg_seq: int) -> bytes:
    length = len(body).to_bytes(3, "big")
    return struct.pack("!B3sH3s3s", msg_type, length, msg_seq, b"\x00\x00\x00", length) + body


def _handshake(fragment: bytes) -> tuple[int, bytes, bytes]:
    msg_type = fragment[0]
    length = int.from_bytes(fragment[1:4], "big")
    frag_off = int.from_bytes(fragment[6:9], "big")
    frag_len = int.from_bytes(fragment[9:12], "big")
    if frag_off != 0 or frag_len != length:
        raise ValueError("fragmentierte Handshake-Nachricht")
    return msg_type, fragment[12 : 12 + length], fragment[: 12 + length]


def _parse_client_hello(body: bytes) -> dict:
    offset = 2
    rnd = body[offset : offset + 32]
    offset += 32
    sid_len = body[offset]
    offset += 1 + sid_len
    cookie_len = body[offset]
    cookie = body[offset + 1 : offset + 1 + cookie_len]
    offset += 1 + cookie_len
    (cs_len,) = struct.unpack("!H", body[offset : offset + 2])
    ciphers = body[offset + 2 : offset + 2 + cs_len]
    suites = [ciphers[i : i + 2] for i in range(0, len(ciphers), 2)]
    return {"random": rnd, "cookie": cookie, "ciphers": suites}


def _derive(psk: bytes, client_random: bytes, server_random: bytes) -> dict[str, bytes]:
    n = len(psk)
    pre_master = struct.pack("!H", n) + b"\x00" * n + struct.pack("!H", n) + psk
    master = prf(pre_master, b"master secret", client_random + server_random, 48)
    block = prf(master, b"key expansion", server_random + client_random, 40)
    return {
        "master": master,
        "client_key": block[0:16],
        "server_key": block[16:32],
        "client_iv": block[32:36],
        "server_iv": block[36:40],
    }


def _decrypt(keys: dict[str, bytes], ctype: int, epoch: int, seq: int, fragment: bytes) -> bytes:
    explicit = fragment[:8]
    ciphertext = fragment[8:]
    nonce = keys["client_iv"] + explicit
    seq_num = struct.pack("!H", epoch) + seq.to_bytes(6, "big")
    aad = seq_num + struct.pack("!BHH", ctype, DTLS_1_2, len(ciphertext) - 16)
    return AESGCM(keys["client_key"]).decrypt(nonce, ciphertext, aad)


def _encrypt(keys: dict[str, bytes], ctype: int, epoch: int, seq: int, plain: bytes) -> bytes:
    seq_num = struct.pack("!H", epoch) + seq.to_bytes(6, "big")
    nonce = keys["server_iv"] + seq_num
    aad = seq_num + struct.pack("!BHH", ctype, DTLS_1_2, len(plain))
    fragment = seq_num + AESGCM(keys["server_key"]).encrypt(nonce, plain, aad)
    return _record(ctype, epoch, seq, fragment)
