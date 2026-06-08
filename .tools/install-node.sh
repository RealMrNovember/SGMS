#!/usr/bin/env bash
# Node.js 20 — yalnızca sgms.cicibyte.com/.tools/node altına kurar.
# Başka dizinlere, sitelere veya global paketlere DOKUNMAZ.
#
# Usage:
#   bash .tools/install-node.sh

set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="${APP_ROOT}/.tools"
NODE_DIR="${TOOLS_DIR}/node"
NODE_VERSION="v20.20.1"
ARCHIVE="node-${NODE_VERSION}-linux-x64.tar.xz"
URL="https://nodejs.org/dist/${NODE_VERSION}/${ARCHIVE}"

if [[ -x "${NODE_DIR}/bin/node" ]]; then
  echo "Node already installed: $("${NODE_DIR}/bin/node" --version)"
else
  mkdir -p "${TOOLS_DIR}"
  tmpdir="$(mktemp -d "${TOOLS_DIR}/.tmp-node-XXXXXX")"
  cleanup() { rm -rf "${tmpdir}"; }
  trap cleanup EXIT

  echo "==> Downloading Node ${NODE_VERSION} into ${NODE_DIR}"
  curl -fsSL "${URL}" -o "${tmpdir}/${ARCHIVE}"
  tar -xJf "${tmpdir}/${ARCHIVE}" -C "${tmpdir}"
  rm -rf "${NODE_DIR}"
  mv "${tmpdir}/node-${NODE_VERSION}-linux-x64" "${NODE_DIR}"
  chmod -R a+rx "${NODE_DIR}"
fi

# pnpm (corepack — yalnızca proje Node'u)
"${NODE_DIR}/bin/corepack" enable
"${NODE_DIR}/bin/corepack" prepare pnpm@9.15.0 --activate
chmod -R a+rx "${NODE_DIR}"

echo "==> Ready: node $("${NODE_DIR}/bin/node" --version), pnpm $("${NODE_DIR}/bin/pnpm" --version)"
echo "    Path: ${NODE_DIR}/bin/node"
