#!/bin/bash
# SIMULATION: App-Container gegen die simulierte Bridge laufen lassen (kein Test an echter Hardware).
#
# Aufruf:  tests/sim/container_probelauf.sh <image> [sekunden_bis_docker_stop, Standard 25]
# Die App laeuft nach dem Testlauf weiter, deshalb wird sie immer per docker stop beendet.
# Der Container laeuft wie auf HA OS im Docker-Bridge-Netz (ohne host_network) und erreicht
# die simulierte Bridge ueber die Adresse des Docker-Hosts (docker0).
# Voraussetzung: Python mit requirements-dev.txt, Docker, Ports 443/tcp und 2100/udp frei.
set -euo pipefail

image=$1
stop_after=${2:-25}
root=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d)
mkdir -p "$work/data"
host_ip=$(docker network inspect bridge --format '{{(index .IPAM.Config 0).Gateway}}')
echo "{\"bridge_host\":\"$host_ip\",\"bridge_id\":\"0123456789abcdef\",\"testlauf\":true}" > "$work/data/options.json"
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$work/key.pem" -out "$work/cert.pem" \
  -days 1 -subj "/CN=sim-bridge" 2>/dev/null

python "$root/tests/sim/serve.py" --cert "$work/cert.pem" --key "$work/key.pem" \
  --host "$host_ip" --port 443 --report "$work/report.json" > "$work/sim.log" 2>&1 &
sim_pid=$!
sleep 1.5

container=lightshow_probelauf_$$
docker run -d --name "$container" -v "$work/data:/data" "$image" > /dev/null
sleep "$stop_after"
docker stop -t 60 "$container" > /dev/null
exit_code=$(docker wait "$container")
docker logs "$container"
docker rm "$container" > /dev/null
kill -TERM "$sim_pid"
wait "$sim_pid" || true

echo "Exit-Code App: $exit_code"
echo "Bericht der SIMULIERTEN Bridge:"
cat "$work/report.json"
echo
rm -rf "$work"
