ARG BUILD_FROM
FROM ${BUILD_FROM}

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --only-binary=:all: -r requirements.txt

COPY lightshow ./lightshow
COPY mapping.yaml ./mapping.yaml

# Ohne s6-overlay: Supervisor startet mit init (tini), SIGTERM erreicht Python direkt.
ENTRYPOINT ["python3", "-m", "lightshow"]
CMD []
